# Spike Bot Held-Recovery Design

## Problem

When a take-profit (TP) order's tiered-recovery step would cross entry price, `src/strategies/spikebot.ts:241-284` **cancels the still-valid TP** and abandons the position. Two concrete failures observed in the 2026-04-11 XMT_XMD incident:

1. A SELL TP sitting at 0.280795 (above entry 0.28006, still profitable) was cancelled because the *next* rebound step (0.279391) would cross entry. Mean-reversion to 0.280795 would have filled the original TP, but the order was gone.
2. The spike order placement gate at `spikebot.ts:355` requires both `spikeOrders` and `takeProfitOrders` to be empty before placing new spikes. So even if the abandon fix left the TP alive, a single unfilled TP would freeze the bot on that pair — no new spike orders at all until it fills.

## Goal

Replace "abandon" with "hold in place": keep the on-chain TP live, move it out of the active TP list so it does not block new spike placement, and surface it on the dashboard so operators can see what's held and why.

## Architecture

Introduce a third bucket in `PairState` alongside `spikeOrders` and `takeProfitOrders`:

```ts
heldRecoveryOrders: TrackedOrder[]
```

When Phase 2 adjustment would cross entry, the TP is moved from `takeProfitOrders` into `heldRecoveryOrders`. The on-chain limit order is **not** cancelled. Held orders are fill-detected each cycle but do not participate in tiered recovery or the spike placement gate.

### Bucket responsibilities

| Bucket | Gates spike placement? | Participates in tiered recovery? | Fill-detected? | Cancelled on MA-drift rebalance? |
|---|---|---|---|---|
| `spikeOrders` | yes | no | yes (step 4) | yes |
| `takeProfitOrders` | yes | yes (Phase 2 adjustment) | yes (step 5) | yes |
| `heldRecoveryOrders` | **no** | no | yes (new step 5d) | **no** |

Held orders are excluded from `cancelPairOrders` during MA-drift rebalance — they represent specific past entries and should be judged against their entry price, not the current MA.

## Data Model

### `TrackedOrder` (`src/interfaces/order.interface.ts`)

Add one optional field:

```ts
heldSince?: string;   // ISO timestamp set when the TP moves to heldRecoveryOrders
```

Existing `entryPrice`, `cyclesSincePlace`, and `originalTargetPrice` are preserved when the order moves buckets.

### `PairState` (`src/strategies/spikebot.ts`)

```ts
interface PairState {
  // ... existing fields
  spikeOrders: TrackedOrder[];
  takeProfitOrders: TrackedOrder[];
  heldRecoveryOrders: TrackedOrder[];   // new
}
```

Initialized to `[]`. Restored from persistence on startup.

### Persistence

`persistAllTrackedOrders()` currently flushes `spikeOrders + takeProfitOrders`. Extend the on-disk JSON per pair to include a `held` key:

```json
{
  "spike": [...],
  "takeProfit": [...],
  "held": [...]
}
```

Restore logic routes each array back into its matching bucket on the `PairState`.

### `RecoveryOrderState` (shared with dashboard via `order-state.json`)

Extend the phase union and add an optional timestamp:

```ts
interface RecoveryOrderState {
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  originalTargetPrice: number;
  cyclesSincePlace: number;
  phase: 'patience' | 'adjusting' | 'held';   // 'held' is new
  heldSince?: string;                          // present only when phase === 'held'
}
```

Held orders are published in `recoveryOrders[]` alongside patience/adjusting orders so the dashboard sees them without a schema split.

### Breakdown metrics (new)

Each `orderStateEntry` for SpikeBot publishes a `breakdown` object:

```ts
breakdown: {
  spike: number;              // state.spikeOrders.length
  patience: number;           // TPs with cyclesSincePlace <= maxReboundCycles
  adjusting: number;          // TPs with cyclesSincePlace > maxReboundCycles
  held: number;               // state.heldRecoveryOrders.length
  avgEntryPrice: number | null;  // quantity-weighted mean across TP + held
  entryDriftPct: number | null;  // (currentMA - avgEntryPrice) / avgEntryPrice × 100
  notionalLocked: number;        // Σ(price × quantity) across TP + held, in quote
}
```

`avgEntryPrice` and `entryDriftPct` are `null` when `takeProfitOrders + heldRecoveryOrders` is empty. `notionalLocked` excludes plain spike orders — those are deliberate capital at play, not stuck capital.

`breakdown` is published only by SpikeBot. Other strategies omit it; the dashboard treats the field as optional.

## Bot-side Logic Changes (`src/strategies/spikebot.ts`)

### Replace Phase 2 abandon blocks (lines 241-284)

Both `SELL candidatePrice <= entryPrice` and `BUY candidatePrice >= entryPrice` branches become:

```ts
tracked.heldSince = new Date().toISOString();
state.heldRecoveryOrders.push(tracked);
logger.info(`[SpikeBot] Holding ${sideStr} TP at ${currentPrice} — next step would cross entry ${tracked.entryPrice}`);
events.orderHeld(`[SpikeBot] Held ${sideStr} TP at ${currentPrice}`, {
  market: symbol,
  side: sideStr,
  price: currentPrice,
  entryPrice: tracked.entryPrice,
  candidatePrice,
});
tpOrdersChanged = true;
// tpAbandoned stays false — spike placement is allowed to resume
continue;
```

Key differences from current abandon:

- No `cancelOrder` / `withdrawAll`. The on-chain order stays live.
- The TP moves out of `takeProfitOrders` so the Phase 2 loop does not re-evaluate it next cycle.
- `tpAbandoned` is **not** set, so step 7 can place new spike orders if `spikeOrders + takeProfitOrders` are empty.

### New step 5d: fill detection for held orders

Added after step 5c (tiered recovery):

```ts
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

### MA-drift rebalance (lines 339-350)

`cancelPairOrders` currently cancels every open order for the pair. Filter out order IDs present in `heldRecoveryOrders` so they survive a rebalance. `state.heldRecoveryOrders` is **not** cleared alongside `spikeOrders` and `takeProfitOrders`.

### `orderStateEntry` publishing (lines 106-124)

Extend the entry:

- `recoveryOrders[]` includes held orders mapped with `phase: 'held'` and `heldSince` pulled from the tracked order. Cycles field for held orders retains the last cycle count seen before hold (informational only).
- Add the new `breakdown` object as specified above.

### `cancelOwnOrders`

Include `heldRecoveryOrders` in the union of tracked orders to cancel when the strategy shuts down.

### Events module

Add `events.orderHeld(message, payload)`. Event type `'order'`, subtype `'order held'` (or similar, matching existing naming conventions). Persisted like other order events so the dashboard event log shows held transitions.

## Dashboard Changes (`dex-dashboard`)

### `src/lib/api.ts`

```ts
export interface RecoveryOrder {
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  originalTargetPrice: number;
  cyclesSincePlace: number;
  phase: 'patience' | 'adjusting' | 'held';
  heldSince?: string;
}

export interface InstanceOrderMarket {
  // ... existing fields
  recoveryOrders?: RecoveryOrder[];
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

### Compact card (the `3 / 4 orders` row)

When `breakdown` is present on a pair, render a chip row beneath the order-count line:

```
XMT_XMD                          3 / 4 orders
[2 spike] [0 patience] [0 adjusting] [1 held]
```

Chip colors match phase badges: blue spike, yellow patience, orange adjusting, purple held. Zero-count chips render in muted gray so the row width stays stable across pairs.

### Expanded card

Above the existing Buy/Sell grid, add two rows:

1. **Stat row**: four count chips in larger type (spike / patience / adjusting / held).
2. **Summary row**: `Avg entry 0.28006 · Drift −0.2% · Locked 280.06 XMD`. Hidden entirely when `avgEntryPrice` is `null`. Drift is colored: red when unfavorable (negative for SELL-side recovery, positive for BUY-side), green when favorable, gray near zero.

### Recovery orders list (`instance-monitor.tsx` lines 329-379)

Extend the phase badge:

- `patience` → yellow, label `Waiting (N cycles)`
- `adjusting` → orange, label `Adjusting (N cycles)`
- `held` → purple, label `Held since {formatted heldSince}` (e.g., `Held since Apr 11, 10:58pm`)

Per-order entry/price/progress-bar UI is unchanged.

## Testing

### `test/strategies/spikebot.test.ts`

Rewrite the three abandon tests (`spikebot.test.ts:297-383`) to validate the hold-in-place behavior instead:

1. `holds SELL take-profit when adjusted price would cross entry price`
   - Assert TP moves to `heldRecoveryOrders`, `takeProfitOrders` is empty, on-chain order is **not** cancelled.
2. `holds BUY take-profit when adjusted price would cross entry price`
   - Symmetric assertion for BUY-side.
3. `resumes spike order placement while a held recovery exists`
   - After hold, trigger another cycle and assert new spike orders are placed despite `heldRecoveryOrders.length > 0`.

New tests:

4. `fills held recovery when price returns`
   - Given an order in `heldRecoveryOrders`, remove it from the mock open-orders list, assert `events.orderFilled` fires with `Held recovery` prefix and the bucket is empty.
5. `preserves held recovery across MA-drift rebalance`
   - With `heldRecoveryOrders.length === 1`, trigger MA drift past threshold, assert the held order remains after rebalance and is not included in `cancelPairOrders`.
6. `persists and restores held recovery across restart`
   - Seed persistence with a `held: [...]` array, re-initialize, assert `state.heldRecoveryOrders` repopulates with preserved `entryPrice`, `heldSince`, etc.
7. `publishes breakdown metrics on orderStateEntry`
   - Assert `breakdown.spike/patience/adjusting/held` counts match state, and `avgEntryPrice` / `entryDriftPct` / `notionalLocked` compute correctly across mixed TP + held sets.

### Dashboard tests (`dex-dashboard/test`)

Snapshot / rendering tests for:

- Compact card with `breakdown` present — chip row renders with correct counts and colors.
- Expanded card with held recovery orders — purple badge, `heldSince` formatting, summary row renders with drift coloring.
- `breakdown` absent (non-SpikeBot strategy) — chip row hidden, no regressions.

## Out of Scope

- Explicit cap on `heldRecoveryOrders.length` per pair. User confirmed unbounded holding is acceptable for now.
- Manual "release held" UI control in the dashboard. Operators can cancel via existing stop/cancel flow.
- Re-placing held orders at alternate prices (e.g., the user's original "retry at original MA" idea). The held on-chain order already covers that case implicitly — if price returns, it fills.
- Fee-buffer clamp approach (Approach B from brainstorming). Not pursued; hold-in-place preserves the full original profit margin.

## Follow-ups (not part of this spec)

- Metric on historical fill rate of held recoveries — are held orders actually filling over time, or growing without bound?
- If growth becomes a concern, consider a time-based expiry (`heldSince` + N hours) that either cancels or re-prices.
