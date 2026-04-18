# SpikeBot TP Rebalance Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve take-profit orders across grid rebalances by re-placing them at the new MA with a fresh patience window, instead of losing them.

**Architecture:** When MA drift triggers a rebalance, snapshot existing TPs (with their on-chain remaining quantities), cancel all orders as before, place the fresh spike grid, then re-place each snapshotted TP at the new MA price. If the new MA crosses a TP's entry price, move it to held recovery instead. Log partial fills detected during the snapshot.

**Tech Stack:** TypeScript, Vitest

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/interfaces/order.interface.ts` | Modify | Add `'rebalance'` to `AdjustmentHistoryEntry.reason` |
| `src/strategies/spikebot.ts` | Modify | Rebalance block (lines ~453-493): snapshot TPs, re-place after grid |
| `test/strategies/spikebot.test.ts` | Modify | Update existing rebalance test, add new tests |

---

### Task 1: Add 'rebalance' to AdjustmentHistoryEntry reason

**Files:**
- Modify: `src/interfaces/order.interface.ts:13`

- [ ] **Step 1: Update the reason union type**

In `src/interfaces/order.interface.ts`, change line 13:

```typescript
// Before:
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual';

// After:
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual' | 'rebalance';
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/interfaces/order.interface.ts
git commit -m "feat(spikebot): add 'rebalance' to AdjustmentHistoryEntry reason type"
```

---

### Task 2: Write failing tests for TP re-placement after rebalance

**Files:**
- Modify: `test/strategies/spikebot.test.ts`

- [ ] **Step 1: Update the existing rebalance test**

The existing test at line 67 (`'triggers rebalance when only take-profit orders exist and MA drifts'`) currently only asserts that `cancelOrder` is called. After our change, the TP gets re-placed, so we need to mock `resolveOrderIds` and update assertions.

Find the test block starting with `describe('Bug fix: MA drift check during take-profit phase'` and replace the test:

```typescript
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
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 20 },
      ]);

      // Mock resolveOrderIds for the re-placed TP and spike orders
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      // Old TP should be cancelled during rebalance
      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
      // TP should be re-placed at new MA (1.054) with fresh metadata
      expect(state.takeProfitOrders.length).toBe(1);
      const tp = state.takeProfitOrders[0];
      expect(tp.entryPrice).toBe(0.9);
      expect(tp.cyclesSincePlace).toBe(0);
      expect(tp.originalTargetPrice).toBe(1.054);
      expect(tp.orderSide).toBe(2); // still SELL
    });
  });
```

- [ ] **Step 2: Add test for TP moved to held when MA crosses entry price**

Add a new describe block after the existing `'Bug fix: MA drift check during take-profit phase'` block:

```typescript
  describe('Rebalance: TP preservation', () => {
    it('moves TP to held recovery when new MA crosses entry price (SELL)', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // MA will drift to 0.85 — below entryPrice of 0.9
      state.priceHistory = Array(9).fill(0.85);
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 10, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: '2026-04-17T00:00:00Z' },
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(0.85);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 20 },
      ]);

      // Mock resolveOrderIds for spike orders only (TP should go to held, not re-placed)
      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
      // TP should be in held, not takeProfitOrders
      expect(state.takeProfitOrders.length).toBe(0);
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.heldRecoveryOrders[0].entryPrice).toBe(0.9);
      expect(state.heldRecoveryOrders[0].heldSince).toBeDefined();
    });

    it('moves BUY TP to held when new MA crosses entry price', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // MA will drift to 1.15 — above entryPrice of 1.1 (BUY TP should not buy above entry)
      state.priceHistory = Array(9).fill(1.15);
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 1, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 1.1, cyclesSincePlace: 5, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: '2026-04-17T00:00:00Z' },
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.15);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 1, quantity_curr: 20 },
      ]);

      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
      expect(state.takeProfitOrders.length).toBe(0);
      expect(state.heldRecoveryOrders.length).toBe(1);
      expect(state.heldRecoveryOrders[0].entryPrice).toBe(1.1);
    });

    it('re-places TP with remaining quantity from partial fill', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // MA drifts to 1.054
      state.priceHistory = Array(9).fill(1.06);
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 3, originalTargetPrice: 1.0,
        spikeTrigger: { price: 1.0, at: '2026-04-17T00:00:00Z' },
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
      // quantity_curr is 18 — means 2 were filled (partial fill)
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 18 },
      ]);

      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      expect(state.takeProfitOrders.length).toBe(1);
      // Re-placed TP should use remaining quantity (18), not original (20)
      expect(state.takeProfitOrders[0].quantity).toBe(18);
      expect(state.takeProfitOrders[0].entryPrice).toBe(0.9);
      expect(state.takeProfitOrders[0].cyclesSincePlace).toBe(0);
    });

    it('treats fully filled TP during rebalance as filled (not re-placed)', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // MA drifts to 1.054
      state.priceHistory = Array(9).fill(1.06);
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 3, originalTargetPrice: 1.0,
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
      // TP is NOT in open orders — it was fully filled
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]);

      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      // TP was filled, not re-placed. Fill detection in step 5 handles it.
      // After rebalance, no TPs to re-place since none were on-chain.
      expect(state.takeProfitOrders.length).toBe(0);
    });

    it('re-places multiple TPs independently during rebalance', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      // MA drifts to 1.054
      state.priceHistory = Array(9).fill(1.06);
      state.spikeOrders = [];
      state.takeProfitOrders = [
        {
          orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
          orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 3, originalTargetPrice: 1.0,
          spikeTrigger: { price: 1.0, at: '2026-04-17T00:00:00Z' },
        },
        {
          orderSide: 2, price: 1.02, quantity: 15, marketSymbol: 'XMT_XMD',
          orderId: 'tp-2', entryPrice: 0.85, cyclesSincePlace: 8, originalTargetPrice: 1.02,
          spikeTrigger: { price: 0.98, at: '2026-04-16T00:00:00Z' },
        },
      ];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 20 },
        { order_id: 'tp-2', price: 1.02, order_side: 2, quantity_curr: 15 },
      ]);

      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      expect(cancelOrder).toHaveBeenCalledWith('tp-1');
      expect(cancelOrder).toHaveBeenCalledWith('tp-2');
      expect(state.takeProfitOrders.length).toBe(2);
      // Both should preserve their own entryPrice
      expect(state.takeProfitOrders[0].entryPrice).toBe(0.9);
      expect(state.takeProfitOrders[1].entryPrice).toBe(0.85);
      // Both reset cycle counter
      expect(state.takeProfitOrders[0].cyclesSincePlace).toBe(0);
      expect(state.takeProfitOrders[1].cyclesSincePlace).toBe(0);
      // Both should have spikeTrigger preserved
      expect(state.takeProfitOrders[0].spikeTrigger).toEqual({ price: 1.0, at: '2026-04-17T00:00:00Z' });
      expect(state.takeProfitOrders[1].spikeTrigger).toEqual({ price: 0.98, at: '2026-04-16T00:00:00Z' });
    });

    it('logs adjustment history with rebalance reason', async () => {
      await strategy.initialize({
        maWindow: 10, rebalanceThresholdPct: 2.0,
        pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
      });

      warmUpMA(strategy, 1.0, 10);
      const state = (strategy as any).pairStates[0];

      state.priceHistory = Array(9).fill(1.06);
      state.spikeOrders = [];
      state.takeProfitOrders = [{
        orderSide: 2, price: 1.0, quantity: 20, marketSymbol: 'XMT_XMD',
        orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 5, originalTargetPrice: 1.0,
        adjustmentHistory: [{ price: 1.0, at: '2026-04-17T00:00:00Z', reason: 'placed' }],
      }];
      state.lastOrderMA = 1.0;

      mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
      mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
        { order_id: 'tp-1', price: 1.0, order_side: 2, quantity_curr: 20 },
      ]);

      (strategy as any).resolveOrderIds = async (orders: any[]) =>
        orders.map((o: any, i: number) => ({ ...o, orderId: `resolved-${i}`, placedAt: new Date().toISOString() }));

      await strategy.trade();

      const history = state.takeProfitOrders[0].adjustmentHistory;
      expect(history).toHaveLength(2);
      expect(history[0].reason).toBe('placed');
      expect(history[1].reason).toBe('rebalance');
      expect(history[1].price).toBeCloseTo(1.054, 3);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: New tests FAIL (rebalance currently clears TPs without re-placing). The updated existing test also FAILs because it expects `state.takeProfitOrders.length` to be 1 but gets 0.

- [ ] **Step 4: Commit failing tests**

```bash
git add test/strategies/spikebot.test.ts
git commit -m "test(spikebot): add failing tests for TP preservation across rebalances"
```

---

### Task 3: Implement TP preservation in the rebalance block

**Files:**
- Modify: `src/strategies/spikebot.ts:453-493`

- [ ] **Step 1: Implement the rebalance TP snapshot and re-placement**

Replace the rebalance block (step 6, lines 453-468) and modify the initial placement block (step 7, lines 471-493) in `src/strategies/spikebot.ts`.

Replace lines 453-493 with:

```typescript
        // 6. MA drift check - rebalance if MA shifted beyond threshold
        let rebalanced = false;
        let rebalanceTPSnapshot: { tracked: TrackedOrder; quantityCurr: number }[] = [];
        if (state.lastOrderMA > 0 && (state.spikeOrders.length > 0 || state.takeProfitOrders.length > 0)) {
          const driftPct = Math.abs(state.currentMA - state.lastOrderMA) / state.lastOrderMA * 100;
          if (driftPct > this.rebalanceThresholdPct) {
            const reason = `MA drift ${driftPct.toFixed(2)}% exceeds threshold — rebalancing`;
            logger.info(`[SpikeBot] ${symbol} ${reason}`);
            this.setLastCancelReason(state, reason);

            // Snapshot TPs with their on-chain remaining quantities before cancelling
            for (const tracked of state.takeProfitOrders) {
              const onChain = tracked.orderId
                ? openOrders.find(o => o.order_id === tracked.orderId)
                : openOrders.find(o => o.price === tracked.price && o.order_side === tracked.orderSide);

              if (!onChain) {
                // TP was fully filled between fetch and now — log as filled, skip re-placement
                const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
                logger.info(`[SpikeBot] Take-profit ${sideStr} filled at ${tracked.price} for ${symbol} (detected during rebalance)`);
                events.orderFilled(`[SpikeBot] Take-profit ${sideStr} filled at ${tracked.price} (during rebalance)`, {
                  market: symbol,
                  side: sideStr,
                  quantity: tracked.quantity,
                  price: tracked.price,
                });
                continue;
              }

              const quantityCurr = (onChain as any).quantity_curr ?? tracked.quantity;

              // Log partial fill if detected
              if (quantityCurr < tracked.quantity) {
                const filledQty = +(tracked.quantity - quantityCurr).toFixed(market.bid_token.precision);
                const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';
                logger.info(`[SpikeBot] Rebalance: ${sideStr} TP partial fill detected — ${filledQty} of ${tracked.quantity} filled at ${tracked.price} before re-placement`);
                events.orderFilled(`[SpikeBot] Rebalance: ${sideStr} TP partial fill — ${filledQty} of ${tracked.quantity} at ${tracked.price}`, {
                  market: symbol,
                  side: sideStr,
                  quantity: filledQty,
                  price: tracked.price,
                  partial: true,
                });
              }

              rebalanceTPSnapshot.push({ tracked, quantityCurr });
            }

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
            const reason = `clearing ${activeOpenOrders.length} stale orders before fresh placement`;
            logger.info(`[SpikeBot] ${symbol} ${reason}`);
            this.setLastCancelReason(state, reason);
            await this.cancelPairOrders(symbol, activeOpenOrders);
            await dexrpc.withdrawAll();
            await delay(2000);
          }

          const spikeOrders = this.buildSpikeOrders(symbol, state.currentMA, state.config, market);
          if (spikeOrders.length > 0) {
            logger.info(`[SpikeBot] ${symbol} placing ${spikeOrders.length} spike orders around MA ${state.currentMA.toFixed(market.ask_token.precision)}`);
            const trigger = { price: state.currentMA, at: new Date().toISOString() };
            await this.placeOrders(spikeOrders);
            const resolved = await this.resolveOrderIds(spikeOrders, symbol);
            state.spikeOrders = resolved.map(o => ({ ...o, spikeTrigger: { ...trigger } }));
            state.lastOrderMA = state.currentMA;
          }
        }

        // 7b. Re-place snapshotted TPs after rebalance
        if (rebalanced && rebalanceTPSnapshot.length > 0) {
          const tpOrders: TradeOrder[] = [];
          const tpMeta: { entryPrice: number; spikeTrigger?: import('../interfaces').SpikeTrigger; adjustmentHistory?: import('../interfaces').AdjustmentHistoryEntry[]; quantityCurr: number }[] = [];

          for (const { tracked, quantityCurr } of rebalanceTPSnapshot) {
            const sideStr = tracked.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL';

            // Guard: if new MA crosses entry price, move to held recovery
            const maUnprofitable = tracked.orderSide === ORDERSIDES.SELL
              ? state.currentMA <= tracked.entryPrice!
              : state.currentMA >= tracked.entryPrice!;

            if (maUnprofitable) {
              // Can't place a profitable TP at current MA — move to held
              const heldOrder: TrackedOrder = {
                ...tracked,
                heldSince: new Date().toISOString(),
                quantity: quantityCurr,
              };
              // Held orders don't have an on-chain order (it was cancelled in rebalance)
              // Place a new order at current price to keep it on-chain
              const filledSide = tracked.orderSide === ORDERSIDES.SELL ? ORDERSIDES.BUY : ORDERSIDES.SELL;
              const heldTpOrder = this.buildTakeProfitOrder(symbol, tracked.price, filledSide, state.config.orderAmount, market);
              heldTpOrder.quantity = quantityCurr;
              await this.placeOrders([heldTpOrder]);
              const resolvedHeld = await this.resolveOrderIds([heldTpOrder], symbol);
              if (resolvedHeld.length > 0) {
                heldOrder.orderId = resolvedHeld[0].orderId;
                heldOrder.price = resolvedHeld[0].price;
              }
              state.heldRecoveryOrders.push(heldOrder);

              logger.info(`[SpikeBot] Rebalance: ${sideStr} TP moved to held — MA ${state.currentMA.toFixed(market.ask_token.precision)} ${tracked.orderSide === ORDERSIDES.SELL ? 'below' : 'above'} entry ${tracked.entryPrice}`);
              events.orderHeld(`[SpikeBot] Rebalance: ${sideStr} TP moved to held — MA crosses entry`, {
                market: symbol,
                side: sideStr,
                price: tracked.price,
                entryPrice: tracked.entryPrice!,
                currentMA: state.currentMA,
              });
              continue;
            }

            // Build replacement TP at new MA
            const filledSide = tracked.orderSide === ORDERSIDES.SELL ? ORDERSIDES.BUY : ORDERSIDES.SELL;
            const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, filledSide, state.config.orderAmount, market);
            // Override quantity with remaining on-chain quantity
            tpOrder.quantity = quantityCurr;
            tpOrders.push(tpOrder);
            tpMeta.push({
              entryPrice: tracked.entryPrice!,
              spikeTrigger: tracked.spikeTrigger,
              adjustmentHistory: tracked.adjustmentHistory,
              quantityCurr,
            });

            logger.info(`[SpikeBot] Rebalance: re-placed ${sideStr} TP at ${state.currentMA.toFixed(market.ask_token.precision)} (was ${tracked.price.toFixed(market.ask_token.precision)}, entry ${tracked.entryPrice})`);
          }

          if (tpOrders.length > 0) {
            this.offsetMixedSideCollisions(tpOrders, market);
            await this.placeOrders(tpOrders);
            const resolvedTP = await this.resolveOrderIds(tpOrders, symbol);
            const now = new Date().toISOString();
            for (let i = 0; i < resolvedTP.length; i++) {
              const r = resolvedTP[i];
              const meta = tpMeta[i];
              r.entryPrice = meta.entryPrice;
              r.cyclesSincePlace = 0;
              r.originalTargetPrice = state.currentMA;
              r.spikeTrigger = meta.spikeTrigger;
              r.quantity = meta.quantityCurr;
              r.adjustmentHistory = [
                ...(meta.adjustmentHistory ?? []),
                { price: r.price, at: now, reason: 'rebalance' as const },
              ];
              state.takeProfitOrders.push(r);
            }

            events.gridPlaced(`[SpikeBot] Re-placed ${resolvedTP.length} TP orders after rebalance`, {
              orders: resolvedTP.map(o => ({
                market: symbol,
                side: o.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL',
                quantity: o.quantity,
                price: o.price,
              })),
            });
          }
        }
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run test/strategies/spikebot.test.ts`
Expected: All tests PASS, including the new rebalance preservation tests.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/strategies/spikebot.ts
git commit -m "feat(spikebot): preserve take-profit orders across grid rebalances

During MA drift rebalance, snapshot existing TPs with their on-chain
remaining quantities. After placing the fresh spike grid, re-place each
TP at the new MA with a reset patience window. If the new MA crosses a
TP's entry price, move it to held recovery instead.

Partial fills are detected and logged during the snapshot step."
```

---

### Task 4: Verify and clean up

- [ ] **Step 1: Run full test suite one more time**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Review the diff**

Run: `git diff HEAD~3..HEAD --stat` to confirm only the expected files were changed.

Expected files:
- `src/interfaces/order.interface.ts` (1 line changed)
- `src/strategies/spikebot.ts` (rebalance block modified)
- `test/strategies/spikebot.test.ts` (tests added/updated)
