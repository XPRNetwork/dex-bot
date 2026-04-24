# SpikeBot: Spike Re-placement After Non-Spike Fill + Partial-Fill TP Handling

## Problem

Two gaps in the current spike lifecycle cause missed opportunities and uncovered inventory:

1. **Missing spike re-placement.** When a non-spike order resolves (a take-profit, tier-bumped TP, or held recovery order), the bot does not re-create the spike order that originated it. The spike level stays empty until the next MA-drift rebalance rebuilds the whole grid — and even then, the new grid is anchored around the drifted MA, not the original level that caught the move.

2. **Uncovered inventory on partial spike fills.** `spikebot.ts:216-263` treats a spike as "filled" only when it disappears from `openOrders` entirely. If a spike fills partially — quantity taken but order still on-book with remaining quantity — no TP is placed for the filled portion. That inventory sits unhedged until either the spike finishes filling or a rebalance cancels it.

## Solution

1. Preserve the `spikeLevel` on every spike and propagate it through every downstream order state. When a non-spike order fills, compare its `spikeTrigger.price` against `state.lastOrderMA`: if they match, no rebalance has occurred since the originating spike was placed, and the original spike is re-created at its original absolute price. If they differ, a rebalance already rebuilt the grid, so skip re-placement.

2. Detect partial spike fills by comparing on-chain `quantity_curr` against the tracked spike's quantity. Place a TP for the newly-uncovered delta, tracking coverage with a new `coveredQuantity` field on the spike so that repeated detections of the same partial fill never issue duplicate TPs.

## Design

### Data Model

Extend `TrackedOrder` (`src/interfaces/order.interface.ts:21`) with two fields:

```ts
spikeLevel?: number;        // 1..N; level of the originating spike order (config.levels)
coveredQuantity?: number;   // spike-only; total quantity already covered by TP placements
```

- `spikeLevel` is set on every spike at initial placement and inherited by every TP (standard, tier-bumped, rebalance-replaced, held). Needed to reconstruct the original spike price when re-placing.
- `coveredQuantity` is set on spikes only (default 0). It is the running sum of quantity that already has a TP placed against it. Never decreases.

Both fields persist through the existing `saveTrackedOrders` / `loadTrackedOrders` path; no changes to the persistence format are needed.

### Step 4 Rewrite: Spike Fill Detection With Partial-Fill Handling

Replace the current fill-detection block (`spikebot.ts:216-263`) with logic that distinguishes three states per tracked spike:

For each tracked spike, find the on-chain order in `openOrders`:

Let `tick = 10^(-market.bid_token.precision)` — the smallest quantity unit the DEX will accept on this market. All quantity comparisons and arithmetic below are quantized to this precision via `+x.toFixed(bid_token.precision)` to suppress JS floating-point drift.

**Case A — spike not found on-chain:** The spike is fully resolved (filled or cancelled). Let `terminalQty = tracked.quantity - (tracked.coveredQuantity ?? 0)`, quantized to `bid_token.precision`. If `terminalQty >= tick`, place a terminal TP for that amount and collect it into the cycle's `filledNonSpikes` list (see step 7c). If `terminalQty < tick`, skip placement and log a sub-tick-residual note — the residual is below what the DEX can accept. In either case, remove the spike from `state.spikeOrders`.

**Case B — spike found, no new fill:** If `(tracked.quantity - quantity_curr) - (tracked.coveredQuantity ?? 0) < tick` (quantized), no meaningful new fill since last cycle. No action.

**Case C — spike found, partial fill past tick threshold:** Compute:

```
filledOnChain  = +(tracked.quantity - quantity_curr).toFixed(bid_token.precision)
newlyUncovered = +(filledOnChain - (tracked.coveredQuantity ?? 0)).toFixed(bid_token.precision)
```

If `newlyUncovered >= tick`:
1. Build a TP at `state.currentMA`, side opposite the spike's, quantity `newlyUncovered`, carrying `entryPrice = tracked.price`, `spikeLevel = tracked.spikeLevel`, `spikeTrigger = tracked.spikeTrigger`, `cyclesSincePlace = 0`, `originalTargetPrice = state.currentMA`, `adjustmentHistory: [{ price: MA, at: now, reason: 'placed' }]`.
2. Place the TP, resolve its order ID, push to `state.takeProfitOrders`.
3. Set `tracked.coveredQuantity = filledOnChain`.
4. **Persist immediately** via `persistAllTrackedOrders()` — do not wait for end-of-cycle.
5. Emit a `partial-fill` log and dashboard event so operators can see the delta.
6. Keep the spike in `state.spikeOrders`.

If `newlyUncovered < tick`, skip placement **and do not update `coveredQuantity`**. The sub-tick residual accumulates with next cycle's fills; once it clears the tick threshold it gets placed in full, or if the spike terminates first, Case A sweeps it into the terminal TP.

Invariant (precision-aware): `tracked.coveredQuantity + quantity_curr === tracked.quantity  (±tick)`.

### Filled Non-Spike Collection

Today, step 5 (`spikebot.ts:265-292`) and step 5d (`spikebot.ts:420-444`) detect TP and held-recovery fills silently. Extend both to collect each filled order into a cycle-local list:

```ts
type FilledNonSpike = {
  orderSide: ORDERSIDES;          // side of the TP/held (opposite of original spike)
  spikeTrigger?: SpikeTrigger;
  spikeLevel?: number;
};
const filledNonSpikes: FilledNonSpike[] = [];
```

Case A of the new step 4 (spike fully resolves, terminal TP placed) also contributes a synthetic entry — but only after the terminal TP is subsequently detected as filled in a later cycle. The terminal TP itself does not immediately trigger re-placement in the same cycle it was placed.

No behavior changes inside steps 5 and 5d beyond the collection.

### Step 7c: Spike Re-placement

New step added after step 7b (rebalance TP re-placement, `spikebot.ts:535-623`).

For each entry in `filledNonSpikes`:

1. **Rebalance guard:** If `entry.spikeTrigger?.price !== state.lastOrderMA`, skip. A rebalance between spike placement and this TP fill has already rebuilt the grid at the new MA, so the old level should not be re-populated.
2. **Slot-occupancy guard:** Compute the original spike side (`opposite of entry.orderSide`) and level (`entry.spikeLevel`). If `state.spikeOrders` already contains an order with that side and level, skip. This handles the case where multiple partial-fill TPs from the same spike resolve in sequence — the first fill re-places the spike, later fills find the slot occupied.
3. **Build and place:** Use a new `buildSingleSpikeOrder` helper (see below) with `anchorMA = state.lastOrderMA`, `deviationPct = state.config.deviationPct`, `level = entry.spikeLevel`, `side = originalSpikeSide`, `orderAmount = state.config.orderAmount`. Place on-chain, resolve order ID, and push to `state.spikeOrders` with a fresh `spikeTrigger = { price: state.lastOrderMA, at: now }`, `spikeLevel = entry.spikeLevel`, `coveredQuantity = 0`.
4. Log and emit a dashboard event for the re-placement.

Running step 7c after step 7 (initial placement) and step 7b (rebalance TP re-placement) is intentional: if a rebalance fired in step 6, `lastOrderMA` was updated to the current MA, and the rebalance guard in step 1 above will skip every filled non-spike cleanly — the new spike grid from step 7 already covers those levels.

### Helper: `buildSingleSpikeOrder`

Extract the per-level/per-side price-and-quantity math from `buildSpikeOrders` (`spikebot.ts:822-855`) into a standalone helper:

```ts
private buildSingleSpikeOrder(
  symbol: string,
  anchorMA: number,
  deviationPct: number,
  level: number,
  side: ORDERSIDES,
  orderAmount: number,
  market: Market,
): TradeOrder
```

Refactor `buildSpikeOrders` to call this helper in its level loop so the spike price formula has exactly one source of truth.

### Propagating `spikeLevel` Through All TP States

The `spikeLevel` field must be attached at every point a spike or TP is created or rebuilt:

- Initial spike placement (`spikebot.ts:530`): set `spikeLevel` based on the loop index from `buildSpikeOrders`.
- Standard TP placement after full fill (`spikebot.ts:239-244`, `255-260`): inherit from `tracked.spikeLevel`.
- Partial-fill TP placement (new, see step 4): inherit from `tracked.spikeLevel`.
- Tier-bumped TP replacement (`spikebot.ts:386-397`): inherit from old `tracked.spikeLevel`.
- Held recovery transition (`spikebot.ts:333-360`): `spikeLevel` already carried on the tracked object, no change needed.
- Rebalance TP re-placement (`spikebot.ts:599-612`): inherit from original TP (add to `tpMeta`).
- Rebalance held transition (`spikebot.ts:548-576`): inherit from original TP.

Because `buildSpikeOrders` returns `TradeOrder[]` (no level field), the caller at `spikebot.ts:528-531` already iterates the resolved orders; amend it to attach `spikeLevel` by index (level = Math.floor(index / 2) + 1 given the BUY-then-SELL pairing in the builder, or — cleaner — have the refactored `buildSpikeOrders` return a structure that carries the level alongside each order).

### Crash-Safety for Partial-Fill Bookkeeping

The existing `persistAllTrackedOrders()` call at end-of-cycle (`spikebot.ts:632`) is insufficient for the partial-fill path. If the bot crashes between an on-chain partial-fill TP placement and the end of the cycle, on restart the persisted `coveredQuantity` is stale and the same partial fill would be re-detected, producing a duplicate TP.

Mitigation: in Case C of the new step 4, call `persistAllTrackedOrders()` immediately after setting `tracked.coveredQuantity = filledOnChain` (i.e., after on-chain placement succeeded and in-memory state has been updated). This closes the crash window to the time between the DEX acknowledging the order and a single JSON file write.

Startup reconciliation (`spikebot.ts:118-135`) is unchanged in scope — it still drops tracked orders not on-chain. It does not attempt to discover orphaned on-chain TPs whose `coveredQuantity` never persisted, because identifying TP lineage from on-chain data alone is unreliable (the DEX exposes only side/price/quantity/id, not `entryPrice` or `spikeLevel`). The immediate-persist pattern is the primary safety mechanism.

## Files to Modify

| File | Change |
|------|--------|
| `src/interfaces/order.interface.ts` | Add `spikeLevel?: number` and `coveredQuantity?: number` to `TrackedOrder` |
| `src/strategies/spikebot.ts` | Rewrite step 4 for partial-fill handling; add filled-non-spike collection in steps 5 and 5d; add step 7c spike re-placement; extract `buildSingleSpikeOrder` helper; propagate `spikeLevel` through all TP creation paths; immediate-persist in partial-fill path |
| `test/strategies/spikebot.test.ts` | Add tests for partial-fill TP coverage, `coveredQuantity` invariant, spike re-placement under all guard conditions, and crash-safety (persist call count) |

## Test Cases

### Partial-Fill TP Handling

1. **Partial fill places TP for delta.** Spike of quantity 10 with `quantity_curr = 7` on-chain triggers a TP of quantity 3; `coveredQuantity` becomes 3.
2. **Second partial fill places another TP.** Same spike now at `quantity_curr = 4` triggers a TP of quantity 3 (7 − 4); `coveredQuantity` becomes 6.
3. **No new fill produces no TP.** Spike's `quantity_curr` unchanged across cycles: zero new TPs placed.
4. **Idempotency: repeated step 4 in same cycle produces no duplicate.** Calling the fill-detection block twice with the same on-chain state issues exactly one TP.
5. **Terminal fill covers remainder.** Spike disappears from `openOrders` with `coveredQuantity = 6`; terminal TP quantity is `10 − 6 = 4`.
6. **Immediate persist on partial fill.** `persistAllTrackedOrders` is called inside step 4 (not only at end-of-cycle) whenever a partial-fill TP is issued.
7. **Sub-tick residual is not placed.** `newlyUncovered < tick` (e.g. 1e-15 float drift, or a true remainder below market precision): no TP placed, `coveredQuantity` unchanged. Verified by asserting `placeOrders` was not called.
8. **Sub-tick residual accumulates and later places.** Two successive cycles each generate a sub-tick `newlyUncovered`; the third cycle pushes the cumulative uncovered past tick, producing one TP covering the full accumulated amount.
9. **Sub-tick terminal residual skips Case A placement.** Spike terminates with `tracked.quantity - coveredQuantity < tick`: no terminal TP placed, sub-tick log emitted, spike removed.

### Spike Re-placement

10. **TP fills before any rebalance, slot empty → spike re-placed.** Spike fully filled, TP fills, `lastOrderMA === spikeTrigger.price`, no existing spike at that side+level: a new spike is placed at `spikeTrigger.price × (1 ± deviationPct × level / 100)`.
11. **TP fills after a rebalance → spike not re-placed.** Setup: TP carried through rebalance, `spikeTrigger.price !== state.lastOrderMA`: re-placement is skipped.
12. **TP fills while parent spike has remaining quantity → spike not re-placed.** Partial-fill TP resolves while parent spike is still in `state.spikeOrders`: slot occupied, skipped.
13. **Multiple TPs from one fully-filled spike resolve in sequence.** First TP fill re-places spike; subsequent TP fills from same lineage find the slot occupied and skip.
14. **Held recovery order fills before rebalance → spike re-placed.** Held order with matching `lastOrderMA` fills; spike is re-placed.
15. **Held recovery order fills after rebalance → spike not re-placed.** Standard case for held orders that survived a rebalance.
16. **Tier-bumped TP fills before rebalance → spike re-placed at original level.** Even though TP price changed via tier-bump, `spikeLevel` and `spikeTrigger` were preserved; re-placement uses the original spike level, not the bumped TP price.
17. **`spikeLevel` propagates through all TP creation paths.** Verified across: standard TP, partial-fill TP, tier-bumped TP, rebalance-replaced TP, held-transitioned TP.

### Integration

18. **Full partial-fill → re-placement lifecycle.** Spike partially fills (TP₁ placed), fully fills (TP₂ placed), TP₁ fills (spike re-placed), TP₂ fills (slot occupied, no re-placement). Final state: one fresh spike, zero TPs.

## Out of Scope

- On-chain orphaned-TP reconciliation at startup (identifying TPs on-chain that were placed by a crashed instance but never persisted). The immediate-persist mitigation is considered sufficient.
- Changes to rebalance's own TP preservation flow — that was handled by the 2026-04-17 spec and is left untouched.
- Changes to the held recovery lifecycle beyond adding `spikeLevel` propagation.
- New configuration knobs; all behavior is deterministic from existing `deviationPct`, `levels`, and `rebalanceThresholdPct`.
