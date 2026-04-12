import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDexAPI, createMockMarket } from '../helpers/mock-dexapi';

vi.mock('../../src/utils', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  getConfig: () => ({
    dashboard: {}, username: 'testuser', strategy: 'spikeBot',
    rpc: { apiRoot: 'https://test', lightApiRoot: 'https://test', endpoints: [], privateKeyPermission: 'active' },
  }),
  getUsername: () => 'testuser',
}));

vi.mock('../../src/events', () => ({
  events: {
    orderPlaced: vi.fn(), orderFilled: vi.fn(), orderCancelled: vi.fn(),
    orderHeld: vi.fn(),
    botError: vi.fn(), gridPlaced: vi.fn(), gridAdjusted: vi.fn(), initialize: vi.fn(),
  },
}));

vi.mock('../../src/dexrpc', () => ({
  prepareLimitOrder: vi.fn(),
  submitProcessAction: vi.fn(),
  submitOrders: vi.fn(),
  cancelOrder: vi.fn(),
  withdrawAll: vi.fn(),
}));

const mockDexAPI = createMockDexAPI();

import { SpikeBotStrategy } from '../../src/strategies/spikebot';
import { cancelOrder, withdrawAll } from '../../src/dexrpc';
import type { TrackedOrder } from '../../src/interfaces';

describe('SpikeBotStrategy', () => {
  let strategy: SpikeBotStrategy;
  const XMT_XMD_MARKET = createMockMarket({
    market_id: 2,
    symbol: 'XMT_XMD',
    bid_token: { code: 'XMT', precision: 4, contract: 'eosio.token', multiplier: 10000 },
    ask_token: { code: 'XMD', precision: 6, contract: 'eosio.token', multiplier: 1000000 },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new SpikeBotStrategy();
    (strategy as any).dexAPI = mockDexAPI;
    (strategy as any).username = 'testuser';
    mockDexAPI.getMarketBySymbol.mockReturnValue(XMT_XMD_MARKET);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]);
  });

  function warmUpMA(strategy: SpikeBotStrategy, price: number, window: number) {
    const state = (strategy as any).pairStates[0];
    state.priceHistory = Array(window).fill(price);
    state.currentMA = price;
    state.lastOrderMA = price;
  }

  describe('Bug fix: MA drift check during take-profit phase', () => {
    it('triggers rebalance when only take-profit orders exist and MA drifts', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // Pre-fill history so MA will drift well past 2% threshold
      // 9 values at 1.06 + the new 1.06 = MA of 1.054 (5.4% drift from lastOrderMA=1.0)
      state.priceHistory = Array(9).fill(1.06);
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2 },
      ]);

      await strategy.trade();

      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
    });
  });

  describe('Bug fix: no re-placement while take-profit active', () => {
    it('does not place spike orders when take-profit is outstanding', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2 },
      ]);

      const { prepareLimitOrder } = await import('../../src/dexrpc');
      await strategy.trade();

      expect(prepareLimitOrder).not.toHaveBeenCalled();
    });
  });

  describe('Spike fill metadata', () => {
    it('stores entryPrice, cyclesSincePlace, and originalTargetPrice on take-profit orders', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // Simulate a BUY spike order at 0.90 that has been filled (not in open orders)
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD', orderId: 'spike-1',
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      // spike-1 is NOT in open orders -> it was filled
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]);

      await strategy.trade();

      // The take-profit order should have recovery metadata
      const tp = state.takeProfitOrders[0];
      expect(tp).toBeDefined();
      expect(tp.entryPrice).toBe(0.9);
      expect(tp.cyclesSincePlace).toBe(0);
      expect(tp.originalTargetPrice).toBe(1.0);
      // Take-profit for a filled BUY should be a SELL at MA
      expect(tp.orderSide).toBe(2);
    });
  });

  describe('Tiered recovery: Phase 1 — Patience', () => {
    it('increments cyclesSincePlace each cycle for unfilled take-profit orders', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 20, reboundStepPct: 0.5,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 5, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.95);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2 },
      ]);

      await strategy.trade();

      expect(state.takeProfitOrders[0].cyclesSincePlace).toBe(6);
    });

    it('does not adjust take-profit price while within patience window', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 20, reboundStepPct: 0.5,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 10, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.95);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2 },
      ]);

      await strategy.trade();

      // Price should remain unchanged during patience
      expect(state.takeProfitOrders[0].price).toBe(1.0);
      expect(cancelOrder).not.toHaveBeenCalled();
    });
  });

  describe('Tiered recovery: Phase 2 — Gradual Adjustment', () => {
    it('adjusts SELL take-profit price downward after maxReboundCycles', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 1.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 0.95, 10);
      const state = (strategy as any).pairStates[0];

      // SELL TP at 1.0, entry was BUY at 0.9, patience expired (cycles=6 > max=5)
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 6, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 0.95;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.95);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2 },
      ]);

      await strategy.trade();

      // Old TP should be cancelled
      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
      // New price = 1.0 - (1.0 * 1.0 / 100) = 0.99
      expect(state.takeProfitOrders[0].price).toBeCloseTo(0.99, 4);
    });

    it('adjusts BUY take-profit price upward after maxReboundCycles', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 1.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.05, 10);
      const state = (strategy as any).pairStates[0];

      // BUY TP at 1.0, entry was SELL at 1.1, patience expired
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 1, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 1.1, cyclesSincePlace: 6, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.05;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.05);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 1 },
      ]);

      await strategy.trade();

      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
      // New price = 1.0 + (1.0 * 1.0 / 100) = 1.01
      expect(state.takeProfitOrders[0].price).toBeCloseTo(1.01, 4);
    });

    it('does not adjust SELL take-profit upward (only moves toward market)', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 1.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.05, 10);
      const state = (strategy as any).pairStates[0];

      // SELL TP at 1.0, MA is now ABOVE at 1.05 — don't move TP up
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 6, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.05;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.05);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2 },
      ]);

      await strategy.trade();

      // Should NOT cancel/adjust — price can only move down for SELL TP
      expect(cancelOrder).not.toHaveBeenCalled();
      expect(state.takeProfitOrders[0].price).toBe(1.0);
    });
  });

  describe('Tiered recovery: Phase 3 — Hold in place', () => {
    it('holds SELL take-profit when adjusted price would cross entry price', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 0.85, 10);
      const state = (strategy as any).pairStates[0];

      // SELL TP at 0.91, entry BUY was at 0.90
      // Adjustment: 0.91 - (0.91 * 2.0 / 100) = 0.91 - 0.0182 = 0.8918 < 0.90 entry
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 0.91, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.90, cyclesSincePlace: 6, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 0.85;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.85);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 0.91, order_side: 2 },
      ]);

      await strategy.trade();

      // TP should be moved to held, NOT cancelled
      expect(cancelOrder).not.toHaveBeenCalledWith('tp-1');
      expect(state.takeProfitOrders.length).toBe(0);
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.heldRecoveryOrders[0].orderId).toBe('tp-1');
      expect(state.heldRecoveryOrders[0].heldSince).toBeDefined();

      const { events } = await import('../../src/events');
      expect(events.orderHeld).toHaveBeenCalledWith(
        expect.stringContaining('Held SELL TP'),
        expect.objectContaining({ market: 'XMT_XMD', side: 'SELL', entryPrice: 0.90 }),
      );
    });

    it('holds BUY take-profit when adjusted price would cross entry price', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.15, 10);
      const state = (strategy as any).pairStates[0];

      // BUY TP at 1.09, entry SELL was at 1.10
      // Adjustment: 1.09 + (1.09 * 2.0 / 100) = 1.09 + 0.0218 = 1.1118 > 1.10 entry
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 1, price: 1.09, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 1.10, cyclesSincePlace: 6, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.15;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.15);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.09, order_side: 1 },
      ]);

      await strategy.trade();

      expect(cancelOrder).not.toHaveBeenCalledWith('tp-1');
      expect(state.takeProfitOrders.length).toBe(0);
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.heldRecoveryOrders[0].orderId).toBe('tp-1');
      expect(state.heldRecoveryOrders[0].heldSince).toBeDefined();

      const { events } = await import('../../src/events');
      expect(events.orderHeld).toHaveBeenCalledWith(
        expect.stringContaining('Held BUY TP'),
        expect.objectContaining({ market: 'XMT_XMD', side: 'BUY', entryPrice: 1.10 }),
      );
    });

    it('fills held recovery when price returns', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 0.95, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [];
      state.takeProfitOrders = [];
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 0.91, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-held-1', entryPrice: 0.90, cyclesSincePlace: 20,
        originalTargetPrice: 1.0, heldSince: '2026-04-11T23:09:21Z',
      }];
      state.lastOrderMA = 0.95;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.95);
      // held order no longer present — it filled
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]);

      const { events } = await import('../../src/events');
      vi.mocked(events.orderFilled).mockClear();

      await strategy.trade();

      expect(state.heldRecoveryOrders.length).toBe(0);
      expect(events.orderFilled).toHaveBeenCalledWith(
        expect.stringContaining('Held recovery SELL filled'),
        expect.objectContaining({ market: 'XMT_XMD', side: 'SELL', price: 0.91 }),
      );
    });

    it('places new spike orders while a held recovery exists', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 0.85, 10);
      const state = (strategy as any).pairStates[0];

      // Start with one TP that will be held this cycle
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 0.91, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.90, cyclesSincePlace: 6, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 0.85;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.85);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 0.91, order_side: 2 },
      ]);

      await strategy.trade();

      // After hold: TP moved to heldRecoveryOrders; takeProfitOrders is empty.
      // New spike orders are placed same-cycle because the placement gate only
      // checks spikeOrders + takeProfitOrders (held orders do not block placement).
      expect(state.takeProfitOrders.length).toBe(0);
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.spikeOrders.length).toBeGreaterThan(0);

      // Held order remains live across the next cycle and new spikes stay in place.
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 0.91, order_side: 2 },
      ]);
      const { prepareLimitOrder } = await import('../../src/dexrpc');
      vi.mocked(prepareLimitOrder).mockClear();

      await strategy.trade();

      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.heldRecoveryOrders[0].orderId).toBe('tp-1');
    });

    it('preserves held recovery across MA-drift rebalance', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // Seed a held order + one TP so the rebalance branch runs
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.05, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-active', entryPrice: 1.0, cyclesSincePlace: 1, originalTargetPrice: 1.05,
      }];
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 1.03, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-held', entryPrice: 1.02, cyclesSincePlace: 20,
        originalTargetPrice: 1.05, heldSince: '2026-04-11T23:09:21Z',
      }];
      state.priceHistory = Array(9).fill(1.06);
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06); // MA will drift past 2%
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-active', price: 1.05, order_side: 2 },
        { order_id: 'tp-held', price: 1.03, order_side: 2 },
      ]);

      await strategy.trade();

      // Active TP gets cancelled during rebalance; held TP survives
      expect(cancelOrder).toHaveBeenCalledWith('tp-active');
      expect(cancelOrder).not.toHaveBeenCalledWith('tp-held');
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.heldRecoveryOrders[0].orderId).toBe('tp-held');
    });

    it('persists and restores held recovery across restart', async () => {
      // First strategy instance — seed state and trigger persistence
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 0.85, 10);
      const state = (strategy as any).pairStates[0];
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 0.91, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-held', entryPrice: 0.90, cyclesSincePlace: 20,
        originalTargetPrice: 1.0, heldSince: '2026-04-11T23:09:21Z',
      }];

      const savedOrders: any[] = [];
      (strategy as any).saveTrackedOrders = vi.fn((_name: string, orders: any[]) => {
        savedOrders.push(...orders);
      });
      (strategy as any).persistAllTrackedOrders();

      expect(savedOrders.length).toBe(1);
      expect(savedOrders[0]._type).toBe('held');
      expect(savedOrders[0].orderId).toBe('tp-held');
      expect(savedOrders[0].heldSince).toBe('2026-04-11T23:09:21Z');

      // Second strategy instance — restore from persisted data
      const strategy2 = new SpikeBotStrategy();
      (strategy2 as any).dexAPI = mockDexAPI;
      (strategy2 as any).username = 'testuser';
      (strategy2 as any).loadTrackedOrders = vi.fn(() => savedOrders);

      await strategy2.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      const state2 = (strategy2 as any).pairStates[0];
      expect(state2.heldRecoveryOrders.length).toBe(1);
      expect(state2.heldRecoveryOrders[0].orderId).toBe('tp-held');
      expect(state2.heldRecoveryOrders[0].heldSince).toBe('2026-04-11T23:09:21Z');
      expect(state2.takeProfitOrders.length).toBe(0);
      expect(state2.spikeOrders.length).toBe(0);
    });

    it('cancels held recovery orders on graceful shutdown', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [];
      state.takeProfitOrders = [];
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 0.91, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-held', entryPrice: 0.90, cyclesSincePlace: 20,
        originalTargetPrice: 1.0, heldSince: '2026-04-11T23:09:21Z',
      }];

      const cancelled: TrackedOrder[] = [];
      (strategy as any).cancelTrackedOrders = vi.fn(async (orders: TrackedOrder[]) => {
        cancelled.push(...orders);
      });
      (strategy as any).cleanupTrackedOrdersFile = vi.fn();

      await strategy.cancelOwnOrders();

      expect(cancelled).toHaveLength(1);
      expect(cancelled[0].orderId).toBe('tp-held');
    });
  });

  describe('Breakdown metrics', () => {
    it('publishes breakdown on orderStateEntry', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 0.85, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.76, quantity: 26.32, marketSymbol: 'XMT_XMD', orderId: 's-1',
      }];
      // Patience (cycles <= maxReboundCycles=5)
      state.takeProfitOrders = [{
        orderSide: 2, price: 0.88, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-p', entryPrice: 0.86, cyclesSincePlace: 2, originalTargetPrice: 0.88,
      }];
      // Adjusting (cycles > maxReboundCycles)
      state.takeProfitOrders.push({
        orderSide: 2, price: 0.89, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-a', entryPrice: 0.87, cyclesSincePlace: 10, originalTargetPrice: 0.90,
      });
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 0.91, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-h', entryPrice: 0.90, cyclesSincePlace: 20,
        originalTargetPrice: 1.0, heldSince: '2026-04-11T23:09:21Z',
      }];

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.85);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.76, order_side: 1 },
        { order_id: 'tp-p', price: 0.88, order_side: 2 },
        { order_id: 'tp-a', price: 0.89, order_side: 2 },
        { order_id: 'tp-h', price: 0.91, order_side: 2 },
      ]);

      const writeOrderStateSpy = vi.fn();
      (strategy as any).writeOrderState = writeOrderStateSpy;

      await strategy.trade();

      expect(writeOrderStateSpy).toHaveBeenCalledOnce();
      const [[entries]] = writeOrderStateSpy.mock.calls;
      expect(entries).toHaveLength(1);
      const breakdown = entries[0].breakdown;
      expect(breakdown).toBeDefined();
      expect(breakdown.spike).toBe(1);
      expect(breakdown.patience).toBe(1);
      expect(breakdown.adjusting).toBe(1);
      expect(breakdown.held).toBe(1);
      // avgEntry weighted by quantity: (0.86*20 + 0.87*20 + 0.90*20) / 60 = 0.876667
      expect(breakdown.avgEntryPrice).toBeCloseTo(0.8766666, 4);
      // notional = 0.88*20 + 0.89*20 + 0.91*20 = 53.6 (spike excluded)
      expect(breakdown.notionalLocked).toBeCloseTo(53.6, 4);
      // drift = (currentMA 0.85 - avgEntry 0.876667) / 0.876667 * 100 ≈ -3.042%
      expect(breakdown.entryDriftPct).toBeCloseTo(-3.042, 2);
    });

    it('returns null avg/drift when no recovery or held orders exist', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0, maxReboundCycles: 5, reboundStepPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 0.85, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.76, quantity: 26.32, marketSymbol: 'XMT_XMD', orderId: 's-1',
      }];

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.85);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.76, order_side: 1 },
      ]);

      const writeOrderStateSpy = vi.fn();
      (strategy as any).writeOrderState = writeOrderStateSpy;

      await strategy.trade();

      const [[entries]] = writeOrderStateSpy.mock.calls;
      const breakdown = entries[0].breakdown;
      expect(breakdown.spike).toBe(1);
      expect(breakdown.patience).toBe(0);
      expect(breakdown.adjusting).toBe(0);
      expect(breakdown.held).toBe(0);
      expect(breakdown.avgEntryPrice).toBeNull();
      expect(breakdown.entryDriftPct).toBeNull();
      expect(breakdown.notionalLocked).toBe(0);
    });
  });

  describe('Config initialization', () => {
    it('uses provided maxReboundCycles and reboundStepPct', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        maxReboundCycles: 30, reboundStepPct: 0.8,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      expect((strategy as any).maxReboundCycles).toBe(30);
      expect((strategy as any).reboundStepPct).toBe(0.8);
    });

    it('defaults maxReboundCycles to 20 and reboundStepPct to 0.5 when omitted', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      expect((strategy as any).maxReboundCycles).toBe(20);
      expect((strategy as any).reboundStepPct).toBe(0.5);
    });
  });
});
