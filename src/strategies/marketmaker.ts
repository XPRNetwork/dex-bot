// a basic market maker strategy
import { Market, OrderHistory } from '@proton/wrap-constants';
import { BigNumber as BN } from 'bignumber.js';
import { ORDERSIDES } from '../core/constants';
import { BotConfig, MarketMakerPair, TradeOrder, TradingStrategy } from '../interfaces';
import { getLogger } from '../utils';
import { MarketDetails, TradingStrategyBase } from './base';
import { fetchTokenBalance } from '../dexapi';

const logger = getLogger();

/**
 * Market Making Trading Strategy
 * The goal is to always have some buy and some sell side orders on the books.
 * The number of orders is determined by config value gridLevels, see config/default.json
 * The orders should be maker orders.
 */
export class MarketMakerStrategy extends TradingStrategyBase implements TradingStrategy {
  private pairs: MarketMakerPair[] = [];

  async initialize(options?: BotConfig['marketMaker']): Promise<void> {
    if(options) {
      this.pairs = options.pairs;
    }
  }
 
  async trade() {
    for (let i = 0; i < this.pairs.length; ++i) {
      logger.info(`Checking ${this.pairs[i].symbol} market maker orders on account ${this.username}`);

      try {
        const openOrders = await this.getOpenOrders(this.pairs[i].symbol);

        // any orders to place?
        const gridLevels = new BN(this.getGridLevels(this.pairs[i].symbol));
        const buys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY);
        const sells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL);
        if (buys.length >= gridLevels.toNumber() && sells.length >= gridLevels.toNumber()) {
          logger.info(`No change - there are enough orders(as per the grid levels in config) on the orderbook for ${this.pairs[i].symbol}`);
          continue;
        }

        const marketDetails = await this.getMarketDetails(this.pairs[i].symbol);
        const preparedOrders = await this.prepareOrders(this.pairs[i].symbol, marketDetails, openOrders);
        await this.placeOrders(preparedOrders, 100);
      } catch (error) {
        logger.error((error as Error).message);
      }
    }
  }

  /**
   * Given a price and total cost return a quantity value. Use precision values in the bid and ask
   * currencies, and return an adjusted total to account for losses during rounding. The adjustedTotal
   * value is used for buy orders
   */
  private getQuantityAndAdjustedTotal(price: BN | string, totalCost: BN | string | number, bidPrecision: number, askPrecision: number): {
    quantity: number;
    adjustedTotal: number;
  } {
    const quantity = +new BN(totalCost).dividedBy(price).toFixed(bidPrecision, BN.ROUND_UP);
    const adjustedTotal = +new BN(price).times(quantity).toFixed(askPrecision, BN.ROUND_UP);
    return {
      adjustedTotal,
      quantity,
    };
  }

  private getBidAmountPerLevel(marketSymbol: string) {
    let bidAmountPerLevel;

    this.pairs.forEach((pair) => {
      if (marketSymbol === pair.symbol){
        bidAmountPerLevel = pair.bidAmountPerLevel;
      }
    })

    if (bidAmountPerLevel === undefined) {
      throw new Error(`Bid Amount option is missing for market ${marketSymbol} in default.json`);
    }
  
    return bidAmountPerLevel;
  }  

  private getGridInterval(marketSymbol: string) {
    let interval;

    this.pairs.forEach((pair) => {
      if (marketSymbol === pair.symbol){
        interval = pair.gridInterval;
      }
    })

    if (interval === undefined) {
      throw new Error(`GridInterval option is missing for market ${marketSymbol} in default.json`);
    }
  
    return interval;
  }

  private getGridLevels(marketSymbol: string) {
    let levels;
    this.pairs.forEach((pair) => {
      if (marketSymbol === pair.symbol){
        levels = pair.gridLevels;
      } 
    });
  
    if (levels === undefined) {
      throw new Error(`GridLevels option is missing for market ${marketSymbol} in default.json`);
    }
  
    return levels;
  }

  // prepare the orders we want to have on the books
  private async prepareOrders(marketSymbol: string, marketDetails: MarketDetails, openOrders: OrderHistory[]): Promise<TradeOrder[]> {
    const { market } = marketDetails;
    if (market === undefined) {
      throw new Error(`Market ${marketSymbol} does not exist`);
    }
    const orders: TradeOrder[] = [];
    let numBuys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY).length;
    let numSells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL).length;

    const levels = new BN(this.getGridLevels(marketSymbol));
    const side = this.getGridOrderSide(marketSymbol);
    const levelsN = levels.toNumber();
    var sellToken = 0;
    var buyToken = 0;
    for (let index = 0; index < levelsN; index += 1) {
      // buy order
      if ((numBuys < levelsN) && ((side === 'BOTH') || (side === 'BUY'))) {
        const order = this.createBuyOrder(marketSymbol, marketDetails, index);
        if(order){
          orders.push(order);
          buyToken += order.quantity;
        }
        numBuys += 1;
      }

      // sell order
      if ((numSells < levelsN) && ((side === 'BOTH') || (side === 'SELL'))) {
        const order = this.createSellOrder(marketSymbol, marketDetails, index);
        if(order) {
          orders.push(order);
          sellToken += order.quantity;
        }
        numSells += 1;
      }
    }

    const sellTotal = new BN(sellToken).toFixed(market.bid_token.precision);
    const buyTotal = new BN(buyToken).toFixed(market.ask_token.precision);
    const sellBalances  = await fetchTokenBalance(this.username, market.bid_token.contract, market.bid_token.code);
    const buyBalances = await fetchTokenBalance(this.username, market.ask_token.contract, market.ask_token.code);
    if(sellTotal > sellBalances || buyTotal > buyBalances) {
      logger.error(`LOW BALANCES - Current balance ${sellBalances} ${market.bid_token.code} - Expected ${sellTotal} ${market.bid_token.code}
                    Current balance ${buyBalances} ${market.ask_token.code} - Expected ${buyTotal} ${market.ask_token.code}`);
      process.exit();
    }

    return orders;
  }

  private getGridOrderSide(marketSymbol: string) {
    let side;
    this.pairs.forEach((pair) => {
      if (marketSymbol === pair.symbol){
        side =pair.orderSide;
      } 
    });

    if (side === undefined) {
      throw new Error(`OrderSide option is missing for market ${marketSymbol} in default.json`);
    }
  
    return side;
  }
  
  private createBuyOrder(marketSymbol: string, marketDetails: MarketDetails, index: number): TradeOrder | undefined {
    const { market } = marketDetails;
    if(!market) {
      return undefined;
    }
    const askPrecision = market.ask_token.precision;
    const bidPrecision = market.bid_token.precision;
    const bigMinSpread = new BN(this.getGridInterval(marketSymbol));
    const pair = this.pairs.find(p => p.symbol === marketSymbol);
    if (!pair) {
        return undefined;
    }
    const bidAmountPerLevel = new BN(pair.bidAmountPerLevel);
    
  
    const lastSalePrice = new BN(marketDetails.price);
    const lowestAsk = new BN(marketDetails.lowestAsk);
    const highestBid = new BN(marketDetails.highestBid);
    const base = new String(this.getBase(marketSymbol));
    const avgPrice = lowestAsk.plus(highestBid).dividedBy(2);
    let startPrice;
  
    switch (base) {
      case 'BID':
        startPrice = highestBid;
        break;
      case 'ASK':
        startPrice = lowestAsk;
        break;
      case 'LAST':
        startPrice = lastSalePrice;
        break;
      case 'AVERAGE':
      default:
        startPrice = avgPrice;
        break;
    }
  
    const buyPrice = (bigMinSpread.times(0 - (index + 1)).plus(1))
      .times(startPrice).decimalPlaces(askPrecision, BN.ROUND_DOWN);
    const { adjustedTotal } = this.getQuantityAndAdjustedTotal(
      buyPrice,
      bidAmountPerLevel,
      bidPrecision,
      askPrecision,
    );
  
    const order = {
      orderSide: ORDERSIDES.BUY,
      price: +buyPrice,
      quantity: adjustedTotal,
      marketSymbol,
    };
    return order;
  };
  
  private createSellOrder(marketSymbol: string, marketDetails: MarketDetails, index: number): TradeOrder | undefined {
    const { market } = marketDetails;
    if(!market) {
      return undefined;
    }
    const askPrecision = market.ask_token.precision;
    const bidPrecision = market.bid_token.precision;
    const bigMinSpread = new BN(this.getGridInterval(marketSymbol));
    const pair = this.pairs.find(p => p.symbol === marketSymbol);
    if (!pair) {
        return undefined;
    }
    const bidAmountPerLevel = new BN(pair.bidAmountPerLevel);
  
    const lastSalePrice = new BN(marketDetails.price);
    const lowestAsk = new BN(marketDetails.lowestAsk);
    const highestBid = new BN(marketDetails.highestBid);
    const base = new String(this.getBase(marketSymbol));
    const avgPrice = lowestAsk.plus(highestBid).dividedBy(2);
    let startPrice;
  
    switch (base) {
      case 'BID':
        startPrice = highestBid;
        break;
      case 'ASK':
        startPrice = lowestAsk;
        break;
      case 'LAST':
        startPrice = lastSalePrice;
        break;
      default:
        startPrice = avgPrice;
        break;
    }
  
    const sellPrice = (bigMinSpread.times(0 + (index + 1)).plus(1))
      .times(startPrice).decimalPlaces(askPrecision, BN.ROUND_UP);
    const { quantity } = this.getQuantityAndAdjustedTotal(
      sellPrice,
      bidAmountPerLevel,
      bidPrecision,
      askPrecision,
    );
  
    const order = {
      orderSide: ORDERSIDES.SELL,
      price: +sellPrice,
      quantity,
      marketSymbol,
    };
  
    return order;
  }

  private getBase(marketSymbol: string) {
    let type;
    this.pairs.forEach((pair) => {
      if (marketSymbol === pair.symbol){
        type = pair.base;
      } 
    });
  
    if (type === undefined) {
      throw new Error(`Base option is missing for market ${marketSymbol} in default.json`);
    }
  
    return type;
  }
}

