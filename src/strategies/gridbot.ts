// grid bot strategy
import { BigNumber as BN } from 'bignumber.js';
import { ORDERSIDES } from '../core/constants';
import { BotConfig, GridBotPair, TradeOrder, TrackedOrder, TradingStrategy } from '../interfaces';
import { configValueToFloat, configValueToInt, getConfig, getLogger, getUsername } from '../utils';
import { TradingStrategyBase, OrderStateEntry } from './base';
import { fetchTokenBalance } from '../dexapi';
import { events } from '../events';
import fs from "fs";

const logFileName = './gridbot-logs-' + getUsername() + '.txt';

const logger = getLogger();
const config = getConfig();

function logItem(item: string | object, label?: string) {
  if (typeof item === 'object') {
    item = JSON.stringify(item, null, 2);
  }
  if (label) {
    item = `${label}: ${item}`;
  }
  fs.appendFileSync(logFileName, item + '\n\n');
}

/**
 * Grid Trading Bot Strategy
 * Grid Trading Bots are programs that allow users to automatically buy low and sell high within a pre-set price range.
 * The number of orders is determined by config values like limits, gridLevels, refer config/default.json
 */
export class GridBotStrategy extends TradingStrategyBase implements TradingStrategy {
  private oldOrders: TrackedOrder[][] = []
  private pairs: GridBotPair[] = [];

  async initialize(options?: BotConfig['gridBot']): Promise<void> {
    if (options) {
      this.pairs = this.parseEachPairConfig(options.pairs);
      this.pairs.forEach((_, i) => {
        this.oldOrders[i] = [];
      });

      // Recover tracked orders from disk
      const persisted = this.loadTrackedOrders();
      if (persisted.length > 0) {
        for (const order of persisted) {
          const pairIdx = this.pairs.findIndex(p => p.symbol === order.marketSymbol);
          if (pairIdx >= 0) {
            this.oldOrders[pairIdx].push(order);
          }
        }
        logger.info(`[GridBot] Recovered ${persisted.length} tracked orders from disk`);
      }
    }
  }

  async trade(): Promise<void> {
    const orderStateEntries: OrderStateEntry[] = [];

    for (var i = 0; i < this.pairs.length; i++) {
      try {
        console.log("Checking for trades");
        const marketSymbol = this.pairs[i].symbol;
        const marketDetails = await this.getMarketDetails(marketSymbol);
        const { market } = marketDetails;
        if (!market) {
          console.log('Invalid market');
          continue;
        }

        // Number of grid levels for the current pair
        const gridLevels = this.pairs[i].gridLevels;
        // Precision of the bid and ask tokens
        const bidPrecision = market.bid_token.precision;
        const askPrecision = market.ask_token.precision;

        // Last sale price of the market
        const lastSalePrice = new BN(marketDetails.price).toFixed(askPrecision);

        // Fetch open orders filtered to this instance's tracked IDs
        const trackedIds = new Set<string>(
          this.oldOrders[i].map(o => o.orderId).filter((id): id is string => id !== undefined)
        );
        const openOrders = await this.getOwnOpenOrders(marketSymbol, trackedIds);

        // Track order state for dashboard state file
        orderStateEntries.push({
          symbol: marketSymbol,
          orders: openOrders,
          expectedOrders: gridLevels,
        });
        // Upper and lower limit for trading within the current pair
        const upperLimit = new BN(
          this.pairs[i].upperLimit * 10 ** bidPrecision
        );
        const lowerLimit = new BN(
          this.pairs[i].lowerLimit * 10 ** bidPrecision
        );

        // How many tokens to buy/sell at each grid level
        const bidAmountPerLevel = new BN(this.pairs[i].bidAmountPerLevel);
        const gridSize = upperLimit.minus(lowerLimit).dividedBy(gridLevels);
        // Convert the grid size to the precision of the bid/ask token pair
        const gridPrice = gridSize
          .dividedBy(10 ** bidPrecision)
          .toFixed(askPrecision);
        let latestOrders = [];
        const username = getUsername();

        if (!this.oldOrders[i].length) {
          // Place orders on bot initialization
          let index = 0;
          let maxGrids = gridLevels;
          logger.info(`gridLevels ${gridLevels}, ${maxGrids}`);
          if (!maxGrids)
            continue;
          const priceTraded = new BN(lastSalePrice).times(10 ** bidPrecision);
          logger.info(`upperLimit ${upperLimit}, lowerLimit: ${lowerLimit}, priceTraded: ${priceTraded}`);

          // DEBUG: Log precision and grid calculations
          logger.info(`[DEBUG] ${marketSymbol} - bidPrecision: ${bidPrecision}, askPrecision: ${askPrecision}`);
          logger.info(`[DEBUG] ${marketSymbol} - lastSalePrice: ${lastSalePrice}, gridSize: ${gridSize.toString()}, gridPrice: ${gridPrice}`);
          logger.info(`[DEBUG] ${marketSymbol} - bidAmountPerLevel: ${bidAmountPerLevel.toString()}`);

          if (upperLimit.isGreaterThanOrEqualTo(priceTraded) && lowerLimit.isGreaterThanOrEqualTo(priceTraded)) maxGrids -= 1;
          if (upperLimit.isLessThanOrEqualTo(priceTraded) && lowerLimit.isLessThanOrEqualTo(priceTraded)) index = 1;

          logger.info(`[DEBUG] ${marketSymbol} - After bounds check: index=${index}, maxGrids=${maxGrids}`);

          var sellToken = 0;
          var buyToken = 0;
          let validOrderCount = 0;
          let invalidOrderCount = 0;

          for (; index <= maxGrids; index += 1) {
            const price = upperLimit
              .minus(gridSize.multipliedBy(index))
              .dividedBy(10 ** bidPrecision)
              .toFixed(askPrecision);
            const { quantity, adjustedTotal } = this.getQuantityAndAdjustedTotal(
              price,
              bidAmountPerLevel,
              bidPrecision,
              askPrecision
            );

            const priceDiff = Math.abs(parseFloat(price) - parseFloat(lastSalePrice));
            const minDiff = +gridPrice / 2;
            const validOrder = new BN(priceDiff).isGreaterThanOrEqualTo(minDiff);

            const validBuyOrder = new BN(
              (parseFloat(lastSalePrice) - parseFloat(price))
            ).isGreaterThan(0);

            const validSellOrder = new BN(
              (parseFloat(price) - parseFloat(lastSalePrice))
            ).isGreaterThan(0);

            // DEBUG: Log first few and any invalid orders
            if (index <= 3 || !validOrder) {
              logger.info(`[DEBUG] ${marketSymbol} grid[${index}] - price: ${price}, quantity: ${quantity}, adjustedTotal: ${adjustedTotal}`);
              logger.info(`[DEBUG] ${marketSymbol} grid[${index}] - priceDiff: ${priceDiff}, minDiff: ${minDiff}, validOrder: ${validOrder}, validBuy: ${validBuyOrder}, validSell: ${validSellOrder}`);
            }

            // Prepare orders and push into a list
            if (validOrder) {
              validOrderCount++;
              if (validSellOrder) {
                const order = {
                  orderSide: ORDERSIDES.SELL,
                  price: +price,
                  quantity: quantity,
                  marketSymbol,
                };
                sellToken += quantity;
                this.oldOrders[i].push(order);
              } else if (validBuyOrder) {
                const order = {
                  orderSide: ORDERSIDES.BUY,
                  price: +price,
                  quantity: adjustedTotal,
                  marketSymbol,
                };
                buyToken += adjustedTotal;
                this.oldOrders[i].push(order);
              }
            } else {
              invalidOrderCount++;
            }
          }

          logger.info(`[DEBUG] ${marketSymbol} - Loop complete: validOrders=${validOrderCount}, invalidOrders=${invalidOrderCount}, ordersToPlace=${this.oldOrders[i].length}`);

          const sellTotal = new BN(sellToken).toFixed(bidPrecision);
          const buyTotal = new BN(buyToken).toFixed(askPrecision);
          const sellBalances = await fetchTokenBalance(username, market.bid_token.contract, market.bid_token.code);
          const buyBalances = await fetchTokenBalance(username, market.ask_token.contract, market.ask_token.code);

          logger.info(`[DEBUG] ${marketSymbol} - sellTotal: ${sellTotal} (type: ${typeof sellTotal}), sellBalances: ${sellBalances} (type: ${typeof sellBalances})`);
          logger.info(`[DEBUG] ${marketSymbol} - buyTotal: ${buyTotal} (type: ${typeof buyTotal}), buyBalances: ${buyBalances} (type: ${typeof buyBalances})`);
          logger.info(`[DEBUG] ${marketSymbol} - String comparison: sellTotal > sellBalances = ${sellTotal > sellBalances}, buyTotal > buyBalances = ${buyTotal > buyBalances}`);
          logger.info(`[DEBUG] ${marketSymbol} - Numeric comparison: ${parseFloat(sellTotal)} > ${parseFloat(sellBalances)} = ${parseFloat(sellTotal) > parseFloat(sellBalances)}`);

          if (sellTotal > sellBalances || buyTotal > buyBalances) {
            const errorMsg = `LOW BALANCES - Current balance ${sellBalances} ${market.bid_token.code} - Expected ${sellTotal} ${market.bid_token.code}, Current balance ${buyBalances} ${market.ask_token.code} - Expected ${buyTotal} ${market.ask_token.code}`;
            logger.error(errorMsg);
            logger.info(` Overdrawn Balance - Not placing orders for ${market.bid_token.code}-${market.ask_token.code} `);

            // Emit balance low event
            events.balanceLow(errorMsg, {
              market: `${market.bid_token.code}-${market.ask_token.code}`,
              sellRequired: sellTotal,
              sellAvailable: sellBalances,
              buyRequired: buyTotal,
              buyAvailable: buyBalances,
            });
            continue;
          }

          logger.info(`[DEBUG] ${marketSymbol} - Passed balance check, checking order count: ${this.oldOrders[i].length} <= ${maxGrids} = ${this.oldOrders[i].length <= maxGrids}`);

          // Makesure to place only maxGrids order, as there is a possibility to place 1 additional order because of the non divisible configuration
          if (this.oldOrders[i].length <= maxGrids) {
            logger.info(`[DEBUG] ${marketSymbol} - Placing ${this.oldOrders[i].length} orders...`);
            await this.placeOrders(this.oldOrders[i]);
            this.oldOrders[i] = await this.resolveOrderIds(this.oldOrders[i], marketSymbol);
            logger.info(`[DEBUG] ${marketSymbol} - Orders placed successfully`);
          } else {
            logger.warn(`[DEBUG] ${marketSymbol} - SKIPPED: ordersToPlace (${this.oldOrders[i].length}) > maxGrids (${maxGrids})`);
          }
        } else if (openOrders.length > 0 && openOrders.length < gridLevels) {
          // compare open orders with old orders and place counter orders for the executed orders
          let currentOrders: TrackedOrder[] = openOrders.map((order) => ({
            orderSide: order.order_side,
            price: order.price,
            quantity: order.quantity_curr,
            marketSymbol,
            orderId: order.order_id,
          }));
          for (var j = 0; j < this.oldOrders[i].length; j++) {
            // Use order ID for fill detection when available, fall back to price
            const tracked = this.oldOrders[i][j];
            const newOrder = tracked.orderId
              ? openOrders.find(o => o.order_id === tracked.orderId)
              : openOrders.find(o => o.price === tracked.price);
            if (!newOrder) {
              const orderSideStr = this.oldOrders[i][j].orderSide == ORDERSIDES.BUY ? "BUY" : (this.oldOrders[i][j].orderSide == ORDERSIDES.SELL ? "SELL" : "INVALID");
              const buySellString = "Completed " + orderSideStr + " order for " + this.oldOrders[i][j].quantity + " " + this.oldOrders[i][j].marketSymbol + " at " + this.oldOrders[i][j].price;
              logger.info(buySellString);

              // Emit order filled event
              events.orderFilled(buySellString, {
                market: this.oldOrders[i][j].marketSymbol,
                side: orderSideStr,
                quantity: this.oldOrders[i][j].quantity,
                price: this.oldOrders[i][j].price,
              });

              // Emit both-legs trade to dashboard /api/trades
              this.emitFillAsTrade(
                {
                  orderId: tracked.orderId ?? `${marketSymbol}-${tracked.price}-${tracked.orderSide}`,
                  orderSide: tracked.orderSide,
                  orderType: 0, // gridbot places limit orders
                  marketId: market.market_id,
                  accountName: this.username,
                  price: tracked.price,
                  quantityInit: tracked.quantity,
                  quantityFilled: tracked.quantity,
                  filledTotal: null,
                  filledAmount: null,
                  filledFee: null,
                  finalStatus: 'filled',
                  isFullyFilled: true,
                  orderCreatedAt: tracked.placedAt ?? new Date().toISOString(),
                  orderCompletedAt: new Date().toISOString(),
                },
                {
                  marketId: market.market_id,
                  symbol: marketSymbol,
                  baseToken: market.bid_token?.code ?? '',
                  quoteToken: market.ask_token?.code ?? '',
                  makerFee: Number(market.maker_fee ?? 0),
                  takerFee: Number(market.taker_fee ?? 0),
                },
                {
                  mode: this.mockEngine ? 'paper' : 'live',
                  txId: tracked.orderId ?? `${marketSymbol}-${tracked.price}-${tracked.orderSide}`,
                },
              ).catch(err => logger.warn('[trades] emitFillAsTrade error:', err));

              if (this.oldOrders[i][j].orderSide === ORDERSIDES.BUY) {
                const lowestAsk = this.getLowestAsk(currentOrders);
                var sellPrice;
                // Place a counter sell order for the executed buy order
                if (!lowestAsk || config.gridPlacement)
                  sellPrice = new BN(this.oldOrders[i][j].price)
                    .plus(gridPrice)
                    .toFixed(askPrecision);
                else
                  sellPrice = new BN(lowestAsk)
                    .minus(gridPrice)
                    .toFixed(askPrecision);
                const { quantity } = this.getQuantityAndAdjustedTotal(
                  sellPrice,
                  bidAmountPerLevel,
                  bidPrecision,
                  askPrecision
                );
                const order = {
                  orderSide: ORDERSIDES.SELL,
                  price: +sellPrice,
                  quantity: quantity,
                  marketSymbol,
                };

                latestOrders.push(order);
                currentOrders.push(order);
              } else if (this.oldOrders[i][j].orderSide === ORDERSIDES.SELL) {
                const highestBid = this.getHighestBid(currentOrders);
                // Place a counter buy order for the executed sell order
                var buyPrice;
                if (!highestBid || config.gridPlacement)
                  buyPrice = new BN(this.oldOrders[i][j].price)
                    .minus(gridPrice)
                    .toFixed(askPrecision);
                else
                  buyPrice = new BN(highestBid)
                    .plus(gridPrice)
                    .toFixed(askPrecision);
                const { adjustedTotal } = this.getQuantityAndAdjustedTotal(
                  buyPrice,
                  bidAmountPerLevel,
                  bidPrecision,
                  askPrecision
                );
                const order = {
                  orderSide: ORDERSIDES.BUY,
                  price: +buyPrice,
                  quantity: adjustedTotal,
                  marketSymbol,
                };

                latestOrders.push(order);
                currentOrders.push(order);
              }
            }
          }
          await this.placeOrders(latestOrders);
          // Resolve IDs for the newly placed counter orders
          const resolvedLatest = await this.resolveOrderIds(latestOrders, marketSymbol);
          // Merge resolved IDs back into currentOrders
          for (const resolved of resolvedLatest) {
            const idx = currentOrders.findIndex(o => o.price === resolved.price && o.orderSide === resolved.orderSide && !o.orderId);
            if (idx >= 0) {
              currentOrders[idx] = resolved;
            }
          }
          // Update old orders for next round of inspection
          this.oldOrders[i] = currentOrders;
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(errorMsg);
        events.botError(`GridBot error: ${errorMsg}`, { error: errorMsg });
      }
    }

    // Persist tracked orders for crash recovery
    this.persistAllTrackedOrders();

    this.writeOrderState(orderStateEntries);
  }

  async cancelOwnOrders(): Promise<void> {
    const allTracked: TrackedOrder[] = this.oldOrders.flat();
    if (allTracked.length > 0) {
      logger.info(`[GridBot] Cancelling ${allTracked.length} tracked orders on shutdown`);
      await this.cancelTrackedOrders(allTracked);
    }
    this.cleanupTrackedOrdersFile();
  }

  private persistAllTrackedOrders(): void {
    const allTracked: TrackedOrder[] = this.oldOrders.flat();
    this.saveTrackedOrders('gridbot', allTracked);
  }

  private parseEachPairConfig(pairs: BotConfig['gridBot']['pairs']): GridBotPair[] {
    const result: GridBotPair[] = [];

    pairs.forEach((pair, idx) => {
      if (pair.symbol === undefined) {
        throw new Error(
          `Market symbol option is missing for gridBot pair with index ${idx} in default.json`
        );
      }

      if (
        pair.upperLimit === undefined ||
        pair.lowerLimit === undefined ||
        pair.gridLevels === undefined ||
        pair.bidAmountPerLevel === undefined
      ) {
        throw new Error(
          `Options are missing for market or gridBot pair ${pair.symbol} in default.json`
        );
      }

      result.push({
        symbol: pair.symbol,
        upperLimit: configValueToFloat(pair.upperLimit),
        lowerLimit: configValueToFloat(pair.lowerLimit),
        gridLevels: configValueToInt(pair.gridLevels),
        bidAmountPerLevel: configValueToFloat(pair.bidAmountPerLevel),
      });
    });
    return result;
  }

  /**
    * Given a price and total cost return a quantity value. Use precision values in the bid and ask
    * currencies, and return an adjusted total to account for losses during rounding. The adjustedTotal
    * value is used for buy orders
    */
  private getQuantityAndAdjustedTotal(price: BN | string, totalCost: BN, bidPrecision: number, askPrecision: number): {
    quantity: number;
    adjustedTotal: number;
  } {
    const adjustedTotal = +new BN(totalCost).times(price).toFixed(askPrecision);
    const quantity = +new BN(adjustedTotal).dividedBy(price).toFixed(bidPrecision);
    return {
      quantity,
      adjustedTotal,
    };
  }

  private getHighestBid(orders: TradeOrder[]): BN | null {
    const buyOrders = orders.filter((order) => order.orderSide === ORDERSIDES.BUY);
    if (buyOrders.length === 0) return null;

    buyOrders.sort((orderA, orderB): number => {
      if (BN(orderA.price).isGreaterThan(BN(orderB.price))) return -1;
      if (BN(orderA.price).isLessThan(BN(orderB.price))) return 1;
      return 0
    });

    const highestBid = new BN(buyOrders[0].price);
    return highestBid;
  }

  private getLowestAsk(orders: TradeOrder[]): BN | null {
    const sellOrders = orders.filter((order) => order.orderSide === ORDERSIDES.SELL);
    if (sellOrders.length === 0) return null;

    sellOrders.sort((orderA, orderB): number => {
      if (BN(orderA.price).isGreaterThan(BN(orderB.price))) return 1;
      if (BN(orderA.price).isLessThan(BN(orderB.price))) return -1;
      return 0;
    });

    const lowestAsk = new BN(sellOrders[0].price);
    return lowestAsk;
  }
}
