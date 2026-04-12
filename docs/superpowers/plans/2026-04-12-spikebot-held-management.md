# Spike Bot Held-Order Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give operators complete visibility and control over SpikeBot's held-recovery bucket from the dashboard — clear / cancel per-pair or instance-wide while the bot is running, make reset truly wipe state, and expand the MarketCard with chip filtering and rich per-order detail.

**Architecture:** File-based IPC between dashboard and running bot. Dashboard writes commands to `${instanceId}-commands.jsonl`; bot reads and dispatches at cycle boundaries; bot writes outcomes to `${instanceId}-command-results.jsonl`. Clean reset deletes all state files directly (bot stopped). Dashboard polls for new per-order data that bot already writes to `${instanceId}-orders.json`.

**Tech Stack:**
- Bot (`/Users/tayler/Developer/Protonext/dex-bot`): TypeScript 5, Node.js ESM (ts-node loader), vitest
- Dashboard (`/Users/tayler/Developer/Protonext/dex-dashboard`): Next.js 16, React 19, Tailwind, vitest
- Shared: file-based state under `ORDER_STATE_DIR`, PM2 for bot lifecycle

**Spec:** `docs/superpowers/specs/2026-04-12-spikebot-held-management-design.md` (in dex-bot)

---

## File Structure

**dex-bot — new files:**
- `src/strategies/command-queue.ts` — pure queue I/O (read, append, truncate, rotate)

**dex-bot — modified files:**
- `src/interfaces/order.interface.ts` — extend `TrackedOrder` with three optional fields
- `src/strategies/base.ts` — `processCommands()`, `wipeStateFiles()`, integrate into abstract class
- `src/strategies/spikebot.ts` — `handleCommand()` dispatch, data-capture hooks, `PairState.lastCancelReason`

**dex-bot — new test files:**
- `test/strategies/command-queue.test.ts`
- Extensions to `test/strategies/spikebot.test.ts`

**dex-dashboard — new files:**
- `src/app/api/instances/[id]/commands/route.ts` — POST
- `src/app/api/instances/[id]/commands/[commandId]/route.ts` — GET
- `src/app/api/instances/[id]/wipe-state/route.ts` — POST

**dex-dashboard — modified files:**
- `src/app/api/instances/[id]/reset/route.ts` — add `wipeState` handling
- `src/lib/api.ts` — extend types, add command client helpers
- `src/components/dashboard/instance-monitor.tsx` — filter toolbar, per-market actions, row expansion, instance-wide actions

---

## Conventions

- All repo paths are absolute from each repo root unless noted.
- Bot working directory: `/Users/tayler/Developer/Protonext/dex-bot`
- Dashboard working directory: `/Users/tayler/Developer/Protonext/dex-dashboard`
- Run bot tests: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- <path>`
- Run dashboard tests: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npm test -- <path>`
- **Commit message prefix**: use `feat(spikebot): …`, `feat(dashboard): …`, `feat(api): …`, `test(spikebot): …`, `refactor(…): …` to match existing git log style.
- Each task ends with a commit so we can bisect if something breaks.

---

## Task 1: Extend `TrackedOrder` with new persisted fields

**Files:**
- Modify: `src/interfaces/order.interface.ts:10-17`

- [ ] **Step 1: Open the file and add three optional fields plus a new supporting interface.**

Replace the existing `TrackedOrder` interface (lines 10-17) with:

```ts
export interface AdjustmentHistoryEntry {
  price: number;
  at: string;           // ISO timestamp
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual';
}

export interface SpikeTrigger {
  price: number;
  at: string;           // ISO timestamp
}

export interface TrackedOrder extends TradeOrder {
    orderId?: string;    // on-chain order_id from the DEX
    placedAt?: string;   // ISO timestamp for debugging
    entryPrice?: number;         // spike fill price (hard floor for TP adjustment)
    cyclesSincePlace?: number;   // trade cycles this TP has been open
    originalTargetPrice?: number; // MA at time of TP placement
    heldSince?: string;          // ISO timestamp set when TP moves to heldRecoveryOrders
    adjustmentHistory?: AdjustmentHistoryEntry[]; // price changes over time
    cancelReason?: string;        // set right before bot-initiated cancel
    spikeTrigger?: SpikeTrigger;  // inherited from spike order that produced this TP
}
```

- [ ] **Step 2: Re-export the new types from the barrel.**

Check `/Users/tayler/Developer/Protonext/dex-bot/src/interfaces/index.ts` (if present) and add:

```ts
export type { AdjustmentHistoryEntry, SpikeTrigger, TrackedOrder } from './order.interface';
```

Only add what's missing — leave existing exports alone. If `index.ts` doesn't exist, skip this step.

- [ ] **Step 3: Verify type-check passes.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/interfaces/order.interface.ts src/interfaces/index.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): extend TrackedOrder with adjustment history and spike trigger

Adds optional adjustmentHistory, cancelReason, and spikeTrigger fields so the
bot can surface per-order context to the dashboard.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create command-queue module (types + file I/O)

**Files:**
- Create: `src/strategies/command-queue.ts`
- Create: `test/strategies/command-queue.test.ts`

- [ ] **Step 1: Write failing tests.**

Create `test/strategies/command-queue.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readPending,
  appendResult,
  truncate,
  BotCommand,
  BotCommandResult,
} from '../../src/strategies/command-queue';

describe('command-queue', () => {
  let tmpDir: string;
  let cmdPath: string;
  let resultsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdq-'));
    cmdPath = path.join(tmpDir, 'commands.jsonl');
    resultsPath = path.join(tmpDir, 'results.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when file does not exist', async () => {
    const result = await readPending(cmdPath);
    expect(result).toEqual([]);
  });

  it('parses valid commands', async () => {
    const cmd: BotCommand = {
      id: 'a', type: 'clear_held', marketSymbol: 'XPR_XUSDC',
      issuedAt: '2026-04-12T00:00:00.000Z',
    };
    fs.writeFileSync(cmdPath, JSON.stringify(cmd) + '\n');
    const result = await readPending(cmdPath);
    expect(result).toEqual([cmd]);
  });

  it('dedupes commands by id (keeps first)', async () => {
    const a1: BotCommand = { id: 'a', type: 'clear_held', issuedAt: 't1' };
    const a2: BotCommand = { id: 'a', type: 'clear_non_held', issuedAt: 't2' };
    fs.writeFileSync(cmdPath, JSON.stringify(a1) + '\n' + JSON.stringify(a2) + '\n');
    const result = await readPending(cmdPath);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('clear_held');
  });

  it('skips malformed lines but parses valid ones after', async () => {
    const good: BotCommand = { id: 'good', type: 'clear_held', issuedAt: 't' };
    fs.writeFileSync(cmdPath, 'not-json\n' + JSON.stringify(good) + '\n');
    const result = await readPending(cmdPath);
    expect(result).toEqual([good]);
  });

  it('appends a result preserving existing lines', async () => {
    const r1: BotCommandResult = { id: 'a', status: 'ok', appliedAt: 't1' };
    const r2: BotCommandResult = { id: 'b', status: 'error', appliedAt: 't2', message: 'x' };
    await appendResult(resultsPath, r1);
    await appendResult(resultsPath, r2);
    const lines = fs.readFileSync(resultsPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(r1);
    expect(JSON.parse(lines[1])).toEqual(r2);
  });

  it('rotates results file to last 200 entries', async () => {
    for (let i = 0; i < 210; i++) {
      await appendResult(resultsPath, {
        id: `r${i}`, status: 'ok', appliedAt: new Date().toISOString(),
      });
    }
    const lines = fs.readFileSync(resultsPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(200);
    expect(JSON.parse(lines[0]).id).toBe('r10');
    expect(JSON.parse(lines[199]).id).toBe('r209');
  });

  it('truncate empties the file', async () => {
    fs.writeFileSync(cmdPath, 'data\n');
    await truncate(cmdPath);
    expect(fs.readFileSync(cmdPath, 'utf-8')).toBe('');
  });

  it('truncate on missing file is a no-op', async () => {
    await expect(truncate(cmdPath)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/command-queue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module implementation.**

Create `src/strategies/command-queue.ts`:

```ts
import * as fs from 'fs';
import * as fsp from 'fs/promises';

export interface BotCommand {
  id: string;
  type: 'cancel_order' | 'clear_held' | 'clear_non_held';
  marketSymbol?: string;
  orderId?: string;
  issuedAt: string;
}

export interface BotCommandResult {
  id: string;
  status: 'ok' | 'error' | 'skipped' | 'queued' | 'pending';
  message?: string;
  appliedAt: string;
}

const MAX_RESULTS = 200;

export async function readPending(filePath: string): Promise<BotCommand[]> {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    const seen = new Set<string>();
    const out: BotCommand[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as BotCommand;
        if (!parsed.id || seen.has(parsed.id)) continue;
        seen.add(parsed.id);
        out.push(parsed);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function appendResult(filePath: string, result: BotCommandResult): Promise<void> {
  let existing = '';
  try {
    existing = await fsp.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const lines = existing.split('\n').filter(Boolean);
  lines.push(JSON.stringify(result));
  const trimmed = lines.slice(-MAX_RESULTS);
  await fsp.writeFile(filePath, trimmed.join('\n') + '\n');
}

export async function truncate(filePath: string): Promise<void> {
  try {
    await fsp.writeFile(filePath, '');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/command-queue.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/command-queue.ts test/strategies/command-queue.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): add command-queue module for dashboard-bot IPC

Pure file I/O: read/dedupe pending commands, append bounded results,
truncate on success. Used by a new in-bot command loop in a later change.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `wipeStateFiles` helper to `TradingStrategyBase`

**Files:**
- Modify: `src/strategies/base.ts` (add method near `cleanupTrackedOrdersFile` at line 273-286)

- [ ] **Step 1: Write a failing test.**

Append to `test/strategies/spikebot.test.ts` (inside the outer `describe('SpikeBotStrategy', ...)` block, or as a new `describe` in a helper file — but keeping it adjacent is easier):

```ts
import * as fsNode from 'fs';
import * as pathNode from 'path';
import * as osNode from 'os';

describe('wipeStateFiles', () => {
  let tmpDir: string;
  let originalStateDir: string | undefined;
  let originalInstanceId: string | undefined;

  beforeEach(() => {
    tmpDir = fsNode.mkdtempSync(pathNode.join(osNode.tmpdir(), 'wipe-'));
    originalStateDir = process.env.ORDER_STATE_DIR;
    originalInstanceId = process.env.DASHBOARD_INSTANCE_ID;
    process.env.ORDER_STATE_DIR = tmpDir;
    process.env.DASHBOARD_INSTANCE_ID = 'inst1';
  });

  afterEach(() => {
    process.env.ORDER_STATE_DIR = originalStateDir;
    process.env.DASHBOARD_INSTANCE_ID = originalInstanceId;
    fsNode.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes all four state files when present', async () => {
    const files = [
      'inst1-tracked.json',
      'inst1-orders.json',
      'inst1-commands.jsonl',
      'inst1-command-results.jsonl',
    ];
    for (const f of files) {
      fsNode.writeFileSync(pathNode.join(tmpDir, f), 'data');
    }
    const s = new SpikeBotStrategy();
    await (s as any).wipeStateFiles();
    for (const f of files) {
      expect(fsNode.existsSync(pathNode.join(tmpDir, f))).toBe(false);
    }
  });

  it('is a no-op when files are missing', async () => {
    const s = new SpikeBotStrategy();
    await expect((s as any).wipeStateFiles()).resolves.toBeUndefined();
  });
});
```

Make sure to add the imports at the top of the test file alongside the existing ones (aliases `fsNode`/`pathNode`/`osNode` to avoid collisions).

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "wipeStateFiles"`
Expected: FAIL — method not a function.

- [ ] **Step 3: Add the method to `TradingStrategyBase`.**

In `src/strategies/base.ts`, add the following method immediately after `cleanupTrackedOrdersFile()` (which ends near line 286):

```ts
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
```

Also expose it publicly by adding (in the same class, near the existing public `cancelOwnOrders`):

```ts
public async wipeState(): Promise<void> {
  await this.wipeStateFiles();
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "wipeStateFiles"`
Expected: both tests PASS.

Also run full suite to ensure no regressions:
Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test`
Expected: all prior tests still PASS.

- [ ] **Step 5: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/base.ts test/strategies/spikebot.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): add wipeStateFiles to TradingStrategyBase

Deletes all four per-instance state files (tracked, orders, commands, results).
Powers the dashboard's clean-reset flow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `lastCancelReason` to `PairState` and populate on cancel

**Files:**
- Modify: `src/strategies/spikebot.ts:17-25` (PairState interface)
- Modify: `src/strategies/spikebot.ts:476-489` (`cancelPairOrders`)

- [ ] **Step 1: Extend the `PairState` interface.**

Replace the `PairState` interface (lines 17-25) with:

```ts
interface PairState {
  config: SpikeBotPair;
  priceHistory: number[];
  currentMA: number;
  lastOrderMA: number;
  spikeOrders: TrackedOrder[];
  takeProfitOrders: TrackedOrder[];
  heldRecoveryOrders: TrackedOrder[];
  lastCancelReason?: { reason: string; at: string };
}
```

- [ ] **Step 2: Write a failing test.**

Append inside the existing outer `describe('SpikeBotStrategy', ...)`:

```ts
describe('lastCancelReason tracking', () => {
  it('sets lastCancelReason when rebalance cancels orders', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    warmUpMA(strategy, 1.0, 10);
    const state = (strategy as any).pairStates[0];
    state.priceHistory = Array(9).fill(1.06);
    state.spikeOrders = [{
      orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD', orderId: 's-1',
    }];
    state.takeProfitOrders = [];
    state.lastOrderMA = 1.0;
    mockDexAPI.fetchLatestPrice.mockResolvedValue(1.06);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
      { order_id: 's-1', price: 0.9, order_side: 1 },
    ]);

    await strategy.trade();

    expect(state.lastCancelReason).toBeDefined();
    expect(state.lastCancelReason.reason).toMatch(/drift|rebalance/i);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "lastCancelReason"`
Expected: FAIL — `lastCancelReason` undefined.

- [ ] **Step 4: Populate `lastCancelReason` at every bot-initiated cancel.**

In `src/strategies/spikebot.ts`, introduce a helper method (add near `cancelPairOrders` around line 476):

```ts
private setLastCancelReason(state: PairState, reason: string): void {
  state.lastCancelReason = { reason, at: new Date().toISOString() };
}
```

Then call `this.setLastCancelReason(state, '…')` at the three cancel sites:

**Site 1 — rebalance on MA drift (around line 404-406).** Replace:

```ts
if (driftPct > this.rebalanceThresholdPct) {
  logger.info(`[SpikeBot] ${symbol} MA drift ${driftPct.toFixed(2)}% exceeds threshold ${this.rebalanceThresholdPct}% - rebalancing`);
  await this.cancelPairOrders(symbol, activeOpenOrders);
```

with:

```ts
if (driftPct > this.rebalanceThresholdPct) {
  const reason = `MA drift ${driftPct.toFixed(2)}% exceeds threshold — rebalancing`;
  logger.info(`[SpikeBot] ${symbol} ${reason}`);
  this.setLastCancelReason(state, reason);
  await this.cancelPairOrders(symbol, activeOpenOrders);
```

**Site 2 — pre-placement stale clear (around line 420-422).** Replace:

```ts
if (!rebalanced && activeOpenOrders.length > 0) {
  logger.info(`[SpikeBot] ${symbol} clearing ${activeOpenOrders.length} stale orders before fresh placement`);
  await this.cancelPairOrders(symbol, activeOpenOrders);
```

with:

```ts
if (!rebalanced && activeOpenOrders.length > 0) {
  const reason = `clearing ${activeOpenOrders.length} stale orders before fresh placement`;
  logger.info(`[SpikeBot] ${symbol} ${reason}`);
  this.setLastCancelReason(state, reason);
  await this.cancelPairOrders(symbol, activeOpenOrders);
```

**Site 3 — Phase-2 adjustment cancel (around line 317-327).** Replace:

```ts
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
```

with:

```ts
if (tracked.orderId) {
  try {
    tracked.cancelReason = `tier-bump cycle ${tracked.cyclesSincePlace}`;
    this.setLastCancelReason(state, `TP adjustment ${tracked.price} → ${candidatePrice}`);
    await dexrpc.cancelOrder(String(tracked.orderId));
    await dexrpc.withdrawAll();
    await delay(2000);
  } catch (error) {
    logger.error(`[SpikeBot] Failed to cancel TP order ${tracked.orderId}: ${(error as Error).message}`);
    adjustedTP.push(tracked);
    continue;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): track lastCancelReason per pair and per order

Record a short reason each time the bot cancels its own orders (rebalance,
stale clear, tier-bump adjustment). Surfaced by the dashboard in the
expanded market card.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Populate `spikeTrigger` at spike placement and propagate to TP on fill

**Files:**
- Modify: `src/strategies/spikebot.ts:427-432` (initial placement)
- Modify: `src/strategies/spikebot.ts:200-216` (TP placement on spike fill)

- [ ] **Step 1: Write a failing test.**

Append inside the outer `describe('SpikeBotStrategy', ...)`:

```ts
describe('spikeTrigger propagation', () => {
  it('sets spikeTrigger on spike orders at placement', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    warmUpMA(strategy, 1.0, 10);
    const state = (strategy as any).pairStates[0];
    state.spikeOrders = [];
    state.takeProfitOrders = [];
    mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]);
    (strategy as any).resolveOrderIds = async (orders: any[]) =>
      orders.map((o, i) => ({ ...o, orderId: `new-${i}`, placedAt: 'x' }));

    await strategy.trade();

    expect(state.spikeOrders.length).toBeGreaterThan(0);
    for (const o of state.spikeOrders) {
      expect(o.spikeTrigger).toBeDefined();
      expect(o.spikeTrigger.price).toBe(1.0);
      expect(typeof o.spikeTrigger.at).toBe('string');
    }
  });

  it('propagates spikeTrigger from filled spike onto its TP', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    warmUpMA(strategy, 1.0, 10);
    const state = (strategy as any).pairStates[0];
    state.spikeOrders = [{
      orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD',
      orderId: 's-1', spikeTrigger: { price: 1.0, at: '2026-04-12T00:00:00Z' },
    }];
    state.takeProfitOrders = [];
    mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // spike filled
    (strategy as any).resolveOrderIds = async (orders: any[]) =>
      orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

    await strategy.trade();

    expect(state.takeProfitOrders).toHaveLength(1);
    const tp = state.takeProfitOrders[0];
    expect(tp.spikeTrigger).toEqual({ price: 1.0, at: '2026-04-12T00:00:00Z' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "spikeTrigger"`
Expected: FAIL — `spikeTrigger` undefined.

- [ ] **Step 3: Attach `spikeTrigger` to spike orders at placement.**

In `src/strategies/spikebot.ts`, find the initial placement block (around line 427-432). Replace:

```ts
const spikeOrders = this.buildSpikeOrders(symbol, state.currentMA, state.config, market);
if (spikeOrders.length > 0) {
  logger.info(`[SpikeBot] ${symbol} placing ${spikeOrders.length} spike orders around MA ${state.currentMA.toFixed(market.ask_token.precision)}`);
  await this.placeOrders(spikeOrders);
  state.spikeOrders = await this.resolveOrderIds(spikeOrders, symbol);
  state.lastOrderMA = state.currentMA;
}
```

with:

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

- [ ] **Step 4: Propagate `spikeTrigger` onto TPs when a spike fills.**

In the spike fill block (around line 200-205), replace:

```ts
// Place take-profit counter-order at MA
const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
(tpOrder as any).entryPrice = tracked.price;
(tpOrder as any).cyclesSincePlace = 0;
(tpOrder as any).originalTargetPrice = state.currentMA;
newOrders.push(tpOrder);
```

with:

```ts
// Place take-profit counter-order at MA
const tpOrder = this.buildTakeProfitOrder(symbol, state.currentMA, tracked.orderSide, state.config.orderAmount, market);
(tpOrder as any).entryPrice = tracked.price;
(tpOrder as any).cyclesSincePlace = 0;
(tpOrder as any).originalTargetPrice = state.currentMA;
(tpOrder as any).spikeTrigger = tracked.spikeTrigger;
newOrders.push(tpOrder);
```

Then in the subsequent `resolveOrderIds` block (around line 213-215), ensure the field survives resolution. Replace:

```ts
if (newOrders.length > 0) {
  await this.placeOrders(newOrders);
  const resolvedTP = await this.resolveOrderIds(newOrders, symbol);
  state.takeProfitOrders.push(...resolvedTP);
}
```

with:

```ts
if (newOrders.length > 0) {
  await this.placeOrders(newOrders);
  const resolvedTP = await this.resolveOrderIds(newOrders, symbol);
  const withTrigger = resolvedTP.map((r, i) => ({
    ...r,
    spikeTrigger: (newOrders[i] as any).spikeTrigger,
  }));
  state.takeProfitOrders.push(...withTrigger);
}
```

- [ ] **Step 5: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): capture spike trigger context and propagate to TPs

Record the MA price + timestamp at spike placement, then copy that context
onto the TP order when the spike fills, so the dashboard can show what
originally triggered each held/adjusting TP.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Append to `adjustmentHistory` at placement and tier-bump

**Files:**
- Modify: `src/strategies/spikebot.ts` (TP placement on spike fill + Phase-2 adjustment block)

- [ ] **Step 1: Write a failing test.**

Append inside the outer `describe('SpikeBotStrategy', ...)`:

```ts
describe('adjustmentHistory tracking', () => {
  it('appends a placed entry when a TP is first placed from a filled spike', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    warmUpMA(strategy, 1.0, 10);
    const state = (strategy as any).pairStates[0];
    state.spikeOrders = [{
      orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD',
      orderId: 's-1', spikeTrigger: { price: 1.0, at: 't0' },
    }];
    state.takeProfitOrders = [];
    mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([]); // spike filled
    (strategy as any).resolveOrderIds = async (orders: any[]) =>
      orders.map((o, i) => ({ ...o, orderId: `tp-${i}`, placedAt: 'x' }));

    await strategy.trade();

    const tp = state.takeProfitOrders[0];
    expect(tp.adjustmentHistory).toHaveLength(1);
    expect(tp.adjustmentHistory[0].reason).toBe('placed');
    expect(tp.adjustmentHistory[0].price).toBe(tp.price);
  });

  it('appends a tier-bump entry when a TP is adjusted', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      maxReboundCycles: 1, reboundStepPct: 0.5,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    warmUpMA(strategy, 1.0, 10);
    const state = (strategy as any).pairStates[0];
    state.spikeOrders = [];
    state.takeProfitOrders = [{
      orderSide: 2, price: 1.1, quantity: 20, marketSymbol: 'XMT_XMD',
      orderId: 'tp-1', entryPrice: 0.9, cyclesSincePlace: 5,
      originalTargetPrice: 1.1,
      adjustmentHistory: [{ price: 1.1, at: 't0', reason: 'placed' }],
    }];
    state.lastOrderMA = 1.0;
    mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
      { order_id: 'tp-1', price: 1.1, order_side: 2 },
    ]);
    (strategy as any).resolveOrderIds = async (orders: any[]) =>
      orders.map((o, i) => ({ ...o, orderId: `adj-${i}`, placedAt: 'x' }));

    await strategy.trade();

    const tp = state.takeProfitOrders[0];
    expect(tp.adjustmentHistory).toHaveLength(2);
    expect(tp.adjustmentHistory[1].reason).toBe('tier-bump');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "adjustmentHistory"`
Expected: FAIL.

- [ ] **Step 3: Append a `placed` entry at TP creation.**

In the spike-fill → TP placement section (the `withTrigger` block from Task 5 Step 4). Replace:

```ts
const withTrigger = resolvedTP.map((r, i) => ({
  ...r,
  spikeTrigger: (newOrders[i] as any).spikeTrigger,
}));
state.takeProfitOrders.push(...withTrigger);
```

with:

```ts
const now = new Date().toISOString();
const withTrigger = resolvedTP.map((r, i) => ({
  ...r,
  spikeTrigger: (newOrders[i] as any).spikeTrigger,
  adjustmentHistory: [{ price: r.price, at: now, reason: 'placed' as const }],
}));
state.takeProfitOrders.push(...withTrigger);
```

- [ ] **Step 4: Append a `tier-bump` entry on Phase-2 adjustment.**

In the Phase-2 adjustment block (around line 336-344), find:

```ts
await this.placeOrders([adjustedOrder]);
const resolved = await this.resolveOrderIds([adjustedOrder], symbol);
if (resolved.length > 0) {
  const newTracked = resolved[0];
  newTracked.entryPrice = tracked.entryPrice;
  newTracked.cyclesSincePlace = tracked.cyclesSincePlace;
  newTracked.originalTargetPrice = tracked.originalTargetPrice;
  adjustedTP.push(newTracked);
}
```

Replace with:

```ts
await this.placeOrders([adjustedOrder]);
const resolved = await this.resolveOrderIds([adjustedOrder], symbol);
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

- [ ] **Step 5: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): record adjustmentHistory for TP placements and tier-bumps

Append to TrackedOrder.adjustmentHistory whenever a TP is placed from a
filled spike or re-priced during Phase-2 adjustment. Enables the dashboard
to show the recovery timeline per order.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: SpikeBot — `handleCommand` dispatch (cancel_order + clear_held + clear_non_held)

**Files:**
- Modify: `src/strategies/spikebot.ts` (add public method)

- [ ] **Step 1: Write failing tests.**

Append inside the outer `describe('SpikeBotStrategy', ...)`:

```ts
import type { BotCommand } from '../../src/strategies/command-queue';

describe('handleCommand', () => {
  async function setupWithOrders() {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    const state = (strategy as any).pairStates[0];
    state.spikeOrders = [{
      orderSide: 1, price: 0.9, quantity: 20, marketSymbol: 'XMT_XMD', orderId: 's-1',
    }];
    state.takeProfitOrders = [{
      orderSide: 2, price: 1.1, quantity: 20, marketSymbol: 'XMT_XMD', orderId: 'tp-1',
      entryPrice: 0.9, cyclesSincePlace: 0,
    }];
    state.heldRecoveryOrders = [{
      orderSide: 2, price: 1.05, quantity: 20, marketSymbol: 'XMT_XMD', orderId: 'h-1',
      entryPrice: 0.9, cyclesSincePlace: 10, heldSince: 'h-t',
    }];
    return state;
  }

  it('clear_held cancels held orders and empties the bucket', async () => {
    const state = await setupWithOrders();
    const cmd: BotCommand = {
      id: 'c1', type: 'clear_held', marketSymbol: 'XMT_XMD', issuedAt: 't',
    };
    const result = await (strategy as any).handleCommand(cmd);

    expect(result.status).toBe('ok');
    expect(state.heldRecoveryOrders).toHaveLength(0);
    expect(state.spikeOrders).toHaveLength(1);
    expect(state.takeProfitOrders).toHaveLength(1);
    expect(cancelOrder).toHaveBeenCalledWith('h-1');
  });

  it('clear_non_held cancels spike + TP, leaves held alone', async () => {
    const state = await setupWithOrders();
    const cmd: BotCommand = {
      id: 'c2', type: 'clear_non_held', marketSymbol: 'XMT_XMD', issuedAt: 't',
    };
    const result = await (strategy as any).handleCommand(cmd);

    expect(result.status).toBe('ok');
    expect(state.spikeOrders).toHaveLength(0);
    expect(state.takeProfitOrders).toHaveLength(0);
    expect(state.heldRecoveryOrders).toHaveLength(1);
    expect(cancelOrder).toHaveBeenCalledWith('s-1');
    expect(cancelOrder).toHaveBeenCalledWith('tp-1');
  });

  it('cancel_order removes a specific order from its bucket', async () => {
    const state = await setupWithOrders();
    const cmd: BotCommand = {
      id: 'c3', type: 'cancel_order', marketSymbol: 'XMT_XMD', orderId: 'h-1', issuedAt: 't',
    };
    const result = await (strategy as any).handleCommand(cmd);

    expect(result.status).toBe('ok');
    expect(state.heldRecoveryOrders).toHaveLength(0);
    expect(cancelOrder).toHaveBeenCalledWith('h-1');
  });

  it('returns skipped for unknown market', async () => {
    await setupWithOrders();
    const cmd: BotCommand = {
      id: 'c4', type: 'clear_held', marketSymbol: 'UNKNOWN_MARKET', issuedAt: 't',
    };
    const result = await (strategy as any).handleCommand(cmd);
    expect(result.status).toBe('skipped');
  });

  it('returns skipped for unknown order id', async () => {
    await setupWithOrders();
    const cmd: BotCommand = {
      id: 'c5', type: 'cancel_order', marketSymbol: 'XMT_XMD', orderId: 'nope', issuedAt: 't',
    };
    const result = await (strategy as any).handleCommand(cmd);
    expect(result.status).toBe('skipped');
  });

  it('returns error for unknown type', async () => {
    await setupWithOrders();
    const cmd = { id: 'c6', type: 'bogus', issuedAt: 't' } as unknown as BotCommand;
    const result = await (strategy as any).handleCommand(cmd);
    expect(result.status).toBe('error');
  });

  it('applies clear_held across all markets when marketSymbol omitted', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [
        { symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 },
        { symbol: 'XPR_XUSDC', deviationPct: 10, levels: 1, orderAmount: 20 },
      ],
    });
    const [s1, s2] = (strategy as any).pairStates;
    s1.heldRecoveryOrders = [{
      orderSide: 2, price: 1, quantity: 1, marketSymbol: 'XMT_XMD', orderId: 'h-a',
    }];
    s2.heldRecoveryOrders = [{
      orderSide: 2, price: 1, quantity: 1, marketSymbol: 'XPR_XUSDC', orderId: 'h-b',
    }];
    const cmd: BotCommand = { id: 'c7', type: 'clear_held', issuedAt: 't' };
    const result = await (strategy as any).handleCommand(cmd);
    expect(result.status).toBe('ok');
    expect(s1.heldRecoveryOrders).toHaveLength(0);
    expect(s2.heldRecoveryOrders).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "handleCommand"`
Expected: FAIL.

- [ ] **Step 3: Implement `handleCommand` in `SpikeBotStrategy`.**

Add the following imports near the top of `src/strategies/spikebot.ts` (after existing imports):

```ts
import type { BotCommand, BotCommandResult } from './command-queue';
```

Then add this public method to the `SpikeBotStrategy` class (place it near `cancelOwnOrders` around line 448):

```ts
public async handleCommand(cmd: BotCommand): Promise<BotCommandResult> {
  const appliedAt = new Date().toISOString();
  try {
    if (cmd.type === 'cancel_order') {
      return await this.handleCancelOrder(cmd, appliedAt);
    }
    if (cmd.type === 'clear_held') {
      return await this.handleClearBucket(cmd, 'held', appliedAt);
    }
    if (cmd.type === 'clear_non_held') {
      return await this.handleClearBucket(cmd, 'non-held', appliedAt);
    }
    return { id: cmd.id, status: 'error', message: `unknown type: ${cmd.type}`, appliedAt };
  } catch (err) {
    return {
      id: cmd.id, status: 'error',
      message: (err as Error).message ?? 'unknown error', appliedAt,
    };
  }
}

private async handleCancelOrder(cmd: BotCommand, appliedAt: string): Promise<BotCommandResult> {
  if (!cmd.orderId) {
    return { id: cmd.id, status: 'error', message: 'orderId required', appliedAt };
  }
  const states = cmd.marketSymbol
    ? this.pairStates.filter(s => s.config.symbol === cmd.marketSymbol)
    : this.pairStates;
  for (const state of states) {
    for (const bucket of ['spikeOrders', 'takeProfitOrders', 'heldRecoveryOrders'] as const) {
      const idx = state[bucket].findIndex(o => o.orderId === cmd.orderId);
      if (idx >= 0) {
        const [order] = state[bucket].splice(idx, 1);
        order.cancelReason = 'manual cancel via dashboard';
        this.setLastCancelReason(state, `manual cancel ${cmd.orderId}`);
        await this.cancelTrackedOrders([order]);
        this.persistAllTrackedOrders();
        return { id: cmd.id, status: 'ok', appliedAt };
      }
    }
  }
  return { id: cmd.id, status: 'skipped', message: 'order not found', appliedAt };
}

private async handleClearBucket(
  cmd: BotCommand, kind: 'held' | 'non-held', appliedAt: string,
): Promise<BotCommandResult> {
  const states = cmd.marketSymbol
    ? this.pairStates.filter(s => s.config.symbol === cmd.marketSymbol)
    : this.pairStates;
  if (cmd.marketSymbol && states.length === 0) {
    return { id: cmd.id, status: 'skipped', message: `unknown market: ${cmd.marketSymbol}`, appliedAt };
  }
  let totalCancelled = 0;
  for (const state of states) {
    if (kind === 'held') {
      const toCancel = [...state.heldRecoveryOrders];
      if (toCancel.length === 0) continue;
      for (const o of toCancel) o.cancelReason = 'manual clear_held';
      this.setLastCancelReason(state, `manual clear_held (${toCancel.length})`);
      await this.cancelTrackedOrders(toCancel);
      state.heldRecoveryOrders = [];
      totalCancelled += toCancel.length;
    } else {
      const toCancel = [...state.spikeOrders, ...state.takeProfitOrders];
      if (toCancel.length === 0) continue;
      for (const o of toCancel) o.cancelReason = 'manual clear_non_held';
      this.setLastCancelReason(state, `manual clear_non_held (${toCancel.length})`);
      await this.cancelTrackedOrders(toCancel);
      state.spikeOrders = [];
      state.takeProfitOrders = [];
      totalCancelled += toCancel.length;
    }
  }
  this.persistAllTrackedOrders();
  return {
    id: cmd.id, status: 'ok', appliedAt,
    message: `cancelled ${totalCancelled} orders`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): handle dashboard commands (cancel_order, clear_held, clear_non_held)

Per-order and per-bucket control surface the dashboard can invoke via the
command queue. Per-market scoping when marketSymbol is set; instance-wide
when omitted. Unknown target returns 'skipped'; unknown type returns 'error'.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integrate command-processing loop into `TradingStrategyBase` run cycle

**Files:**
- Modify: `src/strategies/base.ts`

- [ ] **Step 1: Write a failing integration test.**

Append to `test/strategies/spikebot.test.ts`:

```ts
describe('command queue integration', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fsNode.mkdtempSync(pathNode.join(osNode.tmpdir(), 'cmdint-'));
    process.env.ORDER_STATE_DIR = tmpDir;
    process.env.DASHBOARD_INSTANCE_ID = 'inst-int';
  });
  afterEach(() => {
    delete process.env.ORDER_STATE_DIR;
    delete process.env.DASHBOARD_INSTANCE_ID;
    fsNode.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executes queued clear_held command at cycle start and writes result', async () => {
    await strategy.initialize({
      maWindow: 10, rebalanceThresholdPct: 2.0,
      pairs: [{ symbol: 'XMT_XMD', deviationPct: 10, levels: 1, orderAmount: 20 }],
    });
    warmUpMA(strategy, 1.0, 10);
    const state = (strategy as any).pairStates[0];
    state.heldRecoveryOrders = [{
      orderSide: 2, price: 1.05, quantity: 20, marketSymbol: 'XMT_XMD', orderId: 'h-q',
      entryPrice: 0.9, cyclesSincePlace: 10, heldSince: 'x',
    }];
    state.takeProfitOrders = [];
    state.spikeOrders = [];

    mockDexAPI.fetchLatestPrice.mockResolvedValue(1.0);
    mockDexAPI.fetchPairOpenOrders.mockResolvedValue([
      { order_id: 'h-q', price: 1.05, order_side: 2 },
    ]);

    const cmdPath = pathNode.join(tmpDir, 'inst-int-commands.jsonl');
    const resultsPath = pathNode.join(tmpDir, 'inst-int-command-results.jsonl');
    fsNode.writeFileSync(cmdPath, JSON.stringify({
      id: 'q1', type: 'clear_held', marketSymbol: 'XMT_XMD', issuedAt: 't',
    }) + '\n');

    await strategy.trade();

    expect(state.heldRecoveryOrders).toHaveLength(0);
    expect(fsNode.readFileSync(cmdPath, 'utf-8')).toBe('');
    const results = fsNode.readFileSync(resultsPath, 'utf-8').trim().split('\n');
    expect(results).toHaveLength(1);
    const r = JSON.parse(results[0]);
    expect(r.id).toBe('q1');
    expect(r.status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test -- test/strategies/spikebot.test.ts -t "command queue integration"`
Expected: FAIL — command file not truncated, no results.

- [ ] **Step 3: Add `processCommands()` to `TradingStrategyBase` and integrate into the run loop.**

In `src/strategies/base.ts`, add the following imports at the top:

```ts
import { readPending, appendResult, truncate, BotCommand, BotCommandResult } from './command-queue';
```

Add the method inside `TradingStrategyBase` (near `writeOrderState`):

```ts
protected async processCommands(): Promise<void> {
  const stateDir = process.env.ORDER_STATE_DIR;
  const instanceId = process.env.DASHBOARD_INSTANCE_ID;
  if (!stateDir || !instanceId) return;
  const cmdPath = path.join(stateDir, `${instanceId}-commands.jsonl`);
  const resultsPath = path.join(stateDir, `${instanceId}-command-results.jsonl`);

  const pending = await readPending(cmdPath);
  if (pending.length === 0) return;

  const dispatcher = (this as unknown as {
    handleCommand?: (cmd: BotCommand) => Promise<BotCommandResult>;
  }).handleCommand;

  for (const cmd of pending) {
    let result: BotCommandResult;
    if (typeof dispatcher === 'function') {
      result = await dispatcher.call(this, cmd);
    } else {
      result = {
        id: cmd.id, status: 'error',
        message: 'strategy does not support commands',
        appliedAt: new Date().toISOString(),
      };
    }
    await appendResult(resultsPath, result);
  }
  await truncate(cmdPath);
}
```

Now invoke it at the top of `SpikeBotStrategy.trade()`. In `src/strategies/spikebot.ts`, at the beginning of `trade()` (line 77), insert:

```ts
async trade(): Promise<void> {
  await this.processCommands();
  const orderStateEntries: OrderStateEntry[] = [];
  // ... rest unchanged
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/base.ts src/strategies/spikebot.ts test/strategies/spikebot.test.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): process dashboard commands at start of each trade cycle

Adds TradingStrategyBase.processCommands() which reads pending commands,
dispatches to strategy.handleCommand, writes results, and truncates the
queue. SpikeBot invokes it first thing in trade() so UI-initiated changes
take effect before any new order logic runs.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Surface new fields in `${instanceId}-orders.json`

**Files:**
- Modify: `src/strategies/spikebot.ts` (extend `recoveryForState` + `OrderStateEntry` usage)
- Modify: `src/strategies/base.ts` (extend `RecoveryOrderState`, `OrderStateEntry`, `writeOrderState`)

- [ ] **Step 1: Extend the base interfaces.**

In `src/strategies/base.ts`, replace the `RecoveryOrderState` interface (lines 12-20) with:

```ts
export interface AdjustmentHistoryState {
  price: number;
  at: string;
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual';
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
```

Extend `OrderStateEntry` (lines 32-38):

```ts
export interface OrderStateEntry {
  symbol: string;
  orders: OrderHistory[];
  expectedOrders: number;
  recoveryOrders?: RecoveryOrderState[];
  breakdown?: SpikeBotBreakdown;
  lastCancelReason?: { reason: string; at: string };
}
```

In `writeOrderState()` (around line 303-322), include `lastCancelReason` in the emitted object. Replace:

```ts
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

with:

```ts
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
```

- [ ] **Step 2: Populate the new fields in SpikeBot.**

In `src/strategies/spikebot.ts`, the `recoveryForState` construction (around lines 110-132) currently maps into simple shape. Replace the block with:

```ts
const mapTpEntry = (o: TrackedOrder, phase: 'patience' | 'adjusting'): import('./base').RecoveryOrderState => ({
  orderId: o.orderId,
  side: (o.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
  price: o.price,
  entryPrice: o.entryPrice!,
  originalTargetPrice: o.originalTargetPrice ?? o.price,
  cyclesSincePlace: o.cyclesSincePlace!,
  phase,
  adjustmentHistory: o.adjustmentHistory,
  cancelReason: o.cancelReason,
  spikeTrigger: o.spikeTrigger,
});

const recoveryForState: import('./base').RecoveryOrderState[] = [
  ...state.takeProfitOrders
    .filter(o => o.entryPrice !== undefined && o.cyclesSincePlace !== undefined)
    .map(o => mapTpEntry(o, (o.cyclesSincePlace! > this.maxReboundCycles ? 'adjusting' : 'patience'))),
  ...state.heldRecoveryOrders
    .filter(o => o.entryPrice !== undefined)
    .map(o => ({
      orderId: o.orderId,
      side: (o.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      price: o.price,
      entryPrice: o.entryPrice!,
      originalTargetPrice: o.originalTargetPrice ?? o.price,
      cyclesSincePlace: o.cyclesSincePlace ?? 0,
      phase: 'held' as const,
      heldSince: o.heldSince,
      adjustmentHistory: o.adjustmentHistory,
      cancelReason: o.cancelReason,
      spikeTrigger: o.spikeTrigger,
    })),
];
```

And include `lastCancelReason` in the push to `orderStateEntries` (around line 155-171). Replace:

```ts
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

with:

```ts
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
  lastCancelReason: state.lastCancelReason,
});
```

- [ ] **Step 3: Verify type-check and tests.**

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npx tsc --noEmit`
Expected: zero errors.

Run: `cd /Users/tayler/Developer/Protonext/dex-bot && npm test`
Expected: all existing tests still PASS.

- [ ] **Step 4: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot
git add src/strategies/base.ts src/strategies/spikebot.ts
git commit -m "$(cat <<'EOF'
feat(spikebot): surface new per-order and per-market fields in state file

Extends RecoveryOrderState with orderId, adjustmentHistory, cancelReason,
and spikeTrigger; adds lastCancelReason to OrderStateEntry and writeOrderState
output. Consumed by the dashboard in a follow-up change.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Extend dashboard types and command client

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/api.ts`

- [ ] **Step 1: Extend `RecoveryOrder` and `InstanceOrdersMarket` shapes.**

In `src/lib/api.ts`, replace the `RecoveryOrder` interface (around lines 5-14) with:

```ts
export interface AdjustmentHistoryEntry {
  price: number;
  at: string;
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual';
}

export interface SpikeTrigger {
  price: number;
  at: string;
}

export interface RecoveryOrder {
  orderId?: string;
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  originalTargetPrice: number;
  cyclesSincePlace: number;
  phase: 'patience' | 'adjusting' | 'held';
  heldSince?: string;
  adjustmentHistory?: AdjustmentHistoryEntry[];
  cancelReason?: string;
  spikeTrigger?: SpikeTrigger;
}
```

Extend `InstanceOrdersMarket` (around line 27-39) to add the optional `lastCancelReason`:

```ts
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
  lastCancelReason?: { reason: string; at: string };
}
```

- [ ] **Step 2: Add command-related types and client helpers.**

Below the reset types (around line 59), append:

```ts
// Command types for live bot control
export type BotCommandType = 'cancel_order' | 'clear_held' | 'clear_non_held';

export interface BotCommandRequest {
  type: BotCommandType;
  marketSymbol?: string;
  orderId?: string;
}

export interface BotCommandResponse {
  id: string;
  status: 'ok' | 'error' | 'skipped' | 'queued' | 'pending';
  message?: string;
  appliedAt?: string;
}
```

Inside the `instanceApi` object (around line 85 onwards), add these entries near the existing methods (placement doesn't matter functionally; keep alphabetical if the file already uses a convention — otherwise append):

```ts
  // Send a command to a running bot instance (cancel order, clear bucket)
  sendCommand: (id: string, body: BotCommandRequest) =>
    fetchApi<BotCommandResponse>(`/instances/${id}/commands`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Poll for a previously-issued command's outcome
  getCommand: (id: string, commandId: string) =>
    fetchApi<BotCommandResponse>(`/instances/${id}/commands/${commandId}`),

  // Wipe all bot state files (bot must be stopped)
  wipeState: (id: string) =>
    fetchApi<{ deletedFiles: string[] }>(`/instances/${id}/wipe-state`, {
      method: 'POST',
    }),

  // Reset instance with wipeState option (default true)
  reset: (id: string, options?: { cancelOrders?: boolean; restart?: boolean; wipeState?: boolean; marketSymbol?: string }) =>
    fetchApi<ResetResult>(`/instances/${id}/reset`, {
      method: 'POST',
      body: options ? JSON.stringify(options) : undefined,
    }),
```

**Note:** a `reset` helper may already exist under this name. If it does, update the signature to match — don't duplicate.

- [ ] **Step 3: Type-check.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): add bot command client and extend recovery types

Adds BotCommandRequest/Response types, sendCommand/getCommand/wipeState
helpers, and extends RecoveryOrder with orderId, adjustmentHistory,
cancelReason, spikeTrigger. Paves the way for live override UI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Dashboard API — POST `/api/instances/[id]/commands`

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-dashboard/src/app/api/instances/[id]/commands/route.ts`

- [ ] **Step 1: Create the route file.**

Create `src/app/api/instances/[id]/commands/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { pm2Service } from '@/lib/pm2-service';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STATE_DIR = path.join(DATA_DIR, 'state');
const POLL_TIMEOUT_MS = 2000;
const POLL_INTERVAL_MS = 150;

type Status = 'ok' | 'error' | 'skipped' | 'queued' | 'pending';

interface CommandResult {
  id: string;
  status: Status;
  message?: string;
  appliedAt: string;
}

const VALID_TYPES = new Set(['cancel_order', 'clear_held', 'clear_non_held']);

async function findResult(resultsPath: string, commandId: string): Promise<CommandResult | null> {
  try {
    const raw = await fs.readFile(resultsPath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]) as CommandResult;
        if (parsed.id === commandId) return parsed;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { type, marketSymbol, orderId } = body;

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: `invalid type: ${type}` },
        { status: 400 },
      );
    }
    if (type === 'cancel_order' && !orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId required for cancel_order' },
        { status: 400 },
      );
    }

    const instance = await pm2Service.getInstance(id);
    if (!instance) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 },
      );
    }

    await fs.mkdir(STATE_DIR, { recursive: true });
    const cmdPath = path.join(STATE_DIR, `${id}-commands.jsonl`);
    const resultsPath = path.join(STATE_DIR, `${id}-command-results.jsonl`);

    const commandId = randomUUID();
    const command = {
      id: commandId,
      type,
      ...(marketSymbol && { marketSymbol }),
      ...(orderId && { orderId }),
      issuedAt: new Date().toISOString(),
    };
    await fs.appendFile(cmdPath, JSON.stringify(command) + '\n');

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const r = await findResult(resultsPath, commandId);
      if (r) {
        return NextResponse.json({ success: true, data: r });
      }
      await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
    }

    return NextResponse.json({
      success: true,
      data: { id: commandId, status: 'queued', appliedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to enqueue command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to enqueue command' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check and smoke-test against a running instance (optional manual verify).**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

Manual smoke test (optional here, fully verified in Task 17):

```bash
curl -X POST http://localhost:3000/api/instances/<real-instance-id>/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"clear_held","marketSymbol":"XMT_XMD"}'
```

Expected: JSON response with a status field; `queued` if bot isn't running or hasn't picked up yet.

- [ ] **Step 3: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/app/api/instances/[id]/commands/route.ts
git commit -m "$(cat <<'EOF'
feat(api): POST /instances/[id]/commands enqueues bot commands

Writes one JSON-lines command to \${instanceId}-commands.jsonl and polls
\${instanceId}-command-results.jsonl for up to 2s. Returns 'queued' if
the bot hasn't picked it up by then; UI polls /commands/[commandId] for
the eventual outcome.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Dashboard API — GET `/api/instances/[id]/commands/[commandId]`

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-dashboard/src/app/api/instances/[id]/commands/[commandId]/route.ts`

- [ ] **Step 1: Create the route.**

Create `src/app/api/instances/[id]/commands/[commandId]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ id: string; commandId: string }>;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STATE_DIR = path.join(DATA_DIR, 'state');

interface CommandResult {
  id: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  appliedAt: string;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { id, commandId } = await params;
    const resultsPath = path.join(STATE_DIR, `${id}-command-results.jsonl`);

    let raw = '';
    try {
      raw = await fs.readFile(resultsPath, 'utf-8');
    } catch {
      return NextResponse.json({
        success: true,
        data: { id: commandId, status: 'pending', appliedAt: new Date().toISOString() },
      });
    }

    const lines = raw.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]) as CommandResult;
        if (parsed.id === commandId) {
          return NextResponse.json({ success: true, data: parsed });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      data: { id: commandId, status: 'pending', appliedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to fetch command result:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch command result' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/app/api/instances/[id]/commands/[commandId]/route.ts
git commit -m "$(cat <<'EOF'
feat(api): GET /instances/[id]/commands/[commandId] returns command outcome

Scans results file for the matching command id and returns the latest
BotCommandResult, or { status: 'pending' } if not yet applied.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Dashboard API — POST `/api/instances/[id]/wipe-state`

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-dashboard/src/app/api/instances/[id]/wipe-state/route.ts`

- [ ] **Step 1: Create the route.**

Create `src/app/api/instances/[id]/wipe-state/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { pm2Service } from '@/lib/pm2-service';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STATE_DIR = path.join(DATA_DIR, 'state');

export async function POST(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const instance = await pm2Service.getInstance(id);
    if (!instance) {
      return NextResponse.json(
        { success: false, error: 'Instance not found' },
        { status: 404 },
      );
    }
    if (instance.status === 'online') {
      return NextResponse.json(
        { success: false, error: 'Bot must be stopped before wiping state' },
        { status: 409 },
      );
    }

    const names = [
      `${id}-tracked.json`,
      `${id}-orders.json`,
      `${id}-commands.jsonl`,
      `${id}-command-results.jsonl`,
    ];
    const deleted: string[] = [];
    for (const name of names) {
      const p = path.join(STATE_DIR, name);
      try {
        await fs.unlink(p);
        deleted.push(name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }

    return NextResponse.json({
      success: true,
      data: { deletedFiles: deleted },
    });
  } catch (error) {
    console.error('Failed to wipe state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to wipe state' },
      { status: 500 },
    );
  }
}
```

**Note:** if `pm2Service.getInstance` exposes `status` under a different property (e.g. `pm2_env.status`), adapt the check. Inspect `src/lib/pm2-service.ts` to confirm before coding — the check must correctly identify a running instance.

- [ ] **Step 2: Type-check.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors. Fix the status-property access if tsc reports it.

- [ ] **Step 3: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/app/api/instances/[id]/wipe-state/route.ts
git commit -m "$(cat <<'EOF'
feat(api): POST /instances/[id]/wipe-state deletes bot state files

Deletes all four per-instance state files; requires the bot to be stopped.
Returns 409 if the instance is online. Called from the reset flow when
wipeState is true.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Update reset endpoint to wipe state by default

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/app/api/instances/[id]/reset/route.ts`

- [ ] **Step 1: Extend the body parsing and add a wipe-state step.**

Open `src/app/api/instances/[id]/reset/route.ts`. Line 18 currently reads:

```ts
const { cancelOrders = true, flushLogs = true, restart = true, marketSymbol } = body;
```

Replace with:

```ts
const { cancelOrders = true, flushLogs = true, restart = true, wipeState = true, marketSymbol } = body;
```

- [ ] **Step 2: Insert a wipe-state step between cancel-orders and flush-logs.**

Directly after the `cancelOrders` block (currently ending near line 76) and before the `flushLogs` block, add:

```ts
// Step 2b: Wipe bot state files (if requested)
if (wipeState) {
  try {
    const names = [
      `${id}-tracked.json`,
      `${id}-orders.json`,
      `${id}-commands.jsonl`,
      `${id}-command-results.jsonl`,
    ];
    let deleted = 0;
    for (const name of names) {
      const p = path.join(STATE_DIR, name);
      try {
        await fs.unlink(p);
        deleted++;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    steps.push({
      step: 'wipeState',
      status: 'success',
      details: `Deleted ${deleted} state file(s)`,
    });
  } catch (error) {
    steps.push({
      step: 'wipeState',
      status: 'error',
      details: error instanceof Error ? error.message : 'Failed to wipe state',
    });
  }
}
```

Add the required imports at the top of the file (adjust to keep existing ones intact):

```ts
import path from 'path';
```

And define `STATE_DIR` alongside the top-level constants:

```ts
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const STATE_DIR = path.join(DATA_DIR, 'state');
```

Note: `fs/promises` is already imported as `fs` at line 4 — keep that.

- [ ] **Step 3: Type-check.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/app/api/instances/[id]/reset/route.ts
git commit -m "$(cat <<'EOF'
feat(api): reset endpoint wipes bot state by default

Adds wipeState flag (default true) to POST /instances/[id]/reset. Between
on-chain cancel and flush-logs, deletes all four state files so restart
produces a clean slate. Caller can pass wipeState:false to preserve state.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Dashboard UI — filter toolbar + per-market actions

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/dashboard/instance-monitor.tsx`

This task has no unit tests — it's pure UI and existing dashboard conventions don't include component tests. The success criterion is a visual + manual smoke test; Task 17 covers that.

- [ ] **Step 1: Add imports and per-chip filter state to `MarketCard`.**

At the top of `src/components/dashboard/instance-monitor.tsx`, update the lucide import to include the new icons we'll need:

```tsx
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle, RotateCcw,
  Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { instanceApi, InstanceOrdersData, InstanceOrdersMarket, BotCommandType, RecoveryOrder } from '@/lib/api';
```

Inside the `MarketCard` component (line 242), replace the current state hook line:

```tsx
const [expanded, setExpanded] = useState(false);
```

with:

```tsx
type PhaseFilter = 'all' | 'spike' | 'patience' | 'adjusting' | 'held';

const [expanded, setExpanded] = useState(false);
const [filter, setFilter] = useState<PhaseFilter>('all');
const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
const [commandMessage, setCommandMessage] = useState<string | null>(null);
const [commandError, setCommandError] = useState<string | null>(null);
const [commandBusy, setCommandBusy] = useState(false);
```

- [ ] **Step 2: Add a helper to send commands and an `instanceId` prop.**

Change the `MarketCard` signature (line 242) to accept the parent instance id so it can call the API:

```tsx
function MarketCard({ market, instanceId }: { market: InstanceOrdersMarket; instanceId: string }) {
```

In `InstanceMonitor` where `MarketCard` is rendered (around line 231-233), pass it through:

```tsx
ordersData.markets.map((market) => (
  <MarketCard key={market.symbol} market={market} instanceId={instance.id} />
))
```

Inside `MarketCard`, add a helper:

```tsx
async function runCommand(type: BotCommandType, body: { marketSymbol?: string; orderId?: string } = {}) {
  setCommandBusy(true);
  setCommandMessage(null);
  setCommandError(null);
  try {
    const res = await instanceApi.sendCommand(instanceId, { type, ...body });
    if (res.status === 'ok') {
      setCommandMessage(res.message ?? 'Applied');
    } else if (res.status === 'queued') {
      setCommandMessage('Queued — will apply on the bot\u2019s next cycle');
    } else if (res.status === 'skipped') {
      setCommandError(res.message ?? 'Skipped');
    } else {
      setCommandError(res.message ?? 'Command failed');
    }
  } catch (err) {
    setCommandError(err instanceof Error ? err.message : 'Command failed');
  } finally {
    setCommandBusy(false);
  }
}
```

- [ ] **Step 3: Replace the existing expanded body with the new layout.**

The expanded body starts at line 295 (`{expanded && (`). Replace the entire expanded block (from `{expanded && (` through the closing paren/brace of that block — roughly lines 295-464) with the following. Preserve the surrounding click-handler `button` (lines 269-293) and the wrapper `div` (line 267).

```tsx
{expanded && (
  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
    {market.breakdown && (
      <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start gap-4">
          <div className="grid grid-cols-4 gap-2 text-center flex-1">
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
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <button
              disabled={commandBusy || market.breakdown.held === 0}
              onClick={(e) => { e.stopPropagation(); runCommand('clear_held', { marketSymbol: market.symbol }); }}
              className="text-xs px-2 py-1 rounded border border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Held ({market.breakdown.held})
            </button>
            <button
              disabled={commandBusy || (market.breakdown.spike + market.breakdown.patience + market.breakdown.adjusting) === 0}
              onClick={(e) => { e.stopPropagation(); runCommand('clear_non_held', { marketSymbol: market.symbol }); }}
              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Non-Held ({market.breakdown.spike + market.breakdown.patience + market.breakdown.adjusting})
            </button>
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

    {(commandMessage || commandError) && (
      <div className={`mb-3 text-xs px-3 py-2 rounded border ${
        commandError
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
      }`}>
        {commandError ?? commandMessage}
      </div>
    )}

    <MarketCardFilterAndOrders
      market={market}
      filter={filter}
      setFilter={setFilter}
      expandedOrderId={expandedOrderId}
      setExpandedOrderId={setExpandedOrderId}
      runCommand={runCommand}
      commandBusy={commandBusy}
    />
  </div>
)}
```

Now add the new `MarketCardFilterAndOrders` component to the same file (after the `MarketCard` function):

```tsx
function MarketCardFilterAndOrders({
  market, filter, setFilter, expandedOrderId, setExpandedOrderId, runCommand, commandBusy,
}: {
  market: InstanceOrdersMarket;
  filter: 'all' | 'spike' | 'patience' | 'adjusting' | 'held';
  setFilter: (f: 'all' | 'spike' | 'patience' | 'adjusting' | 'held') => void;
  expandedOrderId: string | null;
  setExpandedOrderId: (id: string | null) => void;
  runCommand: (type: BotCommandType, body?: { marketSymbol?: string; orderId?: string }) => Promise<void>;
  commandBusy: boolean;
}) {
  const b = market.breakdown;
  const recoveryOrders = market.recoveryOrders ?? [];
  const totalCount = b ? b.spike + b.patience + b.adjusting + b.held : recoveryOrders.length;

  const lastCancelRecent = market.lastCancelReason
    ? (Date.now() - new Date(market.lastCancelReason.at).getTime()) < 10 * 60 * 1000
    : false;

  const filteredRecovery = recoveryOrders.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'held' || filter === 'patience' || filter === 'adjusting') {
      return r.phase === filter;
    }
    return false;
  });

  return (
    <>
      <div className="flex gap-1.5 items-center py-2 border-t border-b border-gray-200 dark:border-gray-700 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Filter:</span>
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} color="blue" label={`All (${totalCount})`} />
        {b && b.spike > 0 && <FilterChip active={filter === 'spike'} onClick={() => setFilter('spike')} color="blue" label={`${b.spike} spike`} />}
        {b && b.patience > 0 && <FilterChip active={filter === 'patience'} onClick={() => setFilter('patience')} color="yellow" label={`${b.patience} patience`} />}
        {b && b.adjusting > 0 && <FilterChip active={filter === 'adjusting'} onClick={() => setFilter('adjusting')} color="orange" label={`${b.adjusting} adjusting`} />}
        {b && b.held > 0 && <FilterChip active={filter === 'held'} onClick={() => setFilter('held')} color="purple" label={`${b.held} held`} />}
        {lastCancelRecent && market.lastCancelReason && (
          <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
            Last cancel: {market.lastCancelReason.reason}
          </span>
        )}
      </div>

      {filter === 'all' || filter === 'spike' ? (
        <div className="grid grid-cols-2 gap-4 pt-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Buy Orders ({market.buyOrders.length})
              </span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {market.buyOrders.length === 0 ? (
                <p className="text-xs text-gray-400">No buy orders</p>
              ) : (
                market.buyOrders.sort((a, b) => b.price - a.price).map((order) => (
                  <div key={order.order_id} className="text-xs p-2 bg-green-100 dark:bg-green-900/30 rounded flex justify-between">
                    <span>{order.quantity.toFixed(4)}</span>
                    <span className="text-green-600 dark:text-green-400">@ {order.price.toFixed(6)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sell Orders ({market.sellOrders.length})
              </span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {market.sellOrders.length === 0 ? (
                <p className="text-xs text-gray-400">No sell orders</p>
              ) : (
                market.sellOrders.sort((a, b) => a.price - b.price).map((order) => (
                  <div key={order.order_id} className="text-xs p-2 bg-red-100 dark:bg-red-900/30 rounded flex justify-between">
                    <span>{order.quantity.toFixed(4)}</span>
                    <span className="text-red-600 dark:text-red-400">@ {order.price.toFixed(6)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {filteredRecovery.length > 0 && filter !== 'spike' && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {filter === 'all' ? `Recovery (${filteredRecovery.length})` : `${filter} (${filteredRecovery.length})`}
            </span>
          </div>
          <div className="space-y-2">
            {filteredRecovery.map((recovery, idx) => {
              const rowKey = recovery.orderId ?? `${recovery.side}-${recovery.price}-${idx}`;
              const isOpen = expandedOrderId === rowKey;
              return (
                <RecoveryRow
                  key={rowKey}
                  rowKey={rowKey}
                  recovery={recovery}
                  market={market}
                  open={isOpen}
                  onToggle={() => setExpandedOrderId(isOpen ? null : rowKey)}
                  runCommand={runCommand}
                  commandBusy={commandBusy}
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function FilterChip({ active, onClick, color, label }: {
  active: boolean;
  onClick: () => void;
  color: 'blue' | 'yellow' | 'orange' | 'purple';
  label: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
    blue:   { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-blue-700 dark:text-blue-300', border: 'border-gray-300 dark:border-gray-700', activeBg: 'bg-blue-200 dark:bg-blue-900/60', activeText: 'text-blue-900 dark:text-blue-100' },
    yellow: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-gray-300 dark:border-gray-700', activeBg: 'bg-yellow-200 dark:bg-yellow-900/60', activeText: 'text-yellow-900 dark:text-yellow-100' },
    orange: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-orange-700 dark:text-orange-300', border: 'border-gray-300 dark:border-gray-700', activeBg: 'bg-orange-200 dark:bg-orange-900/60', activeText: 'text-orange-900 dark:text-orange-100' },
    purple: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-purple-700 dark:text-purple-300', border: 'border-gray-300 dark:border-gray-700', activeBg: 'bg-purple-200 dark:bg-purple-900/60', activeText: 'text-purple-900 dark:text-purple-100' },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${active ? `${c.activeBg} ${c.activeText}` : `${c.bg} ${c.text}`} ${c.border}`}
    >
      {label}
    </button>
  );
}
```

`RecoveryRow` will be added in Task 16. For now, stub it:

```tsx
function RecoveryRow(props: {
  rowKey: string;
  recovery: RecoveryOrder;
  market: InstanceOrdersMarket;
  open: boolean;
  onToggle: () => void;
  runCommand: (type: BotCommandType, body?: { marketSymbol?: string; orderId?: string }) => Promise<void>;
  commandBusy: boolean;
}) {
  const { recovery, onToggle, open } = props;
  return (
    <div className="text-xs p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer" onClick={onToggle}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          recovery.side === 'BUY'
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}>
          {recovery.side} TP
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {open ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronRight className="h-3 w-3 inline" />}
        </span>
      </div>
      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>TP: {recovery.price.toFixed(6)}</span>
        <span>Entry: {recovery.entryPrice.toFixed(6)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check and smoke the dev server.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

Start dev server: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npm run dev` (background ok).
Open the instance page, expand a market card, verify the chip filter toggles between All/spike/patience/adjusting/held, and the Clear Held / Clear Non-Held buttons render (disabled counts zero).

- [ ] **Step 5: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/components/dashboard/instance-monitor.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): add chip filter and per-market clear actions to MarketCard

Filter toolbar (single-select) with All/spike/patience/adjusting/held.
Per-market Clear Held and Clear Non-Held buttons next to the breakdown.
Stubs RecoveryRow; rich per-order detail follows in the next change.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Dashboard UI — rich recovery row expansion (spike trigger, trajectory, history, cancel)

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/dashboard/instance-monitor.tsx`

- [ ] **Step 1: Add a time-formatting helper and replace `RecoveryRow` stub.**

Near the top of the file (alongside `formatHeldSince`), add:

```tsx
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return iso;
  const diffSec = Math.max(0, (Date.now() - then) / 1000);
  if (diffSec < 60) return `${Math.floor(diffSec)}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function estimateBreakEven(side: 'BUY' | 'SELL', entryPrice: number, feeRate = 0.002): number {
  return side === 'SELL' ? entryPrice * (1 + feeRate) : entryPrice * (1 - feeRate);
}
```

Replace the stub `RecoveryRow` implementation with the full expanded row:

```tsx
function RecoveryRow({
  rowKey, recovery, market, open, onToggle, runCommand, commandBusy,
}: {
  rowKey: string;
  recovery: RecoveryOrder;
  market: InstanceOrdersMarket;
  open: boolean;
  onToggle: () => void;
  runCommand: (type: BotCommandType, body?: { marketSymbol?: string; orderId?: string }) => Promise<void>;
  commandBusy: boolean;
}) {
  const phaseChip = (() => {
    if (recovery.phase === 'patience') {
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', label: `Patience (${recovery.cyclesSincePlace} cyc)` };
    }
    if (recovery.phase === 'adjusting') {
      return { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', label: `Adjusting (${recovery.cyclesSincePlace} cyc)` };
    }
    return { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', label: recovery.heldSince ? `Held · ${formatRelative(recovery.heldSince)}` : 'Held' };
  })();

  const progressPct = recovery.originalTargetPrice !== recovery.entryPrice
    ? Math.abs(recovery.originalTargetPrice - recovery.price)
      / Math.abs(recovery.originalTargetPrice - recovery.entryPrice) * 100
    : 0;

  const breakEven = estimateBreakEven(recovery.side, recovery.entryPrice);

  return (
    <div className={`text-xs p-3 rounded-lg border cursor-pointer ${
      open
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500'
        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
    }`} onClick={onToggle}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex gap-2 items-center">
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            recovery.side === 'BUY'
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
          }`}>{recovery.side} TP</span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${phaseChip.bg} ${phaseChip.text}`}>
            {phaseChip.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          {recovery.phase === 'held' && recovery.orderId && (
            <button
              disabled={commandBusy}
              onClick={(e) => { e.stopPropagation(); runCommand('cancel_order', { marketSymbol: market.symbol, orderId: recovery.orderId }); }}
              className="text-[10px] px-2 py-0.5 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 disabled:opacity-40"
            >
              Cancel
            </button>
          )}
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </div>
      </div>

      <div className="flex justify-between text-gray-600 dark:text-gray-400">
        <span>TP: {recovery.price.toFixed(6)}</span>
        <span>Entry: {recovery.entryPrice.toFixed(6)}</span>
      </div>

      <div className="mt-1.5">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(progressPct, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-0.5 text-[10px] text-gray-400">
          <span>Target: {recovery.originalTargetPrice.toFixed(6)}</span>
          <span>Floor: {recovery.entryPrice.toFixed(6)}</span>
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">Spike trigger</div>
              {recovery.spikeTrigger ? (
                <>
                  <div className="text-gray-700 dark:text-gray-300">@ {recovery.spikeTrigger.price.toFixed(6)} · {formatRelative(recovery.spikeTrigger.at)}</div>
                </>
              ) : (
                <div className="text-gray-400 italic">no trigger recorded</div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">Recovery trajectory</div>
              <div className="text-gray-700 dark:text-gray-300">
                Target {recovery.originalTargetPrice.toFixed(6)} · Floor {recovery.entryPrice.toFixed(6)}
              </div>
              <div className="text-yellow-700 dark:text-yellow-400 text-[10px] mt-0.5">
                Break-even ≈ {breakEven.toFixed(6)}
              </div>
            </div>
          </div>

          {recovery.adjustmentHistory && recovery.adjustmentHistory.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Adjustment history</div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {recovery.adjustmentHistory.map((h, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-gray-400">→</span>}
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px]">
                      {h.price.toFixed(6)} <span className="text-gray-400">· {h.reason} · {formatRelative(h.at)}</span>
                    </span>
                  </span>
                ))}
                {recovery.phase === 'held' && (
                  <>
                    <span className="text-gray-400">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px]">held</span>
                  </>
                )}
              </div>
            </div>
          )}

          {recovery.cancelReason && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              Cancel reason: {recovery.cancelReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and smoke-test.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

Open the dev server, expand a MarketCard, click a recovery row: it should expand inline and show spike trigger, trajectory with break-even, adjustment history chain, and (on a held row) a Cancel button.

- [ ] **Step 3: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/components/dashboard/instance-monitor.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): rich recovery row expansion with trigger, trajectory, history

Clicking a recovery row now reveals spike-trigger context, recovery trajectory
with break-even estimate, adjustment history timeline, cancel reason, and a
Cancel button on held rows that issues cancel_order to the running bot.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Dashboard UI — instance-wide action buttons + verify clean reset

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/dashboard/instance-monitor.tsx`

- [ ] **Step 1: Add instance-wide action buttons to the header.**

In `InstanceMonitor` around lines 142-165 (the header with Refresh + Reset Bot), replace the surrounding `<div className="flex items-center gap-2">` block with:

```tsx
<div className="flex items-center gap-2">
  <Button variant="secondary" size="sm" onClick={() => fetchOrders()} disabled={loading}>
    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
    Refresh
  </Button>
  <Button
    variant="secondary" size="sm"
    onClick={() => runInstanceCommand('clear_held', 'Clear All Held')}
    disabled={commandBusy || instance.status === 'stopped'}
  >
    Clear All Held
  </Button>
  <Button
    variant="secondary" size="sm"
    onClick={() => runInstanceCommand('clear_non_held', 'Clear All Non-Held')}
    disabled={commandBusy || instance.status === 'stopped'}
  >
    Clear All Non-Held
  </Button>
  <Button variant="secondary" size="sm" onClick={() => handleReset(true, true)} disabled={resetting || instance.status === 'stopped'}>
    {resetting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
    Reset Bot
  </Button>
</div>
```

Inside `InstanceMonitor` add state and helper (near the existing `resetting` state):

```tsx
const [commandBusy, setCommandBusy] = useState(false);
const [commandResult, setCommandResult] = useState<{ success: boolean; message: string } | null>(null);

const runInstanceCommand = async (type: BotCommandType, label: string) => {
  const totalsNote = ordersData?.markets.reduce(
    (acc, m) => {
      if (!m.breakdown) return acc;
      if (type === 'clear_held') return { orders: acc.orders + m.breakdown.held, markets: acc.markets + (m.breakdown.held > 0 ? 1 : 0) };
      const nonHeld = m.breakdown.spike + m.breakdown.patience + m.breakdown.adjusting;
      return { orders: acc.orders + nonHeld, markets: acc.markets + (nonHeld > 0 ? 1 : 0) };
    },
    { orders: 0, markets: 0 },
  );
  const confirmMsg = `${label}: affects ${totalsNote?.orders ?? 0} orders across ${totalsNote?.markets ?? 0} markets. Continue?`;
  if (!confirm(confirmMsg)) return;

  setCommandBusy(true);
  setCommandResult(null);
  try {
    const res = await instanceApi.sendCommand(instance.id, { type });
    const success = res.status === 'ok' || res.status === 'queued';
    setCommandResult({
      success,
      message: res.message ?? (res.status === 'queued' ? 'Queued — will apply on next cycle' : res.status),
    });
    await fetchOrders();
    onRefresh?.();
  } catch (err) {
    setCommandResult({
      success: false,
      message: err instanceof Error ? err.message : 'Command failed',
    });
  } finally {
    setCommandBusy(false);
  }
};
```

Also add a result banner below the existing `resetResult` banner (around line 169-179):

```tsx
{commandResult && (
  <div className={`p-3 rounded-lg border text-sm ${
    commandResult.success
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
  }`}>
    {commandResult.message}
  </div>
)}
```

Import `BotCommandType` at the top if not already added:

```tsx
import { instanceApi, InstanceOrdersData, InstanceOrdersMarket, BotCommandType, RecoveryOrder } from '@/lib/api';
```

- [ ] **Step 2: Wire `handleReset` to always wipe state.**

Find `handleReset` (around line 86-111) and change the single `reset` call (around line 94):

```tsx
const result = await instanceApi.reset(instance.id, { cancelOrders, restart });
```

to:

```tsx
const result = await instanceApi.reset(instance.id, { cancelOrders, restart, wipeState: true });
```

- [ ] **Step 3: Type-check and smoke test.**

Run: `cd /Users/tayler/Developer/Protonext/dex-dashboard && npx tsc --noEmit`
Expected: zero errors.

Manually verify on a running testnet instance:

1. Open the instance page, click **Clear All Held** → confirm dialog → success banner or "Queued".
2. Wait one cycle (~30s), refresh — held bucket should be empty.
3. Hit **Reset Bot** → after restart, breakdown should show fresh spike orders placed from scratch (no carried-over held).

- [ ] **Step 4: Commit.**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
git add src/components/dashboard/instance-monitor.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): instance-wide clear buttons and truly-clean reset

Adds Clear All Held / Clear All Non-Held buttons next to Reset Bot (both
confirm with an aggregate order-count summary). Reset Bot now passes
wipeState:true so tracked.json is deleted between stop and restart.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Full manual verification checklist

This task has no code and no commit — it's a post-implementation checklist. Mark each line when verified on a real testnet instance.

- [ ] Dashboard expanded MarketCard shows chip filter row with All/spike/patience/adjusting/held.
- [ ] Clicking a chip filters to that phase; clicking All restores full view.
- [ ] Clicking a recovery row expands it inline; only one row open at a time.
- [ ] Expanded row shows: spike trigger, recovery trajectory with break-even, adjustment history chain, cancel reason if set.
- [ ] Held rows show a Cancel button; clicking it issues `cancel_order`, shows success, and that order disappears from the UI after the next cycle.
- [ ] Per-market Clear Held and Clear Non-Held buttons work while the bot is running; disabled counts are zero.
- [ ] Instance-wide Clear All Held and Clear All Non-Held buttons work with confirm dialog.
- [ ] "Reset Bot" truly wipes state: after restart, no carryover held orders; bot places fresh spike orders on first cycle.
- [ ] If the bot is stopped, instance-wide command buttons are disabled (status badge reflects this).
- [ ] Queue + rotation: issue many commands in quick succession; `command-results.jsonl` caps at 200 lines; commands file is empty after bot processes them.
- [ ] `last-cancel` banner shows when a pair just had an order cancelled; fades after ~10 minutes.
- [ ] `/api/instances/[id]/commands/[commandId]` returns `pending` for unknown ids; returns historical result for known ids.

---

## Execution Checkpoints

- **After Task 4**: all bot-side data capture (lastCancelReason) plumbed and tested. Good pause point for review.
- **After Task 9**: full bot side complete with command handling + new fields in state file. Good pause point.
- **After Task 14**: full dashboard API layer in place; can manually smoke-test via curl.
- **After Task 17**: full UI up; run the manual checklist in Task 18.
