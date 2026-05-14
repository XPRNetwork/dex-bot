# Plan 2: dex-bot-solana + Swapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new `dex-bot-solana` repo (sibling to `dex-bot/` and `dex-dashboard/`), implement Solana primitives (RPC connection, wallet, Jupiter quote+swap client, token registry, balance fetcher), the swapper strategy with threshold-driven swap logic, a paper-mode mock engine, and a main loop that pushes events and trades to the existing dashboard via Plan 1's `POST /api/trades` endpoint.

**Architecture:** Mirror `dex-bot/`'s structure. Solana primitives in `src/solana/`. `SolanaTradingStrategyBase` provides `swap()` with paper/live branching and the same state-file/command-queue helpers as `dex-bot`'s base. Jupiter client wraps the public Quote+Swap APIs and parses `routePlan[]` into `primaryDex`. Token registry resolves user-friendly symbols (`SOL/USDC`) via Jupiter's verified token list, honoring per-pair mint overrides for memecoins.

**Tech Stack:** TypeScript, `@solana/web3.js`, `@solana/spl-token`, `bs58`, `node-fetch`, `vitest`, `bignumber.js`, `winston`, `config` (node-config — same as dex-bot).

**Source spec:** `/Users/tayler/Developer/Protonext/dex-bot/docs/superpowers/specs/2026-05-14-dex-bot-solana-design.md` (sections 5, 6, 7, 11, 12).

**Depends on:** Plan 1 (uses `POST /api/trades` for trade emission).

**Repo location:** `/Users/tayler/Developer/Protonext/dex-bot-solana/` (NEW — sibling folder).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `package.json` | Create | Dependencies, scripts (`bot`, `bot:test`, `test`, `lint`) |
| `tsconfig.json` | Create | TS config matching dex-bot's |
| `vitest.config.ts` | Create | Test runner config |
| `.gitignore` | Create | Standard Node ignores |
| `README.md` | Create | One-page intro: install, configure, run, supported strategies |
| `config/default.json` | Create | Example config: empty wallet, public RPC, swapper SOL/USDC pair |
| `config/test.json` | Create | Devnet config for `npm run bot:test` |
| `src/utils.ts` | Create | `getConfig()`, `getLogger()`, `getWalletPubkey()` |
| `src/core/constants.ts` | Create | `ORDERSIDES = { BUY: 1, SELL: 2 }` (matches dex-bot) |
| `src/interfaces/index.ts` | Create | `TradingStrategy`, `TradingStrategyConstructor`, `SwapResult` |
| `src/events.ts` | Create | Event emitter (verbatim from dex-bot/src/events.ts) |
| `src/trades.ts` | Create | Trade emitter (from dex-bot/src/trades.ts after Plan 1) |
| `src/health-monitor.ts` | Create | Health tracker for RPC + Jupiter (adapted from dex-bot) |
| `src/solana/connection.ts` | Create | `Connection` with RPC fallback + health hooks |
| `src/solana/wallet.ts` | Create | `loadKeypair(secretKeyBase58)` + signing helper |
| `src/solana/jupiter.ts` | Create | `JupiterClient`: `quote()`, `buildSwapTx()`, parses `routePlan` |
| `src/solana/token-registry.ts` | Create | Symbol → mint lookup via Jupiter verified token list + overrides |
| `src/solana/balances.ts` | Create | `getBalances(pubkey, mints)` returning native SOL + SPL balances |
| `src/strategies/base.ts` | Create | `SolanaTradingStrategyBase`: `swap()`, `getPrice()`, state-file helpers, command-queue |
| `src/strategies/command-queue.ts` | Create | `readPending`, `appendResult` (verbatim from dex-bot) |
| `src/strategies/swapper.ts` | Create | `SwapperStrategy` — threshold-driven buy/sell loop |
| `src/strategies/index.ts` | Create | `getStrategy(name)` factory (only `swapper` for v1) |
| `src/mock-engine.ts` | Create | Paper mode: simulated swaps + virtual SPL balances |
| `src/index.ts` | Create | Main loop: init, trade cycle, graceful shutdown |
| `test/utils.test.ts` | Create | Config + logger helpers |
| `test/solana/connection.test.ts` | Create | RPC fallback rotation on transient failure |
| `test/solana/wallet.test.ts` | Create | Keypair loading + signing |
| `test/solana/jupiter.test.ts` | Create | Quote parsing, route-plan → primaryDex extraction, swap-tx signing |
| `test/solana/token-registry.test.ts` | Create | Symbol resolution + per-pair overrides |
| `test/solana/balances.test.ts` | Create | SPL + native SOL balance shape |
| `test/strategies/swapper.test.ts` | Create | Table-driven decision logic: (price, balances, config) → action |
| `test/mock-engine.test.ts` | Create | Simulated swaps update virtual balances correctly |
| `test/integration/swapper-paper.test.ts` | Create | End-to-end paper-mode loop driven by injected mock prices |

---

## Phase A — Repo scaffolding

### Task A1: Create the new repo directory and Git init

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/` (directory)

- [ ] **Step 1: Create the directory and initialize git**

```bash
mkdir -p /Users/tayler/Developer/Protonext/dex-bot-solana
cd /Users/tayler/Developer/Protonext/dex-bot-solana
git init
git checkout -b main
```
Expected: empty `dex-bot-solana/` directory with a `.git/` subdirectory.

- [ ] **Step 2: Create .gitignore**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/.gitignore`:

```
node_modules/
dist/
*.log
.DS_Store
.env
.env.local
config/local.json
config/local-*.json
data/
*.tmp
.vscode/
.idea/
```

- [ ] **Step 3: Initial commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
git add .gitignore
git commit -m "chore: initial commit"
```

- [ ] **Step 4-5 (none for this task)**

---

### Task A2: package.json + tsconfig + vitest config

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/package.json`
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/tsconfig.json`
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "dex-bot-solana",
  "version": "0.1.0",
  "description": "Solana trading bot using Jupiter aggregator, paired with the existing dex-dashboard",
  "main": "src/index.ts",
  "type": "module",
  "scripts": {
    "bot": "tsc --noEmit && node --no-warnings=ExperimentalWarning --loader ts-node/esm ./src/index.ts",
    "bot:test": "cross-env NODE_ENV=test npm run bot",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src test --ext .ts",
    "lint:fix": "eslint src test --fix --ext .ts"
  },
  "keywords": ["solana", "raydium", "jupiter", "dex", "trading", "bot"],
  "license": "MIT",
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "bignumber.js": "^9.1.1",
    "bs58": "^6.0.0",
    "config": "^3.3.8",
    "node-fetch": "^3.3.0",
    "winston": "^3.8.2"
  },
  "devDependencies": {
    "@types/config": "^3.3.0",
    "@types/node": "^20",
    "cross-env": "^7.0.3",
    "eslint": "^8.32.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.4.0",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": true,
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**'], // run integration tests separately
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Install deps and confirm**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
npm install
npx tsc --noEmit
```
Expected: install completes; `tsc` reports no errors (no source files yet, but config valid).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold package.json, tsconfig, vitest"
```

---

### Task A3: Example config files

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/config/default.json`
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/config/test.json`

- [ ] **Step 1: Create default.json**

```json
{
  "tradeIntervalMS": 30000,
  "slackIntervalMS": 300000,
  "cancelOpenOrdersOnExit": false,
  "strategy": "swapper",
  "mode": "live",
  "swapper": {
    "pairs": [
      {
        "symbol": "SOL/USDC",
        "base": "SOL",
        "quote": "USDC",
        "quoteAmountPerSwap": 25,
        "quoteMaxHold": 500,
        "quoteMinHold": 25,
        "quoteBuyMaxThreshold": 150,
        "quoteSellMinThreshold": 200,
        "slippageBps": 50
      }
    ]
  },
  "wallet": {
    "publicKey": "",
    "privateKey": ""
  },
  "rpc": {
    "endpoints": [
      "https://api.mainnet-beta.solana.com"
    ]
  },
  "jupiter": {
    "apiBase": "https://lite-api.jup.ag/swap/v1",
    "tokenListUrl": "https://lite-api.jup.ag/tokens/v1/strict"
  },
  "dashboard": {
    "url": "",
    "apiKey": "",
    "instanceId": "",
    "enabled": false
  }
}
```

- [ ] **Step 2: Create test.json (devnet)**

```json
{
  "tradeIntervalMS": 60000,
  "rpc": {
    "endpoints": [
      "https://api.devnet.solana.com"
    ]
  },
  "swapper": {
    "pairs": [
      {
        "symbol": "SOL/USDC",
        "base": "SOL",
        "quote": "USDC",
        "quoteAmountPerSwap": 1,
        "quoteMaxHold": 10,
        "quoteMinHold": 1,
        "quoteBuyMaxThreshold": 1000,
        "quoteSellMinThreshold": 0.01,
        "slippageBps": 100
      }
    ]
  }
}
```

- [ ] **Step 3-5: Commit**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
git add config/
git commit -m "chore: example default + devnet config"
```

---

## Phase B — Shared infrastructure

### Task B1: utils.ts (config + logger)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/utils.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getConfig, getLogger, getWalletPubkey } from '@/utils';

describe('utils', () => {
  it('getConfig returns the loaded config object', () => {
    const cfg = getConfig();
    expect(cfg).toHaveProperty('strategy');
    expect(cfg.strategy).toBe('swapper');
  });

  it('getLogger returns a winston logger with info method', () => {
    const log = getLogger();
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('getWalletPubkey returns the configured public key (or empty string)', () => {
    expect(typeof getWalletPubkey()).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
npx vitest run test/utils.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement utils.ts**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/utils.ts`:

```ts
import config from 'config';
import winston from 'winston';

let _logger: winston.Logger | null = null;

export function getConfig(): any {
  return config.util.toObject();
}

export function getLogger(): winston.Logger {
  if (_logger) return _logger;
  _logger = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) =>
        `${timestamp} [${level}] ${message}`,
      ),
    ),
    transports: [new winston.transports.Console()],
  });
  return _logger;
}

export function getWalletPubkey(): string {
  return getConfig().wallet?.publicKey ?? '';
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/utils.test.ts
```
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils.ts test/utils.test.ts
git commit -m "feat(utils): config loader, winston logger, wallet pubkey helper"
```

---

### Task B2: core/constants.ts and interfaces

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/core/constants.ts`
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/interfaces/index.ts`

- [ ] **Step 1: Write the constants file**

```ts
// /Users/tayler/Developer/Protonext/dex-bot-solana/src/core/constants.ts
export const ORDERSIDES = { BUY: 1, SELL: 2 } as const;
export type OrderSide = typeof ORDERSIDES[keyof typeof ORDERSIDES];
```

- [ ] **Step 2: Write the interfaces file**

```ts
// /Users/tayler/Developer/Protonext/dex-bot-solana/src/interfaces/index.ts
export interface TradingStrategy {
  initialize(options?: any): Promise<void>;
  trade(): Promise<void>;
  cancelOwnOrders(): Promise<void>;
}

export interface TradingStrategyConstructor {
  new (): TradingStrategy;
}

export interface SwapResult {
  txSignature: string;
  inputMint: string;
  inputAmount: number;
  outputMint: string;
  outputAmount: number;
  primaryDex: string;
  routePlan: Array<{ dex: string; inputMint: string; outputMint: string; inputAmount: number; outputAmount: number }>;
  feeLamports: number;
  usdValue?: number;
}
```

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: (no test — pure type/value declarations)**

Skip.

- [ ] **Step 5: Commit**

```bash
git add src/core/constants.ts src/interfaces/index.ts
git commit -m "feat: ORDERSIDES constants and TradingStrategy interfaces"
```

---

### Task B3: events.ts (verbatim from dex-bot)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/events.ts`

- [ ] **Step 1: Copy events.ts content from dex-bot**

Read the source:
```bash
cat /Users/tayler/Developer/Protonext/dex-bot/src/events.ts
```

- [ ] **Step 2: Create the file**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/events.ts` with the entire contents of `/Users/tayler/Developer/Protonext/dex-bot/src/events.ts` (copy verbatim — the wire protocol is identical and the only import (`./utils`) resolves to dex-bot-solana's own utils).

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: (no test — events.ts is HTTP-side-effect heavy and tested in dex-bot already; integration tests will exercise it)**

Skip.

- [ ] **Step 5: Commit**

```bash
git add src/events.ts
git commit -m "feat(events): copy dashboard event emitter from dex-bot"
```

---

### Task B4: trades.ts (from dex-bot, post-Plan-1)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/trades.ts`

- [ ] **Step 1: Verify Plan 1's trades.ts exists in dex-bot**

```bash
ls /Users/tayler/Developer/Protonext/dex-bot/src/trades.ts && echo "OK"
```
Expected: file exists, prints "OK". If not, Plan 1 hasn't completed Task E1 yet — pause here until it has.

- [ ] **Step 2: Copy verbatim**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/trades.ts` with the entire contents of `/Users/tayler/Developer/Protonext/dex-bot/src/trades.ts`. Same import paths (`./utils`), same `Venue` type with both `'proton'` and `'solana'`.

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: (no test — same reasoning as events; dex-bot's tests cover behavior)**

Skip.

- [ ] **Step 5: Commit**

```bash
git add src/trades.ts
git commit -m "feat(trades): copy trade emitter from dex-bot (post-plan-1)"
```

---

### Task B5: health-monitor.ts (adapted)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/health-monitor.ts`

- [ ] **Step 1: Read dex-bot's health-monitor for reference**

```bash
cat /Users/tayler/Developer/Protonext/dex-bot/src/health-monitor.ts
```

- [ ] **Step 2: Create adapted version**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/health-monitor.ts`. Adapt the dex-bot file by changing the `EndpointCategory` type from `'rpc' | 'dexApi' | 'lightApi'` to `'rpc' | 'jupiter'` (Solana has only two external dependencies — Solana RPC and Jupiter HTTP). Keep all other logic (rolling success/error counts, restart-trigger thresholds, `recordSuccess`, `recordError`) identical.

If you don't have access to dex-bot's source, use this as the implementation:

```ts
import { getLogger } from './utils';

const logger = getLogger();

export type EndpointCategory = 'rpc' | 'jupiter';

interface HealthStats {
  successCount: number;
  errorCount: number;
  lastErrorAt: number | null;
  consecutiveErrors: number;
}

class HealthMonitor {
  private stats: Record<EndpointCategory, HealthStats> = {
    rpc: this.fresh(),
    jupiter: this.fresh(),
  };
  private restartRequested = false;
  private cancelOnRestart = false;

  private fresh(): HealthStats {
    return { successCount: 0, errorCount: 0, lastErrorAt: null, consecutiveErrors: 0 };
  }

  initialize(): void {
    // Reset stats on init
    this.stats = { rpc: this.fresh(), jupiter: this.fresh() };
    this.restartRequested = false;
  }

  recordSuccess(category: EndpointCategory): void {
    const s = this.stats[category];
    s.successCount++;
    s.consecutiveErrors = 0;
  }

  recordError(category: EndpointCategory, msg: string): void {
    const s = this.stats[category];
    s.errorCount++;
    s.consecutiveErrors++;
    s.lastErrorAt = Date.now();
    logger.warn(`[health:${category}] consecutive errors: ${s.consecutiveErrors}: ${msg}`);
    if (s.consecutiveErrors >= 10) {
      logger.error(`[health:${category}] threshold exceeded, requesting restart`);
      this.restartRequested = true;
      this.cancelOnRestart = true;
    }
  }

  isRestartRequested(): boolean {
    return this.restartRequested;
  }

  shouldCancelOrdersOnRestart(): boolean {
    return this.cancelOnRestart;
  }
}

export const healthMonitor = new HealthMonitor();
```

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: (no test — exercised via integration)**

Skip.

- [ ] **Step 5: Commit**

```bash
git add src/health-monitor.ts
git commit -m "feat(health): RPC + Jupiter health monitor with restart trigger"
```

---

## Phase C — Solana primitives

### Task C1: Connection with RPC fallback

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/connection.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/connection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/connection.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils', () => ({
  getConfig: () => ({
    rpc: { endpoints: ['https://primary.test', 'https://fallback.test'] },
  }),
  getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

vi.mock('@solana/web3.js', () => {
  let calls = 0;
  return {
    Connection: vi.fn().mockImplementation((url: string) => ({
      url,
      getSlot: vi.fn(async () => {
        calls++;
        // First call (primary endpoint) fails, second (fallback) succeeds
        if (url.includes('primary')) throw new Error('primary down');
        return 12345;
      }),
    })),
    _calls: () => calls,
  };
});

describe('SolanaConnectionManager', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('@/solana/connection')];
  });

  it('rotates to fallback endpoint when primary fails', async () => {
    const { getActiveConnection, withRetry } = await import('@/solana/connection');
    const result = await withRetry(c => c.getSlot());
    expect(result).toBe(12345);
    expect(getActiveConnection().url).toContain('fallback');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
npx vitest run test/solana/connection.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the connection manager**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/connection.ts`:

```ts
import { Connection } from '@solana/web3.js';
import { getConfig, getLogger } from '../utils';
import { healthMonitor } from '../health-monitor';

const logger = getLogger();

const endpoints: string[] = getConfig().rpc?.endpoints ?? ['https://api.mainnet-beta.solana.com'];
let activeIndex = 0;
let connection = new Connection(endpoints[activeIndex], { commitment: 'confirmed' });

export function getActiveConnection(): Connection {
  return connection;
}

function rotateConnection(): void {
  activeIndex = (activeIndex + 1) % endpoints.length;
  connection = new Connection(endpoints[activeIndex], { commitment: 'confirmed' });
  logger.warn(`[rpc] rotated to endpoint ${activeIndex}: ${endpoints[activeIndex]}`);
}

/**
 * Run an operation against the active connection with retry+rotation on failure.
 * Tries up to (endpoints.length × maxAttemptsPerEndpoint) times.
 */
export async function withRetry<T>(
  op: (c: Connection) => Promise<T>,
  maxAttemptsPerEndpoint = 2,
): Promise<T> {
  let lastErr: unknown = null;
  const totalAttempts = endpoints.length * maxAttemptsPerEndpoint;
  for (let i = 0; i < totalAttempts; i++) {
    try {
      const result = await op(connection);
      healthMonitor.recordSuccess('rpc');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErr = err;
      healthMonitor.recordError('rpc', msg);
      if (i % maxAttemptsPerEndpoint === maxAttemptsPerEndpoint - 1) {
        rotateConnection();
      }
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/solana/connection.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/solana/connection.ts test/solana/connection.test.ts
git commit -m "feat(solana): RPC connection with fallback rotation + health hooks"
```

---

### Task C2: Wallet (Keypair from base58)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/wallet.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/wallet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/wallet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadKeypair, signTransaction } from '@/solana/wallet';
import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

describe('wallet', () => {
  it('loadKeypair decodes base58 secret key into a Keypair with matching public key', () => {
    const generated = Keypair.generate();
    const secretBase58 = bs58.encode(generated.secretKey);
    const loaded = loadKeypair(secretBase58);
    expect(loaded.publicKey.toBase58()).toBe(generated.publicKey.toBase58());
  });

  it('throws on invalid base58', () => {
    expect(() => loadKeypair('not-base58-!!!')).toThrow();
  });

  it('signTransaction signs a transaction with the keypair', () => {
    const kp = Keypair.generate();
    const recipient = Keypair.generate().publicKey;
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: recipient, lamports: 1 }),
    );
    tx.recentBlockhash = '11111111111111111111111111111111';
    tx.feePayer = kp.publicKey;
    const signed = signTransaction(tx, kp);
    expect(signed.signatures.length).toBeGreaterThan(0);
    expect(signed.signatures[0].publicKey.equals(kp.publicKey)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/solana/wallet.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement wallet.ts**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/wallet.ts`:

```ts
import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

export function loadKeypair(secretKeyBase58: string): Keypair {
  const decoded = bs58.decode(secretKeyBase58);
  if (decoded.length !== 64) {
    throw new Error(`Invalid secret key length: expected 64, got ${decoded.length}`);
  }
  return Keypair.fromSecretKey(decoded);
}

export function signTransaction(tx: Transaction, kp: Keypair): Transaction {
  tx.partialSign(kp);
  return tx;
}

export function signVersionedTransaction(tx: VersionedTransaction, kp: Keypair): VersionedTransaction {
  tx.sign([kp]);
  return tx;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/solana/wallet.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/solana/wallet.ts test/solana/wallet.test.ts
git commit -m "feat(solana): wallet — load Keypair from base58, sign helpers"
```

---

### Task C3: Jupiter client (quote + swap + route parsing)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/jupiter.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/jupiter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/jupiter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils', () => ({
  getConfig: () => ({ jupiter: { apiBase: 'https://lite-api.jup.ag/swap/v1' } }),
  getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

describe('JupiterClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    delete require.cache[require.resolve('@/solana/jupiter')];
  });

  it('quote returns parsed response with primaryDex from largest hop', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        inputMint: 'IN', outputMint: 'OUT',
        inAmount: '100000000',  // 100 USDC (6 decimals)
        outAmount: '600000000', // 0.6 SOL (9 decimals)
        otherAmountThreshold: '590000000',
        slippageBps: 50,
        routePlan: [
          { swapInfo: { label: 'Raydium', inputMint: 'IN', outputMint: 'MID', inAmount: '60000000', outAmount: '300000000' }, percent: 60 },
          { swapInfo: { label: 'Orca',    inputMint: 'IN', outputMint: 'MID', inAmount: '40000000', outAmount: '200000000' }, percent: 40 },
          { swapInfo: { label: 'Meteora', inputMint: 'MID', outputMint: 'OUT', inAmount: '500000000', outAmount: '600000000' }, percent: 100 },
        ],
      }),
    });

    const { JupiterClient } = await import('@/solana/jupiter');
    const client = new JupiterClient();
    const q = await client.quote({ inputMint: 'IN', outputMint: 'OUT', amount: 100_000_000, slippageBps: 50 });

    expect(q.inAmount).toBe(100_000_000);
    expect(q.outAmount).toBe(600_000_000);
    expect(q.primaryDex).toBe('Raydium'); // largest by inAmount across all hops
    expect(q.routePlan).toHaveLength(3);
  });

  it('quote returns null route when no path found (404 or empty)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'no route found',
    });
    const { JupiterClient } = await import('@/solana/jupiter');
    const client = new JupiterClient();
    await expect(client.quote({ inputMint: 'IN', outputMint: 'OUT', amount: 100, slippageBps: 50 })).rejects.toThrow(/no route|404/i);
  });

  it('buildSwapTx posts the quote response and returns serialized tx bytes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ swapTransaction: Buffer.from('hello').toString('base64'), lastValidBlockHeight: 12345 }),
    });
    const { JupiterClient } = await import('@/solana/jupiter');
    const client = new JupiterClient();
    const result = await client.buildSwapTx({
      quoteResponse: { foo: 'bar' } as any,
      userPublicKey: 'PubKey1',
    });
    expect(result.swapTransaction).toBeInstanceOf(Buffer);
    expect(result.swapTransaction.toString('utf8')).toBe('hello');
    expect(result.lastValidBlockHeight).toBe(12345);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lite-api.jup.ag/swap/v1/swap',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/solana/jupiter.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement JupiterClient**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/jupiter.ts`:

```ts
import { getConfig, getLogger } from '../utils';
import { healthMonitor } from '../health-monitor';

const logger = getLogger();

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;        // in input token's smallest unit (lamports / atomic)
  slippageBps: number;
}

export interface RouteHop {
  dex: string;
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
  percent?: number;
}

export interface QuoteResponse {
  raw: any;              // full Jupiter response (preserved for trade.data blob)
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
  otherAmountThreshold: number;
  slippageBps: number;
  routePlan: RouteHop[];
  primaryDex: string;
}

export interface SwapBuildRequest {
  quoteResponse: any;
  userPublicKey: string;
  prioritizationFeeLamports?: number | 'auto';
  dynamicComputeUnitLimit?: boolean;
  asLegacyTransaction?: boolean;
}

export interface SwapBuildResponse {
  swapTransaction: Buffer;
  lastValidBlockHeight?: number;
}

export class JupiterClient {
  private apiBase: string;

  constructor(apiBase?: string) {
    this.apiBase = apiBase ?? getConfig().jupiter?.apiBase ?? 'https://lite-api.jup.ag/swap/v1';
  }

  async quote(req: QuoteRequest): Promise<QuoteResponse> {
    const url = `${this.apiBase}/quote?inputMint=${req.inputMint}&outputMint=${req.outputMint}&amount=${req.amount}&slippageBps=${req.slippageBps}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>');
      healthMonitor.recordError('jupiter', `quote ${res.status}: ${body}`);
      throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
    }
    healthMonitor.recordSuccess('jupiter');
    const raw = await res.json();
    const routePlan: RouteHop[] = (raw.routePlan ?? []).map((rp: any) => ({
      dex: rp.swapInfo?.label ?? 'Unknown',
      inputMint: rp.swapInfo?.inputMint,
      outputMint: rp.swapInfo?.outputMint,
      inAmount: Number(rp.swapInfo?.inAmount ?? 0),
      outAmount: Number(rp.swapInfo?.outAmount ?? 0),
      percent: rp.percent,
    }));
    const primaryDex = routePlan.length > 0
      ? [...routePlan].sort((a, b) => b.inAmount - a.inAmount)[0].dex
      : 'Unknown';
    return {
      raw,
      inputMint: raw.inputMint,
      outputMint: raw.outputMint,
      inAmount: Number(raw.inAmount),
      outAmount: Number(raw.outAmount),
      otherAmountThreshold: Number(raw.otherAmountThreshold ?? 0),
      slippageBps: Number(raw.slippageBps ?? req.slippageBps),
      routePlan,
      primaryDex,
    };
  }

  async buildSwapTx(req: SwapBuildRequest): Promise<SwapBuildResponse> {
    const url = `${this.apiBase}/swap`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: req.quoteResponse,
        userPublicKey: req.userPublicKey,
        prioritizationFeeLamports: req.prioritizationFeeLamports ?? 'auto',
        dynamicComputeUnitLimit: req.dynamicComputeUnitLimit ?? true,
        asLegacyTransaction: req.asLegacyTransaction ?? false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>');
      healthMonitor.recordError('jupiter', `swap ${res.status}: ${body}`);
      throw new Error(`Jupiter swap-build failed (${res.status}): ${body}`);
    }
    healthMonitor.recordSuccess('jupiter');
    const raw = await res.json();
    return {
      swapTransaction: Buffer.from(raw.swapTransaction, 'base64'),
      lastValidBlockHeight: raw.lastValidBlockHeight,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/solana/jupiter.test.ts
```
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add src/solana/jupiter.ts test/solana/jupiter.test.ts
git commit -m "feat(solana): JupiterClient — quote + buildSwapTx + primaryDex parser"
```

---

### Task C4: Token registry (symbol → mint)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/token-registry.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/token-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/token-registry.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/utils', () => ({
  getConfig: () => ({ jupiter: { tokenListUrl: 'https://lite-api.jup.ag/tokens/v1/strict' } }),
  getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

describe('TokenRegistry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', decimals: 9, name: 'Wrapped SOL' },
        { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
        { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', decimals: 6, name: 'Tether' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    delete require.cache[require.resolve('@/solana/token-registry')];
  });

  it('resolves a known symbol to its mint and decimals', async () => {
    const { TokenRegistry } = await import('@/solana/token-registry');
    const reg = new TokenRegistry();
    await reg.load();
    const sol = reg.resolve('SOL');
    expect(sol.mint).toBe('So11111111111111111111111111111111111111112');
    expect(sol.decimals).toBe(9);
  });

  it('honors per-pair mint override', async () => {
    const { TokenRegistry } = await import('@/solana/token-registry');
    const reg = new TokenRegistry();
    await reg.load();
    const memecoin = reg.resolve('FAKE', { mintOverride: 'CustomMint123', decimalsOverride: 6 });
    expect(memecoin.mint).toBe('CustomMint123');
    expect(memecoin.decimals).toBe(6);
  });

  it('throws clear error on unknown symbol with no override', async () => {
    const { TokenRegistry } = await import('@/solana/token-registry');
    const reg = new TokenRegistry();
    await reg.load();
    expect(() => reg.resolve('NOPE')).toThrow(/NOPE.*not found.*mintOverride/);
  });

  it('parsePair splits "SOL/USDC" into base + quote symbols', async () => {
    const { TokenRegistry } = await import('@/solana/token-registry');
    const reg = new TokenRegistry();
    await reg.load();
    expect(reg.parsePair('SOL/USDC')).toEqual({ base: 'SOL', quote: 'USDC' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/solana/token-registry.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement TokenRegistry**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/token-registry.ts`:

```ts
import { getConfig, getLogger } from '../utils';

const logger = getLogger();

export interface TokenInfo {
  mint: string;
  symbol: string;
  decimals: number;
  name?: string;
}

export interface ResolveOverride {
  mintOverride?: string;
  decimalsOverride?: number;
}

export class TokenRegistry {
  private bySymbol: Map<string, TokenInfo> = new Map();
  private loaded = false;

  async load(): Promise<void> {
    const url = getConfig().jupiter?.tokenListUrl ?? 'https://lite-api.jup.ag/tokens/v1/strict';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load Jupiter token list: ${res.status}`);
    }
    const tokens = (await res.json()) as Array<{ address: string; symbol: string; decimals: number; name?: string }>;
    for (const t of tokens) {
      // First-seen wins (verified list usually orders canonical first)
      if (!this.bySymbol.has(t.symbol.toUpperCase())) {
        this.bySymbol.set(t.symbol.toUpperCase(), {
          mint: t.address, symbol: t.symbol, decimals: t.decimals, name: t.name,
        });
      }
    }
    this.loaded = true;
    logger.info(`[tokens] loaded ${this.bySymbol.size} tokens from Jupiter`);
  }

  resolve(symbol: string, override?: ResolveOverride): TokenInfo {
    if (override?.mintOverride) {
      return {
        mint: override.mintOverride,
        symbol,
        decimals: override.decimalsOverride ?? 6,
      };
    }
    if (!this.loaded) throw new Error('TokenRegistry.resolve called before load()');
    const info = this.bySymbol.get(symbol.toUpperCase());
    if (!info) {
      throw new Error(
        `Token '${symbol}' not found in Jupiter verified list. ` +
        `Provide a mintOverride in the pair config to use this token.`,
      );
    }
    return info;
  }

  /** Parses "BASE/QUOTE" or "BASE_QUOTE" into base+quote symbols. */
  parsePair(pair: string): { base: string; quote: string } {
    const parts = pair.split(/[\/_]/);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid pair format: '${pair}'. Expected 'BASE/QUOTE' or 'BASE_QUOTE'.`);
    }
    return { base: parts[0], quote: parts[1] };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/solana/token-registry.test.ts
```
Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/solana/token-registry.ts test/solana/token-registry.test.ts
git commit -m "feat(solana): TokenRegistry with Jupiter verified list + mint overrides"
```

---

### Task C5: Balances (SPL + native SOL)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/balances.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/balances.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/solana/balances.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey } from '@solana/web3.js';

vi.mock('@/solana/connection', () => {
  const mockConn = {
    getBalance: vi.fn(async () => 2_500_000_000),  // 2.5 SOL
    getParsedTokenAccountsByOwner: vi.fn(async () => ({
      value: [
        {
          pubkey: new PublicKey('11111111111111111111111111111111'),
          account: {
            data: { parsed: { info: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', tokenAmount: { amount: '150000000', decimals: 6 } } } },
          },
        },
      ],
    })),
  };
  return {
    getActiveConnection: () => mockConn,
    withRetry: async (op: any) => op(mockConn),
  };
});

vi.mock('@/utils', () => ({
  getConfig: () => ({}),
  getLogger: () => ({ info: () => {}, warn: () => {} }),
}));

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('balances', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('@/solana/balances')];
  });

  it('returns native SOL balance and SPL balances for requested mints', async () => {
    const { getBalances } = await import('@/solana/balances');
    const owner = new PublicKey('11111111111111111111111111111111');
    const balances = await getBalances(owner, [SOL_MINT, USDC_MINT]);
    expect(balances[SOL_MINT]).toBeCloseTo(2.5);   // 2.5 SOL
    expect(balances[USDC_MINT]).toBeCloseTo(150);  // 150 USDC
  });

  it('returns 0 for an SPL mint with no token account', async () => {
    const { getBalances } = await import('@/solana/balances');
    const owner = new PublicKey('11111111111111111111111111111111');
    const UNKNOWN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
    const balances = await getBalances(owner, [UNKNOWN_MINT]);
    expect(balances[UNKNOWN_MINT]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/solana/balances.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement balances.ts**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/solana/balances.ts`:

```ts
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { withRetry } from './connection';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Returns balances in human-readable units (e.g., 1.234 for 1.234 SOL or 150.0 for 150 USDC).
 * Keys are mint addresses; values are decimal numbers.
 */
export async function getBalances(
  owner: PublicKey,
  mints: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const m of mints) result[m] = 0;

  // Native SOL balance (lamports → SOL)
  if (mints.includes(SOL_MINT)) {
    const lamports = await withRetry(c => c.getBalance(owner));
    result[SOL_MINT] = lamports / LAMPORTS_PER_SOL;
  }

  // SPL tokens
  const splMints = mints.filter(m => m !== SOL_MINT);
  if (splMints.length === 0) return result;

  const accounts = await withRetry(c =>
    c.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
  );

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

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/solana/balances.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/solana/balances.ts test/solana/balances.test.ts
git commit -m "feat(solana): native SOL + SPL token balance fetcher"
```

---

## Phase D — Strategy framework

### Task D1: command-queue (verbatim from dex-bot)

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/command-queue.ts`

- [ ] **Step 1: Read dex-bot's command-queue**

```bash
cat /Users/tayler/Developer/Protonext/dex-bot/src/strategies/command-queue.ts
```

- [ ] **Step 2: Copy verbatim**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/command-queue.ts` with the entire contents of the dex-bot file.

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4-5: Commit**

```bash
git add src/strategies/command-queue.ts
git commit -m "feat(strategies): copy command-queue from dex-bot (same protocol)"
```

---

### Task D2: SolanaTradingStrategyBase

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/base.ts`

(Tests for `swap()` paper-vs-live branching land in Task D3 alongside the mock engine.)

- [ ] **Step 1: Write the file**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/base.ts`:

```ts
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import BigNumber from 'bignumber.js';

import { TradingStrategy, SwapResult } from '../interfaces';
import { ORDERSIDES } from '../core/constants';
import { getConfig, getLogger } from '../utils';
import { events } from '../events';
import { tradesEmitter } from '../trades';
import { getActiveConnection, withRetry } from '../solana/connection';
import { loadKeypair, signVersionedTransaction } from '../solana/wallet';
import { JupiterClient, type QuoteResponse } from '../solana/jupiter';
import { TokenRegistry, type TokenInfo } from '../solana/token-registry';
import { getBalances } from '../solana/balances';
import { readPending, appendResult, type BotCommand, type BotCommandResult } from './command-queue';
import type { MockEngine } from '../mock-engine';

const baseLogger = getLogger();

export interface PriceQuote {
  price: number;          // quote per base (e.g. 165.43 USDC per 1 SOL)
  inAmount: number;
  outAmount: number;
}

export abstract class SolanaTradingStrategyBase implements TradingStrategy {
  abstract initialize(options?: any): Promise<void>;
  abstract trade(): Promise<void>;

  protected jupiter = new JupiterClient();
  protected tokens = new TokenRegistry();
  protected wallet: Keypair | null = null;
  public mockEngine?: MockEngine;

  protected async loadInfra(): Promise<void> {
    const cfg = getConfig();
    const sk = cfg.wallet?.privateKey;
    if (!sk) throw new Error('wallet.privateKey not configured');
    this.wallet = loadKeypair(sk);
    await this.tokens.load();
  }

  protected getWalletPubkey(): PublicKey {
    if (!this.wallet) throw new Error('Wallet not initialized — call loadInfra()');
    return this.wallet.publicKey;
  }

  /**
   * Get current price of base in terms of quote, by quoting 1 unit of base.
   * Returns NaN if no route is available.
   */
  protected async getPrice(base: TokenInfo, quote: TokenInfo): Promise<number> {
    const oneUnit = Math.pow(10, base.decimals);
    try {
      const q = await this.jupiter.quote({
        inputMint: base.mint,
        outputMint: quote.mint,
        amount: oneUnit,
        slippageBps: 50,
      });
      return q.outAmount / Math.pow(10, quote.decimals);
    } catch (err) {
      baseLogger.warn(`[price] no route for ${base.symbol}->${quote.symbol}: ${(err as Error).message}`);
      return NaN;
    }
  }

  /**
   * Execute a swap: paper mode uses MockEngine, live mode signs + sends via Jupiter.
   */
  protected async swap(
    inputToken: TokenInfo,
    outputToken: TokenInfo,
    inputAmountHuman: number,
    slippageBps: number,
  ): Promise<SwapResult | null> {
    const inputAmountAtomic = Math.floor(inputAmountHuman * Math.pow(10, inputToken.decimals));

    if (this.mockEngine) {
      // Paper mode
      const q = await this.jupiter.quote({
        inputMint: inputToken.mint, outputMint: outputToken.mint,
        amount: inputAmountAtomic, slippageBps,
      });
      const outHuman = q.outAmount / Math.pow(10, outputToken.decimals);
      this.mockEngine.applySwap(inputToken, outputToken, inputAmountHuman, outHuman, q.primaryDex);
      return {
        txSignature: `paper-${Date.now()}`,
        inputMint: inputToken.mint, inputAmount: inputAmountHuman,
        outputMint: outputToken.mint, outputAmount: outHuman,
        primaryDex: q.primaryDex,
        routePlan: q.routePlan,
        feeLamports: 5000,
      };
    }

    // Live mode
    const q = await this.jupiter.quote({
      inputMint: inputToken.mint, outputMint: outputToken.mint,
      amount: inputAmountAtomic, slippageBps,
    });
    const built = await this.jupiter.buildSwapTx({
      quoteResponse: q.raw,
      userPublicKey: this.getWalletPubkey().toBase58(),
    });
    const tx = VersionedTransaction.deserialize(built.swapTransaction);
    signVersionedTransaction(tx, this.wallet!);
    const sig = await withRetry(c => c.sendTransaction(tx, { maxRetries: 3 }));
    await withRetry(c => c.confirmTransaction({
      signature: sig,
      blockhash: '',  // confirmTransaction with sig-only is OK on confirmed commitment
      lastValidBlockHeight: built.lastValidBlockHeight ?? 0,
    } as any, 'confirmed'));

    const outHuman = q.outAmount / Math.pow(10, outputToken.decimals);
    return {
      txSignature: sig,
      inputMint: inputToken.mint, inputAmount: inputAmountHuman,
      outputMint: outputToken.mint, outputAmount: outHuman,
      primaryDex: q.primaryDex,
      routePlan: q.routePlan,
      feeLamports: 5000, // approximate; actual computed from tx receipt if needed
    };
  }

  /**
   * Push a swap result to the dashboard as both a swap_executed event and a /api/trades record.
   */
  protected async reportSwap(
    result: SwapResult,
    side: 'BUY' | 'SELL',
    symbol: string,
    base: TokenInfo,
    quote: TokenInfo,
    mode: 'live' | 'paper',
  ): Promise<void> {
    const sentToken = side === 'BUY' ? quote : base;
    const receivedToken = side === 'BUY' ? base : quote;
    const sentAmount = side === 'BUY' ? result.inputAmount : result.inputAmount;
    const receivedAmount = result.outputAmount;
    const price = side === 'BUY'
      ? new BigNumber(result.inputAmount).dividedBy(result.outputAmount).toNumber()
      : new BigNumber(result.outputAmount).dividedBy(result.inputAmount).toNumber();

    events.swapExecuted(`Swap ${side} ${symbol}`, {
      mode, market: symbol, side,
      price, quantity: side === 'BUY' ? receivedAmount : sentAmount,
      txSig: result.txSignature, primaryDex: result.primaryDex,
      route: result.routePlan,
    });

    await tradesEmitter.emit({
      instanceId: process.env.DASHBOARD_INSTANCE_ID ?? '',
      symbol, side, price,
      quantity: side === 'BUY' ? receivedAmount : sentAmount,
      mode, venue: 'solana',
      dex: result.primaryDex, txId: result.txSignature,
      sentAmount, sentCurrency: sentToken.symbol, sentContract: sentToken.mint,
      receivedAmount, receivedCurrency: receivedToken.symbol, receivedContract: receivedToken.mint,
      feeCurrency: 'SOL', // tx fee always in SOL
      data: { route: result.routePlan, feeLamports: result.feeLamports },
    });
  }

  // State-file helpers (chain-agnostic, mirror dex-bot)
  protected writeOrderState(state: any): void {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;
    try {
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
      const filePath = path.join(stateDir, `${instanceId}-orders.json`);
      const tempPath = filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(state));
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      baseLogger.warn('[state] failed to write order state:', err);
    }
  }

  protected async processCommands(): Promise<void> {
    const stateDir = process.env.ORDER_STATE_DIR;
    const instanceId = process.env.DASHBOARD_INSTANCE_ID;
    if (!stateDir || !instanceId) return;
    const cmdPath = path.join(stateDir, `${instanceId}-commands.jsonl`);
    const procPath = cmdPath + '.processing';
    const resultsPath = path.join(stateDir, `${instanceId}-command-results.jsonl`);

    let hasSidecar = fs.existsSync(procPath);
    if (!hasSidecar) {
      if (!fs.existsSync(cmdPath)) return;
      try { fs.renameSync(cmdPath, procPath); hasSidecar = true; }
      catch (err) { baseLogger.warn('[commands] move failed:', err); return; }
    }
    const pending = await readPending(procPath);
    const dispatcher = (this as any).handleCommand as ((cmd: BotCommand) => Promise<BotCommandResult>) | undefined;
    for (const cmd of pending) {
      let result: BotCommandResult;
      if (typeof dispatcher === 'function') {
        try { result = await dispatcher.call(this, cmd); }
        catch (err) {
          result = { id: cmd.id, status: 'error', message: (err as Error).message ?? 'dispatch failed', appliedAt: new Date().toISOString() };
        }
      } else {
        result = { id: cmd.id, status: 'error', message: 'strategy does not support commands', appliedAt: new Date().toISOString() };
      }
      await appendResult(resultsPath, result);
    }
    try { fs.unlinkSync(procPath); } catch (err) { baseLogger.warn('[commands] cleanup failed:', err); }
  }

  async cancelOwnOrders(): Promise<void> {
    baseLogger.info('[Solana] cancelOwnOrders is a no-op (AMM swaps have no resting orders)');
  }

  protected async readBalancesFor(mints: string[]): Promise<Record<string, number>> {
    if (this.mockEngine) return this.mockEngine.getBalances(mints);
    return getBalances(this.getWalletPubkey(), mints);
  }
}
```

- [ ] **Step 2-3: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4-5: Commit**

```bash
git add src/strategies/base.ts
git commit -m "feat(strategies): SolanaTradingStrategyBase with swap/getPrice/reportSwap"
```

---

## Phase E — Swapper strategy

### Task E1: SwapperStrategy and tests

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/swapper.ts`
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/index.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/strategies/swapper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/strategies/swapper.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils', () => ({
  getConfig: () => ({
    swapper: {
      pairs: [{
        symbol: 'SOL/USDC', base: 'SOL', quote: 'USDC',
        quoteAmountPerSwap: 25,
        quoteMaxHold: 500, quoteMinHold: 25,
        quoteBuyMaxThreshold: 150, quoteSellMinThreshold: 200,
        slippageBps: 50,
      }],
    },
    wallet: { publicKey: 'pk', privateKey: 'sk-fake' },
    jupiter: { apiBase: 'https://x', tokenListUrl: 'https://x' },
  }),
  getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
  getWalletPubkey: () => 'pk',
}));

vi.mock('@/solana/wallet', () => ({
  loadKeypair: vi.fn(() => ({ publicKey: { toBase58: () => 'pk' } })),
  signVersionedTransaction: vi.fn(),
}));

vi.mock('@/solana/token-registry', () => ({
  TokenRegistry: class {
    async load() {}
    parsePair(p: string) { const [b, q] = p.split('/'); return { base: b, quote: q }; }
    resolve(s: string) {
      if (s === 'SOL') return { mint: 'So111', symbol: 'SOL', decimals: 9 };
      if (s === 'USDC') return { mint: 'EPjFW', symbol: 'USDC', decimals: 6 };
      throw new Error(`unknown ${s}`);
    }
  },
}));

describe('SwapperStrategy decision logic', () => {
  let mockSwap: ReturnType<typeof vi.fn>;
  let mockReport: ReturnType<typeof vi.fn>;
  let mockGetPrice: ReturnType<typeof vi.fn>;
  let mockReadBalances: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    delete require.cache[require.resolve('@/strategies/swapper')];
    delete require.cache[require.resolve('@/strategies/base')];
    mockSwap = vi.fn(async () => ({ txSignature: 'sig', primaryDex: 'Raydium', inputAmount: 1, outputAmount: 1, inputMint: '', outputMint: '', routePlan: [], feeLamports: 5000 }));
    mockReport = vi.fn(async () => {});
    mockGetPrice = vi.fn();
    mockReadBalances = vi.fn();
  });

  async function makeStrategy(price: number, balances: Record<string, number>) {
    const { SwapperStrategy } = await import('@/strategies/swapper');
    const s: any = new SwapperStrategy();
    await s.initialize();
    s.swap = mockSwap;
    s.reportSwap = mockReport;
    s.getPrice = vi.fn(async () => price);
    s.readBalancesFor = vi.fn(async () => balances);
    return s;
  }

  it('BUY when price <= quoteBuyMaxThreshold and quote balance >= minHold', async () => {
    const s = await makeStrategy(140, { So111: 0, EPjFW: 100 });
    await s.trade();
    expect(mockSwap).toHaveBeenCalledTimes(1);
    const [inTok, outTok, amount] = mockSwap.mock.calls[0];
    expect(inTok.symbol).toBe('USDC');
    expect(outTok.symbol).toBe('SOL');
    expect(amount).toBe(25);
  });

  it('SELL when price >= quoteSellMinThreshold and base held > 0 and quote held < maxHold', async () => {
    const s = await makeStrategy(210, { So111: 1, EPjFW: 100 });
    await s.trade();
    expect(mockSwap).toHaveBeenCalledTimes(1);
    const [inTok, outTok] = mockSwap.mock.calls[0];
    expect(inTok.symbol).toBe('SOL');
    expect(outTok.symbol).toBe('USDC');
  });

  it('skips when price is between thresholds', async () => {
    const s = await makeStrategy(180, { So111: 1, EPjFW: 100 });
    await s.trade();
    expect(mockSwap).not.toHaveBeenCalled();
  });

  it('skips BUY if quote balance below minHold', async () => {
    const s = await makeStrategy(140, { So111: 0, EPjFW: 10 }); // < 25 minHold
    await s.trade();
    expect(mockSwap).not.toHaveBeenCalled();
  });

  it('skips SELL if quote balance >= maxHold (even if price triggers)', async () => {
    const s = await makeStrategy(210, { So111: 1, EPjFW: 600 }); // > 500 maxHold
    await s.trade();
    expect(mockSwap).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
npx vitest run test/strategies/swapper.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SwapperStrategy + index.ts**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/swapper.ts`:

```ts
import { SolanaTradingStrategyBase } from './base';
import { getConfig, getLogger } from '../utils';
import { events } from '../events';

const logger = getLogger();

interface SwapperPair {
  symbol: string;
  base: string;
  quote: string;
  mintOverride?: { base?: string; quote?: string; baseDecimals?: number; quoteDecimals?: number };
  quoteAmountPerSwap: number;
  quoteMaxHold: number;
  quoteMinHold: number;
  quoteBuyMaxThreshold: number;
  quoteSellMinThreshold: number;
  slippageBps: number;
}

export class SwapperStrategy extends SolanaTradingStrategyBase {
  private pairs: SwapperPair[] = [];

  async initialize(): Promise<void> {
    const cfg = getConfig();
    this.pairs = cfg.swapper?.pairs ?? [];
    await this.loadInfra();
    logger.info(`[swapper] initialized with ${this.pairs.length} pair(s)`);
  }

  async trade(): Promise<void> {
    await this.processCommands();
    for (const pair of this.pairs) {
      await this.tradePair(pair).catch(err =>
        logger.error(`[swapper:${pair.symbol}] cycle error: ${(err as Error).message}`),
      );
    }
  }

  private async tradePair(pair: SwapperPair): Promise<void> {
    const { base: baseSym, quote: quoteSym } = this.tokens.parsePair(pair.symbol);
    const base = this.tokens.resolve(baseSym, {
      mintOverride: pair.mintOverride?.base,
      decimalsOverride: pair.mintOverride?.baseDecimals,
    });
    const quote = this.tokens.resolve(quoteSym, {
      mintOverride: pair.mintOverride?.quote,
      decimalsOverride: pair.mintOverride?.quoteDecimals,
    });

    const price = await this.getPrice(base, quote);
    if (!isFinite(price)) {
      logger.warn(`[swapper:${pair.symbol}] no price available, skipping cycle`);
      return;
    }

    const balances = await this.readBalancesFor([base.mint, quote.mint]);
    const baseHeld = balances[base.mint] ?? 0;
    const quoteHeld = balances[quote.mint] ?? 0;

    const wantBuy =
      price <= pair.quoteBuyMaxThreshold &&
      quoteHeld >= pair.quoteMinHold;
    const wantSell =
      price >= pair.quoteSellMinThreshold &&
      baseHeld > 0 &&
      quoteHeld < pair.quoteMaxHold;

    if (wantBuy) {
      const swapAmount = Math.min(pair.quoteAmountPerSwap, quoteHeld);
      logger.info(`[swapper:${pair.symbol}] BUY: price=${price} <= ${pair.quoteBuyMaxThreshold}, swapping ${swapAmount} ${quote.symbol} -> ${base.symbol}`);
      const result = await this.swap(quote, base, swapAmount, pair.slippageBps);
      if (result) {
        await this.reportSwap(result, 'BUY', pair.symbol, base, quote, this.mockEngine ? 'paper' : 'live');
      }
    } else if (wantSell) {
      logger.info(`[swapper:${pair.symbol}] SELL: price=${price} >= ${pair.quoteSellMinThreshold}, swapping ${baseHeld} ${base.symbol} -> ${quote.symbol}`);
      const result = await this.swap(base, quote, baseHeld, pair.slippageBps);
      if (result) {
        await this.reportSwap(result, 'SELL', pair.symbol, base, quote, this.mockEngine ? 'paper' : 'live');
      }
    } else {
      logger.info(`[swapper:${pair.symbol}] no-op: price=${price} (buy<=${pair.quoteBuyMaxThreshold}, sell>=${pair.quoteSellMinThreshold}), base=${baseHeld} ${base.symbol}, quote=${quoteHeld} ${quote.symbol}`);
    }

    this.writeOrderState({
      instanceId: process.env.DASHBOARD_INSTANCE_ID ?? '',
      venue: 'solana',
      timestamp: new Date().toISOString(),
      strategy: 'swapper',
      pairs: [{
        symbol: pair.symbol,
        balances: { [base.symbol]: baseHeld.toString(), [quote.symbol]: quoteHeld.toString() },
        currentPrice: price,
      }],
    });
  }
}
```

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/strategies/index.ts`:

```ts
import { TradingStrategy, TradingStrategyConstructor } from '../interfaces';
import { SwapperStrategy } from './swapper';

const strategiesMap = new Map<string, TradingStrategyConstructor>([
  ['swapper', SwapperStrategy],
]);

export function getStrategy(name: string): TradingStrategy {
  const Ctor = strategiesMap.get(name);
  if (Ctor) return new Ctor();
  throw new Error(`No strategy named ${name} found`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/strategies/swapper.test.ts
```
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add src/strategies/swapper.ts src/strategies/index.ts test/strategies/swapper.test.ts
git commit -m "feat(swapper): threshold-driven buy/sell strategy via Jupiter"
```

---

## Phase F — Mock engine (paper trading)

### Task F1: MockEngine

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/mock-engine.ts`
- Test: `/Users/tayler/Developer/Protonext/dex-bot-solana/test/mock-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/test/mock-engine.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MockEngine } from '@/mock-engine';

const SOL = { mint: 'So111', symbol: 'SOL', decimals: 9 };
const USDC = { mint: 'EPjFW', symbol: 'USDC', decimals: 6 };

describe('MockEngine', () => {
  let stateDir: string;
  let engine: MockEngine;

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-eng-'));
    engine = new MockEngine(stateDir, 'inst-1');
    engine.initializeBalances({ SOL: 0, USDC: 1000 });
  });

  it('records initial balances', () => {
    expect(engine.getBalances([SOL.mint, USDC.mint])).toEqual({ [SOL.mint]: 0, [USDC.mint]: 1000 });
  });

  it('applySwap deducts input and credits output', () => {
    engine.applySwap(USDC, SOL, 165, 1, 'Raydium'); // buy 1 SOL for 165 USDC
    const b = engine.getBalances([SOL.mint, USDC.mint]);
    expect(b[USDC.mint]).toBe(835);
    expect(b[SOL.mint]).toBe(1);
  });

  it('saves and reloads state', () => {
    engine.applySwap(USDC, SOL, 165, 1, 'Raydium');
    engine.saveState();
    const reloaded = new MockEngine(stateDir, 'inst-1');
    reloaded.loadState();
    const b = reloaded.getBalances([SOL.mint, USDC.mint]);
    expect(b[USDC.mint]).toBe(835);
    expect(b[SOL.mint]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/mock-engine.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MockEngine**

Create `/Users/tayler/Developer/Protonext/dex-bot-solana/src/mock-engine.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { TokenInfo } from './solana/token-registry';
import { getLogger } from './utils';

const logger = getLogger();

interface MockState {
  balancesBySymbol: Record<string, number>;          // human-readable
  balancesByMint: Record<string, number>;
  swaps: Array<{
    at: string; primaryDex: string;
    inputSymbol: string; inputAmount: number;
    outputSymbol: string; outputAmount: number;
  }>;
}

export class MockEngine {
  private state: MockState = {
    balancesBySymbol: {},
    balancesByMint: {},
    swaps: [],
  };
  private stateFilePath: string;

  constructor(private stateDir: string, private instanceId: string) {
    this.stateFilePath = path.join(stateDir, `${instanceId}-mock-state.json`);
  }

  initializeBalances(initial: Record<string, number>): void {
    this.state.balancesBySymbol = { ...initial };
    // mint mapping populated lazily on first applySwap with that token
  }

  loadState(): void {
    if (!fs.existsSync(this.stateFilePath)) return;
    try {
      this.state = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf-8'));
    } catch (err) {
      logger.warn(`[mock] failed to load state: ${(err as Error).message}`);
    }
  }

  saveState(): void {
    try {
      if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
      const tmp = this.stateFilePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
      fs.renameSync(tmp, this.stateFilePath);
    } catch (err) {
      logger.warn(`[mock] failed to save state: ${(err as Error).message}`);
    }
  }

  applySwap(input: TokenInfo, output: TokenInfo, inAmount: number, outAmount: number, primaryDex: string): void {
    const inSym = input.symbol;
    const outSym = output.symbol;
    this.state.balancesBySymbol[inSym] = (this.state.balancesBySymbol[inSym] ?? 0) - inAmount;
    this.state.balancesBySymbol[outSym] = (this.state.balancesBySymbol[outSym] ?? 0) + outAmount;
    this.state.balancesByMint[input.mint] = this.state.balancesBySymbol[inSym];
    this.state.balancesByMint[output.mint] = this.state.balancesBySymbol[outSym];
    this.state.swaps.push({
      at: new Date().toISOString(),
      primaryDex,
      inputSymbol: inSym, inputAmount: inAmount,
      outputSymbol: outSym, outputAmount: outAmount,
    });
  }

  getBalances(mints: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const m of mints) {
      result[m] = this.state.balancesByMint[m] ?? 0;
    }
    return result;
  }

  getBalanceBySymbol(symbol: string): number {
    return this.state.balancesBySymbol[symbol] ?? 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/mock-engine.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mock-engine.ts test/mock-engine.test.ts
git commit -m "feat: MockEngine for paper-mode SPL balance simulation"
```

---

## Phase G — Main loop

### Task G1: src/index.ts

**Files:**
- Create: `/Users/tayler/Developer/Protonext/dex-bot-solana/src/index.ts`

- [ ] **Step 1: Write the file**

```ts
import { getConfig, getLogger } from './utils';
import { getStrategy } from './strategies';
import { events } from './events';
import { tradesEmitter } from './trades';
import { healthMonitor } from './health-monitor';
import type { MockEngine } from './mock-engine';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const logger = getLogger();
const config = getConfig();

async function gracefulShutdown(reason: string): Promise<void> {
  logger.info(`[shutdown] ${reason}`);
  events.botStopped(`Graceful shutdown: ${reason}`);
  events.shutdown();
  await delay(2000);
  process.exit(1);
}

let mockEngineInstance: MockEngine | undefined;

async function execTrade(): Promise<void> {
  console.log('Bot is live');
  try {
    await currentStrategy.trade();
  } catch (err) {
    logger.error(`[loop] error: ${(err as Error).message}`);
    events.botError(`Trade cycle error: ${(err as Error).message}`, { error: (err as Error).message });
  }
  if (mockEngineInstance) mockEngineInstance.saveState();
  if (healthMonitor.isRestartRequested()) {
    await gracefulShutdown('Health monitor triggered restart');
    return;
  }
  await delay(config.tradeIntervalMS);
  execTrade();
}

const currentStrategy = getStrategy(config.strategy);

events.initialize();
tradesEmitter.initialize();
healthMonitor.initialize();

async function main(): Promise<void> {
  await currentStrategy.initialize(config[config.strategy]);

  const isPaper = config.mode === 'paper' || process.env.BOT_MODE === 'paper';
  if (isPaper) {
    const { MockEngine } = await import('./mock-engine');
    const stateDir = process.env.ORDER_STATE_DIR ?? '';
    const instanceId = process.env.DASHBOARD_INSTANCE_ID ?? '';
    const engine = new MockEngine(stateDir, instanceId);
    engine.loadState();
    if (config.paperTrading?.startingBalances) {
      engine.initializeBalances(config.paperTrading.startingBalances);
    }
    (currentStrategy as any).mockEngine = engine;
    mockEngineInstance = engine;
    logger.info('[paper] mock engine initialized — no real swaps');
  }

  events.botStarted(`Bot started with strategy: ${config.strategy}${isPaper ? ' (paper mode)' : ''}`);
  events.configLoaded('Configuration loaded', {
    strategy: config.strategy,
    walletPubkey: config.wallet?.publicKey,
    tradeIntervalMS: config.tradeIntervalMS,
  });

  process.stdin.resume();
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  execTrade();
}

main().catch(err => {
  logger.error(`[main] fatal: ${(err as Error).message}`);
  events.botError(`Fatal error: ${(err as Error).message}`, { error: (err as Error).message });
  process.exit(1);
});
```

- [ ] **Step 2: tsc check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: (no isolated unit test — covered by integration test in H1)**

Skip.

- [ ] **Step 4-5: Commit**

```bash
git add src/index.ts
git commit -m "feat: main loop — init, trade cycle, graceful shutdown"
```

---

## Phase H — Manual verification

### Task H1: Devnet smoke test

This is a manual check — confirms the bot can boot, fetch a quote, and (in paper mode) "execute" a swap.

- [ ] **Step 1: Set up paper-mode config**

In `/Users/tayler/Developer/Protonext/dex-bot-solana/config/local.json` (gitignored), add:

```json
{
  "mode": "paper",
  "wallet": {
    "publicKey": "<your-test-pubkey>",
    "privateKey": "<base58-secret-key-of-throwaway-keypair>"
  },
  "paperTrading": {
    "startingBalances": { "SOL": 5, "USDC": 1000 }
  },
  "swapper": {
    "pairs": [{
      "symbol": "SOL/USDC", "base": "SOL", "quote": "USDC",
      "quoteAmountPerSwap": 50,
      "quoteMaxHold": 2000, "quoteMinHold": 50,
      "quoteBuyMaxThreshold": 1000,
      "quoteSellMinThreshold": 0.01,
      "slippageBps": 50
    }]
  },
  "rpc": { "endpoints": ["https://api.mainnet-beta.solana.com"] }
}
```

(Wide thresholds so the bot will execute on every cycle.)

- [ ] **Step 2: Generate a throwaway keypair (paper mode signs but doesn't send)**

```bash
node -e "const {Keypair}=require('@solana/web3.js'); const bs58=require('bs58').default; const kp=Keypair.generate(); console.log('PUB:', kp.publicKey.toBase58()); console.log('SEC:', bs58.encode(kp.secretKey));"
```
Paste the output into `config/local.json`.

- [ ] **Step 3: Run the bot**

```bash
cd /Users/tayler/Developer/Protonext/dex-bot-solana
npm run bot
```

Expected output (within 30 seconds):
- `[tokens] loaded N tokens from Jupiter`
- `[swapper] initialized with 1 pair(s)`
- `[paper] mock engine initialized — no real swaps`
- `Bot is live`
- `[swapper:SOL/USDC] BUY: price=... <= 1000, swapping 50 USDC -> SOL`
- The mock state file appears under `~/Developer/Protonext/dex-bot-solana/data/` (or wherever ORDER_STATE_DIR points) with updated balances.

If you see any 4xx/5xx from Jupiter, switch to a paid RPC (Helius free tier works) and try again.

- [ ] **Step 4: Tear down**

```
Ctrl+C
```

Expected: `[shutdown] SIGINT` then process exit.

- [ ] **Step 5: (no commit — verification only)**

If the smoke test reveals bugs, file them and revisit; otherwise the plan is done.

---

## Self-Review Checklist

**Spec coverage:**
- §5 (architecture) — Phase A repo + B shared infra + C primitives ✓
- §6 (repo structure) — file table at top matches §6 layout ✓
- §6.1 (key modules) — each module has a task ✓
- §7 (swapper config + trade loop + state file) — Tasks E1, base.writeOrderState ✓
- §11 (error handling matrix) — connection retry/rotation, jupiter quote no-route, mock fallback ✓
- §12 (testing) — vitest unit + integration locations match §12 layout ✓

**Placeholder scan:** No "TBD"/"TODO"/"similar to". All steps include the actual code or commands.

**Type consistency:**
- `TokenInfo` defined in `token-registry.ts`, consumed in `base.ts`, `swapper.ts`, `mock-engine.ts` ✓
- `SwapResult` defined in `interfaces/index.ts`, returned by `base.swap()`, consumed by `base.reportSwap()` ✓
- `tradesEmitter.emit` payload shape matches Plan 1's `TradeInputSchema` ✓
- `MockEngine.applySwap` signature matches `base.swap()` paper-mode call ✓

**Scope:** Just the new repo + swapper. No dashboard changes (Plan 3). No additional strategies.

---

## Out of scope for Plan 2

- Strategies beyond `swapper` — each gets its own follow-up spec
- CLMM (concentrated liquidity) support — separate larger spec
- Hardware-key wallet support — env-var-injected private key for v1
- Production tx-confirmation guarantees beyond Jupiter's defaults
- Slack integration (was optional in dex-bot — not built here)
- PM2 ecosystem file (covered by Plan 3, where the dashboard learns to start dex-bot-solana processes)

## Dependencies

- Plan 1 must complete before Plan 2's Task B4 (we copy `dex-bot/src/trades.ts` from Plan 1's deliverable)
- Plan 3 (dashboard multi-chain UI) can start in parallel once Plan 1's Phase A (schema) lands; full Plan 3 can wait until Plan 2 is complete to wire UI to a working bot
