# SpikeBot Spike Re-placement + Partial-Fill TPs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-create the originating spike order after a non-spike descendant (TP, held, tier-bumped TP) resolves, and cover partial spike fills with per-partial-fill TPs — without ever double-placing TPs or spikes.

**Architecture:** Two additive changes in `spikebot.ts`. (1) Track `spikeLevel` on every order and `coveredQuantity` on spikes. (2) In step 4, detect partial fills by comparing on-chain `quantity_curr` to tracked quantity and place a delta-TP; in a new step 7c, iterate non-spike fills collected during steps 5/5d and re-place the originating spike, gated by `spikeTrigger.price === state.lastOrderMA` and by a slot-occupancy check on `state.spikeOrders`. All quantity math is quantized to `bid_token.precision` with a tick-level skip for sub-tick residuals.

**Tech Stack:** TypeScript, Vitest, BigNumber.js. Spec: `docs/superpowers/specs/2026-04-24-spikebot-spike-replacement-and-partial-fills-design.md`.

---

### Task 1: Add `spikeLevel` and `coveredQuantity` to `TrackedOrder`

**Files:**
- Modify: `src/interfaces/order.interface.ts:21`

- [ ] **Step 1: Add the two fields to the interface**

Edit `src/interfaces/order.interface.ts` to add the fields to `TrackedOrder`:

```ts
export interface TrackedOrder extends TradeOrder {
    orderId?: string;
    placedAt?: string;
    entryPrice?: number;
    cyclesSincePlace?: number;
    originalTargetPrice?: number;
    heldSince?: string;
    adjustmentHistory?: AdjustmentHistoryEntry[];
    cancelReason?: string;
    spikeTrigger?: SpikeTrigger;
    spikeLevel?: number;              // 1..N; level of the originating spike order
    coveredQuantity?: number;         // spike-only; total quantity already covered by TP placements
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/interfaces/order.interface.ts
git commit -m "feat(spikebot): add spikeLevel and coveredQuantity to TrackedOrder"
```

---

### Task 2: Extract `buildSingleSpikeOrder` helper and refactor `buildSpikeOrders`

**Files:**
- Modify: `src/strategies/spikebot.ts:822-855`
- Test: `test/strategies/spikebot.test.ts` (append new `describe`)

- [ ] **Step 1: Write failing tests for the new helper and refactored return shape**

Append to `test/strategies/spikebot.test.ts` before the final closing `});`:

```ts
  describe('buildSingleSpikeOrder + buildSpikeOrders level metadata', () => {
    it('buildSingleSpikeOrder produces correct BUY price at level 1', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 2, orderAmount: 20 }],
      });
      const order = (strategy as any).buildSingleSpikeOrder(
        'XMT_XMD', 1.0, 10, 1, 1 /* BUY */, 20, XMT_XMD_MARKET,
      );
      expect(order.orderSide).toBe(1);
      expect(order.price).toBeCloseTo(0.9, 6);
      expect(order.marketSymbol).toBe('XMT_XMD');
    });

    it('buildSingleSpikeOrder produces correct SELL price at level 2', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 2, orderAmount: 20 }],
      });
      const order = (strategy as any).buildSingleSpikeOrder(
        'XMT_XMD', 1.0, 10, 2, 2 /* SELL */, 20, XMT_XMD_MARKET,
      );
      expect(order.orderSide).toBe(2);
      expect(order.price).toBeCloseTo(1.2, 6);
    });

    it('buildSpikeOrders returns level metadata alongside each order', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 2, orderAmount: 20 }],
      });
      const result = (strategy as any).buildSpikeOrders(
        'XMT_XMD', 1.0, { deviationPct: 10, levels: 2, orderAmount: 20, symbol: 'XMT_XMD' }, XMT_XMD_MARKET,
      );
      expect(result).toHaveLength(4);
      for (const entry of result) {
        expect(entry).toHaveProperty('order');
        expect(entry).toHaveProperty('level');
      }
      const levels = result.map((r: any) => r.level).sort();
      expect(levels).toEqual([1, 1, 2, 2]);
    });
  });
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "buildSingleSpikeOrder"`
Expected: FAIL (buildSingleSpikeOrder is undefined; buildSpikeOrders returns `TradeOrder[]`, not `{ order, level }[]`).

- [ ] **Step 3: Implement the helper and refactor**

In `src/strategies/spikebot.ts`, replace the `buildSpikeOrders` method (lines ~822-855) with:

```ts
  private buildSingleSpikeOrder(
    symbol: string,
    anchorMA: number,
    deviationPct: number,
    level: number,
    side: ORDERSIDES,
    orderAmount: number,
    market: Market,
  ): TradeOrder {
    const bidPrecision = market.bid_token.precision;
    const askPrecision = market.ask_token.precision;
    const deviation = deviationPct * level / 100;

    if (side === ORDERSIDES.BUY) {
      const buyPrice = new BN(anchorMA).times(1 - deviation).toFixed(askPrecision);
      const { adjustedTotal } = this.getQuantityAndAdjustedTotal(buyPrice, orderAmount, bidPrecision, askPrecision);
      return {
        orderSide: ORDERSIDES.BUY,
        price: +buyPrice,
        quantity: adjustedTotal,
        marketSymbol: symbol,
      };
    } else {
      const sellPrice = new BN(anchorMA).times(1 + deviation).toFixed(askPrecision);
      const { quantity } = this.getQuantityAndAdjustedTotal(sellPrice, orderAmount, bidPrecision, askPrecision);
      return {
        orderSide: ORDERSIDES.SELL,
        price: +sellPrice,
        quantity,
        marketSymbol: symbol,
      };
    }
  }

  private buildSpikeOrders(
    symbol: string, ma: number, pairConfig: SpikeBotPair, market: Market,
  ): { order: TradeOrder; level: number }[] {
    const { deviationPct, levels, orderAmount } = pairConfig;
    const result: { order: TradeOrder; level: number }[] = [];
    for (let level = 1; level <= levels; level++) {
      const buyOrder = this.buildSingleSpikeOrder(symbol, ma, deviationPct, level, ORDERSIDES.BUY, orderAmount, market);
      const sellOrder = this.buildSingleSpikeOrder(symbol, ma, deviationPct, level, ORDERSIDES.SELL, orderAmount, market);
      result.push({ order: buyOrder, level });
      result.push({ order: sellOrder, level });
      logger.info(`[SpikeBot] ${symbol} level ${level}: BUY at ${buyOrder.price}, SELL at ${sellOrder.price}`);
    }
    return result;
  }
```

- [ ] **Step 4: Update the one caller to unwrap the new return shape**

In `src/strategies/spikebot.ts`, replace the block at lines ~524-532 (step 7 initial placement). Find:

```ts
          const spikeOrders = this.buildSpikeOrders(symbol, state.currentMA, state.config, market);
          if (spikeOrders.length > 0) {
            logger.info(`[SpikeBot] ${symbol} placing ${spikeOrders.length} spike orders around MA ${state.currentMA.toFixed(market.ask_token.precision)}`);
            const trigger = { price: state.currentMA, at: new Date().toISOString() };
            await this.placeOrders(spikeOrders);
            const resolved = await this.resolveOrderIds(spikeOrders, symbol);
            state.spikeOrders = resolved.map(o => ({ ...o, spikeTrigger: { ...trigger } }));
            state.lastOrderMA = state.currentMA;
          }
```

Replace with:

```ts
          const spikeEntries = this.buildSpikeOrders(symbol, state.currentMA, state.config, market);
          if (spikeEntries.length > 0) {
            const spikeOrders = spikeEntries.map(e => e.order);
            logger.info(`[SpikeBot] ${symbol} placing ${spikeOrders.length} spike orders around MA ${state.currentMA.toFixed(market.ask_token.precision)}`);
            const trigger = { price: state.currentMA, at: new Date().toISOString() };
            await this.placeOrders(spikeOrders);
            const resolved = await this.resolveOrderIds(spikeOrders, symbol);
            state.spikeOrders = resolved.map((o, i) => ({
              ...o,
              spikeTrigger: { ...trigger },
              spikeLevel: spikeEntries[i].level,
              coveredQuantity: 0,
            }));
            state.lastOrderMA = state.currentMA;
          }
```

- [ ] **Step 5: Run tests — new helper tests pass, existing tests still pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "refactor(spikebot): extract buildSingleSpikeOrder, attach spikeLevel on placement"
```

---

### Task 3: Propagate `spikeLevel` onto TPs at full-fill

**Files:**
- Modify: `src/strategies/spikebot.ts:239-260` (step 4 full-fill TP placement)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/strategies/spikebot.test.ts` inside the final `describe('SpikeBotStrategy', ...)` block, before its closing `});`:

```ts
  describe('spikeLevel propagation', () => {
    it('propagates spikeLevel from filled spike onto its TP', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 2, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 0,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // spike fully filled
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].spikeLevel).toBe(1);
    });
  });
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "propagates spikeLevel from filled spike"`
Expected: FAIL (TP has `spikeLevel === undefined`).

- [ ] **Step 3: Implement propagation at full-fill TP placement**

In `src/strategies/spikebot.ts`, find the block inside step 4 around lines 239-260:

```ts
              const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
              (tpOrder as any).entryPrice = tracked.price;
              (tpOrder as any).cyclesSincePlace = 0;
              (tpOrder as any).originalTargetPrice = state.currentMA;
              (tpOrder as any).spikeTrigger = tracked.spikeTrigger;
              newOrders.push(tpOrder);
```

Add the `spikeLevel` attachment:

```ts
              const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
              (tpOrder as any).entryPrice = tracked.price;
              (tpOrder as any).cyclesSincePlace = 0;
              (tpOrder as any).originalTargetPrice = state.currentMA;
              (tpOrder as any).spikeTrigger = tracked.spikeTrigger;
              (tpOrder as any).spikeLevel = tracked.spikeLevel;
              newOrders.push(tpOrder);
```

And in the follow-up block that copies fields onto resolved TPs (around lines 253-260):

```ts
            const withTrigger = resolvedTP.map((r, i) => ({
              ...r,
              spikeTrigger: (newOrders[i] as any).spikeTrigger,
              adjustmentHistory: [{ price: r.price, at: now, reason: 'placed' as const }],
            }));
```

Replace with:

```ts
            const withTrigger = resolvedTP.map((r, i) => ({
              ...r,
              spikeTrigger: (newOrders[i] as any).spikeTrigger,
              spikeLevel: (newOrders[i] as any).spikeLevel,
              adjustmentHistory: [{ price: r.price, at: now, reason: 'placed' as const }],
            }));
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): propagate spikeLevel onto TPs at full spike fill"
```

---

### Task 4: Partial-fill TP — basic Case C (no tick threshold yet)

**Files:**
- Modify: `src/strategies/spikebot.ts:216-263` (step 4 — rewrite fill-detection loop)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing tests for partial-fill detection**

Append to `test/strategies/spikebot.test.ts` inside the main `describe`:

```ts
  describe('Partial-fill TP handling', () => {
    it('places a TP for newly-filled delta on first partial fill', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 0,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 7 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].coveredQuantity).toBeCloseTo(3, 4);
      expect(state.takeProfitOrders).toHaveLength(1);
      const tp = state.takeProfitOrders[0];
      expect(tp.quantity).toBeCloseTo(3, 4);
      expect(tp.orderSide).toBe(2);            // TP for BUY spike is SELL
      expect(tp.entryPrice).toBe(0.9);
      expect(tp.spikeLevel).toBe(1);
      expect(tp.spikeTrigger).toEqual({ price: 1.0, at: 't0' });
    });

    it('places a second TP for additional delta on a second partial fill', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 3,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 4 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].coveredQuantity).toBeCloseTo(6, 4);
      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].quantity).toBeCloseTo(3, 4);
    });

    it('places no TP when quantity_curr is unchanged (no new fill)', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 3,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 7 },  // same as (10 - 3)
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.takeProfitOrders).toHaveLength(0);
      expect(state.spikeOrders[0].coveredQuantity).toBeCloseTo(3, 4);
    });
  });
```

- [ ] **Step 2: Run — verify all three tests fail**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "Partial-fill TP handling"`
Expected: FAIL — no partial-fill logic exists yet.

- [ ] **Step 3: Rewrite step 4 to handle partial fills**

In `src/strategies/spikebot.ts`, replace the entire step 4 block (lines ~215-263, from `// 4. Fill detection - spike orders` through `state.spikeOrders = remainingSpike;`) with:

```ts
        // 4. Fill detection — spike orders, including partial fills
        if (state.spikeOrders.length > 0) {
          const newOrders: TradeOrder[] = [];
          const newOrderMeta: Array<{ entryPrice: number; spikeLevel?: number; spikeTrigger?: SpikeTrigger }> = [];
          const remainingSpike: TrackedOrder[] = [];

          for (const tracked of state.spikeOrders) {
            const stillOpen = tracked.orderId
              ? openOrders.find(o => o.order_id === tracked.orderId)
              : openOrders.find(o => o.price === tracked.price && o.order_side === tracked.orderSide);

            if (!stillOpen) {
              // Case A — spike fully resolved. Place a terminal TP for the uncovered remainder.
              const terminalQty = +(tracked.quantity - (tracked.coveredQuantity ?? 0)).toFixed(market.bid_token.precision);
              if (terminalQty > 0) {
                const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
                const fillMsg = `[SpikeBot] Filled ${sideStr} spike at ${tracked.price} for ${symbol} (terminal qty ${terminalQty})`;
                logger.info(fillMsg);
                events.orderFilled(fillMsg, {
                  market: symbol,
                  side: sideStr,
                  quantity: terminalQty,
                  price: tracked.price,
                });

                const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
                tpOrder.quantity = terminalQty;
                newOrders.push(tpOrder);
                newOrderMeta.push({
                  entryPrice: tracked.price,
                  spikeLevel: tracked.spikeLevel,
                  spikeTrigger: tracked.spikeTrigger,
                });
              }
              continue;
            }

            // Spike still on-chain. Check for partial fill via quantity_curr.
            const quantityCurr = stillOpen.quantity_curr ?? tracked.quantity;
            const filledOnChain = +(tracked.quantity - quantityCurr).toFixed(market.bid_token.precision);
            const newlyUncovered = +(filledOnChain - (tracked.coveredQuantity ?? 0)).toFixed(market.bid_token.precision);

            if (newlyUncovered > 0) {
              // Case C — partial fill with new uncovered delta.
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              logger.info(`[SpikeBot] Partial fill ${sideStr} spike at ${tracked.price} for ${symbol}: +${newlyUncovered} newly uncovered (total filled ${filledOnChain} of ${tracked.quantity})`);
              events.orderFilled(`[SpikeBot] Partial fill ${sideStr} spike +${newlyUncovered} at ${tracked.price}`, {
                market: symbol,
                side: sideStr,
                quantity: newlyUncovered,
                price: tracked.price,
                partial: true,
              });

              const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
              tpOrder.quantity = newlyUncovered;
              newOrders.push(tpOrder);
              newOrderMeta.push({
                entryPrice: tracked.price,
                spikeLevel: tracked.spikeLevel,
                spikeTrigger: tracked.spikeTrigger,
              });

              tracked.coveredQuantity = filledOnChain;
            }
            // Case B — no new fill past tick: fall through, keep spike as-is.

            remainingSpike.push(tracked);
          }

          if (newOrders.length > 0) {
            this.offsetMixedSideCollisions(newOrders, market);
            await this.placeOrders(newOrders);
            const resolvedTP = await this.resolveOrderIds(newOrders, symbol);
            const now = new Date().toISOString();
            const placed = resolvedTP.map((r, i) => ({
              ...r,
              entryPrice: newOrderMeta[i].entryPrice,
              cyclesSincePlace: 0,
              originalTargetPrice: state.currentMA,
              spikeTrigger: newOrderMeta[i].spikeTrigger,
              spikeLevel: newOrderMeta[i].spikeLevel,
              adjustmentHistory: [{ price: r.price, at: now, reason: 'placed' as const }],
            }));
            state.takeProfitOrders.push(...placed);
          }
          state.spikeOrders = remainingSpike;
        }
```

- [ ] **Step 4: Run — all three new tests pass, existing tests still pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): detect partial spike fills and place delta TPs"
```

---

### Task 5: Terminal TP covers remainder after `coveredQuantity`

**Files:**
- Test: `test/strategies/spikebot.test.ts` (Task 4 already implemented the Case A branch that subtracts `coveredQuantity`; this task adds the dedicated test)

- [ ] **Step 1: Add test covering terminal fill with prior partial coverage**

Append inside the `describe('Partial-fill TP handling', ...)` block:

```ts
    it('terminal TP quantity equals tracked.quantity minus coveredQuantity', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 6,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // spike disappeared from on-chain
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(0);
      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].quantity).toBeCloseTo(4, 4);
    });
```

- [ ] **Step 2: Run — verify passing**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "terminal TP quantity equals"`
Expected: PASS (Task 4's implementation already covers this).

- [ ] **Step 3: Commit**

```bash
git add test/strategies/spikebot.test.ts
git commit -m "test(spikebot): verify terminal TP subtracts coveredQuantity"
```

---

### Task 6: Tick-threshold gating — skip sub-tick residuals in all three cases

**Files:**
- Modify: `src/strategies/spikebot.ts` (step 4 block from Task 4)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write three failing tests for sub-tick behavior**

Append inside the `describe('Partial-fill TP handling', ...)` block:

```ts
    it('skips partial-fill TP when newlyUncovered is below one tick', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      // XMT_XMD bid_token.precision = 4 → tick = 0.0001
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 3,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      // quantity_curr = 6.99995 → filledOnChain ≈ 3.00005 → newlyUncovered ≈ 0.00005 < 0.0001
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 6.99995 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.takeProfitOrders).toHaveLength(0);
      expect(state.spikeOrders[0].coveredQuantity).toBeCloseTo(3, 4);
    });

    it('places an accumulated TP once sub-tick residuals cross the tick threshold', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 3,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);

      // Cycle 1: sub-tick delta, no TP
      mockDexAPI.fetchPairOpenOrders.mockResolvedValueOnce([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 6.99995 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));
      await strategy.trade();
      expect(state.takeProfitOrders).toHaveLength(0);

      // Cycle 2: now quantity_curr = 6.9, filledOnChain = 3.1, newlyUncovered = 0.1 (>= tick)
      mockDexAPI.fetchPairOpenOrders.mockResolvedValueOnce([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 6.9 },
      ]);
      await strategy.trade();

      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].quantity).toBeCloseTo(0.1, 4);
      expect(state.spikeOrders[0].coveredQuantity).toBeCloseTo(3.1, 4);
    });

    it('skips terminal TP when residual is below one tick', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 9.99995,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // spike gone
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(0);
      expect(state.takeProfitOrders).toHaveLength(0);
    });
```

- [ ] **Step 2: Run — verify all three fail (or pass incorrectly)**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "sub-tick|accumulated TP|residual is below"`
Expected: FAIL. The first test fails because current code places a TP for 0.00005. The second fails because no accumulation happens (coveredQuantity was updated to 3.00005 on cycle 1). The third fails because current code places a 0.00005 terminal TP.

- [ ] **Step 3: Add tick gating to step 4**

In `src/strategies/spikebot.ts`, in the step 4 block from Task 4, add a `tick` constant at the top and replace the two places that test `> 0`:

After the line `// 4. Fill detection — spike orders, including partial fills`, add:

```ts
        const tick = Math.pow(10, -market.bid_token.precision);
```

In the Case A (terminal) branch, change:

```ts
              if (terminalQty > 0) {
```

to:

```ts
              if (terminalQty >= tick) {
```

And inside the `else` of that `if`, add logging for the sub-tick skip:

```ts
              } else if (terminalQty > 0) {
                logger.info(`[SpikeBot] Sub-tick terminal residual ${terminalQty} for ${symbol} spike — skipping TP placement`);
              }
```

In the Case C branch, change:

```ts
            if (newlyUncovered > 0) {
```

to:

```ts
            if (newlyUncovered >= tick) {
```

And add a sub-tick log immediately after the `if ... else` (after the `remainingSpike.push(tracked)` line is NOT the right place; do it inside the main per-spike loop after the `if (newlyUncovered >= tick) { ... }` block). Replace that block with:

```ts
            if (newlyUncovered >= tick) {
              // Case C — partial fill with new uncovered delta at or above tick threshold.
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              logger.info(`[SpikeBot] Partial fill ${sideStr} spike at ${tracked.price} for ${symbol}: +${newlyUncovered} newly uncovered (total filled ${filledOnChain} of ${tracked.quantity})`);
              events.orderFilled(`[SpikeBot] Partial fill ${sideStr} spike +${newlyUncovered} at ${tracked.price}`, {
                market: symbol,
                side: sideStr,
                quantity: newlyUncovered,
                price: tracked.price,
                partial: true,
              });

              const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
              tpOrder.quantity = newlyUncovered;
              newOrders.push(tpOrder);
              newOrderMeta.push({
                entryPrice: tracked.price,
                spikeLevel: tracked.spikeLevel,
                spikeTrigger: tracked.spikeTrigger,
              });

              tracked.coveredQuantity = filledOnChain;
            } else if (newlyUncovered > 0) {
              // Case B — sub-tick residual accumulates; do not update coveredQuantity.
              logger.info(`[SpikeBot] Sub-tick residual ${newlyUncovered} for ${symbol} spike — deferring`);
            }
```

- [ ] **Step 4: Run — all three tick tests pass, other tests still pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): skip sub-tick partial-fill residuals at market precision"
```

---

### Task 7: Immediate persist on partial-fill TP placement

**Files:**
- Modify: `src/strategies/spikebot.ts` (step 4 block)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing test**

Append inside `describe('Partial-fill TP handling', ...)`:

```ts
    it('persists tracked orders immediately when a partial-fill TP is placed', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 0,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 7 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

      const persistSpy = vi.spyOn(strategy as any, 'persistAllTrackedOrders');
      await strategy.trade();

      // Expect at least 2 calls: one inside step 4 after partial-fill placement, one at end-of-cycle
      expect(persistSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "persists tracked orders immediately"`
Expected: FAIL — persistAllTrackedOrders currently called only once (end-of-cycle).

- [ ] **Step 3: Add immediate persist after partial-fill placements**

In `src/strategies/spikebot.ts`, inside the step 4 block, find the part that processes `newOrders` (after the per-spike loop):

```ts
          if (newOrders.length > 0) {
            this.offsetMixedSideCollisions(newOrders, market);
            await this.placeOrders(newOrders);
            const resolvedTP = await this.resolveOrderIds(newOrders, symbol);
            const now = new Date().toISOString();
            const placed = resolvedTP.map((r, i) => ({
              ...r,
              entryPrice: newOrderMeta[i].entryPrice,
              cyclesSincePlace: 0,
              originalTargetPrice: state.currentMA,
              spikeTrigger: newOrderMeta[i].spikeTrigger,
              spikeLevel: newOrderMeta[i].spikeLevel,
              adjustmentHistory: [{ price: r.price, at: now, reason: 'placed' as const }],
            }));
            state.takeProfitOrders.push(...placed);
          }
          state.spikeOrders = remainingSpike;
```

Add a persist call after the TPs are pushed and after the spike state mutation:

```ts
          if (newOrders.length > 0) {
            this.offsetMixedSideCollisions(newOrders, market);
            await this.placeOrders(newOrders);
            const resolvedTP = await this.resolveOrderIds(newOrders, symbol);
            const now = new Date().toISOString();
            const placed = resolvedTP.map((r, i) => ({
              ...r,
              entryPrice: newOrderMeta[i].entryPrice,
              cyclesSincePlace: 0,
              originalTargetPrice: state.currentMA,
              spikeTrigger: newOrderMeta[i].spikeTrigger,
              spikeLevel: newOrderMeta[i].spikeLevel,
              adjustmentHistory: [{ price: r.price, at: now, reason: 'placed' as const }],
            }));
            state.takeProfitOrders.push(...placed);
            state.spikeOrders = remainingSpike;
            // Immediate persist: close the crash window between on-chain TP placement
            // and end-of-cycle persist so `coveredQuantity` can't be lost on a crash.
            this.persistAllTrackedOrders();
          } else {
            state.spikeOrders = remainingSpike;
          }
```

- [ ] **Step 4: Run — all tests pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): immediately persist tracked orders after partial-fill TP placement"
```

---

### Task 8: Collect filled non-spikes + step 7c spike re-placement (rebalance guard only)

**Files:**
- Modify: `src/strategies/spikebot.ts` (steps 5 and 5d collection; new step 7c after step 7b)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing tests for positive and negative re-placement cases**

Append to `test/strategies/spikebot.test.ts` inside the main `describe`:

```ts
  describe('Spike re-placement after non-spike fill', () => {
    it('re-places the original spike when TP fills and lastOrderMA matches spikeTrigger.price', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // TP filled
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(1);
      const spike = state.spikeOrders[0];
      expect(spike.orderSide).toBe(1);                  // opposite of TP (which was SELL)
      expect(spike.price).toBeCloseTo(0.9, 6);          // 1.0 × (1 - 0.10)
      expect(spike.spikeLevel).toBe(1);
      expect(spike.spikeTrigger.price).toBe(1.0);
      expect(spike.coveredQuantity).toBe(0);
    });

    it('does not re-place when spikeTrigger.price differs from lastOrderMA (rebalance occurred)', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.05, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.05;                         // grid rebuilt at 1.05
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.05, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.05,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,     // spike originally placed at MA=1.0
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.05);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // TP filled
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(0);
    });
  });
```

- [ ] **Step 2: Run — verify both fail**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "Spike re-placement after non-spike fill"`
Expected: FAIL — no re-placement logic exists yet. (The first test fails because `state.spikeOrders` stays empty. The second happens to pass "by accident" since there's no re-placement at all; keep both so it's explicit once implementation lands.)

- [ ] **Step 3: Add a cycle-local filled-non-spike collection to step 5**

In `src/strategies/spikebot.ts`, inside the `for (const state of this.pairStates)` loop (step 3 is already before the `try {`), declare a collection variable at the top of the `try` block. Find the line:

```ts
        // Snapshot take-profit orders before step 4 so that newly placed TPs
        // are not immediately checked for fill in step 5 of the same cycle.
        const existingTakeProfitOrders = [...state.takeProfitOrders];
```

Insert immediately before it:

```ts
        type FilledNonSpike = {
          orderSide: ORDERSIDES;
          spikeTrigger?: SpikeTrigger;
          spikeLevel?: number;
        };
        const filledNonSpikes: FilledNonSpike[] = [];
```

Then modify step 5 (the block starting `// 5. Fill detection - take-profit orders`). Find:

```ts
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
```

Replace with:

```ts
            if (!stillOpen) {
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              logger.info(`[SpikeBot] Take-profit ${sideStr} filled at ${tracked.price} for ${symbol}`);
              events.orderFilled(`[SpikeBot] Take-profit ${sideStr} filled at ${tracked.price}`, {
                market: symbol,
                side: sideStr,
                quantity: tracked.quantity,
                price: tracked.price,
              });
              filledNonSpikes.push({
                orderSide: tracked.orderSide,
                spikeTrigger: tracked.spikeTrigger,
                spikeLevel: tracked.spikeLevel,
              });
            } else {
              survivingExistingTP.push(tracked);
            }
```

- [ ] **Step 4: Add the same collection to step 5d (held recovery)**

Find the step 5d block `// 5d. Held recovery — fill detection.`. Inside its `if (!stillOpen) { ... }` branch:

```ts
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
```

Replace with:

```ts
            if (!stillOpen) {
              const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
              logger.info(`[SpikeBot] Held recovery ${sideStr} filled at ${tracked.price} for ${symbol}`);
              events.orderFilled(`[SpikeBot] Held recovery ${sideStr} filled at ${tracked.price}`, {
                market: symbol,
                side: sideStr,
                quantity: tracked.quantity,
                price: tracked.price,
              });
              filledNonSpikes.push({
                orderSide: tracked.orderSide,
                spikeTrigger: tracked.spikeTrigger,
                spikeLevel: tracked.spikeLevel,
              });
            } else {
```

- [ ] **Step 5: Add step 7c after step 7b**

Find the end of step 7b (the closing `}` of `if (rebalanced && rebalanceTPSnapshot.length > 0) { ... }`). Immediately after it, add step 7c:

```ts
        // 7c. Spike re-placement — for each non-spike order that filled this cycle,
        // re-place the originating spike if no rebalance has happened since it was placed.
        for (const entry of filledNonSpikes) {
          if (entry.spikeTrigger?.price === undefined || entry.spikeLevel === undefined) continue;
          if (entry.spikeTrigger.price !== state.lastOrderMA) continue;  // rebalance guard

          const originalSpikeSide = entry.orderSide === ORDERSIDES.SELL ? ORDERSIDES.BUY : ORDERSIDES.SELL;

          const spikeOrder = this.buildSingleSpikeOrder(
            symbol,
            state.lastOrderMA,
            state.config.deviationPct,
            entry.spikeLevel,
            originalSpikeSide,
            state.config.orderAmount,
            market,
          );

          await this.placeOrders([spikeOrder]);
          const resolved = await this.resolveOrderIds([spikeOrder], symbol);
          if (resolved.length > 0) {
            const now = new Date().toISOString();
            const tracked: TrackedOrder = {
              ...resolved[0],
              spikeTrigger: { price: state.lastOrderMA, at: now },
              spikeLevel: entry.spikeLevel,
              coveredQuantity: 0,
            };
            state.spikeOrders.push(tracked);
            const sideStr = originalSpikeSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
            logger.info(`[SpikeBot] Re-placed ${sideStr} spike at level ${entry.spikeLevel} (${tracked.price}) after non-spike fill`);
            events.gridPlaced(`[SpikeBot] Re-placed ${sideStr} spike at level ${entry.spikeLevel}`, {
              orders: [{
                market: symbol,
                side: sideStr,
                quantity: tracked.quantity,
                price: tracked.price,
              }],
            });
          }
        }
```

- [ ] **Step 6: Run — both tests pass, all existing tests still pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): re-place originating spike after non-spike fill"
```

---

### Task 9: Slot-occupancy guard

**Files:**
- Modify: `src/strategies/spikebot.ts` (step 7c)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing test — TP fills but a spike at same level+side already exists**

Append inside `describe('Spike re-placement after non-spike fill', ...)`:

```ts
    it('does not re-place when a spike at the same level+side already exists', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      // Existing BUY spike at level 1
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 's-existing', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 0,
      }];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      // Spike s-existing stays on-chain (unchanged); TP tp-1 is filled (absent)
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 's-existing', price: 0.9, order_side: 1, quantity_curr: 20 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      // Still exactly one spike (the existing one); no re-placement happened
      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].orderId).toBe('s-existing');
    });
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "does not re-place when a spike at the same level"`
Expected: FAIL — step 7c would place a duplicate BUY-level-1 spike.

- [ ] **Step 3: Add slot-occupancy guard to step 7c**

In `src/strategies/spikebot.ts` inside the step 7c loop, after the rebalance guard line, add the occupancy check. Find:

```ts
          if (entry.spikeTrigger.price !== state.lastOrderMA) continue;  // rebalance guard

          const originalSpikeSide = entry.orderSide === ORDERSIDES.SELL ? ORDERSIDES.BUY : ORDERSIDES.SELL;
```

Replace with:

```ts
          if (entry.spikeTrigger.price !== state.lastOrderMA) continue;  // rebalance guard

          const originalSpikeSide = entry.orderSide === ORDERSIDES.SELL ? ORDERSIDES.BUY : ORDERSIDES.SELL;
          const slotOccupied = state.spikeOrders.some(
            s => s.spikeLevel === entry.spikeLevel && s.orderSide === originalSpikeSide,
          );
          if (slotOccupied) continue;
```

- [ ] **Step 4: Run — the new test passes, all existing tests still pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): skip spike re-placement when slot is already occupied"
```

---

### Task 10: Held recovery fill triggers re-placement

**Files:**
- Test: `test/strategies/spikebot.test.ts` (behavior already wired in Task 8 step 5d)

- [ ] **Step 1: Write a test confirming held fills use the re-placement path**

Append inside `describe('Spike re-placement after non-spike fill', ...)`:

```ts
    it('re-places the spike when a held recovery order fills before any rebalance', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      state.spikeOrders = [];
      state.takeProfitOrders = [];
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'held-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
        heldSince: '2026-04-20T00:00:00Z',
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // held order filled
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.heldRecoveryOrders).toHaveLength(0);
      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].orderSide).toBe(1);
      expect(state.spikeOrders[0].price).toBeCloseTo(0.9, 6);
    });

    it('does not re-place when a held recovery order fills after a rebalance', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.05, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.05;
      state.spikeOrders = [];
      state.takeProfitOrders = [];
      state.heldRecoveryOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'held-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,       // from old grid
        heldSince: '2026-04-20T00:00:00Z',
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.05);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.heldRecoveryOrders).toHaveLength(0);
      expect(state.spikeOrders).toHaveLength(0);
    });
```

- [ ] **Step 2: Run — both tests pass**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "held recovery order"`
Expected: PASS (Task 8 already wired collection in step 5d).

- [ ] **Step 3: Commit**

```bash
git add test/strategies/spikebot.test.ts
git commit -m "test(spikebot): verify spike re-placement triggers on held-recovery fills"
```

---

### Task 11: Tier-bump preserves `spikeLevel` (and therefore supports re-placement)

**Files:**
- Modify: `src/strategies/spikebot.ts:386-397` (step 5c tier-bumped TP replacement)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing tests**

Append inside the main `describe('SpikeBotStrategy', ...)`:

```ts
  describe('spikeLevel preservation through tier-bump', () => {
    it('preserves spikeLevel when a TP is tier-bumped', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        maxReboundCycles: 1, reboundStepPct: 1.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.10, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 2, originalTargetPrice: 1.10,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.10, order_side: 2, quantity_curr: 20 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `bumped-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].spikeLevel).toBe(1);
      expect(state.takeProfitOrders[0].orderId).toBe('bumped-0');
    });

    it('re-places the spike at the ORIGINAL level when a tier-bumped TP fills', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      state.spikeOrders = [];
      // Tier-bumped TP at 1.05 (bumped from original 1.0); spikeLevel still 1
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.05, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-bumped', entryPrice: 0.9, cyclesSincePlace: 5, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
      }];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // tier-bumped TP filled
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.spikeOrders).toHaveLength(1);
      // Re-placed at ORIGINAL level-1 BUY (0.9), not from the bumped TP price (1.05)
      expect(state.spikeOrders[0].orderSide).toBe(1);
      expect(state.spikeOrders[0].price).toBeCloseTo(0.9, 6);
      expect(state.spikeOrders[0].spikeLevel).toBe(1);
    });
  });
```

- [ ] **Step 2: Run — verify failure**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "preserves spikeLevel when a TP is tier-bumped"`
Expected: FAIL — tier-bumped replacement doesn't copy spikeLevel.

- [ ] **Step 3: Add spikeLevel propagation in tier-bump**

In `src/strategies/spikebot.ts`, find the block in step 5c (around lines 386-397):

```ts
            if (resolved.length > 0) {
              const newTracked = resolved[0];
              newTracked.entryPrice = tracked.entryPrice;
              newTracked.cyclesSincePlace = tracked.cyclesSincePlace;
              newTracked.originalTargetPrice = tracked.originalTargetPrice;
              newTracked.spikeTrigger = tracked.spikeTrigger;
              newTracked.adjustmentHistory = [
                ...(tracked.adjustmentHistory ?? []),
                { price: newTracked.price, at: new Date().toISOString(), reason: 'tier-bump' as const },
              ];
              adjustedTP.push(newTracked);
            }
```

Add the `spikeLevel` copy:

```ts
            if (resolved.length > 0) {
              const newTracked = resolved[0];
              newTracked.entryPrice = tracked.entryPrice;
              newTracked.cyclesSincePlace = tracked.cyclesSincePlace;
              newTracked.originalTargetPrice = tracked.originalTargetPrice;
              newTracked.spikeTrigger = tracked.spikeTrigger;
              newTracked.spikeLevel = tracked.spikeLevel;
              newTracked.adjustmentHistory = [
                ...(tracked.adjustmentHistory ?? []),
                { price: newTracked.price, at: new Date().toISOString(), reason: 'tier-bump' as const },
              ];
              adjustedTP.push(newTracked);
            }
```

- [ ] **Step 4: Run — the new test passes, all existing tests still pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): preserve spikeLevel through tier-bump replacement"
```

---

### Task 12: Rebalance preserves `spikeLevel` on re-placed TPs and held transitions

**Files:**
- Modify: `src/strategies/spikebot.ts:535-623` (step 7b — add spikeLevel to tpMeta and held transition)
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write failing tests**

Append inside the main `describe('SpikeBotStrategy', ...)`:

```ts
  describe('spikeLevel preservation through rebalance', () => {
    it('preserves spikeLevel on TPs re-placed by the rebalance flow', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      // Drift the MA past threshold
      state.priceHistory = [1.0, ...Array(8).fill(1.06)];
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
      }];
      state.lastOrderMA = 1.0;
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 20 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `r-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].spikeLevel).toBe(1);
    });

    it('preserves spikeLevel when rebalance moves a TP to held', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      // Drift downward so new MA is below entryPrice for a SELL TP (forcing held)
      state.priceHistory = [1.0, ...Array(8).fill(0.85)];
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
      }];
      state.lastOrderMA = 1.0;
      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.85);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 20 },
      ]);
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `h-${i}`, placedAt: 'x' }));

      await strategy.trade();

      expect(state.heldRecoveryOrders).toHaveLength(1);
      expect(state.heldRecoveryOrders[0].spikeLevel).toBe(1);
    });
  });
```

- [ ] **Step 2: Run — verify both fail**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "spikeLevel preservation through rebalance"`
Expected: FAIL — rebalance paths don't copy `spikeLevel`.

- [ ] **Step 3: Add spikeLevel to `tpMeta` and to the held transition inside step 7b**

In `src/strategies/spikebot.ts`, find inside step 7b the declaration of `tpMeta` (around line 538):

```ts
          const tpMeta: { entryPrice: number; spikeTrigger?: SpikeTrigger; adjustmentHistory?: AdjustmentHistoryEntry[]; quantityCurr: number }[] = [];
```

Replace with:

```ts
          const tpMeta: { entryPrice: number; spikeTrigger?: SpikeTrigger; spikeLevel?: number; adjustmentHistory?: AdjustmentHistoryEntry[]; quantityCurr: number }[] = [];
```

Find the block that builds `tpMeta` entries (around lines 584-590):

```ts
            tpMeta.push({
              entryPrice: tracked.entryPrice!,
              spikeTrigger: tracked.spikeTrigger,
              adjustmentHistory: tracked.adjustmentHistory,
              quantityCurr,
            });
```

Replace with:

```ts
            tpMeta.push({
              entryPrice: tracked.entryPrice!,
              spikeTrigger: tracked.spikeTrigger,
              spikeLevel: tracked.spikeLevel,
              adjustmentHistory: tracked.adjustmentHistory,
              quantityCurr,
            });
```

Find the block that writes metadata onto resolved rebalanced TPs (around lines 598-612). Find the line:

```ts
              r.spikeTrigger = meta.spikeTrigger;
```

Replace with:

```ts
              r.spikeTrigger = meta.spikeTrigger;
              r.spikeLevel = meta.spikeLevel;
```

Find the held-transition branch inside step 7b (around lines 548-576). Find:

```ts
            if (maUnprofitable) {
              // Can't place a profitable TP at current MA — move to held
              const heldOrder: TrackedOrder = {
                ...tracked,
                heldSince: new Date().toISOString(),
                quantity: quantityCurr,
              };
```

The spread `...tracked` already copies `spikeLevel`, so no change is needed there — BUT verify it: the `tracked` here is a `TrackedOrder` that came from `rebalanceTPSnapshot`, which was populated earlier with `rebalanceTPSnapshot.push({ tracked, quantityCurr })`. The original tracked TP has `spikeLevel` from its lineage. The spread is safe. No edit required for this branch; the existing spread is sufficient once `spikeLevel` is present on the source TP (which it will be after Tasks 3, 11, and this task's earlier change).

- [ ] **Step 4: Run — both tests pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "feat(spikebot): preserve spikeLevel through rebalance re-placement and held transition"
```

---

### Task 13: Multiple TPs from one spike — sequential re-placement behavior

**Files:**
- Test: `test/strategies/spikebot.test.ts` (behavior already implemented by Tasks 8+9)

- [ ] **Step 1: Write test — first TP fills re-places spike; second from same lineage finds slot occupied**

Append inside `describe('Spike re-placement after non-spike fill', ...)`:

```ts
    it('replaces the spike on the first matching TP fill, then skips subsequent TP fills from the same lineage', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      state.spikeOrders = [];
      // Two TPs, same spike lineage
      state.takeProfitOrders = [
        {
          orderSide: 2, price: 1.0, quantity: 3, marketSymbol: 'XMT_XMD',
          orderId: 'tp-a', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
          spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
        },
        {
          orderSide: 2, price: 1.0, quantity: 7, marketSymbol: 'XMT_XMD',
          orderId: 'tp-b', entryPrice: 0.9, cyclesSincePlace: 0, originalTargetPrice: 1.0,
          spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1,
        },
      ];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // both filled
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

      await strategy.trade();

      // Exactly ONE re-placed spike, not two
      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].spikeLevel).toBe(1);
      expect(state.spikeOrders[0].orderSide).toBe(1);
    });
```

- [ ] **Step 2: Run — verify pass**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "replaces the spike on the first matching TP fill"`
Expected: PASS (first entry re-places; the mutation of `state.spikeOrders` makes the slot occupied for the second entry).

- [ ] **Step 3: Commit**

```bash
git add test/strategies/spikebot.test.ts
git commit -m "test(spikebot): verify only first TP fill from a spike lineage re-places"
```

---

### Task 14: End-to-end integration test — partial fill → full fill → re-placement

**Files:**
- Test: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Write the integration test exercising the full lifecycle**

Append inside the main `describe('SpikeBotStrategy', ...)`:

```ts
  describe('Full partial-fill → re-placement lifecycle', () => {
    it('handles partial fill, full fill, and sequential TP resolutions correctly', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 5.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 10 }],
      });
      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];
      state.lastOrderMA = 1.0;
      state.spikeOrders = [{
        orderSide: 1, price: 0.9, quantity: 10, marketSymbol: 'XMT_XMD',
        orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' }, spikeLevel: 1, coveredQuantity: 0,
      }];
      state.takeProfitOrders = [];
      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);

      let resolveCounter = 0;
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any) => ({ ...o, orderId: `gen-${resolveCounter++}`, placedAt: 'x' }));

      // Cycle 1: partial fill (3 of 10 filled) → TP₁ placed
      mockDexAPI.fetchPairOpenOrders.mockResolvedValueOnce([
        { order_id: 's-1', price: 0.9, order_side: 1, quantity_curr: 7 },
      ]);
      await strategy.trade();
      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].coveredQuantity).toBeCloseTo(3, 4);
      expect(state.takeProfitOrders).toHaveLength(1);
      const tp1Id = state.takeProfitOrders[0].orderId;

      // Cycle 2: spike fully fills (gone from open orders) → TP₂ placed for remaining 7
      mockDexAPI.fetchPairOpenOrders.mockResolvedValueOnce([
        { order_id: tp1Id, price: 1.0, order_side: 2, quantity_curr: 3 },
      ]);
      await strategy.trade();
      expect(state.spikeOrders).toHaveLength(0);
      expect(state.takeProfitOrders).toHaveLength(2);

      // Cycle 3: TP₁ fills → spike re-placed at level 1 BUY
      const tp2Id = state.takeProfitOrders.find((t: TrackedOrder) => t.orderId !== tp1Id)!.orderId;
      mockDexAPI.fetchPairOpenOrders.mockResolvedValueOnce([
        { order_id: tp2Id, price: 1.0, order_side: 2, quantity_curr: 7 },
      ]);
      await strategy.trade();
      expect(state.takeProfitOrders).toHaveLength(1);
      expect(state.takeProfitOrders[0].orderId).toBe(tp2Id);
      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].spikeLevel).toBe(1);
      expect(state.spikeOrders[0].orderSide).toBe(1);
      const replacedSpikeId = state.spikeOrders[0].orderId;

      // Cycle 4: TP₂ fills — slot already occupied by re-placed spike, so no second re-placement
      mockDexAPI.fetchPairOpenOrders.mockResolvedValueOnce([
        { order_id: replacedSpikeId, price: 0.9, order_side: 1, quantity_curr: 10 },
      ]);
      await strategy.trade();
      expect(state.takeProfitOrders).toHaveLength(0);
      expect(state.spikeOrders).toHaveLength(1);
      expect(state.spikeOrders[0].orderId).toBe(replacedSpikeId);
    });
  });
```

- [ ] **Step 2: Run — verify pass (no new implementation)**

Run: `npx vitest run test/strategies/spikebot.test.ts -t "Full partial-fill"`
Expected: PASS.

- [ ] **Step 3: Run the full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 4: Commit**

```bash
git add test/strategies/spikebot.test.ts
git commit -m "test(spikebot): end-to-end partial-fill and re-placement lifecycle"
```
