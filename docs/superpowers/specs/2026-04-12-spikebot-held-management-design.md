# Spike Bot Held-Order Management Design

## Problem

Operators have no way to see or mutate the `heldRecoveryOrders` bucket from the dashboard, and the "Reset Bot" flow preserves tracked state across restarts — so held orders survive what operators assume is a clean reset. Three concrete pain points:

1. **Stale held orders accumulate silently.** `POST /api/instances/[id]/reset` calls `cancelAllOrders` on-chain but leaves `${instanceId}-tracked.json` on disk. SpikeBot re-loads held orders on restart (`src/strategies/spikebot.ts:56-72`), so nothing clears them short of deleting the state file by hand.
2. **No per-pair intervention.** If one market's held bucket needs attention while others are healthy, operators today must stop the whole bot, hand-edit JSON, and restart. There is no per-market reset or per-order cancel.
3. **Not enough visibility to decide.** The current expanded MarketCard shows TP price, entry price, original target, and phase badge — but not *why* the order is held (triggering spike context), how it got here (adjustment history), or what a fill would mean (break-even vs. entry). Operators cannot judge whether to release capital or wait.

## Goal

Give operators complete visibility into, and authority over, the held-recovery bucket — without restarting the bot. "Cancel & Exit" and "Reset Bot" become truly clean (wipe all tracked state). A live command-file IPC lets the dashboard mutate bot state per-pair or instance-wide while the bot is running. The expanded MarketCard shows each order's full context: spike trigger, adjustment history, recovery trajectory, and last sibling cancel reason.

## Architecture

One new file-based IPC channel connects dashboard and bot; everything else is surface area on top of it.

### Command queue (IPC)

- Dashboard writes append-only JSON lines to `${ORDER_STATE_DIR}/${instanceId}-commands.jsonl`.
- Bot reads pending commands at the top of every trade cycle (before any trading logic), dispatches them to the strategy, writes outcomes to `${instanceId}-command-results.jsonl`, and truncates the command file on success.
- Dashboard `/api/instances/[id]/commands` endpoint enqueues + polls the result for up to 2s; UI falls back to polling `/commands/[id]` if the cycle hadn't picked it up in time.

### Clean reset

- Dashboard deletes tracked state files directly when the bot is stopped (no IPC needed).
- `POST /api/instances/[id]/reset` gains `wipeState?: boolean` (default `true`), so the two existing buttons ("Cancel & Exit" and "Reset Bot") both produce a truly clean slate.

### Dashboard clarity

- MarketCard expanded view gains a single-select chip filter, per-market action buttons, and a richer per-order expansion.
- New persisted per-order data (`adjustmentHistory`, `cancelReason`, `spikeTrigger`) flows through the existing `${instanceId}-orders.json` state file the dashboard already polls.

### Key invariant

Dashboard never mutates bot-owned state directly except when the bot is stopped. While running, all mutations flow through the command queue. This preserves the bot as the single writer of `${instanceId}-tracked.json`.

## Data Model

### `BotCommand` and `BotCommandResult` (new file `src/strategies/command-queue.ts`)

```ts
interface BotCommand {
  id: string;          // uuid, echoed in result
  type: 'cancel_order' | 'clear_held' | 'clear_non_held';
  marketSymbol?: string;   // omit = all markets
  orderId?: string;        // required for cancel_order
  issuedAt: string;        // ISO
}

interface BotCommandResult {
  id: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  appliedAt: string;       // ISO
}
```

- Results file rotates to the last 200 entries to bound size.
- Commands deduplicated by `id` on read.
- Malformed JSON lines are logged and ignored; they don't block later commands.

### `TrackedOrder` (`src/interfaces/order.interface.ts`)

Three optional fields added:

```ts
adjustmentHistory?: Array<{
  price: number;
  at: string;                          // ISO
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual';
}>;
cancelReason?: string;                 // set right before a bot-initiated cancel
spikeTrigger?: { price: number; at: string };   // copied from parent spike order at TP placement
```

- `adjustmentHistory` is appended each time a TP is re-priced inside Phase-1/Phase-2 adjustment blocks. Initial placement gets a `placed` entry.
- `spikeTrigger` is set when a spike order is placed (price + timestamp of the triggering event) and copied onto the TP order when the spike fills.
- `cancelReason` is recorded on cancellations for audit.

### `PairState` (`src/strategies/spikebot.ts`)

Adds:

```ts
lastCancelReason?: { reason: string; at: string };
```

Updated whenever any order in this market is cancelled. Shown in the dashboard as a "last cancel" banner that fades out after a cutoff (UI-side, 10 minutes).

### Persistence

- `${instanceId}-tracked.json`: unchanged schema, now carries the new `TrackedOrder` fields plus per-market `lastCancelReason`.
- `${instanceId}-orders.json`: `InstanceOrdersMarket` shape extended with `lastCancelReason` and the same new fields on each order summary.
- `${instanceId}-commands.jsonl` and `${instanceId}-command-results.jsonl`: new files, created on first write, deleted on clean reset.

## Bot-Side Changes

### `src/strategies/command-queue.ts` (new)

Responsibilities:

- `readPending(path): Promise<BotCommand[]>` — read file, parse, dedupe by id, return ordered list.
- `appendResult(path, result): Promise<void>` — append one result, rotate to last 200.
- `truncate(path): Promise<void>` — clear commands file after successful batch processing.

### `base.ts` integration

- Before each cycle's strategy call, invoke `await this.processCommands()`.
- `processCommands()` reads the command file, dispatches each command to the strategy's new `handleCommand(cmd): Promise<BotCommandResult>` method, collects results, appends them, truncates the command file.
- A new helper `async wipeStateFiles()` deletes `${instanceId}-tracked.json`, `${instanceId}-orders.json`, `${instanceId}-commands.jsonl`, `${instanceId}-command-results.jsonl`. Called from the dashboard's wipe-state endpoint (bot must be stopped).

### SpikeBot `handleCommand` dispatch

| Command | Action |
|---|---|
| `cancel_order` | Find order by `orderId` across all three buckets (optionally scoped to `marketSymbol`). Call `cancelTrackedOrders([order])`. Remove from bucket on success. Persist. |
| `clear_held` | For each matching market, call `cancelTrackedOrders(state.heldRecoveryOrders)`. On per-order success, remove from bucket. Persist. |
| `clear_non_held` | For each matching market, cancel `spikeOrders ∪ takeProfitOrders`. `heldRecoveryOrders` untouched. Persist. |

Unknown types → `status:'error'`. Missing target order/market → `status:'skipped'`. Partial failures leave the bucket partially drained and return the first error message (operator can re-issue).

### Data-capture points in SpikeBot

- At spike placement: set `spikeTrigger = { price: spikeBasisPrice, at: now }`.
- On spike fill → TP placement: copy `spikeTrigger` from the filled spike onto the new TP.
- On TP re-price (Phase 1 / Phase 2): append `{price, at, reason}` to `adjustmentHistory`.
- Before any `cancelTrackedOrders` call inside SpikeBot: set `tracked.cancelReason` on each, and set `state.lastCancelReason` on the pair.

## Dashboard API

Four endpoints:

### `POST /api/instances/[id]/commands`

Body: `{ type, marketSymbol?, orderId? }`.
Generates `uuid`, appends to `${instanceId}-commands.jsonl`, polls results for 2s. Returns matching `BotCommandResult` or `{ id, status: 'queued' }`.

### `GET /api/instances/[id]/commands/[commandId]`

Reads results file; returns `BotCommandResult` or `{ status: 'pending' }`. Used for post-timeout polling and audit.

### `POST /api/instances/[id]/wipe-state`

Calls bot's `wipeStateFiles()` via the existing filesystem layer (bot must be stopped; returns 409 if running).

### Updated `POST /api/instances/[id]/reset`

Body gains `wipeState?: boolean` (default `true`). Flow: stop → cancel-on-chain (if requested) → wipe-state (if requested) → restart (if requested). Default behavior changes from "preserve state" to "clean slate".

### Updated `GET /api/instances/[id]/orders`

Per-order summary and per-market summary extended with the new fields (`adjustmentHistory`, `cancelReason`, `spikeTrigger`, `lastCancelReason`). No existing fields change shape.

### Auth & validation

- All four endpoints reuse the existing auth layer on start/stop/reset. No new auth surface.
- Command bodies validated (type enum, market string, orderId string); invalid payloads rejected with 400 before touching the queue.

## Dashboard UI

Single component change: `src/components/dashboard/instance-monitor.tsx`, specifically the `MarketCard` expanded body.

### Compact header (unchanged)

Symbol, bid/ask tokens, `totalOrders / expectedOrders`, and `BreakdownChips`. No click-through behavior change.

### Expanded body

Four vertical sections in order:

1. **Breakdown stat grid + per-market actions.** Existing 4-count grid (Spike/Patience/Adjusting/Held). New right-hand column: `Clear Held (N)` button (disabled when held=0) and `Clear Non-Held (M)` button. Both POST a command scoped to this market's symbol.
2. **Drift summary** (unchanged): avg entry / drift% / locked notional.
3. **Filter toolbar.** "All (N)" + four phase chips, single-select. Clicking a chip filters the order list below. "Last cancel: {reason} · {relative time}" shown right-aligned when `lastCancelReason` is recent (< 10 min), dimmed otherwise.
4. **Order list.** Flat list of all orders in the filtered phase, compact by default. Clicking a row expands it inline (one at a time) to show:
   - **Spike trigger**: `@ {price} · {relative time}` + `Now: {currentPrice} ({drift%})`.
   - **Recovery trajectory**: `Target {originalTargetPrice} · Floor {entryPrice}` + `Break-even: {price}` where price is `entryPrice × (1 + feeRate)` for SELL TPs and `entryPrice × (1 - feeRate)` for BUY TPs. `feeRate` comes from the instance's existing fee config.
   - **Adjustment history**: horizontal chain of price → price → price with timestamps and reasons per step.
   - **Last sibling cancel**: if any other order in this market was cancelled recently, show the reason and relative time.
   - **Cancel button** (only on held rows): one-shot confirm-less button that POSTs `cancel_order` for this orderId. Success toast + refetch.

### Instance-wide controls

The top `InstanceMonitor` header gains two buttons next to the existing Reset Bot: `Clear All Held` and `Clear All Non-Held`. Both POST commands without `marketSymbol`. Confirm dialog: "Affects {N} orders across {M} markets. Continue?"

### Minor visual conventions

- Held-phase color: purple (`bg-purple-100` / `text-purple-700`), matching existing chips.
- Cancel button color: red, mirroring existing reset.
- Success/error feedback: reuse the existing `resetResult` inline banner pattern in `instance-monitor.tsx:169-179` — no new toast infrastructure.

## Data Flow

### Scenario: "Clear Held" on one market, bot running

1. Operator clicks Clear Held in expanded MarketCard.
2. Dashboard POSTs `{ type: 'clear_held', marketSymbol: 'XPR_XUSDC' }` to `/api/instances/[id]/commands`.
3. API generates uuid, appends `{id, type, marketSymbol, issuedAt}` to `${instanceId}-commands.jsonl`, starts 2s poll on results file.
4. Bot, at next cycle start, calls `processCommands()` → `handleCommand('clear_held')` → `cancelTrackedOrders(heldRecoveryOrders)` for the pair → empties bucket → persists.
5. Bot appends `{id, status:'ok', appliedAt}` to `${instanceId}-command-results.jsonl`, truncates command file.
6. Dashboard API sees match → returns result → UI shows success toast + refetches orders.
7. If bot hasn't picked up in 2s, API returns `{status:'queued'}`; UI polls `/commands/[id]` every 2s (cap 5 tries).

### Scenario: "Cancel & Exit"

1. `POST /reset` with `{cancelOrders:true, wipeState:true, restart:false}`.
2. Dashboard PM2-stops bot, waits for exit.
3. Dashboard calls `cancelAllOrders` via proton-rpc.
4. Dashboard deletes `${instanceId}-{tracked,orders,commands,command-results}.{json,jsonl}` (bot stopped — direct FS access is safe).
5. Returns step-by-step status array (same shape as today's reset response).

### Scenario: "Reset Bot" (stop + wipe + restart)

Same as above with `restart:true` appended. PM2 start after wipe; bot boots with empty state, places fresh spike orders on first cycle.

## Error Handling

- **Bot stopped when command arrives:** command sits in queue. UI shows "queued — will apply on restart" and disables retry. Clean reset wipes queue, so stale commands don't re-apply.
- **Unknown order or market:** `status:'skipped'` + explanation; UI shows message verbatim.
- **Partial failure during `clear_held`:** bot removes orders from bucket only after each on-chain cancel succeeds. Failed cancels remain in the bucket; bot writes `status:'error'` with first failure message. Operator can re-issue.
- **Concurrent POSTs:** `fs.appendFile` is atomic line-by-line. Bot parses line-by-line and ignores malformed lines.
- **Unbounded results file:** rotated to last 200 entries on each write.
- **Dashboard crash mid-poll:** command still applies; operator re-opens UI and polls `/commands/[id]` to learn outcome.
- **PM2 restart mid-cycle with pending commands:** commands file persists; processed on next boot.
- **Wipe-state while running:** returns 409. Forcing a wipe requires an explicit stop first.

## Testing

### Unit

- `command-queue.ts`: malformed lines, id dedupe, rotation at 200, atomic append under interleaved writes (simulated).
- SpikeBot `handleCommand` dispatch: each command type × (known / unknown market) × (known / unknown orderId) — happy path, skipped, and error branches.
- `adjustmentHistory` append on Phase-1/Phase-2 re-pricing; `spikeTrigger` propagation spike→TP on fill.

### Integration

- Start bot against a fixture tracked.json with 2 spike + 1 TP + 1 held across two markets. Write a command file with `clear_held` scoped to one market. Run one cycle. Assert: held bucket emptied for that market only; other market untouched; results file has `status:'ok'`; commands file truncated.
- `wipeStateFiles()`: seed all four files, call, assert all four gone.
- Reset endpoint with `wipeState:true` vs. `wipeState:false` — assert state files are/aren't present after.

### E2E (manual, testnet)

- On a running testnet instance with live held orders, click Clear Held for one market and verify: on-chain cancel confirmed via RPC, UI shows success within one cycle, breakdown count drops to 0, other market's orders untouched.
- "Cancel & Exit" on same instance, then restart: verify fresh spike orders placed on cycle 1 with no carryover.
- Trigger a patience→adjust→held transition and verify adjustment history in the UI matches the log timeline.

## Out of Scope (YAGNI)

- Bulk multi-select of rows (follow-up if single-order ops feel slow).
- `release_to_market` or `reprice_manual` commands (the queue is ready; add later if needed).
- Authentication changes.
- Command history UI (results file is for audit/debug only).
- WebSocket live updates (keep 30s poll + post-mutation refetch).
- Time-based held-order expiry.
- Multi-select chip filter (single-select only).

## File Changes Summary

**dex-bot:**
- `src/interfaces/order.interface.ts` — add three optional fields to `TrackedOrder`.
- `src/strategies/command-queue.ts` — new file.
- `src/strategies/base.ts` — `processCommands()`, `wipeStateFiles()`, call from run loop.
- `src/strategies/spikebot.ts` — `handleCommand` dispatch, data-capture at placement/adjustment/cancel points, `PairState.lastCancelReason`.
- Tests: `tests/command-queue.test.ts`, extensions to existing spikebot tests.

**dex-dashboard:**
- `src/app/api/instances/[id]/commands/route.ts` — new (POST).
- `src/app/api/instances/[id]/commands/[commandId]/route.ts` — new (GET).
- `src/app/api/instances/[id]/wipe-state/route.ts` — new (POST).
- `src/app/api/instances/[id]/reset/route.ts` — add `wipeState` handling.
- `src/app/api/instances/[id]/orders/route.ts` — surface new per-order / per-market fields.
- `src/lib/api.ts` — extend `InstanceOrdersMarket` / order types; add command client helpers.
- `src/components/dashboard/instance-monitor.tsx` — new MarketCard expanded body, filter toolbar, per-market and instance-wide action buttons, row expansion with rich detail.
