# Spike Bot Held-Recovery & Dashboard Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the destructive "abandon on cross-entry" behavior in the spike bot's tiered recovery with a "hold in place" flow that keeps the on-chain TP live, moves it to a dedicated `heldRecoveryOrders` bucket so it no longer blocks new spike placement, and surfaces richer breakdown metrics on the dashboard.

**Architecture:** Add a third tracked-order bucket (`heldRecoveryOrders`) on `PairState`. When a Phase 2 adjustment would cross entry, move the TP there instead of cancelling and withdrawing. Held orders get their own fill-detection step, are excluded from MA-drift rebalance, persist across restarts, and are published with `phase: 'held'` alongside a per-pair `breakdown` block. The dashboard gains chip rows, stat headers, and a new purple "Held" badge.

**Tech Stack:** TypeScript, Vitest, Next.js (App Router), React, Tailwind CSS

---

### File Map

| File | Repo | Action | Responsibility |
|------|------|--------|----------------|
| `src/interfaces/order.interface.ts` | dex-bot | Modify | Add `heldSince?` to `TrackedOrder` |
| `src/strategies/base.ts` | dex-bot | Modify | Extend `RecoveryOrderState` phase union + `heldSince`, add `breakdown` to `OrderStateEntry` |
| `src/events.ts` | dex-bot | Modify | Add `'order_held'` to `EventType`, add `events.orderHeld()` method |
| `src/strategies/spikebot.ts` | dex-bot | Modify | Add bucket, replace abandon with hold, new fill-detection, filter rebalance, persistence, breakdown publishing |
| `test/strategies/spikebot.test.ts` | dex-bot | Modify | Rewrite abandon tests as hold tests; add new tests for fill, rebalance preservation, persistence, breakdown |
| `src/lib/api.ts` | dex-dashboard | Modify | Extend `RecoveryOrder` phase + `heldSince`, add `breakdown` to `InstanceOrdersMarket` |
| `src/components/dashboard/instance-monitor.tsx` | dex-dashboard | Modify | Render chip row, stat/summary row, purple Held badge |

All `dex-bot` paths are relative to `/Users/tayler/Developer/Protonext/dex-bot`. All `dex-dashboard` paths are relative to `/Users/tayler/Developer/Protonext/dex-dashboard`.

---

### Task 1: Extend type definitions

**Files:**
- Modify: `src/interfaces/order.interface.ts:10-16`
- Modify: `src/strategies/base.ts:12-26`

- [ ] **Step 1: Add `heldSince` to `TrackedOrder`**

In `src/interfaces/order.interface.ts`, replace the `TrackedOrder` interface (lines 10-16):

```typescript
export interface TrackedOrder extends TradeOrder {
    orderId?: string;    // on-chain order_id from the DEX
    placedAt?: string;   // ISO timestamp for debugging
    entryPrice?: number;         // spike fill price (hard floor for TP adjustment)
    cyclesSincePlace?: number;   // trade cycles this TP has been open
    originalTargetPrice?: number; // MA at time of TP placement
    heldSince?: string;          // ISO timestamp set when TP moves to heldRecoveryOrders
}
```

- [ ] **Step 2: Extend `RecoveryOrderState` phase union and add `heldSince`**

In `src/strategies/base.ts`, replace `RecoveryOrderState` (lines 12-19):

```typescript
export interface RecoveryOrderState {
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  originalTargetPrice: number;
  cyclesSincePlace: number;
  phase: 'patience' | 'adjusting' | 'held';
  heldSince?: string;
}
```

- [ ] **Step 3: Add `breakdown` to `OrderStateEntry`**

In the same file, replace `OrderStateEntry` (lines 21-26) with:

```typescript
export interface OrderStateEntry {
  symbol: string;
  orders: OrderHistory[];
  expectedOrders: number;
  recoveryOrders?: RecoveryOrderState[];
  breakdown?: {
    spike: number;
    patience: number;
    adjusting: number;
    held: number;
    avgEntryPrice: number | null;
    entryDriftPct: number | null;
    notionalLocked: number;
  };
}
```

- [ ] **Step 4: Thread `breakdown` through `writeOrderState`**

In `src/strategies/base.ts`, in the `markets = entries.map(...)` block (starts at line 291), add `breakdown` pass-through alongside `recoveryOrders`. Replace the inner spread (lines 295-307) with:

```typescript
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
  ...(entry.breakdown && {
    breakdown: entry.breakdown,
  }),
};
```

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx tsc --noEmit`
Expected: no errors. (Compile-only check; no tests run.)

- [ ] **Step 6: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/interfaces/order.interface.ts src/strategies/base.ts
git commit -m "feat(types): add heldSince, held phase, and breakdown to state types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `orderHeld` event

**Files:**
- Modify: `src/events.ts:7-24` and `src/events.ts:200-206`

- [ ] **Step 1: Add `order_held` event type**

In `src/events.ts`, replace the `EventType` union (lines 7-24) by appending `'order_held'`:

```typescript
export type EventType =
  | 'order_placed'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_held'
  | 'order_failed'
  | 'bot_started'
  | 'bot_stopped'
  | 'bot_error'
  | 'balance_low'
  | 'balance_updated'
  | 'trade_executed'
  | 'grid_placed'
  | 'grid_adjusted'
  | 'swap_executed'
  | 'config_loaded'
  | 'market_data_error'
  | 'rpc_error'
  | 'health_restart';
```

- [ ] **Step 2: Add `orderHeld` emitter method**

In `src/events.ts`, immediately after the `orderCancelled` method (lines 200-202), add:

```typescript
  orderHeld(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'order_held', 'info', message, data);
  }
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/events.ts
git commit -m "feat(events): add order_held event type and emitter

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add `heldRecoveryOrders` bucket to `PairState`

**Files:**
- Modify: `src/strategies/spikebot.ts:17-24` and `src/strategies/spikebot.ts:44-51`

- [ ] **Step 1: Add field to `PairState` interface**

In `src/strategies/spikebot.ts`, replace the `PairState` interface (lines 17-24):

```typescript
interface PairState {
  config: SpikeBotPair;
  priceHistory: number[];
  currentMA: number;
  lastOrderMA: number;
  spikeOrders: TrackedOrder[];
  takeProfitOrders: TrackedOrder[];
  heldRecoveryOrders: TrackedOrder[];
}
```

- [ ] **Step 2: Initialize the new bucket in `initialize()`**

In the same file, replace the `pairStates` initialization inside `initialize()` (lines 44-51) with:

```typescript
      this.pairStates = options.pairs.map(pair => ({
        config: pair,
        priceHistory: [],
        currentMA: 0,
        lastOrderMA: 0,
        spikeOrders: [],
        takeProfitOrders: [],
        heldRecoveryOrders: [],
      }));
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts
git commit -m "feat(spikebot): add heldRecoveryOrders bucket to PairState

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Replace SELL abandon with hold-in-place

**Files:**
- Modify: `test/strategies/spikebot.test.ts:298-326`
- Modify: `src/strategies/spikebot.ts:241-262`

- [ ] **Step 1: Mock `orderHeld` in the test file**

In `test/strategies/spikebot.test.ts`, replace the events mock block (lines 13-18) with:

```typescript
vi.mock('../../src/events', () => ({
  events: {
    orderPlaced: vi.fn(), orderFilled: vi.fn(), orderCancelled: vi.fn(),
    orderHeld: vi.fn(),
    botError: vi.fn(), gridPlaced: vi.fn(), gridAdjusted: vi.fn(), initialize: vi.fn(),
  },
}));
```

- [ ] **Step 2: Rewrite the SELL abandon test as a SELL hold test**

In `test/strategies/spikebot.test.ts`, replace the describe block header and the first test (lines 297-326). Change the describe label and the first `it` block to:

```typescript
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
    });
```

- [ ] **Step 3: Run the new test to confirm it fails**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "holds SELL take-profit"`
Expected: FAIL (current code still cancels and sets `takeProfitOrders.length` to 0 but does not populate `heldRecoveryOrders`).

- [ ] **Step 4: Replace the SELL abandon branch with hold-in-place**

In `src/strategies/spikebot.ts`, replace the SELL abandon block (lines 241-262) with:

```typescript
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
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "holds SELL take-profit"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): hold SELL TP in place instead of abandoning

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Replace BUY abandon with hold-in-place

**Files:**
- Modify: `test/strategies/spikebot.test.ts:328-355`
- Modify: `src/strategies/spikebot.ts:263-284`

- [ ] **Step 1: Rewrite the BUY abandon test as a BUY hold test**

In `test/strategies/spikebot.test.ts`, replace the existing `'abandons BUY take-profit when adjusted price would cross entry price'` test (lines 328-355) with:

```typescript
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
    });
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "holds BUY take-profit"`
Expected: FAIL.

- [ ] **Step 3: Replace the BUY abandon branch with hold-in-place**

In `src/strategies/spikebot.ts`, replace the BUY abandon block (lines 263-284 — note line numbers will have shifted after Task 4; match on the pattern `if (tracked.orderSide === ORDERSIDES.BUY && candidatePrice >= tracked.entryPrice) {`):

```typescript
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
```

- [ ] **Step 4: Remove the now-unused `tpAbandoned` variable**

In `src/strategies/spikebot.ts`, find the declaration `let tpAbandoned = false;` (around line 213, now unreferenced) and delete the line. Then find the check `if (!tpAbandoned && state.spikeOrders.length === 0 && state.takeProfitOrders.length === 0) {` and replace with:

```typescript
        // 7. Initial placement (no tracked spike orders & MA ready)
        if (state.spikeOrders.length === 0 && state.takeProfitOrders.length === 0) {
```

- [ ] **Step 5: Run the BUY hold test plus the existing-suite regression check**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "holds BUY take-profit"`
Expected: PASS.

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts`
Expected: the `'resumes spike order placement after abandonment'` test still passes (its assertions — `takeProfitOrders.length === 0` and `spikeOrders.length > 0` after next cycle — remain valid because held orders are now in `heldRecoveryOrders`).

- [ ] **Step 6: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): hold BUY TP in place instead of abandoning

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Fill detection for held orders (step 5d)

**Files:**
- Modify: `test/strategies/spikebot.test.ts` (add new test in the Hold-in-place describe block)
- Modify: `src/strategies/spikebot.ts` (insert new block after step 5c, before step 5d Phase 2 loop)

- [ ] **Step 1: Add a failing test for held-fill detection**

In `test/strategies/spikebot.test.ts`, inside the `'Tiered recovery: Phase 3 — Hold in place'` describe block, append:

```typescript
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
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "fills held recovery when price returns"`
Expected: FAIL — no fill detection wired up for `heldRecoveryOrders`.

- [ ] **Step 3: Insert the held-fill detection block**

In `src/strategies/spikebot.ts`, find the end of step 5c / start of step 6 (the `// 6. MA drift check` comment). Immediately **before** the step 6 comment and after the `if (tpOrdersChanged) { state.takeProfitOrders = adjustedTP; }` block, insert:

```typescript
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
```

- [ ] **Step 4: Include held order IDs when fetching open orders**

In `src/strategies/spikebot.ts`, find the line (around line 100) `const allTracked = [...state.spikeOrders, ...state.takeProfitOrders];` and change it to:

```typescript
        const allTracked = [...state.spikeOrders, ...state.takeProfitOrders, ...state.heldRecoveryOrders];
```

This ensures `getOwnOpenOrders(symbol, trackedIds)` queries for held order IDs so step 5d can check their fill status.

- [ ] **Step 5: Run the held-fill test**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "fills held recovery when price returns"`
Expected: PASS.

- [ ] **Step 6: Run the full spike bot test suite to check for regressions**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): detect fills on held recovery orders

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Preserve held orders across MA-drift rebalance

**Files:**
- Modify: `test/strategies/spikebot.test.ts` (new test)
- Modify: `src/strategies/spikebot.ts` (rebalance block, around lines 339-350)

- [ ] **Step 1: Add failing test for rebalance preservation**

In `test/strategies/spikebot.test.ts`, inside the `'Tiered recovery: Phase 3 — Hold in place'` describe block, append:

```typescript
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

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06); // MA will drift to ~1.054 (5.4%)
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
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "preserves held recovery across MA-drift rebalance"`
Expected: FAIL (current `cancelPairOrders` cancels every open order for the pair, including held).

- [ ] **Step 3: Filter held IDs out of the rebalance cancel call**

In `src/strategies/spikebot.ts`, locate the rebalance block (contains `MA drift ${driftPct.toFixed(2)}%`). Replace the rebalance body (lines ~342-348) with:

```typescript
          if (driftPct > this.rebalanceThresholdPct) {
            logger.info(`[SpikeBot] ${symbol} MA drift ${driftPct.toFixed(2)}% exceeds threshold ${this.rebalanceThresholdPct}% - rebalancing`);
            const heldIds = new Set(state.heldRecoveryOrders.map(o => o.orderId).filter((id): id is string => !!id));
            const ordersToCancel = openOrders.filter(o => !heldIds.has(String(o.order_id)));
            await this.cancelPairOrders(symbol, ordersToCancel);
            await dexrpc.withdrawAll();
            await delay(2000);
            state.spikeOrders = [];
            state.takeProfitOrders = [];
            // heldRecoveryOrders is intentionally preserved — held TPs represent past
            // entries that should be evaluated against their entry price, not current MA.
            rebalanced = true;
            // Fall through to initial placement below
          }
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "preserves held recovery across MA-drift rebalance"`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): preserve held recoveries across MA-drift rebalance

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Gate initial placement considering held bucket (no-op verification)

**Files:**
- Modify: `test/strategies/spikebot.test.ts` (rewrite the existing `'resumes spike order placement after abandonment'` test)

- [ ] **Step 1: Rewrite the existing placement-resumption test**

In `test/strategies/spikebot.test.ts`, locate the test at line ~357 `'resumes spike order placement after abandonment'`. Rename and update it to verify resumption under the new hold semantics (still in the `Tiered recovery: Phase 3 — Hold in place` describe block):

```typescript
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

      // After hold: TP moved to heldRecoveryOrders; takeProfitOrders + spikeOrders empty
      expect(state.takeProfitOrders.length).toBe(0);
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.spikeOrders.length).toBe(0);

      // Next cycle — the held order stays open, and new spike orders are placed
      // because the placement gate only checks spikeOrders + takeProfitOrders.
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 0.91, order_side: 2 },
      ]);
      const { prepareLimitOrder } = await import('../../src/dexrpc');
      vi.mocked(prepareLimitOrder).mockClear();

      await strategy.trade();

      expect(prepareLimitOrder).toHaveBeenCalled();
      expect(state.spikeOrders.length).toBeGreaterThan(0);
      expect(state.heldRecoveryOrders.length).toBe(1); // still held
    });
```

- [ ] **Step 2: Run the test**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "places new spike orders while a held recovery exists"`
Expected: PASS. (The gate at step 7 in `spikebot.ts` already checks only `spikeOrders` + `takeProfitOrders`, so no code change is needed — this is a regression guard.)

- [ ] **Step 3: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add test/strategies/spikebot.test.ts
git commit -m "test(spikebot): regression guard that held orders do not block spikes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Persist and restore held orders

**Files:**
- Modify: `test/strategies/spikebot.test.ts` (new test)
- Modify: `src/strategies/spikebot.ts` (persistAllTrackedOrders, initialize restore)

- [ ] **Step 1: Add failing test**

In `test/strategies/spikebot.test.ts`, inside the `Hold in place` describe block, append:

```typescript
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
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "persists and restores held recovery"`
Expected: FAIL.

- [ ] **Step 3: Update `persistAllTrackedOrders` to include held**

In `src/strategies/spikebot.ts`, replace the `persistAllTrackedOrders` method (currently lines 398-409):

```typescript
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
```

- [ ] **Step 4: Update `initialize` restore logic to route held orders**

In `src/strategies/spikebot.ts`, replace the restore loop (lines 57-66) inside `initialize`:

```typescript
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
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "persists and restores held recovery"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): persist and restore held recovery orders

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `cancelOwnOrders` includes held on shutdown

**Files:**
- Modify: `src/strategies/spikebot.ts:386-396`

- [ ] **Step 1: Update `cancelOwnOrders`**

In `src/strategies/spikebot.ts`, replace `cancelOwnOrders` (lines 386-396) with:

```typescript
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
```

- [ ] **Step 2: Run full suite**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts`
Expected: all tests still pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts
git commit -m "feat(spikebot): cancel held orders on graceful shutdown

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Publish breakdown metrics on `orderStateEntry`

**Files:**
- Modify: `test/strategies/spikebot.test.ts` (new test)
- Modify: `src/strategies/spikebot.ts` (inside `trade()`, around lines 106-124)

- [ ] **Step 1: Add failing test for breakdown publishing**

In `test/strategies/spikebot.test.ts`, add a new describe block (outside the Hold-in-place block, but inside the outer `'SpikeBotStrategy'` describe):

```typescript
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

    it('omits breakdown drift/avg when no recovery or held orders', async () => {
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
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "Breakdown metrics"`
Expected: FAIL (no `breakdown` field produced yet).

- [ ] **Step 3: Build breakdown in `trade()` and attach to `orderStateEntry`**

In `src/strategies/spikebot.ts`, find the `orderStateEntries.push` block inside `trade()` (around lines 117-124). Replace it with:

```typescript
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
        const totalQty = recoveryPool.reduce((s, o) => s + o.quantity, 0);
        const weightedEntrySum = recoveryPool.reduce(
          (s, o) => s + (o.entryPrice ?? 0) * o.quantity, 0,
        );
        const avgEntryPrice = totalQty > 0 && weightedEntrySum > 0
          ? weightedEntrySum / totalQty
          : null;
        const entryDriftPct = avgEntryPrice !== null
          ? (state.currentMA - avgEntryPrice) / avgEntryPrice * 100
          : null;
        const notionalLocked = recoveryPool.reduce(
          (s, o) => s + o.price * o.quantity, 0,
        );

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
```

Also delete the earlier `recoveryOrders` const declaration block that starts with `const recoveryOrders: import('./base').RecoveryOrderState[] = state.takeProfitOrders` (originally at lines 106-115). It is fully replaced by the `recoveryForState` block above.

- [ ] **Step 4: Run the breakdown tests**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts -t "Breakdown metrics"`
Expected: both tests PASS.

- [ ] **Step 5: Run full suite**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run test/strategies/spikebot.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): publish per-pair breakdown metrics in order state

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Dashboard types

**Files:**
- Modify: `src/lib/api.ts:5-27` (dex-dashboard repo)

- [ ] **Step 1: Extend `RecoveryOrder` and `InstanceOrdersMarket`**

In `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/api.ts`, replace the `RecoveryOrder` interface (lines 5-13) and `InstanceOrdersMarket` (lines 15-27) with:

```typescript
// Recovery order state from spike bot
export interface RecoveryOrder {
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  originalTargetPrice: number;
  cyclesSincePlace: number;
  phase: 'patience' | 'adjusting' | 'held';
  heldSince?: string;
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

// Instance orders monitoring types
export interface InstanceOrdersMarket {
  symbol: string;
  marketId: number;
  buyOrders: DexOpenOrder[];
  sellOrders: DexOpenOrder[];
  totalOrders: number;
  expectedOrders: number;
  status: 'ok' | 'warning' | 'error';
  bidToken: string;
  askToken: string;
  recoveryOrders?: RecoveryOrder[];
  breakdown?: SpikeBotBreakdown;
}
```

- [ ] **Step 2: Run dashboard typecheck**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/lib/api.ts
git commit -m "feat(api): add held phase and breakdown type for spike bot

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Dashboard — compact card chip row

**Files:**
- Modify: `src/components/dashboard/instance-monitor.tsx` (compact-card render path)

- [ ] **Step 1: Locate the compact card per-pair row**

Open `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/dashboard/instance-monitor.tsx` and find the block that renders each market's `3 / 4 orders` line. It's the collapsed-card rendering; search for the text `orders` where the count and slash appear together (e.g., `{market.totalOrders} / {market.expectedOrders} orders`).

- [ ] **Step 2: Add a helper component for breakdown chips**

Near the top of the file (below imports, before the main component), add:

```tsx
function BreakdownChips({ breakdown }: { breakdown: NonNullable<InstanceOrdersMarket['breakdown']> }) {
  const chip = (count: number, label: string, activeBg: string, activeText: string) => {
    const muted = count === 0;
    const bg = muted ? 'bg-gray-100 dark:bg-gray-800' : activeBg;
    const text = muted ? 'text-gray-400 dark:text-gray-500' : activeText;
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${bg} ${text}`}>
        {count} {label}
      </span>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-1 mt-0.5">
      {chip(breakdown.spike, 'spike', 'bg-blue-100 dark:bg-blue-900/40', 'text-blue-700 dark:text-blue-300')}
      {chip(breakdown.patience, 'patience', 'bg-yellow-100 dark:bg-yellow-900/40', 'text-yellow-700 dark:text-yellow-300')}
      {chip(breakdown.adjusting, 'adjusting', 'bg-orange-100 dark:bg-orange-900/40', 'text-orange-700 dark:text-orange-300')}
      {chip(breakdown.held, 'held', 'bg-purple-100 dark:bg-purple-900/40', 'text-purple-700 dark:text-purple-300')}
    </div>
  );
}
```

Ensure `InstanceOrdersMarket` is imported at the top: adjust the existing `import` from `@/lib/api` (or wherever it's imported) to include `InstanceOrdersMarket`.

- [ ] **Step 3: Render chips under the compact-card order line**

In the same file, find the compact row JSX — the element that shows `{market.totalOrders} / {market.expectedOrders} orders`. Wrap that element + the new chips in a flex column. Example pattern (match existing surrounding structure):

```tsx
<div className="flex flex-col items-end">
  <span className={statusClass}>
    {market.totalOrders} / {market.expectedOrders} orders
  </span>
  {market.breakdown && <BreakdownChips breakdown={market.breakdown} />}
</div>
```

Adjust surrounding class names to match the existing layout so alignment stays stable.

- [ ] **Step 4: Manual verification in browser**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npm run dev`
Open the dashboard in a browser, find a spike-bot instance whose state file has `breakdown`, confirm the chip row renders below the order count with zero-count chips visibly muted. If no such instance exists, hand-edit a local state JSON under `data/state/<id>-orders.json` to inject a `breakdown` key on one market and reload — then revert the edit after confirming.

- [ ] **Step 5: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/components/dashboard/instance-monitor.tsx
git commit -m "feat(dashboard): show spike bot breakdown chips in compact card

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Dashboard — expanded card stat row & summary

**Files:**
- Modify: `src/components/dashboard/instance-monitor.tsx` (expanded-card panel around the Buy/Sell grid at lines 260-318)

- [ ] **Step 1: Add stat/summary row above the Buy/Sell grid**

In `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/dashboard/instance-monitor.tsx`, at the start of the expanded panel body (just before the `<div className="grid grid-cols-2 gap-4">` at line 260), insert:

```tsx
{market.breakdown && (
  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
    <div className="grid grid-cols-4 gap-2 text-center">
      <div>
        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{market.breakdown.spike}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">Spike</div>
      </div>
      <div>
        <div className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{market.breakdown.patience}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">Patience</div>
      </div>
      <div>
        <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{market.breakdown.adjusting}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">Adjusting</div>
      </div>
      <div>
        <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">{market.breakdown.held}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">Held</div>
      </div>
    </div>
    {market.breakdown.avgEntryPrice !== null && (
      <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-600 dark:text-gray-400">
        <span>Avg entry {market.breakdown.avgEntryPrice.toFixed(6)}</span>
        <span>·</span>
        <span className={driftColorClass(market.breakdown.entryDriftPct)}>
          Drift {(market.breakdown.entryDriftPct ?? 0) >= 0 ? '+' : ''}{(market.breakdown.entryDriftPct ?? 0).toFixed(2)}%
        </span>
        <span>·</span>
        <span>Locked {market.breakdown.notionalLocked.toFixed(2)} {market.askToken}</span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Add the `driftColorClass` helper**

In the same file, above the main component (next to `BreakdownChips` from Task 13), add:

```tsx
function driftColorClass(pct: number | null): string {
  if (pct === null) return 'text-gray-500 dark:text-gray-400';
  const abs = Math.abs(pct);
  if (abs < 0.5) return 'text-gray-500 dark:text-gray-400';
  // Negative drift means current price is below avg entry — unfavorable for SELL-side recovery.
  // We don't know per-order sides here, so use magnitude-based coloring: larger |drift| = redder.
  if (pct < 0) return 'text-red-600 dark:text-red-400';
  return 'text-green-600 dark:text-green-400';
}
```

Note: per spec, drift coloring is side-aware, but side-awareness requires per-order context. For the summary (aggregate) view, magnitude-and-sign is good enough: red for negative drift (likely underwater for the typical SELL-TP-heavy scenario), green for positive, gray near zero.

- [ ] **Step 3: Manual verification**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npm run dev`
Open an instance's expanded card, confirm the 4-stat row and summary line render correctly. Sanity-check that when `avgEntryPrice` is `null` (no recovery/held orders), the summary line is hidden and only the stat row shows.

- [ ] **Step 4: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/components/dashboard/instance-monitor.tsx
git commit -m "feat(dashboard): add breakdown stat row and drift summary to expanded card

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Dashboard — purple "Held" badge on recovery list

**Files:**
- Modify: `src/components/dashboard/instance-monitor.tsx:349-358`

- [ ] **Step 1: Extend the phase badge to cover `'held'`**

In `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/dashboard/instance-monitor.tsx`, locate the phase badge in the Recovery orders list (lines 349-358). Replace the badge block with:

```tsx
<span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
  recovery.phase === 'patience'
    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
    : recovery.phase === 'adjusting'
      ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
      : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
}`}>
  {recovery.phase === 'patience'
    ? `Waiting (${recovery.cyclesSincePlace} cycles)`
    : recovery.phase === 'adjusting'
      ? `Adjusting (${recovery.cyclesSincePlace} cycles)`
      : `Held${recovery.heldSince ? ` since ${formatHeldSince(recovery.heldSince)}` : ''}`
  }
</span>
```

- [ ] **Step 2: Add `formatHeldSince` helper**

In the same file, alongside the other helpers added in prior tasks, add:

```tsx
function formatHeldSince(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
```

- [ ] **Step 3: Manual verification**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npm run dev`
With a spike bot instance that has at least one held recovery order in its state file, expand the card and confirm the Recovery section shows the purple `Held since <date>` badge.

- [ ] **Step 4: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/components/dashboard/instance-monitor.tsx
git commit -m "feat(dashboard): add Held badge with heldSince label to recovery list

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Final verification

- [ ] **Run full bot test suite**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot && npx vitest run
```
Expected: all tests pass.

- [ ] **Run bot typecheck**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Run dashboard typecheck**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Dashboard lint (if configured)**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard && npm run lint
```
Expected: no new errors. Warnings pre-existing in the repo are acceptable.

- [ ] **Manual end-to-end smoke**

Run the bot against a test config with artificially low `maxReboundCycles` so hold-in-place triggers quickly. Verify:
1. TP is not cancelled when candidate crosses entry.
2. New spike orders appear on the next cycle while the held TP sits on the book.
3. Dashboard compact card shows `[… held]` chip and expanded card shows drift summary.
4. Restarting the bot restores the held order from the persistence file.
