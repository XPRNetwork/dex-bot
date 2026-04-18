import { prepareLimitOrder, submitProcessAction, submitOrders, cancelOrder } from "../dexrpc";
import { TradeOrder, TrackedOrder, TradingStrategy } from "../interfaces";
import type { MockEngine } from "../mock-engine";
import * as dexapi from "../dexapi";
import { getConfig, getLogger, getUsername } from "../utils";
import { Market, OrderHistory } from '@proton/wrap-constants';
import { ORDERSIDES } from '../core/constants';
import { events } from "../events";
import fs from 'fs';
import path from 'path';
import { readPending, appendResult, BotCommand, BotCommandResult } from './command-queue';

export interface AdjustmentHistoryState {
  price: number;
  at: string;
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual' | 'rebalance';
}

export interface SpikeTriggerState {
  price: number;
  at: string;
}

export interface RecoveryOrderState {
  orderId?: string;
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  originalTargetPrice: number;
  cyclesSincePlace: number;
  phase: 'patience' | 'adjusting' | 'held';
  heldSince?: string;
  adjustmentHistory?: AdjustmentHistoryState[];
  cancelReason?: string;
  spikeTrigger?: SpikeTriggerState;
}

export interface SpikeBotBreakdown {
  spike: number;
  patience: number;
  adjusting: number;
  held: number;
  avgEntryPrice: number | null;
  entryDriftPct: number | null;
  notionalLocked: number;
}

export interface OrderStateEntry {
  symbol: string;
  orders: OrderHistory[];
  expectedOrders: number;
  recoveryOrders?: RecoveryOrderState[];
  breakdown?: SpikeBotBreakdown;
  lastCancelReason?: { reason: string; at: string };
}

export interface MarketDetails {
  highestBid: number;
  lowestAsk: number;
  market?: Market;
  price: number;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

const baseLogger = getLogger();

export abstract class TradingStrategyBase implements TradingStrategy {
  abstract initialize(options?: any): Promise<void>;

  abstract trade(): Promise<void>;

  protected dexAPI = dexapi;
  protected username = getUsername();
  public mockEngine?: MockEngine;

  protected async placeOrders(orders: TradeOrder[], delayTime = 2000): Promise<void> {
    if (this.mockEngine) {
      for (const order of orders) {
        const market = this.dexAPI.getMarketBySymbol(order.marketSymbol);
        if (market) {
          this.mockEngine.placeOrder(order, market);
        }
      }
      events.gridPlaced(`[Paper] Placed ${orders.length} mock orders`, {
        mode: 'paper',
        orders: orders.map(o => ({
          market: o.marketSymbol,
          side: o.orderSide === 1 ? 'BUY' : 'SELL',
          quantity: o.quantity,
          price: o.price,
        })),
      });
      return;
    }

    for(var i = 1; i <= orders.length; i++) {
        const order = orders[i-1];
        await prepareLimitOrder(
          order.marketSymbol,
          order.orderSide,
          order.quantity,
          order.price
      );
      if(i%10 === 0 || i === orders.length) {
        await submitProcessAction();
        await submitOrders();

        // Emit event for batch of orders placed
        const batchStart = Math.floor((i - 1) / 10) * 10;
        const batchOrders = orders.slice(batchStart, i);
        events.gridPlaced(`Placed ${batchOrders.length} orders`, {
          orders: batchOrders.map(o => ({
            market: o.marketSymbol,
            side: o.orderSide === 1 ? 'BUY' : 'SELL',
            quantity: o.quantity,
            price: o.price,
          })),
        });

        await delay(delayTime);
      };
    }
  }

  protected async getOpenOrders(marketSymbol: string) {
    if (this.mockEngine) {
      const mockOrders = this.mockEngine.getOpenOrders(marketSymbol);
      console.log(`[Paper] Open orders size for pair ${marketSymbol} ${mockOrders.length}`);
      return mockOrders.map(o => ({
        order_id: o.mockId,
        market_id: 0,
        account: this.username,
        order_type: 1,
        order_side: o.orderSide,
        quantity: o.quantity,
        price: o.price,
        created_at: o.placedAt || new Date().toISOString(),
      } as unknown as OrderHistory));
    }

    const market = this.dexAPI.getMarketBySymbol(marketSymbol);
    if (market === undefined) {
      throw new Error(`Market ${marketSymbol} does not exist`);
    }

    const allOrders = await this.dexAPI.fetchPairOpenOrders(this.username, marketSymbol);
    console.log(`Open orders size for pair ${marketSymbol} ${allOrders.length}`);
    return allOrders;
  }

  protected async getMarketDetails(marketSymbol: string): Promise<MarketDetails> {
    const market = dexapi.getMarketBySymbol(marketSymbol);
    const price = await dexapi.fetchLatestPrice(marketSymbol);
    const orderBook = await dexapi.fetchOrderBook(marketSymbol, 1);
    const lowestAsk =
      orderBook.asks.length > 0 ? orderBook.asks[0].level : price;
    const highestBid =
      orderBook.bids.length > 0 ? orderBook.bids[0].level : price;

    const details = {
      highestBid,
      lowestAsk,
      market,
      price,
    };

    return details;
  }

  protected async resolveOrderIds(placedOrders: TradeOrder[], symbol: string): Promise<TrackedOrder[]> {
    if (this.mockEngine) {
      // Mock orders already have IDs from placeOrder()
      return this.mockEngine.getOpenOrders(symbol).map(o => ({
        ...o,
        orderId: o.mockId,
        placedAt: o.placedAt || new Date().toISOString(),
      }));
    }

    const onChainOrders = await this.dexAPI.fetchPairOpenOrders(this.username, symbol);
    return placedOrders.map(placed => {
      const match = onChainOrders.find(o =>
        o.price === placed.price &&
        o.order_side === placed.orderSide
      );
      if (!match) {
        baseLogger.warn(`[Tracking] Could not resolve order_id for ${placed.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL'} at ${placed.price} on ${symbol}`);
      }
      return {
        ...placed,
        orderId: match?.order_id,
        placedAt: new Date().toISOString(),
      };
    });
  }

  protected async getOwnOpenOrders(symbol: string, trackedIds: Set<string>): Promise<OrderHistory[]> {
    if (this.mockEngine) {
      const mockOrders = this.mockEngine.getOpenOrders(symbol)
        .filter(o => trackedIds.size === 0 || trackedIds.has(o.mockId));
      return mockOrders.map(o => ({
        order_id: o.mockId,
        market_id: 0,
        account: this.username,
        order_type: 1,
        order_side: o.orderSide,
        quantity: o.quantity,
        price: o.price,
        created_at: o.placedAt || new Date().toISOString(),
      } as unknown as OrderHistory));
    }

    const allOrders = await this.getOpenOrders(symbol);
    if (trackedIds.size === 0) return allOrders; // fallback: no tracking yet
    return allOrders.filter(o => trackedIds.has(o.order_id));
  }

  protected async cancelTrackedOrders(trackedOrders: TrackedOrder[]): Promise<void> {
    if (this.mockEngine) {
      for (const order of trackedOrders) {
        const id = order.orderId || (order as any).mockId;
        if (id) {
          this.mockEngine.cancelOrder(id);
        }
      }
      return;
    }

    for (const order of trackedOrders) {
      if (order.orderId) {
        try {
          await cancelOrder(String(order.orderId));
        } catch (error) {
          baseLogger.error(`[Tracking] Failed to cancel order ${order.orderId}: ${(error as Error).message}`);
        }
      }
    }
  }

  protected saveTrackedOrders(key: string, trackedOrders: TrackedOrder[]): void {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;

    try {
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      const data = {
        instanceId,
        key,
        timestamp: new Date().toISOString(),
        orders: trackedOrders,
      };

      const filePath = path.join(stateDir, `${instanceId}-tracked.json`);
      const tempPath = filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(data));
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      baseLogger.warn('Failed to save tracked orders:', error);
    }
  }

  protected loadTrackedOrders(): TrackedOrder[] {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return [];

    try {
      const filePath = path.join(stateDir, `${instanceId}-tracked.json`);
      if (!fs.existsSync(filePath)) return [];

      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.orders && Array.isArray(data.orders)) {
        baseLogger.info(`[Tracking] Loaded ${data.orders.length} tracked orders from disk`);
        return data.orders as TrackedOrder[];
      }
    } catch (error) {
      baseLogger.warn('Failed to load tracked orders:', error);
    }
    return [];
  }

  protected cleanupTrackedOrdersFile(): void {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;

    try {
      const filePath = path.join(stateDir, `${instanceId}-tracked.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      baseLogger.warn('Failed to cleanup tracked orders file:', error);
    }
  }

  protected async wipeStateFiles(): Promise<void> {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;
    const names = [
      `${instanceId}-tracked.json`,
      `${instanceId}-orders.json`,
      `${instanceId}-commands.jsonl`,
      `${instanceId}-command-results.jsonl`,
    ];
    for (const name of names) {
      const p = path.join(stateDir, name);
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (error) {
        baseLogger.warn(`Failed to wipe state file ${name}:`, error);
      }
    }
  }

  public async wipeState(): Promise<void> {
    await this.wipeStateFiles();
  }

  async cancelOwnOrders(): Promise<void> {
    // Default implementation — subclasses can override with specific tracked orders
    baseLogger.info('[Tracking] cancelOwnOrders called (base no-op)');
  }

  protected async processCommands(): Promise<void> {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;
    const cmdPath = path.join(stateDir, `${instanceId}-commands.jsonl`);
    const processingPath = cmdPath + '.processing';
    const resultsPath = path.join(stateDir, `${instanceId}-command-results.jsonl`);

    // Crash-recovery: if a .processing sidecar exists from a prior cycle, process it first.
    // Otherwise, atomically move the commands file to the sidecar so new dashboard appends
    // land in a fresh commands file for the next cycle.
    let hasSidecar = fs.existsSync(processingPath);
    if (!hasSidecar) {
      if (!fs.existsSync(cmdPath)) return;
      try {
        fs.renameSync(cmdPath, processingPath);
        hasSidecar = true;
      } catch (err) {
        baseLogger.warn('[Commands] Failed to move commands file to processing sidecar:', err);
        return;
      }
    }

    const pending = await readPending(processingPath);

    const dispatcher = (this as unknown as {
      handleCommand?: (cmd: BotCommand) => Promise<BotCommandResult>;
    }).handleCommand;

    for (const cmd of pending) {
      let result: BotCommandResult;
      if (typeof dispatcher === 'function') {
        try {
          result = await dispatcher.call(this, cmd);
        } catch (err) {
          result = {
            id: cmd.id, status: 'error',
            message: (err as Error).message ?? 'dispatch failed',
            appliedAt: new Date().toISOString(),
          };
        }
      } else {
        result = {
          id: cmd.id, status: 'error',
          message: 'strategy does not support commands',
          appliedAt: new Date().toISOString(),
        };
      }
      await appendResult(resultsPath, result);
    }

    try {
      fs.unlinkSync(processingPath);
    } catch (err) {
      baseLogger.warn('[Commands] Failed to remove processing sidecar:', err);
    }
  }

  protected writeOrderState(entries: OrderStateEntry[]): void {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;

    try {
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      const markets = entries.map(entry => {
        const market = this.dexAPI.getMarketBySymbol(entry.symbol);
        const buyOrders = entry.orders.filter(o => o.order_side === ORDERSIDES.BUY);
        const sellOrders = entry.orders.filter(o => o.order_side === ORDERSIDES.SELL);
        return {
          symbol: entry.symbol,
          marketId: market?.market_id || 0,
          bidToken: market?.bid_token?.code || '',
          askToken: market?.ask_token?.code || '',
          buyOrders,
          sellOrders,
          totalOrders: entry.orders.length,
          expectedOrders: entry.expectedOrders,
          ...(entry.recoveryOrders && entry.recoveryOrders.length > 0 && {
            recoveryOrders: entry.recoveryOrders,
          }),
          ...(entry.breakdown && { breakdown: entry.breakdown }),
          ...(entry.lastCancelReason && { lastCancelReason: entry.lastCancelReason }),
        };
      });

      const state = {
        instanceId,
        timestamp: new Date().toISOString(),
        username: this.username,
        strategy: getConfig().strategy,
        network: process.env.NODE_ENV === 'test' ? 'testnet' : 'mainnet',
        totalOpenOrders: entries.reduce((sum, e) => sum + e.orders.length, 0),
        markets,
      };

      const filePath = path.join(stateDir, `${instanceId}-orders.json`);
      const tempPath = filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(state));
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      console.warn('Failed to write order state:', error);
    }
  }
}
