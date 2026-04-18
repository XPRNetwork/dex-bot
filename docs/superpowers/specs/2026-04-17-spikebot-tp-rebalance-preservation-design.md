# SpikeBot: Preserve Take-Profit Orders Across Grid Rebalances

## Problem

When the MA drifts beyond `rebalanceThresholdPct`, the bot performs a full grid replacement: it cancels all non-held on-chain orders, clears both `spikeOrders` and `takeProfitOrders` arrays, and places a fresh spike grid. Any active TP orders representing open positions are lost — the bot forgets it needs to close those positions.

This means a spike fill followed by an MA drift results in an orphaned position with no sell order to close it.

## Solution

During rebalance, snapshot existing TP orders before clearing. After the new spike grid is placed, re-place each TP at the new MA price with a fresh patience window. Preserve the original `entryPrice` as the hard floor so we never sell below cost.

## Design

### Rebalance Flow (spikebot.ts, lines ~453-468)

**Current:**
1. Detect MA drift > threshold
2. Cancel all non-held orders via `cancelPairOrders()`
3. Clear `spikeOrders = []` and `takeProfitOrders = []`
4. Place fresh spike grid

**New:**
1. Detect MA drift > threshold
2. **Snapshot `takeProfitOrders` with remaining on-chain quantities**
   - For each tracked TP, find its on-chain order in the already-fetched `openOrders` by `orderId`
   - Record `quantity_curr` from the on-chain order (remaining quantity after any partial fills)
   - If the on-chain order is not found, the TP was fully filled — skip it (treat as filled, emit fill event)
3. **Log any partial fills detected** during snapshot
   - If `quantity_curr < tracked.quantity`, log: `[SpikeBot] Rebalance: SELL TP partial fill detected — X of Y XHBAR filled at Z before re-placement`
   - Emit a dashboard event for visibility
4. Cancel all non-held orders via `cancelPairOrders()` (unchanged)
5. Clear `spikeOrders = []` and `takeProfitOrders = []` (unchanged)
6. Place fresh spike grid (unchanged)
7. **Re-place each snapshotted TP at the new MA:**
   - Build a new TP order at `state.currentMA` using `buildTakeProfitOrder()` (same side as original)
   - Use `quantity_curr` from the snapshot as the order quantity
   - Preserve from original: `entryPrice`, `spikeTrigger`
   - Reset: `cyclesSincePlace = 0`, `originalTargetPrice = state.currentMA`
   - Add to `adjustmentHistory`: `{ price: state.currentMA, at: now, reason: 'rebalance' }`
   - **Guard — entry price crossing:** If the new MA would not be profitable (SELL TP but MA <= entryPrice, or BUY TP but MA >= entryPrice), move to `heldRecoveryOrders` instead of re-placing. Log: `[SpikeBot] Rebalance: SELL TP moved to held — MA X below entry Y`
   - De-collide re-placed TPs using existing `offsetMixedSideCollisions()`
8. Place the re-built TP orders on-chain, resolve order IDs, push to `state.takeProfitOrders`
9. Log each re-placement: `[SpikeBot] Rebalance: re-placed SELL TP at X (was Y, entry Z)`

### Held Recovery Orders

No changes. Held orders are already excluded from `activeOpenOrders` and survive rebalances. If a TP's new MA crosses its entry price during rebalance, it gets moved to held recovery — joining the existing held lifecycle.

### Partial Fill Tracking

When snapshotting TPs before cancellation, compare `quantity_curr` from the on-chain order against the tracked TP's quantity. If there's a difference, a partial fill occurred. Log the filled amount and emit a dashboard event so the user has a record of the partial fill even though the TP is being re-placed.

### State Persistence

No changes needed. Re-placed TPs are stored in `state.takeProfitOrders` with `_type: 'takeProfit'` — existing persistence handles this. TPs moved to held go into `state.heldRecoveryOrders` with `_type: 'held'` — also already handled.

## Files to Modify

| File | Change |
|------|--------|
| `src/strategies/spikebot.ts` | Modify rebalance block to snapshot TPs, detect partial fills, and re-place at new MA |
| `test/strategies/spikebot.test.ts` | Add tests for TP re-placement, held fallback, multiple TPs, and partial fill detection |

## Test Cases

1. **TP re-placed at new MA after rebalance** — Verify price is new MA, `cyclesSincePlace` is 0, `entryPrice` preserved, `adjustmentHistory` has `'rebalance'` entry
2. **TP moved to held if new MA crosses entry** — SELL TP where new MA < entryPrice should end up in `heldRecoveryOrders`, not `takeProfitOrders`
3. **Multiple TPs re-placed independently** — Each preserves its own `entryPrice` and `spikeTrigger`
4. **Partial fill logged** — TP with `quantity_curr` < original quantity emits partial fill log/event and re-places with remaining quantity
5. **Fully filled TP during rebalance** — TP not found in `openOrders` is treated as filled, not re-placed

## No Changes Required

- `TrackedOrder` interface — already has all needed fields
- Config / `config.interface.ts` — no new settings
- `cancelPairOrders()` — unchanged, still cancels all non-held orders
- Held recovery lifecycle — unchanged
- State persistence — unchanged
