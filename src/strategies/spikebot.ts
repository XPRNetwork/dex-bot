// spike bot strategy
import { BigNumber as BN } from 'bignumber.js';
import { ORDERSIDES } from '../core/constants';
import { BotConfig, SpikeBotPair, TradeOrder, TrackedOrder, TradingStrategy } from '../interfaces';
import { getLogger, getUsername } from '../utils';
import { TradingStrategyBase, OrderStateEntry } from './base';
import * as dexrpc from '../dexrpc';
import { events } from '../events';
import { Market } from '@proton/wrap-constants';

const logger = getLogger();

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface PairState {
  config: SpikeBotPair;
  priceHistory: number[];
  currentMA: number;
  lastOrderMA: number;
  spikeOrders: TrackedOrder[];
  takeProfitOrders: TrackedOrder[];
  heldRecoveryOrders: TrackedOrder[];
}

/**
 * Spike Bot Strategy
 * Catches brief price spikes by pre-placing limit orders at extreme deviation levels from a moving average.
 * Resting orders on the order book get matched by the DEX engine instantly, avoiding the need for polling-based detection.
 */
export class SpikeBotStrategy extends TradingStrategyBase implements TradingStrategy {
  private pairStates: PairState[] = [];
  private maWindow: number = 20;
  private rebalanceThresholdPct: number = 1.0;
  private maxReboundCycles: number = 20;
  private reboundStepPct: number = 0.5;

  async initialize(options?: BotConfig['spikeBot']): Promise<void> {
    if (options) {
      this.maWindow = options.maWindow;
      this.rebalanceThresholdPct = options.rebalanceThresholdPct;
      this.maxReboundCycles = options.maxReboundCycles ?? 20;
      this.reboundStepPct = options.reboundStepPct ?? 0.5;
      this.pairStates = options.pairs.map(pair => ({
        config: pair,
        priceHistory: [],
        currentMA: 0,
        lastOrderMA: 0,
        spikeOrders: [],
        takeProfitOrders: [],
        heldRecoveryOrders: [],
      }));

      // Recover tracked orders from disk
      const persisted = this.loadTrackedOrders();
      if (persisted.length > 0 && this.pairStates.length > 0) {
        // Distribute loaded orders back to their pair states by marketSymbol
        for (const order of persisted) {
          const pairState = this.pairStates.find(s => s.config.symbol === order.marketSymbol);
          if (!pairState) continue;
          const type = (order as any)._type;
          if (type === 'takeProfit') {
            pairState.takeProfitOrders.push(order);
          } else if (type === 'held') {
            pairState.heldRecoveryOrders.push(order);
          } else {
            pairState.spikeOrders.push(order);
          }
        }
        logger.info(`[SpikeBot] Recovered ${persisted.length} tracked orders from disk`);
      }
    }
  }

  async trade(): Promise<void> {
    const orderStateEntries: OrderStateEntry[] = [];

    for (const state of this.pairStates) {
      try {
        const symbol = state.config.symbol;
        const market = this.dexAPI.getMarketBySymbol(symbol);
        if (!market) {
          logger.error(`[SpikeBot] Invalid market: ${symbol}`);
          continue;
        }

        // 1. Fetch latest price and update rolling window
        const latestPrice = await this.dexAPI.fetchLatestPrice(symbol);
        state.priceHistory.push(latestPrice);
        if (state.priceHistory.length > this.maWindow) {
          state.priceHistory.shift();
        }

        // 2. Calculate MA - skip if not enough data
        if (state.priceHistory.length < this.maWindow) {
          logger.info(`[SpikeBot] ${symbol} warming up: ${state.priceHistory.length}/${this.maWindow} data points`);
          continue;
        }
        state.currentMA = this.calculateMA(state.priceHistory);
        logger.info(`[SpikeBot] ${symbol} - Price: ${latestPrice}, MA: ${state.currentMA.toFixed(market.ask_token.precision)}`);

        // 3. Fetch open orders (filtered to this instance's tracked IDs)
        const allTracked = [...state.spikeOrders, ...state.takeProfitOrders, ...state.heldRecoveryOrders];
        const trackedIds = new Set<string>(
          allTracked.map(o => o.orderId).filter((id): id is string => id !== undefined)
        );
        const openOrders = await this.getOwnOpenOrders(symbol, trackedIds);

        const recoveryForState: import('./base').RecoveryOrderState[] = [
          ...state.takeProfitOrders
            .filter(o => o.entryPrice !== undefined && o.cyclesSincePlace !== undefined)
            .map(o => ({
              side: (o.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
              price: o.price,
              entryPrice: o.entryPrice!,
              originalTargetPrice: o.originalTargetPrice ?? o.price,
              cyclesSincePlace: o.cyclesSincePlace!,
              phase: (o.cyclesSincePlace! > this.maxReboundCycles ? 'adjusting' : 'patience') as 'patience' | 'adjusting' | 'held',
            })),
          ...state.heldRecoveryOrders
            .filter(o => o.entryPrice !== undefined)
            .map(o => ({
              side: (o.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
              price: o.price,
              entryPrice: o.entryPrice!,
              originalTargetPrice: o.originalTargetPrice ?? o.price,
              cyclesSincePlace: o.cyclesSincePlace ?? 0,
              phase: 'held' as const,
              heldSince: o.heldSince,
            })),
        ];

        const recoveryPool = [...state.takeProfitOrders, ...state.heldRecoveryOrders];
        const notionalLocked = recoveryPool.reduce(
          (s, o) => s + o.price * o.quantity, 0,
        );

        const entryPool = recoveryPool.filter(o => o.entryPrice !== undefined);
        const entryQty = entryPool.reduce((s, o) => s + o.quantity, 0);
        const avgEntryPrice = entryQty > 0
          ? entryPool.reduce((s, o) => s + o.entryPrice! * o.quantity, 0) / entryQty
          : null;
        const entryDriftPct = avgEntryPrice !== null
          ? (state.currentMA - avgEntryPrice) / avgEntryPrice * 100
          : null;

        const patienceCount = state.takeProfitOrders.filter(
          o => (o.cyclesSincePlace ?? 0) <= this.maxReboundCycles,
        ).length;
        const adjustingCount = state.takeProfitOrders.filter(
          o => (o.cyclesSincePlace ?? 0) > this.maxReboundCycles,
        ).length;

        orderStateEntries.push({
          symbol,
          orders: openOrders,
          expectedOrders: state.takeProfitOrders.length > 0
            ? state.takeProfitOrders.length
            : state.config.levels * 2,
          recoveryOrders: recoveryForState.length > 0 ? recoveryForState : undefined,
          breakdown: {
            spike: state.spikeOrders.length,
            patience: patienceCount,
            adjusting: adjustingCount,
            held: state.heldRecoveryOrders.length,
            avgEntryPrice,
            entryDriftPct,
            notionalLocked,
          },
        });

        // Snapshot take-profit orders before step 4 so that newly placed TPs
        // are not immediately checked for fill in step 5 of the same cycle.
        const existingTakeProfitOrders = [...state.takeProfitOrders];

        // 4. Fill detection - spike orders
        if (state.spikeOrders.length > 0) {
          const newOrders: TradeOrder[] = [];
          const remainingSpike: TrackedOrder[] = [];

          for (const tracked of state.spikeOrders) {
            // Use order ID for fill detection when available, fall back to price+side
            const stillOpen = tracked.orderId
              ? openOrders.find(o => o.order_id === tracked.orderId)
              : openOrders.find(o => o.price === tracked.price && o.order_side === tracked.orderSide);

            if (!stillOpen) {
              // Spike order was filled
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              const fillMsg = `[SpikeBot] Filled ${sideStr} spike at ${tracked.price} for ${symbol}`;
              logger.info(fillMsg);
              events.orderFilled(fillMsg, {
                market: symbol,
                side: sideStr,
                quantity: tracked.quantity,
                price: tracked.price,
              });

              // Place take-profit counter-order at MA
              const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
              (tpOrder as any).entryPrice = tracked.price;
              (tpOrder as any).cyclesSincePlace = 0;
              (tpOrder as any).originalTargetPrice = state.currentMA;
              newOrders.push(tpOrder);
            } else {
              remainingSpike.push(tracked);
            }
          }

          if (newOrders.length > 0) {
            await this.placeOrders(newOrders);
            const resolvedTP = await this.resolveOrderIds(newOrders, symbol);
            state.takeProfitOrders.push(...resolvedTP);
          }
          state.spikeOrders = remainingSpike;
        }

        // 5. Fill detection - take-profit orders (only orders that existed before this cycle)
        if (existingTakeProfitOrders.length > 0) {
          const survivingExistingTP: TrackedOrder[] = [];

          for (const tracked of existingTakeProfitOrders) {
            const stillOpen = tracked.orderId
              ? openOrders.find(o => o.order_id === tracked.orderId)
              : openOrders.find(o => o.price === tracked.price && o.order_side === tracked.orderSide);

            if (!stillOpen) {
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              logger.info(`[SpikeBot] Take-profit ${sideStr} filled at ${tracked.price} for ${symbol}`);
              events.orderFilled(`[SpikeBot] Take-profit ${sideStr} filled at ${tracked.price}`, {
                market: symbol,
                side: sideStr,
                quantity: tracked.quantity,
                price: tracked.price,
              });
            } else {
              survivingExistingTP.push(tracked);
            }
          }
          // Reconstruct: surviving pre-existing TPs + any newly placed TPs from this cycle
          const newlyPlacedTP = state.takeProfitOrders.filter(
            o => !existingTakeProfitOrders.includes(o)
          );
          state.takeProfitOrders = [...survivingExistingTP, ...newlyPlacedTP];
        }

        // 5b. Tiered recovery — increment cycle counters for pre-existing unfilled take-profit orders
        // (newly placed TPs this cycle start at 0 and are not incremented until next cycle)
        for (const tracked of existingTakeProfitOrders) {
          const stillInState = state.takeProfitOrders.includes(tracked);
          if (stillInState && tracked.cyclesSincePlace !== undefined) {
            tracked.cyclesSincePlace++;
          }
        }

        // 5c. Tiered recovery — Phase 2: gradual adjustment after patience expires
        const adjustedTP: TrackedOrder[] = [];
        let tpOrdersChanged = false;

        for (const tracked of state.takeProfitOrders) {
          if (
            tracked.cyclesSincePlace !== undefined &&
            tracked.entryPrice !== undefined &&
            tracked.cyclesSincePlace > this.maxReboundCycles
          ) {
            const currentPrice = tracked.price;
            let candidatePrice: number;

            if (tracked.orderSide === ORDERSIDES.SELL) {
              if (state.currentMA >= tracked.price) {
                // MA is at or above TP — price will likely come up to fill, skip adjustment
                adjustedTP.push(tracked);
                continue;
              }
              candidatePrice = currentPrice - (currentPrice * this.reboundStepPct / 100);
            } else {
              if (state.currentMA <= tracked.price) {
                // MA is at or below TP — price will likely come down to fill, skip adjustment
                adjustedTP.push(tracked);
                continue;
              }
              candidatePrice = currentPrice + (currentPrice * this.reboundStepPct / 100);
            }

            // Hard floor check: never cross entry price — hold in place instead of cancelling
            if (tracked.orderSide === ORDERSIDES.SELL && candidatePrice <= tracked.entryPrice) {
              tracked.heldSince = new Date().toISOString();
              state.heldRecoveryOrders.push(tracked);
              logger.info(`[SpikeBot] Holding SELL take-profit for ${symbol} at ${currentPrice.toFixed(market.ask_token.precision)} — next step ${candidatePrice.toFixed(market.ask_token.precision)} would cross entry ${tracked.entryPrice}`);
              events.orderHeld(`[SpikeBot] Held SELL TP at ${currentPrice.toFixed(market.ask_token.precision)} — would cross entry`, {
                market: symbol,
                side: 'SELL',
                price: currentPrice,
                entryPrice: tracked.entryPrice,
                candidatePrice,
              });
              tpOrdersChanged = true;
              continue;
            }
            if (tracked.orderSide === ORDERSIDES.BUY && candidatePrice >= tracked.entryPrice) {
              tracked.heldSince = new Date().toISOString();
              state.heldRecoveryOrders.push(tracked);
              logger.info(`[SpikeBot] Holding BUY take-profit for ${symbol} at ${currentPrice.toFixed(market.ask_token.precision)} — next step ${candidatePrice.toFixed(market.ask_token.precision)} would cross entry ${tracked.entryPrice}`);
              events.orderHeld(`[SpikeBot] Held BUY TP at ${currentPrice.toFixed(market.ask_token.precision)} — would cross entry`, {
                market: symbol,
                side: 'BUY',
                price: currentPrice,
                entryPrice: tracked.entryPrice,
                candidatePrice,
              });
              tpOrdersChanged = true;
              continue;
            }

            // Cancel old order, place new one at adjusted price
            if (tracked.orderId) {
              try {
                await dexrpc.cancelOrder(String(tracked.orderId));
                await dexrpc.withdrawAll();
                await delay(2000);
              } catch (error) {
                logger.error(`[SpikeBot] Failed to cancel TP order ${tracked.orderId}: ${(error as Error).message}`);
                adjustedTP.push(tracked);
                continue;
              }
            }

            // Build replacement TP order at the adjusted price
            // filledSide is the OPPOSITE of TP side (BUY spike -> SELL TP, so filledSide=BUY)
            const filledSide = tracked.orderSide === ORDERSIDES.SELL ? ORDERSIDES.BUY : ORDERSIDES.SELL;
            const adjustedOrder = this.buildTakeProfitOrder(
              symbol, candidatePrice, filledSide, state.config.orderAmount, market
            );

            await this.placeOrders([adjustedOrder]);
            const resolved = await this.resolveOrderIds([adjustedOrder], symbol);
            if (resolved.length > 0) {
              const newTracked = resolved[0];
              newTracked.entryPrice = tracked.entryPrice;
              newTracked.cyclesSincePlace = tracked.cyclesSincePlace;
              newTracked.originalTargetPrice = tracked.originalTargetPrice;
              adjustedTP.push(newTracked);
            }

            const oldPriceStr = currentPrice.toFixed(market.ask_token.precision);
            const newPriceStr = candidatePrice.toFixed(market.ask_token.precision);
            const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
            logger.info(`[SpikeBot] Adjusted ${sideStr} take-profit: ${oldPriceStr} -> ${newPriceStr} (cycle ${tracked.cyclesSincePlace})`);
            events.gridAdjusted(`[SpikeBot] Adjusted ${sideStr} TP: ${oldPriceStr} -> ${newPriceStr}`, {
              market: symbol,
              side: sideStr,
              oldPrice: currentPrice,
              newPrice: candidatePrice,
              cycles: tracked.cyclesSincePlace,
            });
            tpOrdersChanged = true;
          } else {
            adjustedTP.push(tracked);
          }
        }

        if (tpOrdersChanged) {
          state.takeProfitOrders = adjustedTP;
        }

        // 5d. Held recovery — fill detection.
        // Orders that were moved to heldRecoveryOrders earlier in this cycle were NOT
        // cancelled, so they remain in openOrders and will not falsely register as filled.
        if (state.heldRecoveryOrders.length > 0) {
          const surviving: TrackedOrder[] = [];
          for (const tracked of state.heldRecoveryOrders) {
            const stillOpen = tracked.orderId
              ? openOrders.find(o => o.order_id === tracked.orderId)
              : openOrders.find(o => o.price === tracked.price && o.order_side === tracked.orderSide);

            if (!stillOpen) {
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              logger.info(`[SpikeBot] Held recovery ${sideStr} filled at ${tracked.price} for ${symbol}`);
              events.orderFilled(`[SpikeBot] Held recovery ${sideStr} filled at ${tracked.price}`, {
                market: symbol,
                side: sideStr,
                quantity: tracked.quantity,
                price: tracked.price,
              });
            } else {
              surviving.push(tracked);
            }
          }
          state.heldRecoveryOrders = surviving;
        }

        // After hold-in-place: exclude held order IDs from openOrders so that
        // steps 6 and 7 do not attempt to cancel on-chain orders we intentionally kept live.
        const heldIds = new Set(state.heldRecoveryOrders.map(o => o.orderId).filter(Boolean));
        const activeOpenOrders = heldIds.size > 0
          ? openOrders.filter(o => !heldIds.has(String(o.order_id)))
          : openOrders;

        // 6. MA drift check - rebalance if MA shifted beyond threshold
        let rebalanced = false;
        if (state.lastOrderMA > 0 && (state.spikeOrders.length > 0 || state.takeProfitOrders.length > 0)) {
          const driftPct = Math.abs(state.currentMA - state.lastOrderMA) / state.lastOrderMA * 100;
          if (driftPct > this.rebalanceThresholdPct) {
            logger.info(`[SpikeBot] ${symbol} MA drift ${driftPct.toFixed(2)}% exceeds threshold ${this.rebalanceThresholdPct}% - rebalancing`);
            await this.cancelPairOrders(symbol, activeOpenOrders);
            await dexrpc.withdrawAll();
            await delay(2000);
            state.spikeOrders = [];
            state.takeProfitOrders = [];
            rebalanced = true;
            // Fall through to initial placement below
          }
        }

        // 7. Initial placement (no tracked spike orders & MA ready)
        if (state.spikeOrders.length === 0 && state.takeProfitOrders.length === 0) {
          // Cancel any stale on-chain orders from a previous run and withdraw funds
          // Skip if we just rebalanced (orders already cancelled in step 6)
          if (!rebalanced && activeOpenOrders.length > 0) {
            logger.info(`[SpikeBot] ${symbol} clearing ${activeOpenOrders.length} stale orders before fresh placement`);
            await this.cancelPairOrders(symbol, activeOpenOrders);
            await dexrpc.withdrawAll();
            await delay(2000);
          }

          const spikeOrders = this.buildSpikeOrders(symbol, state.currentMA, state.config, market);
          if (spikeOrders.length > 0) {
            logger.info(`[SpikeBot] ${symbol} placing ${spikeOrders.length} spike orders around MA ${state.currentMA.toFixed(market.ask_token.precision)}`);
            await this.placeOrders(spikeOrders);
            state.spikeOrders = await this.resolveOrderIds(spikeOrders, symbol);
            state.lastOrderMA = state.currentMA;
          }
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        logger.error(`[SpikeBot] Error for ${state.config.symbol}: ${errorMsg}`);
        events.botError(`SpikeBot error: ${errorMsg}`, { error: errorMsg });
      }
    }

    // Persist tracked orders for crash recovery
    this.persistAllTrackedOrders();

    this.writeOrderState(orderStateEntries);
  }

  async cancelOwnOrders(): Promise<void> {
    const allTracked: TrackedOrder[] = [];
    for (const state of this.pairStates) {
      allTracked.push(...state.spikeOrders, ...state.takeProfitOrders, ...state.heldRecoveryOrders);
    }
    if (allTracked.length > 0) {
      logger.info(`[SpikeBot] Cancelling ${allTracked.length} tracked orders on shutdown`);
      await this.cancelTrackedOrders(allTracked);
    }
    this.cleanupTrackedOrdersFile();
  }

  private persistAllTrackedOrders(): void {
    const allTracked: (TrackedOrder & { _type?: string })[] = [];
    for (const state of this.pairStates) {
      for (const o of state.spikeOrders) {
        allTracked.push({ ...o, _type: 'spike' });
      }
      for (const o of state.takeProfitOrders) {
        allTracked.push({ ...o, _type: 'takeProfit' });
      }
      for (const o of state.heldRecoveryOrders) {
        allTracked.push({ ...o, _type: 'held' });
      }
    }
    this.saveTrackedOrders('spikebot', allTracked as TrackedOrder[]);
  }

  private async cancelPairOrders(symbol: string, openOrders: { order_id: string | number }[]): Promise<void> {
    for (const order of openOrders) {
      try {
        await dexrpc.cancelOrder(String(order.order_id));
      } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('Order not found')) {
          logger.info(`[SpikeBot] Order ${order.order_id} already gone (filled or cancelled)`);
        } else {
          logger.error(`[SpikeBot] Failed to cancel order ${order.order_id}: ${msg}`);
        }
      }
    }
  }

  private calculateMA(prices: number[]): number {
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  }

  private buildTakeProfitOrder(symbol: string, ma: number, filledSide: ORDERSIDES, orderAmount: number, market: Market): TradeOrder {
    const bidPrecision = market.bid_token.precision;
    const askPrecision = market.ask_token.precision;
    const maPrice = new BN(ma).toFixed(askPrecision);

    if (filledSide === ORDERSIDES.BUY) {
      // Buy spike filled → place take-profit sell at MA
      const { quantity } = this.getQuantityAndAdjustedTotal(maPrice, orderAmount, bidPrecision, askPrecision);
      return {
        orderSide: ORDERSIDES.SELL,
        price: +maPrice,
        quantity,
        marketSymbol: symbol,
      };
    } else {
      // Sell spike filled → place take-profit buy at MA
      const { adjustedTotal } = this.getQuantityAndAdjustedTotal(maPrice, orderAmount, bidPrecision, askPrecision);
      return {
        orderSide: ORDERSIDES.BUY,
        price: +maPrice,
        quantity: adjustedTotal,
        marketSymbol: symbol,
      };
    }
  }

  private buildSpikeOrders(symbol: string, ma: number, pairConfig: SpikeBotPair, market: Market): TradeOrder[] {
    const { deviationPct, levels, orderAmount } = pairConfig;
    const bidPrecision = market.bid_token.precision;
    const askPrecision = market.ask_token.precision;
    const orders: TradeOrder[] = [];

    for (let level = 1; level <= levels; level++) {
      const deviation = deviationPct * level / 100;

      // Buy order below MA
      const buyPrice = new BN(ma).times(1 - deviation).toFixed(askPrecision);
      const { adjustedTotal } = this.getQuantityAndAdjustedTotal(buyPrice, orderAmount, bidPrecision, askPrecision);
      orders.push({
        orderSide: ORDERSIDES.BUY,
        price: +buyPrice,
        quantity: adjustedTotal,
        marketSymbol: symbol,
      });

      // Sell order above MA
      const sellPrice = new BN(ma).times(1 + deviation).toFixed(askPrecision);
      const { quantity } = this.getQuantityAndAdjustedTotal(sellPrice, orderAmount, bidPrecision, askPrecision);
      orders.push({
        orderSide: ORDERSIDES.SELL,
        price: +sellPrice,
        quantity,
        marketSymbol: symbol,
      });

      logger.info(`[SpikeBot] ${symbol} level ${level}: BUY at ${buyPrice}, SELL at ${sellPrice}`);
    }

    return orders;
  }

  private getQuantityAndAdjustedTotal(price: BN | string, totalCost: number, bidPrecision: number, askPrecision: number): {
    quantity: number;
    adjustedTotal: number;
  } {
    const adjustedTotal = +new BN(totalCost).times(price).toFixed(askPrecision);
    const quantity = +new BN(adjustedTotal).dividedBy(price).toFixed(bidPrecision);
    return { quantity, adjustedTotal };
  }
}
