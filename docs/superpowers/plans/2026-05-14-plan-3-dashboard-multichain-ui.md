# Plan 3: Dashboard Multi-Chain UI + Venue Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the dex-dashboard so a `BotInstance` has a `venue` discriminator (`'proton' | 'solana'`), branch PM2 / holdings / dex-api services on venue, add a new instance-creation form for Solana, render a chain badge on the instances list, add Chain + DEX columns and filter chips to the trades view, build an export-options dialog (format + filters), and format SPL token balances correctly in the holdings view.

**Architecture:** Schema-first — extend `instance.ts` types with a Zod discriminated union. Then update services to branch on `instance.venue`. UI gets venue-aware components: a venue picker on instance creation that branches between the existing Proton form and a new Solana form, plus column/filter additions to existing trades and instances views. The export-options dialog wraps the `GET /api/trades/export` endpoint shipped in Plan 1.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, Tailwind CSS 4, Zod 4, Zustand, react-query 5, vitest, `@solana/web3.js`, `@solana/spl-token`.

**Source spec:** `/Users/tayler/Developer/Protonext/dex-bot/docs/superpowers/specs/2026-05-14-dex-bot-solana-design.md` (sections 5.2, 8).

**Depends on:** Plan 1 (trades schema extensions); Plan 2 (working dex-bot-solana to actually start instances against).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `src/types/instance.ts` | Modify | Add `Venue`, `SolanaSwapperPairSchema`, `SolanaBotConfigSchema`, `BotInstanceConfigSchema` discriminated union; widen `BotInstance.network` to include `'devnet'`; add `venue` to `BotInstance` and `CreateInstanceSchema` |
| `src/lib/pm2-service.ts` | Modify | Resolve cwd from `DEX_BOT_PATH` (proton) or `DEX_BOT_SOLANA_PATH` (solana) based on venue; update `getPm2Name` to include venue prefix |
| `src/lib/holdings-service.ts` | Modify | New `recordSolanaSnapshot()` path that uses `solana-balances.ts` helper; cron picks fetcher based on instance.venue |
| `src/lib/solana-balances.ts` | Create | `fetchSolanaBalances(walletPubkey, mints)` — wraps `@solana/web3.js` Connection for the dashboard's holdings cron |
| `src/lib/dex-api.ts` | Modify | Add `getSolanaPrice(symbol)` using Jupiter quote API; `getPrice` branches on venue |
| `src/components/instance-create-form.tsx` | Modify | Add venue picker; branch to existing Proton form or new Solana form |
| `src/components/instance-create-solana-form.tsx` | Create | Solana-specific creation form (wallet, RPC, swapper pairs) |
| `src/components/instances-list.tsx` | Modify | Add chain badge column |
| `src/components/trades-table.tsx` | Modify | Add Chain + DEX columns + filter chips |
| `src/components/trades-export-dialog.tsx` | Create | Modal: format picker (cointracker/koinly/cointracking/csv/json) + filter selectors → triggers download |
| `src/components/holdings-table.tsx` | Modify | Format SPL balances with appropriate decimals |
| `test/types/instance-discriminated.test.ts` | Create | Zod discriminated union accepts both venue shapes |
| `test/lib/pm2-service-venue.test.ts` | Create | PM2 cwd resolution branches on venue |
| `test/lib/solana-balances.test.ts` | Create | SPL + native SOL balance shape (mocks Connection) |
| `test/lib/holdings-service-solana.test.ts` | Create | Holdings cron writes SPL snapshots correctly for solana instances |
| `test/components/trades-export-dialog.test.tsx` | Create | Renders, format+filter selection builds correct query string |

---

## Phase A — Schema discriminator

### Task A1: Extend instance.ts with Venue + Solana schemas

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/types/instance.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-dashboard/test/types/instance-discriminated.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/test/types/instance-discriminated.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BotInstanceConfigSchema,
  SolanaSwapperPairSchema,
  SolanaBotConfigSchema,
  CreateInstanceSchema,
} from '@/types/instance';

const validProton = {
  venue: 'proton',
  bot: {
    tradeIntervalMS: 5000,
    slackIntervalMS: 60000,
    cancelOpenOrdersOnExit: false,
    gridPlacement: true,
    strategy: 'gridBot',
    rpc: { endpoints: ['https://x'], apiRoot: 'https://x', lightApiRoot: 'https://x' },
  },
};

const validSolana = {
  venue: 'solana',
  bot: {
    tradeIntervalMS: 30000,
    strategy: 'swapper',
    swapper: {
      pairs: [{
        symbol: 'SOL/USDC', base: 'SOL', quote: 'USDC',
        quoteAmountPerSwap: 25, quoteMaxHold: 500, quoteMinHold: 25,
        quoteBuyMaxThreshold: 150, quoteSellMinThreshold: 200, slippageBps: 50,
      }],
    },
    wallet: { publicKey: 'pk', privateKey: 'sk' },
    rpc: { endpoints: ['https://api.mainnet-beta.solana.com'] },
    jupiter: { apiBase: 'https://lite-api.jup.ag/swap/v1' },
  },
};

describe('BotInstanceConfigSchema discriminated union', () => {
  it('accepts a valid Proton config', () => {
    expect(BotInstanceConfigSchema.parse(validProton).venue).toBe('proton');
  });

  it('accepts a valid Solana config', () => {
    expect(BotInstanceConfigSchema.parse(validSolana).venue).toBe('solana');
  });

  it('rejects when venue is missing', () => {
    expect(() => BotInstanceConfigSchema.parse({ bot: validProton.bot })).toThrow();
  });

  it('rejects a Solana config with Proton fields', () => {
    expect(() => BotInstanceConfigSchema.parse({ venue: 'solana', bot: validProton.bot })).toThrow();
  });
});

describe('SolanaSwapperPairSchema', () => {
  it('rejects negative thresholds', () => {
    expect(() => SolanaSwapperPairSchema.parse({
      symbol: 'SOL/USDC', base: 'SOL', quote: 'USDC',
      quoteAmountPerSwap: -1, quoteMaxHold: 500, quoteMinHold: 25,
      quoteBuyMaxThreshold: 150, quoteSellMinThreshold: 200, slippageBps: 50,
    })).toThrow();
  });

  it('accepts mintOverride for memecoins', () => {
    const parsed = SolanaSwapperPairSchema.parse({
      symbol: 'PEPE/USDC', base: 'PEPE', quote: 'USDC',
      mintOverride: { base: 'CustomMint123', baseDecimals: 6 },
      quoteAmountPerSwap: 10, quoteMaxHold: 100, quoteMinHold: 5,
      quoteBuyMaxThreshold: 0.0001, quoteSellMinThreshold: 0.001, slippageBps: 200,
    });
    expect(parsed.mintOverride?.base).toBe('CustomMint123');
  });
});

describe('CreateInstanceSchema with venue', () => {
  it('accepts a Solana create payload', () => {
    const parsed = CreateInstanceSchema.parse({
      name: 'sol-test-1',
      venue: 'solana',
      username: 'solana-wallet-1',
      privateKey: '<base58 secret>',
      mode: 'live',
      network: 'mainnet',
      config: validSolana.bot,
    });
    expect(parsed.venue).toBe('solana');
  });

  it('defaults venue to proton for backward compat', () => {
    const parsed = CreateInstanceSchema.parse({
      name: 'p1',
      username: 'protonuser',
      privateKey: '<key>',
      mode: 'live',
      network: 'mainnet',
      config: validProton.bot,
    });
    expect(parsed.venue).toBe('proton');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
npx vitest run test/types/instance-discriminated.test.ts
```
Expected: FAIL — `BotInstanceConfigSchema`/`SolanaSwapperPairSchema` not exported.

- [ ] **Step 3: Update instance.ts**

In `/Users/tayler/Developer/Protonext/dex-dashboard/src/types/instance.ts`:

After the existing `DashboardConfigSchema` definition, add:

```ts
// =============================================================================
// SOLANA SCHEMAS
// =============================================================================

export const Venue = z.enum(['proton', 'solana']);
export type Venue = z.infer<typeof Venue>;

export const SolanaSwapperPairSchema = z.object({
  symbol: z.string(),                         // e.g. "SOL/USDC"
  base: z.string(),                           // e.g. "SOL"
  quote: z.string(),                          // e.g. "USDC"
  mintOverride: z.object({
    base: z.string().optional(),
    quote: z.string().optional(),
    baseDecimals: z.number().optional(),
    quoteDecimals: z.number().optional(),
  }).optional(),
  quoteAmountPerSwap: z.number().positive(),
  quoteMaxHold: z.number().positive(),
  quoteMinHold: z.number().positive(),
  quoteBuyMaxThreshold: z.number().positive(),
  quoteSellMinThreshold: z.number().positive(),
  slippageBps: z.number().min(0).max(10000).default(50),
});
export type SolanaSwapperPair = z.infer<typeof SolanaSwapperPairSchema>;

export const SolanaBotConfigSchema = z.object({
  tradeIntervalMS: z.number().min(1000).default(30000),
  strategy: z.enum(['swapper']),    // grows as more strategies ship
  swapper: z.object({ pairs: z.array(SolanaSwapperPairSchema) }).optional(),
  wallet: z.object({
    publicKey: z.string(),
    privateKey: z.string().optional(),
  }),
  rpc: z.object({ endpoints: z.array(z.string()).min(1) }),
  jupiter: z.object({
    apiBase: z.string().default('https://lite-api.jup.ag/swap/v1'),
    tokenListUrl: z.string().default('https://lite-api.jup.ag/tokens/v1/strict'),
  }).default({ apiBase: 'https://lite-api.jup.ag/swap/v1', tokenListUrl: 'https://lite-api.jup.ag/tokens/v1/strict' }),
});
export type SolanaBotConfig = z.infer<typeof SolanaBotConfigSchema>;

// Discriminated union: instance is either proton or solana shape
export const BotInstanceConfigSchema = z.discriminatedUnion('venue', [
  z.object({ venue: z.literal('proton'), bot: BotConfigSchema, dashboard: DashboardConfigSchema.optional() }),
  z.object({ venue: z.literal('solana'), bot: SolanaBotConfigSchema, dashboard: DashboardConfigSchema.optional() }),
]);
export type BotInstanceConfig = z.infer<typeof BotInstanceConfigSchema>;
```

Then update `BotInstance` (around line 202): add `venue: Venue;` after `id`, and change `network: 'mainnet' | 'testnet'` to `network: 'mainnet' | 'testnet' | 'devnet'`.

Then update `CreateInstanceSchema` (around line 222): add `venue: Venue.default('proton')` to the schema, change `network` enum to include `'devnet'`. The `config` field stays as-is — Zod will coerce based on venue.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/types/instance-discriminated.test.ts
```
Expected: PASS — all six tests green.

- [ ] **Step 5: Commit**

```bash
git add src/types/instance.ts test/types/instance-discriminated.test.ts
git commit -m "feat(types): venue-discriminated BotInstanceConfigSchema + Solana schemas"
```

---

## Phase B — Service venue branching

### Task B1: PM2 service routes by venue

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/pm2-service.ts:22-23`
- Test: `/Users/tayler/Developer/Protonext/dex-dashboard/test/lib/pm2-service-venue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/test/lib/pm2-service-venue.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, cb: any) => cb(null, { stdout: '', stderr: '' })),
}));

vi.mock('fs/promises', async () => {
  const real = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...real, access: vi.fn(async () => undefined) };
});

describe('pm2-service venue routing', () => {
  beforeEach(() => {
    process.env.DEX_BOT_PATH = '/path/to/dex-bot';
    process.env.DEX_BOT_SOLANA_PATH = '/path/to/dex-bot-solana';
    delete require.cache[require.resolve('@/lib/pm2-service')];
  });

  it('resolveCwdForVenue returns DEX_BOT_PATH for proton', async () => {
    const { resolveCwdForVenue } = await import('@/lib/pm2-service');
    expect(resolveCwdForVenue('proton')).toBe('/path/to/dex-bot');
  });

  it('resolveCwdForVenue returns DEX_BOT_SOLANA_PATH for solana', async () => {
    const { resolveCwdForVenue } = await import('@/lib/pm2-service');
    expect(resolveCwdForVenue('solana')).toBe('/path/to/dex-bot-solana');
  });

  it('throws if DEX_BOT_SOLANA_PATH missing for solana', async () => {
    delete process.env.DEX_BOT_SOLANA_PATH;
    delete require.cache[require.resolve('@/lib/pm2-service')];
    const { resolveCwdForVenue } = await import('@/lib/pm2-service');
    expect(() => resolveCwdForVenue('solana')).toThrow(/DEX_BOT_SOLANA_PATH/);
  });

  it('getPm2Name includes venue prefix for solana', async () => {
    const { getPm2Name } = await import('@/lib/pm2-service');
    expect(getPm2Name('inst-1', 'solana')).toBe('dex-bot-solana-inst-1');
    expect(getPm2Name('inst-2', 'proton')).toBe('dex-bot-inst-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/lib/pm2-service-venue.test.ts
```
Expected: FAIL — `resolveCwdForVenue` not exported.

- [ ] **Step 3: Update pm2-service.ts**

In `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/pm2-service.ts`, after the existing `DEX_BOT_PATH` constant (line 22), add:

```ts
const DEX_BOT_SOLANA_PATH = process.env.DEX_BOT_SOLANA_PATH;

export function resolveCwdForVenue(venue: 'proton' | 'solana'): string {
  if (venue === 'solana') {
    if (!DEX_BOT_SOLANA_PATH) {
      throw new Error(
        'DEX_BOT_SOLANA_PATH env var must be set to your dex-bot-solana installation directory ' +
        '(typically /Users/.../Developer/Protonext/dex-bot-solana).',
      );
    }
    return DEX_BOT_SOLANA_PATH;
  }
  return DEX_BOT_PATH;
}
```

Then update `getPm2Name` (currently around line 82) — change its signature to take a venue and prefix:

```ts
export function getPm2Name(instanceId: string, venue: 'proton' | 'solana' = 'proton'): string {
  return venue === 'solana' ? `dex-bot-solana-${instanceId}` : `dex-bot-${instanceId}`;
}
```

Update all internal callers of `getPm2Name(id)` to pass the `instance.venue` (find with `grep -n "getPm2Name(" src/lib/pm2-service.ts`). Also update any place that uses `DEX_BOT_PATH` for `cwd` to use `resolveCwdForVenue(instance.venue)`.

Also update `verifyDexBotPath` to take a venue parameter so it can verify either repo:

```ts
async function verifyDexBotPath(venue: 'proton' | 'solana' = 'proton'): Promise<void> {
  const dir = resolveCwdForVenue(venue);
  try {
    const packageJsonPath = path.join(dir, 'package.json');
    await fs.access(packageJsonPath);
  } catch {
    throw new Error(
      `${venue === 'solana' ? 'dex-bot-solana' : 'dex-bot'} not found at ${dir}. ` +
      `Please set the ${venue === 'solana' ? 'DEX_BOT_SOLANA_PATH' : 'DEX_BOT_PATH'} environment variable.`,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/lib/pm2-service-venue.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pm2-service.ts test/lib/pm2-service-venue.test.ts
git commit -m "feat(pm2): venue-aware cwd + process-name routing"
```

---

### Task B2: Solana balance fetcher for the dashboard

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/solana-balances.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-dashboard/test/lib/solana-balances.test.ts`

- [ ] **Step 1: Add @solana deps to dashboard**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
npm install @solana/web3.js @solana/spl-token
```

- [ ] **Step 2: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/test/lib/solana-balances.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getBalance: vi.fn(async () => 2_500_000_000),
      getParsedTokenAccountsByOwner: vi.fn(async () => ({
        value: [{
          pubkey: new actual.PublicKey('11111111111111111111111111111111'),
          account: { data: { parsed: { info: { mint: 'EPjFW', tokenAmount: { amount: '150000000', decimals: 6 } } } } },
        }],
      })),
    })),
  };
});

describe('fetchSolanaBalances', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('@/lib/solana-balances')];
  });

  it('returns native SOL + SPL balances in human units', async () => {
    const { fetchSolanaBalances } = await import('@/lib/solana-balances');
    const result = await fetchSolanaBalances(
      'https://api.mainnet-beta.solana.com',
      new PublicKey('11111111111111111111111111111111'),
      ['So11111111111111111111111111111111111111112', 'EPjFW'],
    );
    expect(result['So11111111111111111111111111111111111111112']).toBeCloseTo(2.5);
    expect(result.EPjFW).toBeCloseTo(150);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run test/lib/solana-balances.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement fetchSolanaBalances**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/solana-balances.ts`:

```ts
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Fetch balances for a Solana wallet from the given RPC.
 * Returns a map keyed by mint address with values in human-readable units.
 */
export async function fetchSolanaBalances(
  rpcUrl: string,
  owner: PublicKey,
  mints: string[],
): Promise<Record<string, number>> {
  const conn = new Connection(rpcUrl, 'confirmed');
  const result: Record<string, number> = {};
  for (const m of mints) result[m] = 0;

  if (mints.includes(SOL_MINT)) {
    const lamports = await conn.getBalance(owner);
    result[SOL_MINT] = lamports / LAMPORTS_PER_SOL;
  }

  const splMints = mints.filter(m => m !== SOL_MINT);
  if (splMints.length === 0) return result;

  const accounts = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
  for (const acc of accounts.value) {
    const info = acc.account.data.parsed.info;
    const mint: string = info.mint;
    if (!splMints.includes(mint)) continue;
    const amount = Number(info.tokenAmount.amount);
    const decimals = Number(info.tokenAmount.decimals);
    result[mint] = (result[mint] ?? 0) + amount / Math.pow(10, decimals);
  }
  return result;
}
```

- [ ] **Step 5: Test, then commit**

```bash
npx vitest run test/lib/solana-balances.test.ts
```
Expected: PASS.

```bash
git add src/lib/solana-balances.ts test/lib/solana-balances.test.ts package.json package-lock.json
git commit -m "feat(holdings): solana-balances helper for dashboard cron"
```

---

### Task B3: Holdings cron picks fetcher per venue

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/holdings-service.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-dashboard/test/lib/holdings-service-solana.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/test/lib/holdings-service-solana.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

vi.mock('@/lib/solana-balances', () => ({
  fetchSolanaBalances: vi.fn(async () => ({
    'So11111111111111111111111111111111111111112': 1.5,
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 250,
  })),
}));

describe('holdings-service solana branch', () => {
  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'holdings-sol-'));
    delete require.cache[require.resolve('@/lib/holdings-service')];
  });

  it('records SPL snapshots for a solana instance', async () => {
    const { holdingsService } = await import('@/lib/holdings-service');
    const snapshots = await holdingsService.recordSolanaSnapshot({
      instanceId: 'sol-1',
      instanceName: 'sol test',
      walletPubkey: '11111111111111111111111111111111',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      pairs: [{
        symbol: 'SOL/USDC',
        baseMint: 'So11111111111111111111111111111111111111112', baseSymbol: 'SOL',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', quoteSymbol: 'USDC',
        currentPrice: 165,
      }],
    });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].symbol).toBe('SOL/USDC');
    expect(snapshots[0].baseToken).toBe('SOL');
    expect(parseFloat(snapshots[0].baseBalance)).toBe(1.5);
    expect(snapshots[0].currentPrice).toBe(165);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/lib/holdings-service-solana.test.ts
```
Expected: FAIL — `recordSolanaSnapshot` not defined.

- [ ] **Step 3: Add recordSolanaSnapshot to HoldingsService**

In `/Users/tayler/Developer/Protonext/dex-dashboard/src/lib/holdings-service.ts`, add a new method on `HoldingsService` (alongside the existing `recordInstanceHoldings`):

```ts
import { fetchSolanaBalances } from './solana-balances';
import { PublicKey } from '@solana/web3.js';
// ...

interface SolanaSnapshotInput {
  instanceId: string;
  instanceName: string;
  walletPubkey: string;
  rpcUrl: string;
  pairs: Array<{
    symbol: string;
    baseMint: string; baseSymbol: string;
    quoteMint: string; quoteSymbol: string;
    currentPrice: number;
  }>;
}

// Inside HoldingsService class:
async recordSolanaSnapshot(input: SolanaSnapshotInput): Promise<HoldingsSnapshot[]> {
  const allMints = new Set<string>();
  for (const p of input.pairs) {
    allMints.add(p.baseMint);
    allMints.add(p.quoteMint);
  }
  const balances = await fetchSolanaBalances(
    input.rpcUrl,
    new PublicKey(input.walletPubkey),
    [...allMints],
  );

  const snapshots: HoldingsSnapshot[] = [];
  const timestamp = new Date().toISOString();
  for (const p of input.pairs) {
    snapshots.push(this.recordSnapshot({
      timestamp,
      instanceId: input.instanceId,
      instanceName: input.instanceName,
      username: input.walletPubkey,
      strategy: 'swapper',
      symbol: p.symbol,
      baseToken: p.baseSymbol, baseContract: p.baseMint,
      baseBalance: String(balances[p.baseMint] ?? 0),
      quoteToken: p.quoteSymbol, quoteContract: p.quoteMint,
      quoteBalance: String(balances[p.quoteMint] ?? 0),
      currentPrice: p.currentPrice,
      totalValueUsd: (balances[p.baseMint] ?? 0) * p.currentPrice + (balances[p.quoteMint] ?? 0),
    }));
  }
  return snapshots;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/lib/holdings-service-solana.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/holdings-service.ts test/lib/holdings-service-solana.test.ts
git commit -m "feat(holdings): recordSolanaSnapshot fetches SPL balances and persists"
```

---

### Task B4: Holdings cron picks fetcher by instance.venue

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/app/api/crons/<existing-holdings-cron-route>/route.ts` (find via grep)

- [ ] **Step 1: Locate the existing holdings cron route**

```bash
grep -rn "recordInstanceHoldings\|holdingsService" /Users/tayler/Developer/Protonext/dex-dashboard/src/app/api/crons/
```
Expected: a file under `crons/` that iterates instances and records holdings.

- [ ] **Step 2: Update the cron loop**

In the cron route file, where it iterates instances and calls `recordInstanceHoldings`, branch on venue:

```ts
import { holdingsService } from '@/lib/holdings-service';

for (const instance of instances) {
  if (instance.venue === 'solana') {
    const cfg = await loadInstanceConfig(instance.id); // existing helper
    const pairs = (cfg.bot.swapper?.pairs ?? []).map((p: any) => ({
      symbol: p.symbol,
      baseMint: p.mintOverride?.base ?? lookupMint(p.base),   // helper or hardcoded for SOL/USDC etc
      baseSymbol: p.base,
      quoteMint: p.mintOverride?.quote ?? lookupMint(p.quote),
      quoteSymbol: p.quote,
      currentPrice: 0, // optional: fetch via Jupiter quote here
    }));
    await holdingsService.recordSolanaSnapshot({
      instanceId: instance.id,
      instanceName: instance.name,
      walletPubkey: cfg.bot.wallet.publicKey,
      rpcUrl: cfg.bot.rpc.endpoints[0],
      pairs,
    });
  } else {
    await holdingsService.recordInstanceHoldings(/* existing proton args */);
  }
}
```

(The `lookupMint` helper is straightforward: a small static map for `SOL`, `USDC`, `USDT`, with fallback to the mintOverride. Add it inline or as a helper module.)

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
npx vitest run
```
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Hit the cron endpoint with a registered Solana instance; verify a row appears in `holdings.db`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/crons/...
git commit -m "feat(crons): holdings cron branches on venue for solana instances"
```

---

## Phase C — UI: instance creation

### Task C1: Solana instance-creation form

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/instance-create-solana-form.tsx`
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/instance-create-form.tsx`

- [ ] **Step 1: Locate the existing instance-create-form**

```bash
find /Users/tayler/Developer/Protonext/dex-dashboard/src/components -name "instance-create*"
```
Expected: at least one file (the existing Proton form).

- [ ] **Step 2: Add venue picker to existing form**

In `instance-create-form.tsx`, at the top of the form add a venue picker:

```tsx
const [venue, setVenue] = useState<'proton' | 'solana'>('proton');

return (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium">Venue</label>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => setVenue('proton')}
          className={`px-3 py-1.5 rounded ${venue === 'proton' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Proton (XPR)
        </button>
        <button
          type="button"
          onClick={() => setVenue('solana')}
          className={`px-3 py-1.5 rounded ${venue === 'solana' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Solana (Jupiter)
        </button>
      </div>
    </div>

    {venue === 'proton' ? (
      <ExistingProtonForm /* unchanged */ />
    ) : (
      <SolanaInstanceForm onSubmit={handleSolanaSubmit} />
    )}
  </div>
);
```

- [ ] **Step 3: Implement SolanaInstanceForm**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/instance-create-solana-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

interface SolanaPairInput {
  symbol: string; base: string; quote: string;
  quoteAmountPerSwap: string;
  quoteMaxHold: string; quoteMinHold: string;
  quoteBuyMaxThreshold: string; quoteSellMinThreshold: string;
  slippageBps: string;
}

interface Props {
  onSubmit: (payload: any) => void | Promise<void>;
}

const DEFAULT_PAIR: SolanaPairInput = {
  symbol: 'SOL/USDC', base: 'SOL', quote: 'USDC',
  quoteAmountPerSwap: '25',
  quoteMaxHold: '500', quoteMinHold: '25',
  quoteBuyMaxThreshold: '150', quoteSellMinThreshold: '200',
  slippageBps: '50',
};

export default function SolanaInstanceForm({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const [walletPubkey, setWalletPubkey] = useState('');
  const [walletPrivateKey, setWalletPrivateKey] = useState('');
  const [rpc, setRpc] = useState('https://api.mainnet-beta.solana.com');
  const [mode, setMode] = useState<'live' | 'paper'>('paper');
  const [network, setNetwork] = useState<'mainnet' | 'devnet'>('mainnet');
  const [pairs, setPairs] = useState<SolanaPairInput[]>([{ ...DEFAULT_PAIR }]);

  function generateKeypair() {
    const kp = Keypair.generate();
    setWalletPubkey(kp.publicKey.toBase58());
    setWalletPrivateKey(bs58.encode(kp.secretKey));
  }

  function updatePair(idx: number, field: keyof SolanaPairInput, value: string) {
    setPairs(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      venue: 'solana',
      username: walletPubkey, // dashboard uses pubkey as the "username" for solana instances
      privateKey: walletPrivateKey,
      mode,
      network,
      config: {
        tradeIntervalMS: 30000,
        strategy: 'swapper',
        wallet: { publicKey: walletPubkey, privateKey: walletPrivateKey },
        rpc: { endpoints: [rpc] },
        jupiter: {
          apiBase: 'https://lite-api.jup.ag/swap/v1',
          tokenListUrl: 'https://lite-api.jup.ag/tokens/v1/strict',
        },
        swapper: {
          pairs: pairs.map(p => ({
            symbol: p.symbol, base: p.base, quote: p.quote,
            quoteAmountPerSwap: Number(p.quoteAmountPerSwap),
            quoteMaxHold: Number(p.quoteMaxHold),
            quoteMinHold: Number(p.quoteMinHold),
            quoteBuyMaxThreshold: Number(p.quoteBuyMaxThreshold),
            quoteSellMinThreshold: Number(p.quoteSellMinThreshold),
            slippageBps: Number(p.slippageBps),
          })),
        },
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Instance name</label>
        <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded px-2 py-1" />
      </div>

      <div className="border rounded p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">Wallet</span>
          <button type="button" onClick={generateKeypair} className="text-sm text-blue-600">Generate new keypair</button>
        </div>
        <div>
          <label className="block text-sm">Public key</label>
          <input value={walletPubkey} onChange={e => setWalletPubkey(e.target.value)} required className="w-full font-mono text-xs border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm">Secret key (base58)</label>
          <input type="password" value={walletPrivateKey} onChange={e => setWalletPrivateKey(e.target.value)} required={mode === 'live'} className="w-full font-mono text-xs border rounded px-2 py-1" />
          <p className="text-xs text-gray-500">Stored in this instance's config file. Do not share.</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">RPC endpoint</label>
        <input value={rpc} onChange={e => setRpc(e.target.value)} className="w-full border rounded px-2 py-1" />
        <p className="text-xs text-gray-500">Recommended: Helius / Triton / QuickNode for production. Public endpoint shown is rate-limited.</p>
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium">Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="paper">Paper</option>
            <option value="live">Live</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Network</label>
          <select value={network} onChange={e => setNetwork(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="mainnet">Mainnet</option>
            <option value="devnet">Devnet</option>
          </select>
        </div>
      </div>

      <div className="border rounded p-3 space-y-2">
        <span className="font-medium">Swapper pairs</span>
        {pairs.map((p, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-2 border-t pt-2">
            <div><label className="block text-xs">Symbol</label><input value={p.symbol} onChange={e => updatePair(idx, 'symbol', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-xs">Slippage (bps)</label><input value={p.slippageBps} onChange={e => updatePair(idx, 'slippageBps', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-xs">Quote per swap</label><input value={p.quoteAmountPerSwap} onChange={e => updatePair(idx, 'quoteAmountPerSwap', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-xs">Quote min hold</label><input value={p.quoteMinHold} onChange={e => updatePair(idx, 'quoteMinHold', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-xs">Quote max hold</label><input value={p.quoteMaxHold} onChange={e => updatePair(idx, 'quoteMaxHold', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
            <div></div>
            <div><label className="block text-xs">Buy if price ≤</label><input value={p.quoteBuyMaxThreshold} onChange={e => updatePair(idx, 'quoteBuyMaxThreshold', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
            <div><label className="block text-xs">Sell if price ≥</label><input value={p.quoteSellMinThreshold} onChange={e => updatePair(idx, 'quoteSellMinThreshold', e.target.value)} className="w-full border rounded px-2 py-1" /></div>
          </div>
        ))}
        <button type="button" onClick={() => setPairs(p => [...p, { ...DEFAULT_PAIR }])} className="text-sm text-blue-600">+ Add pair</button>
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create instance</button>
    </form>
  );
}
```

- [ ] **Step 4: Wire up + manual verify**

Start the dashboard:
```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
npm run dev
```
Navigate to the new instance form. Switch to Solana. Click "Generate new keypair." Submit. Verify an instance appears in the list (likely in errored state until `dex-bot-solana` is installed and `DEX_BOT_SOLANA_PATH` is set).

- [ ] **Step 5: Commit**

```bash
git add src/components/instance-create-form.tsx src/components/instance-create-solana-form.tsx
git commit -m "feat(ui): venue picker + Solana instance creation form"
```

---

## Phase D — UI: trades view + export dialog

### Task D1: Add Chain + DEX columns and filters to trades table

**Files:**
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/trades-table.tsx` (find via grep)

- [ ] **Step 1: Find the existing trades table**

```bash
grep -rln "tradesService\|/api/trades\|TradesTable" /Users/tayler/Developer/Protonext/dex-dashboard/src/components/
```
Expected: a file rendering the trades view.

- [ ] **Step 2: Add Chain + DEX columns and filter chips**

In the trades table component, add these columns to the column definition:

```tsx
{ key: 'venue', label: 'Chain', render: (t) => (
  <span className={`px-2 py-0.5 rounded text-xs ${
    t.venue === 'solana' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
  }`}>
    {t.venue}
  </span>
)},
{ key: 'dex', label: 'DEX', render: (t) => t.dex ?? '—' },
{ key: 'txId', label: 'Tx', render: (t) => t.txId
    ? <a href={t.venue === 'solana' ? `https://solscan.io/tx/${t.txId}` : `https://explorer.xprnetwork.org/tx/${t.txId}`}
         target="_blank" className="text-blue-600 text-xs">view</a>
    : '—'
},
```

Add filter chips above the table:

```tsx
const [venueFilter, setVenueFilter] = useState<'all' | 'proton' | 'solana'>('all');
const [dexFilter, setDexFilter] = useState<string>('all');
const dexes = useMemo(() => Array.from(new Set(trades.map(t => t.dex).filter(Boolean))), [trades]);

return (
  <div>
    <div className="flex gap-2 mb-3">
      {['all', 'proton', 'solana'].map(v => (
        <button key={v} onClick={() => setVenueFilter(v as any)}
          className={`px-2 py-1 text-xs rounded ${venueFilter === v ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
          {v}
        </button>
      ))}
      {dexes.length > 0 && (
        <select value={dexFilter} onChange={e => setDexFilter(e.target.value)} className="text-xs border rounded px-2">
          <option value="all">All DEXes</option>
          {dexes.map(d => <option key={d} value={d as string}>{d}</option>)}
        </select>
      )}
    </div>
    {/* existing table */}
  </div>
);
```

Filter the displayed trades:

```tsx
const visibleTrades = trades.filter(t =>
  (venueFilter === 'all' || t.venue === venueFilter) &&
  (dexFilter === 'all' || t.dex === dexFilter)
);
```

- [ ] **Step 3: Manual verify**

Open the trades view; with a Solana instance running and producing trades, see the chain badge and DEX column populated. Filter by `solana` to confirm the filter works.

- [ ] **Step 4-5: Commit**

```bash
git add src/components/trades-table.tsx
git commit -m "feat(ui): chain badge + DEX column + venue/DEX filters in trades view"
```

---

### Task D2: Export-options dialog

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/trades-export-dialog.tsx`
- Modify: `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/trades-table.tsx` (add Export button that opens the dialog)
- Test: `/Users/tayler/Developer/Protonext/dex-dashboard/test/components/trades-export-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/test/components/trades-export-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import TradesExportDialog from '@/components/trades-export-dialog';

describe('TradesExportDialog', () => {
  let openMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    openMock = vi.fn();
    vi.stubGlobal('open', openMock);
  });

  it('builds the correct export URL when user picks format and venue filter', () => {
    render(<TradesExportDialog isOpen={true} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'cointracker' } });
    fireEvent.change(screen.getByLabelText('Chain'), { target: { value: 'solana' } });
    fireEvent.click(screen.getByText('Download'));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/trades\/export\?format=cointracker.*venue=solana/),
      expect.any(String),
    );
  });
});
```

(If `@testing-library/react` is not installed, install it: `npm install -D @testing-library/react @testing-library/dom jsdom`. Update `vitest.config.ts` to use `environment: 'jsdom'` for component tests.)

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/components/trades-export-dialog.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dialog**

Create `/Users/tayler/Developer/Protonext/dex-dashboard/src/components/trades-export-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultInstanceId?: string;
}

const FORMATS = [
  { value: 'cointracker', label: 'CoinTracker (CSV)' },
  { value: 'koinly', label: 'Koinly (CSV)' },
  { value: 'cointracking', label: 'CoinTracking.info (CSV)' },
  { value: 'csv', label: 'Raw CSV' },
  { value: 'json', label: 'JSON' },
];

export default function TradesExportDialog({ isOpen, onClose, defaultInstanceId }: Props) {
  const [format, setFormat] = useState('cointracker');
  const [venue, setVenue] = useState<'all' | 'proton' | 'solana'>('all');
  const [dex, setDex] = useState('');
  const [instanceId, setInstanceId] = useState(defaultInstanceId ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isOpen) return null;

  function handleDownload() {
    const params = new URLSearchParams();
    params.set('format', format);
    if (venue !== 'all') params.set('venue', venue);
    if (dex.trim()) params.set('dex', dex.trim());
    if (instanceId.trim()) params.set('instanceId', instanceId.trim());
    if (startDate) params.set('startTime', new Date(startDate).toISOString());
    if (endDate) params.set('endTime', new Date(endDate + 'T23:59:59').toISOString());
    window.open(`/api/trades/export?${params}`, '_blank');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Export Trades</h2>

        <div>
          <label className="block text-sm font-medium" htmlFor="export-format">Format</label>
          <select id="export-format" aria-label="Format" value={format} onChange={e => setFormat(e.target.value)} className="w-full border rounded px-2 py-1">
            {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="export-chain">Chain</label>
            <select id="export-chain" aria-label="Chain" value={venue} onChange={e => setVenue(e.target.value as any)} className="w-full border rounded px-2 py-1">
              <option value="all">All</option>
              <option value="proton">Proton</option>
              <option value="solana">Solana</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">DEX (optional)</label>
            <input value={dex} onChange={e => setDex(e.target.value)} placeholder="e.g. Raydium" className="w-full border rounded px-2 py-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Instance ID (optional)</label>
          <input value={instanceId} onChange={e => setInstanceId(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm font-medium">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 border rounded">Cancel</button>
          <button onClick={handleDownload} className="bg-blue-600 text-white px-3 py-1.5 rounded">Download</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire Export button into trades-table.tsx**

In the trades table component, add:

```tsx
import TradesExportDialog from './trades-export-dialog';
const [showExport, setShowExport] = useState(false);

// in JSX, near the filter chips:
<button onClick={() => setShowExport(true)} className="px-3 py-1 text-xs bg-green-600 text-white rounded">
  Export
</button>
<TradesExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />
```

- [ ] **Step 5: Run test, manual verify, commit**

```bash
npx vitest run test/components/trades-export-dialog.test.tsx
```
Expected: PASS.

Manual: open the trades view, click Export, pick CoinTracker format and Solana chain, click Download. Verify a CSV download starts with the right contents.

```bash
git add src/components/trades-export-dialog.tsx src/components/trades-table.tsx test/components/trades-export-dialog.test.tsx
git commit -m "feat(ui): trades export dialog with format + chain/DEX/date filters"
```

---

## Phase E — UI: instances list + holdings

### Task E1: Chain badge on instances list

**Files:**
- Modify: existing instances list component (find via grep)

- [ ] **Step 1: Locate the component**

```bash
grep -rln "InstanceList\|instance.status\|/api/instances" /Users/tayler/Developer/Protonext/dex-dashboard/src/components/
```

- [ ] **Step 2: Add chain badge column**

Add a column that renders the venue:

```tsx
{ key: 'venue', label: 'Chain', render: (i) => (
  <span className={`px-2 py-0.5 rounded text-xs ${
    i.venue === 'solana' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
  }`}>
    {i.venue ?? 'proton'}
  </span>
)},
```

(`?? 'proton'` for backward compat with existing instances that don't yet have the field.)

- [ ] **Step 3: Manual verify** — instances list shows the chain badge. Existing Proton instances show "proton" via the fallback.

- [ ] **Step 4-5: Commit**

```bash
git add src/components/<instances-list-file>
git commit -m "feat(ui): chain badge column on instances list"
```

---

### Task E2: Format SPL balances correctly in holdings view

**Files:**
- Modify: existing holdings table component (find via grep)

- [ ] **Step 1: Locate the component**

```bash
grep -rln "Holdings\|baseBalance\|quoteBalance" /Users/tayler/Developer/Protonext/dex-dashboard/src/components/
```

- [ ] **Step 2: Format balances by token decimals**

In the holdings table component, replace the existing balance render with a helper that uses standard decimals:

```tsx
function formatBalance(amount: string | number, token: string): string {
  const n = Number(amount);
  // Sensible defaults; SPL tokens vary but these cover the common ones
  const decimals: Record<string, number> = {
    SOL: 4, USDC: 2, USDT: 2, BTC: 6, ETH: 4, XPR: 2, XMD: 2,
  };
  const d = decimals[token] ?? 6;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d });
}

// In the cell render:
<td>{formatBalance(holding.baseBalance, holding.baseToken)} {holding.baseToken}</td>
<td>{formatBalance(holding.quoteBalance, holding.quoteToken)} {holding.quoteToken}</td>
```

- [ ] **Step 3: Manual verify** — open holdings view; SPL balances render with appropriate decimals.

- [ ] **Step 4-5: Commit**

```bash
git add src/components/<holdings-table-file>
git commit -m "feat(ui): format SPL/Proton balances by token-typical decimals"
```

---

## Phase F — Manual verification

### Task F1: End-to-end multi-chain smoke test

This requires Plans 1, 2, and 3 to all be complete.

- [ ] **Step 1: Set environment variables**

```bash
export DEX_BOT_PATH=/Users/tayler/Developer/Protonext/dex-bot
export DEX_BOT_SOLANA_PATH=/Users/tayler/Developer/Protonext/dex-bot-solana
```

- [ ] **Step 2: Start dashboard**

```bash
cd /Users/tayler/Developer/Protonext/dex-dashboard
npm run dev
```

- [ ] **Step 3: Create a Solana instance via UI in paper mode**

Navigate to instances → New → pick Solana → fill form (generate keypair, accept defaults) → submit. Verify it appears in the instances list with a purple "solana" badge.

- [ ] **Step 4: Start the instance**

Click Start. Watch logs (`npm run logs:pm2` or via PM2 directly). Confirm the bot boots, loads tokens, fetches a price, "executes" paper swaps.

- [ ] **Step 5: Verify multi-chain UI works**

- Trades view: shows both Proton and Solana trades (if any Proton trades present); filter chips work.
- Holdings view: Solana SPL balances render with correct decimals.
- Export dialog: pick CoinTracker, Solana, download — open in CoinTracker (or check column shape via spreadsheet).

If everything works, the multi-chain dashboard is complete.

---

## Self-Review Checklist

**Spec coverage:**
- §5.2 (event/state/trades wire protocols unchanged) — preserved; no changes to events route or state-file format ✓
- §8.1 (schema discriminated union) — Task A1 ✓
- §8.2 (PM2 venue branching) — Task B1 ✓
- §8.2 (holdings-service Solana balance fetcher) — Tasks B2-B4 ✓
- §8.2 (dex-api Solana branch) — see Out of Scope: deferred since holdings cron's optional `currentPrice` defaults to 0 in v1
- §8.3 (UI: instance form, instances list, trades view, holdings view, export dialog) — Phases C, D, E ✓

**Placeholder scan:** No "TBD"/"TODO". One step requires `grep` first to locate existing component/file paths (the dashboard's component file naming wasn't fully discoverable from the spec); each such step provides the grep command to find the right file.

**Type consistency:**
- `Venue` type defined in `instance.ts`, used in `pm2-service`, `holdings-service`, components ✓
- `BotInstanceConfigSchema` discriminated union accepts both shapes ✓
- `recordSolanaSnapshot` input fields match what cron will pass ✓

**Scope:** UI + service venue branching only. No new strategies. No CLMM. No Plans 1 or 2 work.

---

## Out of scope for Plan 3

- Live Solana price fetching in the dashboard (`getSolanaPrice`) — `currentPrice` in holdings snapshots can default to 0 for v1; price fetching can be added incrementally
- Hardware-key wallet UI (paste-or-generate is good enough for v1)
- Strategy editor UI for Solana instances beyond swapper (each new strategy will get its own UI in its plan)
- Real-time chain badge color customization (uses simple bg-purple/bg-blue for v1)

## Dependencies

- Plan 1 (trades schema, `POST /api/trades`, `GET /api/trades/export`) must be complete — Task D2 (export dialog) hits the endpoint
- Plan 2 (`dex-bot-solana` repo) must be complete — Task F1 (smoke test) actually starts a Solana instance
- Plan 3's Phase A (schema) can start in parallel with Plan 1's Phase A (Plan 1 doesn't touch instance.ts)
- Plan 3's Phases C-E (UI) can start once Plan 3's Phases A and B (schema + services) land
