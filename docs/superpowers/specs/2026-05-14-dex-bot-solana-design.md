# Design — `dex-bot-solana` + multi-chain dashboard support

**Date:** 2026-05-14
**Author:** Tayler (with Claude)
**Status:** Approved (awaiting written-spec review before implementation plan)

---

## 1. Goals

1. Enable trading on Solana DEXes (Raydium, Orca, Meteora, etc.) via Jupiter aggregator.
2. Reuse the existing dashboard (`dex-dashboard`) as the single integration point — manage Solana instances alongside Proton instances from one UI.
3. Capture trade data in a form that is **tax-compliant by construction** — exportable to CoinTracker, Koinly, CoinTracking and similar with no post-processing.
4. Reuse the battle-tested order-to-trade mapping logic from `protonext-tax` for Proton trade representation, so both Proton and Solana trades land in the same tax-correct shape.
5. Ship `swapper` as the v1 strategy. Document a roadmap of additional strategies for follow-up specs.

## 2. Non-goals (this spec)

- Strategies beyond `swapper` (each gets its own spec).
- Raydium CLMM (concentrated liquidity) — its own larger spec when ready.
- Extracting the Proton order mapper into a shared workspace package — future spec; for v1 we port-with-parity-tests.
- Hardware-key (Ledger/HSM) wallet support.
- Multi-instance-on-one-wallet coordination beyond a soft warning at instance creation.
- Backfilling historical Proton trades with USD prices we don't have.

## 3. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Codebase shape | Separate `dex-bot-solana` repo | Avoid risking working Proton bot; allow independent evolution |
| Swap execution | Jupiter aggregator API, all DEXes | Best-price routing across Raydium/Orca/Meteora; minimal Solana-pool plumbing to maintain |
| Pair specification | Symbol-first with optional mint override | Clean UX (`SOL/USDC`); escape hatch for memecoins via explicit mint addresses |
| Paper trading | Yes — port `MockEngine` pattern | Matches existing dex-bot UX; cheap insurance against real-money strategy bugs |
| RPC provider | Configurable list, document recommended (Helius / Triton / QuickNode), default to public | No vendor lock-in; users with paid RPC get better reliability |
| Dashboard scope | Full management — create/start/stop Solana instances from UI | Matches existing usage pattern for Proton instances |
| Trade tracking | Extend trades schema; bot pushes via `POST /api/trades`; multi-format export | Multi-DEX requires capturing route/DEX per trade; tax export drives the schema shape |
| Proton trade conversion | Port logic from `protonext-tax/src/lib/services/proton/order-transaction-mapper-v2.ts` with parity tests | Mapper handles non-obvious Proton quirks (sent/received semantics, fee currency, price-convention inconsistency, canceled-order handling); we don't reinvent |
| First strategy | `swapper` | Smallest scope that validates the entire stack |

## 4. Strategy roadmap

The full set of strategies that fit Solana via Jupiter, ranked by effort. **Bold** = no Proton equivalent. Each subsequent strategy gets its own spec; this list is the agreed sequence.

### Tier 1 — straight Jupiter swaps

1. `swapper` *(v1, this spec)*
2. `twapBot`
3. `momentumBot`
4. `scannerBot`
5. `copyTrader`
6. `whaleWatcher`

### Tier 2 — Solana-specific plumbing

7. `spikeBot` (port — recovery model needs redesign for AMM semantics; no partial fills)
8. `arbBot` (Raydium ↔ Orca ↔ Meteora)
9. **Sniper** (subscribe to pool-creation events, snipe new launches)
10. **Jupiter Limit Orders** (CLOB-like UX via Jupiter's on-chain limit orders)

### Tier 3 — Raydium CLMM (separate code path)

11. CLMM range LP ("gridBot equivalent")
12. CLMM market maker

### Dropped

- Classic `gridBot` — no orderbook to grid against; CLMM range LP is the honest replacement
- `spreadBot` — no spread to manage on an AMM

## 5. Architecture overview

### 5.1 Why a separate repo

`dex-bot` is fused to Proton at the type level (`@proton/wrap-constants` `Market` and `OrderHistory` shapes are baked into `TradingStrategyBase`). Refactoring to a chain-abstraction would touch every strategy. By spinning up a parallel `dex-bot-solana` repo we ship value without risking the working Proton bot, and we let the two evolve independently. The cost is some duplicated infrastructure (events client, health monitor, command queue, mock-engine pattern) — accepted for v1, with eventual extraction to a shared package as a future spec.

### 5.2 How the two halves talk

The dashboard is the integration point. Both bots speak the same wire protocols:

- **Events** — HTTP `POST /api/events` (existing in dex-bot, copied into dex-bot-solana)
- **State files** — per-instance JSON in `ORDER_STATE_DIR` (`{instanceId}-orders.json`, `{instanceId}-tracked.json`, `{instanceId}-commands.jsonl`, `{instanceId}-command-results.jsonl`) — same protocol, content shape evolves to fit Solana
- **Trades** — new `POST /api/trades` from bots after every fill/swap (used by both Proton and Solana bots)
- **Holdings** — dashboard cron pulls holdings on a schedule via chain-appropriate balance fetcher

### 5.3 Why Jupiter aggregator

User-selected: Jupiter all-DEX routing. Implications:

- We don't manage Raydium pool state directly — Jupiter's quote response is our source of truth.
- Single HTTP dependency: `https://lite-api.jup.ag/swap/v1` (free tier; spec recommends a paid endpoint for production).
- Each swap response includes `routePlan[]` listing the DEXes used — we parse this to populate the new `dex` trade column.

## 6. `dex-bot-solana` repo structure

Mirrors `dex-bot`:

```
dex-bot-solana/
├── src/
│   ├── core/constants.ts              # ORDERSIDES (BUY=1, SELL=2 to match dex-bot)
│   ├── interfaces/                    # TradingStrategy, SolanaBotConfig
│   ├── solana/
│   │   ├── connection.ts              # @solana/web3.js Connection + RPC fallback list
│   │   ├── wallet.ts                  # Keypair from base58 secretKey
│   │   ├── token-registry.ts          # Symbol → mint via Jupiter token list + per-pair overrides
│   │   ├── balances.ts                # SPL + native SOL balances
│   │   └── jupiter.ts                 # Quote + Swap API client; parses routePlan
│   ├── strategies/
│   │   ├── base.ts                    # SolanaTradingStrategyBase
│   │   ├── command-queue.ts           # same protocol as dex-bot
│   │   ├── swapper.ts                 # v1 strategy
│   │   └── index.ts
│   ├── events.ts                      # copied from dex-bot, identical wire format
│   ├── trades.ts                      # NEW: pushes trades to dashboard
│   ├── health-monitor.ts              # adapted: tracks RPC + Jupiter HTTP health
│   ├── mock-engine.ts                 # paper mode; simulates Jupiter quote + swap
│   ├── utils.ts
│   └── index.ts                       # main loop
├── config/default.json
├── package.json                       # @solana/web3.js, @solana/spl-token, bs58, node-fetch, vitest
├── README.md
└── tsconfig.json
```

### 6.1 Key modules

- **`solana/connection.ts`** — wraps `Connection` with the same RPC-fallback + `healthMonitor` retry pattern as `dex-bot/src/dexrpc.ts`. Endpoints array in config; rotates on consecutive failures.
- **`solana/wallet.ts`** — `loadKeypair(secretKeyBase58)`. Single key per process, env-var-injected through config (matches dex-bot's pattern).
- **`solana/token-registry.ts`** — at startup, fetches Jupiter strict token list, builds `Map<symbol, mintInfo>`. Resolves `"SOL"` → `So111...112`, `"USDC"` → `EPjFW...`. Honors per-pair `mintOverride` from config for memecoins / disambiguation.
- **`solana/jupiter.ts`** — `quote({ inputMint, outputMint, amount, slippageBps })` and `swap({ quoteResponse, userPublicKey })`. Returns `{ tx, route, primaryDex, fees }` where `primaryDex` is the largest hop in `routePlan`. Tx is partially-signed serialized; we sign with our keypair and send.
- **`strategies/base.ts`** — `SolanaTradingStrategyBase` with `protected solana: { connection, wallet, jupiter, tokens, balances }`, `protected async swap(...)` (paper-vs-live branch), `protected async getPrice(in, out)` (quotes a tiny notional), and the same state-file/command-queue helpers as dex-bot's base.

## 7. Swapper strategy (v1 deliverable)

Behavior mirrors `dex-bot/src/strategies/swapper.ts` adapted for AMM swap semantics.

### 7.1 Per-pair config

```ts
SolanaSwapperPairSchema = {
  symbol: string,                    // "SOL/USDC" — parsed into base/quote
  base: string,                      // "SOL"
  quote: string,                     // "USDC"
  mintOverride?: {                   // optional, for memecoins / disambiguation
    base?: string,                   // mint address override
    quote?: string,
  },
  quoteAmountPerSwap: number,        // quote units per buy (e.g. 50 USDC)
  quoteMaxHold: number,              // upper bound on quote balance before forced sell-side cooldown
  quoteMinHold: number,              // lower bound; below this, don't buy
  quoteBuyMaxThreshold: number,      // buy when price ≤ this
  quoteSellMinThreshold: number,     // sell when price ≥ this
  slippageBps: number,               // default 50 (0.5%)
}
```

### 7.2 Trade loop (per cycle)

1. Pull a Jupiter quote for 1 unit base → quote, derive current price.
2. Read current SPL balance for base + quote.
3. Decide:
   - Quote held ≥ `quoteMinHold` AND price ≤ `quoteBuyMaxThreshold` → swap `quoteAmountPerSwap` quote → base
   - Base held > 0 AND price ≥ `quoteSellMinThreshold` AND quote held < `quoteMaxHold` → swap accumulated base → quote
4. Execute swap via Jupiter (paper mode branches to `MockEngine`).
5. Push `swap_executed` event + `POST /api/trades` with full route metadata.
6. Sleep `tradeIntervalMS`.

### 7.3 State file content

`{instanceId}-orders.json` — Solana shape:

```json
{
  "instanceId": "...",
  "venue": "solana",
  "timestamp": "...",
  "wallet": "...",
  "strategy": "swapper",
  "network": "mainnet",
  "pairs": [{
    "symbol": "SOL/USDC",
    "balances": { "SOL": "1.234", "USDC": "200.00" },
    "currentPrice": 165.43,
    "lastSwap": {
      "side": "BUY", "txSig": "...", "at": "...", "primaryDex": "Raydium"
    }
  }]
}
```

## 8. Dashboard changes

### 8.1 Schema

`src/types/instance.ts` becomes venue-discriminated:

```ts
const ProtonBotConfigSchema = z.object({ /* current shape */ });

const SolanaBotConfigSchema = z.object({
  tradeIntervalMS: z.number().min(1000),
  strategy: z.enum(['swapper']),       // grows as we ship more
  swapper: z.object({ pairs: z.array(SolanaSwapperPairSchema) }).optional(),
  wallet: z.object({
    publicKey: z.string(),
    privateKey: z.string().optional(),  // write-only on form, stored in instance config
  }),
  rpc: z.object({ endpoints: z.array(z.string()) }),
  jupiter: z.object({
    apiBase: z.string().default('https://lite-api.jup.ag/swap/v1'),
  }),
});

const BotInstanceConfigSchema = z.discriminatedUnion('venue', [
  z.object({ venue: z.literal('proton'), bot: ProtonBotConfigSchema, dashboard: DashboardConfigSchema.optional() }),
  z.object({ venue: z.literal('solana'), bot: SolanaBotConfigSchema, dashboard: DashboardConfigSchema.optional() }),
]);
```

`BotInstance` gains `venue: 'proton' | 'solana'`. `network` widens to `'mainnet' | 'testnet' | 'devnet'`.

### 8.2 Service changes

| Service | Change |
|---|---|
| `pm2-service.ts` | Branch on venue: cwd = `dex-bot/` (proton) or `dex-bot-solana/` (solana); same `npm run bot` entry point |
| `holdings-service.ts` | Add Solana balance fetcher (`getParsedTokenAccountsByOwner` + native SOL `getBalance`); cron picks fetcher based on `instance.venue` |
| `trades-service.ts` | Schema migration adds `venue`, `dex`, `tx_id`, both-legs, fee-currency, USD value columns (see §9); `TradeInput` and `TradeQueryOptions` extended; queries gain `venue?` and `dex?` filters |
| `dex-api.ts` | Solana branch uses Jupiter quote API for prices; Proton branch unchanged |
| `event-service.ts` | No change — events table already chain-agnostic |

### 8.3 UI changes

- **Instance creation form** — venue picker at the top; Proton form vs Solana form below. Existing form is reused for Proton; new component for Solana.
- **Instances list** — chain badge column (existing PM2 status column unchanged).
- **Trades view** — Chain + DEX columns, filter chips for both, "Export" button (opens dialog with format + filter selection).
- **Holdings view** — renders SPL token balances correctly when `instance.venue === 'solana'`. Mostly label/format changes; table structure already supports it.

### 8.4 End-to-end Solana instance lifecycle

1. User → dashboard → "New Instance" → picks Solana → fills form (name, wallet, RPC, swapper pairs).
2. Dashboard writes `dex-bot-solana/config/{instanceId}.json`, registers in instances DB, starts via PM2.
3. Bot boots → loads config → initializes Connection, Wallet, Jupiter client, token registry → enters trade loop.
4. Each cycle → Jupiter quote → balance read → decision → swap (or skip) → event + trade push → state file write.
5. Dashboard cron → fetches Solana balances → records holdings snapshot.
6. User → dashboard → views events / trades / holdings / PnL — same UI, now multi-chain.

## 9. Tax-compliant trade tracking

### 9.1 Why this shapes the schema

Crypto tax tools (CoinTracker, Koinly, CoinTracking, ZenLedger, TokenTax, Crypto Tax Calculator) expect: **both legs of the trade**, **explicit fees with fee currency**, **UTC timestamp**, **tx hash**, **USD value at trade time** for cost basis. The current trades schema is orderbook-shaped (`side` + `price` + `quantity`), which works for Proton CLOB orders but loses information for AMM swaps and isn't directly importable by tax tools.

### 9.2 Revised trades schema

We **extend, not replace** the existing schema — preserves existing Proton rows and the UI's current shape — while adding the both-legs representation as the source of truth for tax export:

```sql
-- Existing columns kept:
--   id, instance_id, timestamp, symbol, side, price, quantity,
--   fee, total, mode, pnl, cumulative_pnl, mock_id, data
-- New columns added:
ALTER TABLE trades ADD COLUMN venue TEXT NOT NULL DEFAULT 'proton';
ALTER TABLE trades ADD COLUMN dex TEXT;                    -- 'Raydium' | 'Orca' | 'XPR DEX' | ...
ALTER TABLE trades ADD COLUMN tx_id TEXT;                  -- tx signature / transaction id

-- Both-legs (tax export source of truth):
ALTER TABLE trades ADD COLUMN sent_amount REAL;
ALTER TABLE trades ADD COLUMN sent_currency TEXT;
ALTER TABLE trades ADD COLUMN sent_contract TEXT;          -- mint address or token contract
ALTER TABLE trades ADD COLUMN received_amount REAL;
ALTER TABLE trades ADD COLUMN received_currency TEXT;
ALTER TABLE trades ADD COLUMN received_contract TEXT;
ALTER TABLE trades ADD COLUMN fee_currency TEXT;           -- currency of fee field above
ALTER TABLE trades ADD COLUMN usd_value REAL;              -- value of received side at trade time
```

**Backfill of existing Proton trades:** during migration, derive `sent_amount` / `received_amount` / `fee_currency` from `side` + `price` + `quantity` + `total`. `usd_value` is `NULL` for historical rows.

**Going forward:** bots push both representations in `POST /api/trades`. Dashboard derives legacy fields if not provided. Neither bot needs to drop the existing emission shape.

### 9.3 USD valuation at trade time

- **Solana:** trivial when one side is USDC/USDT. For other pairs we capture USD value via Jupiter price API at the moment of swap. `NULL` for failed lookups.
- **Proton:** when bot pushes a trade, fetch latest USD price for the quote token via existing dex-api (XMD is USD-pegged). `NULL` for failed lookups.

### 9.4 Export presets

`GET /api/trades/export` accepts a `format` parameter:

| `format=` | Use case | Columns |
|---|---|---|
| `cointracker` | CoinTracker import | `Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Tag` |
| `koinly` | Koinly import | `Date,Sent Amount,Sent Currency,Received Amount,Received Currency,Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency,Label,Description,TxHash` |
| `cointracking` | CoinTracking.info import | `Type,Buy Amount,Buy Currency,Sell Amount,Sell Currency,Fee,Fee Currency,Exchange,Trade-Group,Comment,Date,Tx-ID` |
| `csv` (default) | Raw — internal analysis | All trade columns including route, dex, pnl, instance metadata |
| `json` | Programmatic | All fields including the full `data` blob |

All filters compose with all formats: `venue`, `dex`, `instanceId`, `symbol`, `startTime`, `endTime`, `side`, `mode`. Filename auto-suffixed with filter summary (e.g., `trades_solana_raydium_2026-01-01_to_2026-05-14.csv`).

UI export button presents a dialog letting the user pick format + filters before download.

## 10. Proton trade representation (using protonext-tax mapper logic)

### 10.1 The problem

If dex-bot writes Proton trades with naive `side` + `price` + `quantity` semantics, tax exports will be subtly wrong — fees in the wrong currency, quantities flipped, canceled orders treated as fills, etc. The mapper at `~/Developer/personal/protonext-tax/src/lib/services/proton/order-transaction-mapper-v2.ts` already encodes the correct rules, learned from real-world Proton order data.

### 10.2 Non-obvious things the mapper handles

- **Field semantics are static; tokens vary by side.** `quantity*` = SENT, `filled*` = RECEIVED, `filledFee` = always taken from RECEIVED. Token *identity* depends on side (BUY = received base, SELL = received quote) but field meaning doesn't change.
- **Price is unreliable across markets** — some store quote-per-base, others base-per-quote. Mapper validates against both interpretations and accepts the better match.
- **`quantityFilled` is misleading on canceled orders** — only `filledTotal` / `filledAmount` are trustworthy fill indicators.
- **Maker vs taker fee inference** from observed fee ratio against market `makerFee` / `takerFee`.
- **Partial-fill / missing-data flagging** as `needsReview`.

### 10.3 Approach for this spec

1. **Port the mapping logic into dex-bot** as `dex-bot/src/proton/order-trade-mapper.ts` — a faithful port of `mapOrderToTransactionV2`'s pure logic (lines 289–633 of the source), stripped of Prisma/database concerns. Inputs become plain TypeScript: `OrderData` with plain numbers (not `Prisma.Decimal`) and `MarketInfo` passed in from the bot's existing market cache. Output is a `MappedTrade` matching the both-legs schema in §9.2.

2. **Bot calls the mapper at fill detection.** When dex-bot detects a fill (existing logic in `dex-bot/src/strategies/base.ts` and per-strategy modules), it calls the mapper to build the trade payload, then pushes via `POST /api/trades` with both:
   - The both-legs fields (`sent_amount`, `received_amount`, `fee_currency`, etc.)
   - The raw order fields (`quantity`, `filledTotal`, `filledAmount`, `filledFee`, `price`, `orderSide`, `marketId`) preserved in the `data` JSON column.

   The raw preservation means: if we ever discover a mapper bug, we can re-derive both-legs without losing data.

3. **Drift-prevention tests.** Add `dex-bot/test/proton/order-mapper-parity.test.ts` with curated fixtures (BUY filled, SELL filled, partial fill, canceled-with-fill, edge-case-fee). Both the dex-bot port AND the protonext-tax mapper run against the fixtures; assert byte-equal output. The protonext-tax module path is read from env var `PROTONEXT_TAX_MAPPER_PATH` (default `~/Developer/personal/protonext-tax/src/lib/services/proton/order-transaction-mapper-v2.ts`); if the file is not present (e.g. CI without the sibling repo), the test logs a skip with a clear message rather than failing. Locally (and in any CI configured to provide the path), the test fails on divergence.

4. **Future spec (out of scope):** extract the mapper into a shared workspace package (`@protonext/proton-order-mapper`) consumed by both repos. Requires refactoring protonext-tax to decouple the mapper from Prisma types — meaningful project of its own.

5. **Solana doesn't need this.** Jupiter's swap response is unambiguous: it tells us `inputAmount`, `outputAmount`, `inputMint`, `outputMint`, `feeBps`, plus full route plan. Both-legs trade representation is built directly from the response. No mapper needed.

### 10.4 Rules dex-bot's port must enforce

Lifted directly from the protonext-tax mapper:

- **BUY** (`orderSide=1`): `sent = quantityFilled` (in quote/ask token), `received = filledAmount` (in base/bid token, net of fee), `fee` in base/bid token.
- **SELL** (`orderSide=2`): `sent = quantityFilled` (in base/bid token), `received = filledAmount` (in quote/ask token, net of fee), `fee` in quote/ask token.
- `received` falls back: `filledAmount` → `filledTotal - filledFee` → gross `filledTotal` → price-calculated estimate (last case flagged `needsReview`).
- Skip orders with no `filledTotal` / `filledAmount` even if `quantityFilled > 0` (canceled orders without fills).
- Fee inference (maker vs taker) and price-validation-vs-both-conventions are kept — they go into the `data` JSON column for the dashboard's trade detail view.

## 11. Error handling & resilience

| Failure mode | Mitigation |
|---|---|
| RPC endpoint returns invalid response / times out | Retry-with-fallback pattern matching `dex-bot/src/dexrpc.ts` `apiTransact`. RPC list rotates on consecutive failures; `healthMonitor` tracks per-endpoint success rate and triggers process restart if degraded. |
| Jupiter rate-limited (429) | Exponential backoff (1s → 2s → 4s, max 3 retries). If still failing, skip cycle, emit `market_data_error`. Don't crash. |
| Jupiter returns no route (illiquid pair) | Skip swap, emit warning event with pair info. Don't retry until next cycle. |
| Slippage exceeded | Jupiter handles slippage at protocol level — tx reverts atomically. We catch the revert, emit `order_failed` with reason, don't record a trade. Cycle continues. |
| Tx submitted but not confirmed within timeout | `Connection.confirmTransaction` with 60s timeout, `commitment: 'confirmed'`. On timeout, query signature status; if still unconfirmed after 90s total, emit `order_failed` and assume it failed. |
| Wallet has insufficient SPL balance | Pre-check before building tx (`balance >= sent_amount + estimated_fee`); skip + emit `balance_low`. |
| Wallet has insufficient SOL for fees | Check native SOL balance before any swap; if below threshold, emit `balance_low` (sev: warning) and pause swaps for that pair until refilled. |
| Token mint resolution fails (memecoin not in registry) | Fail fast at startup with clear error pointing to the `mintOverride` config field. Don't silently proceed. |
| Jupiter route uses unexpected DEX | By design (all-DEX routing). Trade record stores actual DEX from `routePlan`. No error. |
| Concurrent instances on same wallet | Soft check at instance creation: warn if another running instance uses same Solana wallet address. Doesn't block. |

## 12. Testing strategy

### 12.1 Unit tests (vitest)

Mirror dex-bot's test layout:

- `solana/jupiter.test.ts` — mock Jupiter API responses; assert quote parsing, `routePlan` → primary DEX extraction, swap tx construction.
- `solana/token-registry.test.ts` — fixture token list, assert symbol resolution + override behavior.
- `solana/balances.test.ts` — mock Connection responses, assert SPL + native SOL balance shape.
- `strategies/swapper.test.ts` — table-driven tests for threshold logic: given (price, balances, config) → expected decision.
- `mock-engine.test.ts` — assert simulated swaps update virtual balances correctly.

### 12.2 Integration tests

- `test/integration/swapper-paper.test.ts` — boot swapper in paper mode, drive a sequence of price changes via injected mock prices, assert the right swap decisions fire and balances/state-files update. No network.
- `test/integration/jupiter-live.test.ts` — opt-in test (env-var gated, `.skip` by default) that hits real Jupiter API to assert our client still parses real responses correctly. Run manually before releases.

### 12.3 Cross-repo parity test

- `dex-bot/test/proton/order-mapper-parity.test.ts` — fixtures-driven; runs both dex-bot's ported mapper AND protonext-tax's `mapOrderToTransactionV2` against same input; asserts byte-equal output. Catches drift.

### 12.4 Manual verification before merge

- **Devnet smoke test** — spin up an instance pointing at devnet RPC + devnet Jupiter; confirm a swap lands and dashboard reflects it.
- **Mainnet small-amount test** — single instance, $5 USDC, very wide thresholds; confirm one round-trip swap; verify trade row in dashboard with correct route/dex/tx_id; verify export CSV opens cleanly in CoinTracker (or chosen target).

## 13. References

- Existing dex-bot: `/Users/tayler/Developer/Protonext/dex-bot/`
- Existing dex-dashboard: `/Users/tayler/Developer/Protonext/dex-dashboard/`
- Existing trades service: `dex-dashboard/src/lib/trades-service.ts`, `dex-dashboard/src/types/trades.ts`
- Proton order mapper (source of truth for Proton trade conversion): `~/Developer/personal/protonext-tax/src/lib/services/proton/order-transaction-mapper-v2.ts`
- Jupiter docs: <https://dev.jup.ag>
- Raydium docs: <https://docs.raydium.io/sdk-api>
- `@solana/web3.js`: <https://solana-labs.github.io/solana-web3.js/>
