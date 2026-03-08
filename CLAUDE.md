# Claude Instructions for MetalX DEX Bot

## Current Status (Updated 2026-03-04)

**Active Strategies:**
1. **Cross-Venue Arbitrage** (`crossVenueArbitrage`) - AMM vs DEX arbitrage
2. **Multi-Hop Arbitrage** (`multiHopArbitrage`) - LOAN bridge paths
3. **SimpleDEX Arbitrage** (`simpleDexArbitrage`) - Triangle arbs on SimpleDEX pools
4. **Launch Sniper** (`launchSniper`) - Auto-buy new simplelaunch tokens, momentum exit, graduation dump
5. **Competitor Tracker** - Monitors wwworker and other arb bots

**Account:** `tradingbot`
**Current Focus:** XPR, XUSDC, XMD, METAL, LOAN tokens + simplelaunch memecoins

**Profit Threshold:** `minProfitBPS: 15` (arb strategies)

**Fee Structure (tradingbot account):**
- **DEX:** 0% (zero fee tier)
- **AMM:** 6.8 BPS effective (0.2% base × 34% after 66% staking discount)
- **Treasury:** 0% (free XMD↔XUSDC)
- **SimpleDEX:** 30 BPS (0.3%), no staking discount
- **SimpleLaunch:** 1% buy fee, 1% sell fee
- **Total spread needed:** ~22 BPS to break even (arb), ~2% for launch sniper

**Logging:** Winston file transport → `logs/bot-YYYY-MM-DD.log` (50MB rotation, 10 files kept)

---

## Recent Changes (Mar 4) - LAUNCH SNIPER SPEED & MOMENTUM EXIT

### Feature: Momentum-Based Early Exit
andrew4.gm's edge: sells at 1.5-1.8x within minutes. We now sell 75% at 1.3x to beat him.

```typescript
momentumExit: {
  enabled: true,
  minPriceMultiple: 1.3,  // 30% gain triggers exit
  maxAgeSeconds: 1800,     // 30 min window
  percentToSell: 75,       // Sell 75%, keep 25% moonbag
}
```
Remaining 25% follows normal 2x/4x/10x targets.

### Feature: Late Buy Scaling
Prevents buying into pumped curves. Scales position based on how much XPR is already in:

```typescript
lateBuyScaling: {
  enabled: true,
  reducedBuyXPR: 2000,       // <5K XPR in curve → full 5K buy
  reducedThresholdXPR: 5000,  // 5-15K XPR → reduced 2K buy
  skipThresholdXPR: 15000,    // >15K XPR → skip (pump over)
}
```

### Feature: Fast Anti-Snipe Retry
Creator-only period is 60s. Old code retried via tick cycle (~2-5s per attempt, blocked by position monitoring). Now uses a dedicated 500ms retry loop that runs independently.

### Feature: Auto-Graduation Dump
When a token graduates to SimpleDEX, bot now claims tokens AND immediately dumps them for XPR via SimpleDEX swap (`swap:POOL_ID:0:0`).

### Feature: Split Tick Loops
Discovery (new launches + buys) runs on a fast 2s loop. Position monitoring (sells) runs on a separate 5s loop. Discovery is never blocked by slow RPC calls from monitoring.

### Increased Buy Size
`buyAmountXPR: 5000` (was 1000). Matches competitor sizing.

### Persistent File Logging
Winston file transport to `logs/bot-YYYY-MM-DD.log`. Survives restarts. 50MB rotation, 10 files kept.

### Competitor Analysis: andrew4.gm
| Metric | Value |
|--------|-------|
| Median sell multiple | ~1.6x |
| Sell range | 1.5x - 1.8x (outliers to 5x) |
| Hold time | 2-24 minutes |
| Buy size | 3,000 - 12,000 XPR |
| Total profit (2 days) | +44,414 XPR on 50,000 deployed |

---

## Recent Changes (Feb 3) - SLIPPAGE PROTECTION & POST-TRADE ANALYSIS

### Bug: Fill Quality Check Didn't Block Trades
**Problem:** `checkDexFillQuality()` logged a warning but didn't stop trades from executing.
```typescript
// BUGGY (old):
if (slippageBps > threshold) {
  logger.warn(`Slippage warning: ${slippageBps} BPS`);  // Just logged!
  // Trade continued anyway...
}

// FIXED (new):
if (!fillCheck.proceed) {
  logger.info(`🚫 MULTI-HOP BLOCKED: ${fillCheck.reason}`);
  return;  // Actually STOPS the trade
}
```
**Impact:** LOAN_BRIDGE_REV trade expected +19.5 BPS but got -63.1 BPS (-$0.11 loss) because slippage ate the profit.

### Feature: Post-Trade Analysis (60-Second Delayed Verification)
**Why:** Expected profit calculations can differ from actual results due to slippage, partial fills, and price movement. Now we verify actual profit 60 seconds after each trade.

**How it works:**
1. `startTrade()` captures pre-trade balances for all tokens
2. Trade executes
3. 60 seconds later, `runPostTradeAnalysis()` runs automatically
4. Compares actual balance changes vs expected profit
5. Sends Telegram notification with detailed analysis
6. Saves to `trade_analysis` database table

**Example notification:**
```
📊 POST-TRADE ANALYSIS
Trade: trade_123 (LOAN_BRIDGE_REV)
Expected: +19.5 BPS ($0.24)
Actual:   -63.1 BPS (-$0.11)
Status:   ⚠️ LOSS

Balance Changes:
  XPR: +0.0000
  XUSDC: -0.11
  LOAN: +0.0000
```

### Feature: Competitor Tracking Improvements
**Problem:** wwworker runs multiple concurrent arb bots. Grouping by account mixed actions from different transactions, showing wrong token/profit combinations.

**Fix:** Group by transaction ID instead of account:
```typescript
// OLD (buggy):
const key = action.account;  // Mixed data from concurrent txs

// NEW (fixed):
const key = action.trxId;  // Each transaction isolated
```

**Token identification from memo prefixes:**
```typescript
// wwworker's mmmaster memo convention:
// xxxminer = METAL arbs
// yyyminer = XPR arbs
// zzzminer = Mixed
if (memoPrefix.startsWith('xxx')) token = 'METAL';
else if (memoPrefix.startsWith('yyy')) token = 'XPR';
```

---

## Previous Changes (Jan 30) - CRITICAL BUG FIXES

### Bug 1: AMM Slippage Calculation (METAL_DIRECT paths)
**Problem:** Profit calculation used AMM spot price instead of actual swap output with slippage.
```typescript
// BUGGY (old):
const ammSellRate = ammPrice * (1 - AMM_FEE);  // Just spot price × 0.998

// FIXED (new):
const xmdFromAmmSell = this.calculateAmmOutput(metalFromDexBuy, metaxmd, true);
```
**Impact:** Bot executed trades expecting +35 BPS profit but got -84 BPS loss.

### Bug 2: DEX Fill Detection (Triangle Arbitrage)
**Problem:** Fill percentage calculated incorrectly, triggering unnecessary AMM fallback.
```typescript
// BUGGY (old):
const tokensFilled = tokensSent - remainingToken;  // Wrong! Used total balance

// FIXED (new):
const tokensFilled = tokenBalanceBeforeDex - remainingToken;  // Correct! Uses balance diff
```
**Impact:** 100% filled orders reported as 0% filled, causing extra AMM swaps and losses.

### Bug 3: Balance Tracking Pattern
**Problem:** Multiple places used expected amounts instead of actual received.
**Fix:** Consistent pattern across all strategies:
```typescript
// CORRECT PATTERN:
const balanceBefore = await this.getTokenBalance(token, contract);
// ... execute swap/trade ...
const balanceAfter = await this.getTokenBalance(token, contract);
const actualReceived = balanceAfter - balanceBefore;  // Use THIS, not expected!
```

---

## Previous Changes (Jan 28)
- **Atomic Arbitrage Contract**: Created `atomarb` smart contract for atomic execution
- **All-or-Nothing Trades**: Transaction reverts if profit target not met
- **Order Sniping**: Bot identifies specific mispriced orders with exact sizing
- **Full Precision Orderbook**: Uses `step=1000000` for 0.000001 price precision
- **Fill Simulation**: Simulates orderbook fills before trading
- Singleton lock prevents multiple bot instances

## Purpose

This is an **institutional-grade trading bot** for the MetalX DEX on XPR Network. Your primary objective is to **find and exploit profitable trading opportunities** on the MetalX decentralized exchange.

**Core Mission:** Generate profit through automated trading strategies including:
- Grid trading (buy low, sell high within price ranges)
- Market making (provide liquidity, earn spread)
- AMM-DEX arbitrage (exploit price differences between proton.swaps AMM and MetalX orderbook)
- AI-adaptive market making (use Claude AI to optimize trading decisions)

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Set environment variables
export PROTON_USERNAME=your-account
export PROTON_PRIVATE_KEY=PVT_K1_your-private-key
export CLAUDE_API_KEY=sk-ant-...  # Optional, for AI features
export TELEGRAM_BOT_TOKEN=...     # Optional, for notifications
export TELEGRAM_CHAT_ID=...       # Optional, for notifications

# Run on mainnet
npm run bot

# Run on testnet
npm run bot:test
```

## Architecture Overview

```
src/
├── index.ts                 # Entry point, orchestrates everything
├── strategies/              # Trading strategies
│   ├── gridbot.ts          # Grid trading strategy
│   ├── marketmaker.ts      # Market making strategy
│   ├── triangle-arbitrage.ts # AMM-DEX triangle arbitrage (primary)
│   ├── multi-hop-arbitrage.ts # METAL/LOAN bridge arbitrage (NEW)
│   ├── amm-dex-arbitrage.ts # Simple arbitrage between AMM and DEX
│   └── claude-adaptive-mm.ts # AI-powered market making
├── ai/                      # Claude AI integration
│   ├── claude-client.ts    # Anthropic SDK wrapper
│   ├── market-analyzer.ts  # AI market analysis
│   └── prompts.ts          # Analysis prompts
├── amm/                     # proton.swaps AMM integration
│   ├── pool-monitor.ts     # Monitor AMM pool prices
│   ├── price-calculator.ts # Constant product math (x*y=k)
│   └── swap-executor.ts    # Execute AMM swaps
├── xmd/                     # XMD (Metal Dollar) treasury
│   └── treasury.ts         # Mint/redeem XMD from XUSDC
├── risk/                    # Risk management
│   ├── manager.ts          # Pre-trade risk checks
│   ├── circuit-breaker.ts  # Halt trading on drawdown
│   └── position-tracker.ts # Track exposure
├── persistence/             # SQLite database
│   └── database.ts         # Order/trade history
├── analytics/               # Performance tracking
│   ├── pnl.ts              # P&L calculation
│   └── profitability-tracker.ts # Expected vs actual profit tracking + post-trade analysis
├── monitoring/              # Market monitoring
│   └── competitor-tracker.ts # Track competitor arb bots (wwworker, etc.)
├── notifications/           # Alert system
│   └── telegram.ts         # Telegram notifications
├── dexapi.ts               # MetalX DEX API (read)
└── dexrpc.ts               # MetalX DEX RPC (write)
```

## Trading Strategies

### 1. Grid Bot (`gridBot`)
Places buy and sell orders at fixed price intervals within a range.

**Config:**
```json
{
  "gridBot": {
    "pairs": [{
      "symbol": "XPR_XMD",
      "upperLimit": 0.005,
      "lowerLimit": 0.003,
      "gridLevels": 10,
      "bidAmountPerLevel": 10000
    }]
  }
}
```

**How it profits:** Captures volatility by buying dips and selling rallies within the range.

### 2. Market Maker (`marketMaker`)
Provides liquidity by placing orders on both sides of the orderbook.

**Config:**
```json
{
  "marketMaker": {
    "pairs": [{
      "symbol": "XPR_XMD",
      "gridLevels": 5,
      "gridInterval": 0.01,
      "base": "AVERAGE",
      "orderSide": "BOTH",
      "bidAmountPerLevel": 5000
    }]
  }
}
```

**How it profits:** Earns the bid-ask spread when both sides get filled.

### 3. AMM-DEX Arbitrage (`amm-dex-arbitrage`)
Exploits price discrepancies between proton.swaps AMM pools and MetalX DEX orderbook.

**Config:**
```json
{
  "arbitrage": {
    "minProfitBPS": 10,
    "maxTradeSizeUSD": 1000,
    "pools": [{
      "poolSymbol": "XPRUSDC",
      "dexMarketSymbol": "XPR_XUSDC",
      "baseToken": "XPR",
      "quoteToken": "XUSDC",
      "enabled": true
    }],
    "enabled": true
  }
}
```

**How it profits:**
- If DEX price < AMM price → Buy on DEX, sell via AMM swap
- If DEX price > AMM price → Buy via AMM swap, sell on DEX

### 4. Claude Adaptive Market Maker (`claude-adaptive-mm`)
AI-powered market making that adjusts spreads based on market conditions.

**Config:**
```json
{
  "claude": {
    "enabled": true,
    "analysisIntervalMS": 60000
  },
  "claudeAdaptiveMM": {
    "pairs": [{
      "symbol": "XPR_XUSDC",
      "bidAmountPerLevel": 10000,
      "baseSpreadBps": 50,
      "enabled": true
    }],
    "enabled": true
  }
}
```

**How it profits:** Uses Claude to analyze market sentiment, orderbook imbalance, and volatility to dynamically adjust spreads and inventory skew.

### 5. Triangle Arbitrage (`triangleArbitrage`)
**Primary strategy** - Exploits price discrepancies between AMM and DEX using XMD Treasury.

**The Triangle:**
```
proton.swaps (AMM)     MetalX DEX
   XPR/XUSDC    <-->    XPR/XMD
        \                 /
         \               /
          xmd (treasury)
          (XMD = XUSDC 1:1)
```

**Config:** (`config/mainnet.json`)
```json
{
  "triangleArbitrage": {
    "enabled": true,
    "checkIntervalMs": 1000,
    "minProfitBPS": 15,
    "maxTradeUSD": 50,
    "dryRun": false,
    "minPoolLiquidityUSD": 500000
  }
}
```

**Two Execution Paths:**

**AMM_TO_DEX (when DEX price > AMM price):**
1. Swap XUSDC → XPR via AMM (proton.swaps)
2. Sell XPR for XMD on DEX
3. Redeem XMD → XUSDC via Treasury (1:1, 0% fee)

**DEX_TO_AMM (when AMM price > DEX price):**
1. Mint XMD from XUSDC via Treasury
2. Buy XPR with XMD on DEX
3. Swap XPR → XUSDC via AMM

**Fee Structure (for tradingbot account):**
- AMM: 6.8 BPS (0.2% base with 66% staking discount)
- DEX: 0% (zero-fee tier)
- Treasury: 0% (free XMD ↔ XUSDC)
- **Total fees: ~7-8 BPS** → Need >15 BPS gap to profit

**Order Sniping (New!):**
The bot now scans the orderbook for specific mispriced orders and sizes trades exactly to match them:

```
Example:
AMM price: $0.002895
DEX has bid at $0.003100 for 8,000 XPR (7% premium!)

Bot snipes:
1. Buy exactly 8,000 XPR from AMM: $23.16
2. Sell exactly 8,000 XPR on DEX at $0.003100: $24.80
3. After 0.3% fees: ~$1.40 profit
```

**How sniping works:**
1. Fetches full-precision orderbook (`step=1000000` = 0.000001 precision)
2. For each price level, calculates: `profit = (DEX_price - AMM_price) - fees`
3. If profit > minProfitBPS, sizes trade exactly to that order's quantity
4. Executes precise fill instead of walking through multiple levels

**Fill Simulation:**
Before executing any trade, the bot simulates the fill:
- Walks through orderbook levels to calculate weighted average fill price
- Calculates expected slippage
- Only proceeds if trade remains profitable after slippage
- Logs: `Fill simulation: sell 17000 XPR @ avg $0.002891 (3 levels, 12.5 BPS slippage)`

**Status Logging (every 30 seconds):**
```
📊 Snipe scan: AMM=$0.002882 | Best bid=$0.002871 (-38 BPS) need>0.002920 | Best ask=$0.002894 (-41 BPS) need<0.002845
```
This shows:
- Current AMM price
- Best DEX bid and gap vs AMM (negative = below AMM)
- Minimum bid price needed to profit on sells
- Best DEX ask and gap vs AMM
- Maximum ask price needed to profit on buys

**Smart Features:**
- **Order Sniping**: Targets specific mispriced orders with exact sizing
- **Fill Simulation**: Predicts actual execution price before trading
- **Full Precision Orderbook**: Uses 0.000001 price precision
- **Balance-aware**: Checks balances before trading, auto-recovers when stuck
- **Liquidity checking**: Verifies DEX has liquidity before executing
- **Error recovery**: After 3 consecutive failures, extends cooldown
- **Normal limit orders**: Uses `fill_type: 0` (not IOC) so orders stay on book
- **Singleton lock**: Prevents multiple bot instances via TCP port 19847

**Recovery Commands:**
```bash
# If stuck with XPR but low XUSDC, run recovery swap:
node recovery-swap.cjs

# Cancel any stale orders:
# The bot's triangleArbitrage.cancelStaleOrders() handles this
```

### 6. Atomic Arbitrage (`atomicArbitrage`) - NEW!

**All-or-nothing atomic execution** using the `atomarb` smart contract.

**Why Atomic?**
| Multi-Transaction (Current) | Atomic (New) |
|-----------------------------|--------------|
| 3+ separate transactions | 1 atomic transaction |
| Can fail mid-trade | All-or-nothing |
| Tokens can get stuck | Never stuck |
| ~6 seconds total | ~0.5 seconds (1 block) |
| Can be front-run | Single block execution |

**How It Works:**
```
┌─────────────────────────────────────────────────────────────┐
│                 SINGLE ATOMIC TRANSACTION                    │
├─────────────────────────────────────────────────────────────┤
│  1. ammtodex()     → Record balance, swap XUSDC→XPR on AMM  │
│  2. DEX deposit    → Deposit XPR to DEX                     │
│  3. DEX order      → Place aggressive sell order            │
│  4. DEX process    → Match orders                           │
│  5. DEX withdraw   → Withdraw XMD                           │
│  6. redeemxmd()    → Redeem XMD → XUSDC via Treasury        │
│  7. verify()       → ASSERT: XUSDC >= start + min_profit    │
│                                                              │
│  If verify() fails → ENTIRE TRANSACTION REVERTS             │
│                   → No tokens lost, no state changed        │
└─────────────────────────────────────────────────────────────┘
```

**Config:**
```json
{
  "atomicArbitrage": {
    "enabled": true,
    "contractAccount": "atomarb",
    "minProfitBps": 10,
    "maxTradeUsd": 50,
    "preferAtomic": true,
    "forceAtomic": false,
    "dryRun": false
  }
}
```

**Setup Required:**
1. Deploy `atomarb` contract (see `contracts/atomarb/`)
2. Grant `eosio.code` permission:
   ```bash
   proton permission tradingbot active \
     '{"threshold":1,"keys":[{"key":"YOUR_KEY","weight":1}],"accounts":[{"permission":{"actor":"atomarb","permission":"eosio.code"},"weight":1}]}' \
     owner -p tradingbot@owner
   ```
3. Initialize contract and add authorized user:
   ```bash
   proton action atomarb init '{"owner":"tradingbot"}' atomarb@active
   proton action atomarb addauth '{"user":"tradingbot"}' tradingbot@active
   ```

**Files:**
- `contracts/atomarb/` - Smart contract source
- `src/strategies/atomic-executor.ts` - Bot integration
- `src/strategies/atomic-triangle.ts` - Atomic triangle wrapper

**How it profits:** Same as triangle arbitrage, but with guaranteed atomicity. If profit target isn't met, transaction reverts with no loss.

### 7. Multi-Hop Arbitrage (`multiHopArbitrage`) - NEW!
Advanced arbitrage using multiple token bridges through METAL and LOAN markets.

**Paths Available:**
| Path | Direction | Route |
|------|-----------|-------|
| METAL_BRIDGE | Forward | XPR→METAL(AMM)→XMD(DEX)→XUSDC→XPR |
| METAL_BRIDGE_REV | Reverse | XUSDC→XPR→METAL(AMM)→XMD(DEX)→XUSDC |
| LOAN_BRIDGE | Forward | XPR→LOAN(AMM)→XMD(DEX)→XUSDC→XPR |
| LOAN_BRIDGE_REV | Reverse | XUSDC→XMD→LOAN(DEX)→XPR(AMM)→XUSDC |
| METAL_DIRECT | Forward | XMD→METAL(AMM)→XMD(DEX) |
| METAL_DIRECT_REV | Reverse | XMD→METAL(DEX)→XMD(AMM) |

**Config:** (`config/mainnet.json`)
```json
{
  "multiHopArbitrage": {
    "enabled": true,
    "checkIntervalMs": 1000,
    "minProfitBps": 15,
    "maxTradeUsd": 25,
    "dryRun": false,
    "enabledPaths": ["LOAN_BRIDGE", "METAL_DIRECT"]
  }
}
```

**Key AMM Pools Used:**
| Pool | Tokens | Use Case |
|------|--------|----------|
| XPRUSDC | XPR ↔ XUSDC | Main price reference |
| METAXPR | METAL ↔ XPR | METAL bridge |
| METAXMD | METAL ↔ XMD | Direct METAL/XMD arb |
| XPRLOAN | XPR ↔ LOAN | LOAN bridge |

**CRITICAL: AMM Slippage**
The bot uses `calculateAmmOutput()` for ALL profit calculations to account for constant product slippage:
```typescript
// Constant product formula: output = (input * poolOut) / (poolIn + input)
private calculateAmmOutput(inputAmount: number, pool: PoolState, inputIsToken1: boolean): number {
  const feeMultiplier = 1 - this.AMM_FEE;  // 0.998
  const inputAfterFee = inputAmount * feeMultiplier;
  return (inputAfterFee * pool.token2Amount) / (pool.token1Amount + inputAfterFee);
}
```

**Why This Matters:**
- Spot price: `pool2 / pool1` = 0.1300
- Actual swap rate for 194 METAL: 0.1282 (worse due to slippage!)
- Using spot price = false profits → real losses

**DEX Slippage Protection (Safety Check 3):**
Before executing any multi-hop trade, the bot validates DEX fill quality:
```typescript
const fillCheck = await this.checkDexFillQuality(path);
if (!fillCheck.proceed) {
  logger.info(`🚫 MULTI-HOP BLOCKED: ${fillCheck.reason}`);
  return;  // Trade stopped
}
```

The check:
1. Fetches fresh orderbook (50 levels deep)
2. Simulates walking through price levels to fill the order
3. Calculates weighted average fill price
4. Computes slippage vs best price
5. **Rejects if `adjustedProfitBps < 5`** (slippage ate the profit)

**Status Logging:**
```
📊 Multi-hop scan: XPR=$0.002660 | METAL_XMD bid=0.1284 ask=0.12865 | LOAN_XMD bid=0.000393 ask=0.000395
```

### 8. Cross-Venue Arbitrage (`cross-venue-arbitrage`)
Similar to triangle arbitrage but with different configuration approach.

**Config:**
```json
{
  "crossVenueArbitrage": {
    "enabled": true,
    "pairs": [{
      "baseToken": "XPR",
      "baseContract": "eosio.token",
      "basePrecision": 4,
      "ammPoolSymbol": "XPRUSDC",
      "dexMarketSymbol": "XPR_XMD",
      "dexMarketId": 1,
      "enabled": true,
      "minTradeSize": 100,
      "maxTradeSize": 50000
    }],
    "minProfitBPS": 1,
    "maxTradeUSD": 100,
    "dryRun": false
  }
}
```

**How it profits:** The XMD Treasury allows free conversion between XUSDC and XMD. When AMM and DEX prices diverge, arbitrage closes the gap.

## Key Integrations

### XMD Treasury (`xmd.treasury`)
Convert between XUSDC and XMD (Metal Dollar) with **0% fees**.

```typescript
import { xmdTreasury } from './xmd/treasury.js';

// Mint XMD from XUSDC (1:1)
await xmdTreasury.xUSDCtoXMD(100);

// Redeem XMD to XUSDC (1:1)
await xmdTreasury.xMDtoXUSDC(50);
```

**Why this matters:** Most DEX markets use XMD as quote currency. Convert XUSDC↔XMD freely.

### MetalX DEX Orderbook API
The DEX provides a depth endpoint for orderbook data:

```bash
# Get orderbook with full precision (step=1000000 = 0.000001)
curl "https://dex.api.mainnet.metalx.com/dex/v1/orders/depth?symbol=XPR_XMD&step=1000000&limit=50"
```

**Response format:**
```json
{
  "data": {
    "bids": [
      { "level": 0.002895, "bid": 102054.3682 },
      { "level": 0.002887, "bid": 3113.3948 }
    ],
    "asks": [
      { "level": 0.002899, "bid": 100000 },
      { "level": 0.002903, "bid": 95444.0032 }
    ]
  }
}
```

**Step parameter:**
- `step=1000000` → 0.000001 precision (full precision, individual orders)
- `step=1000` → 0.001 precision (aggregated levels)
- `step=1` → 1.0 precision (highly aggregated)

The bot uses `step=1000000` to see individual price levels for precise order sniping.

### proton.swaps AMM
The AMM uses constant product formula: `x * y = k`

```typescript
import { ammPriceCalculator } from './amm/price-calculator.js';

// Calculate swap output
const output = ammPriceCalculator.calculateSwapOutput(
  inputAmount,
  poolReserveIn,
  poolReserveOut,
  0.002  // 0.2% fee
);

// Find arbitrage opportunity
const arb = ammPriceCalculator.findArbitrageOpportunity(
  ammPrice,
  dexBidPrice,
  dexAskPrice,
  10  // min profit in BPS
);
```

## Risk Management

The bot has built-in risk controls:

| Control | Description |
|---------|-------------|
| **Position Limits** | Max position per pair and total exposure |
| **Circuit Breaker** | Halts trading on drawdown threshold |
| **Rate Limiting** | Max orders per minute |
| **Daily Loss Limit** | Stops trading after daily loss limit |

**Config:**
```json
{
  "risk": {
    "maxPositionUSD": 10000,
    "maxTotalExposureUSD": 50000,
    "maxDrawdownPercent": 5,
    "dailyLossLimitUSD": 1000,
    "circuitBreakerEnabled": true
  }
}
```

## Notifications

### Telegram Setup
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your chat ID via [@userinfobot](https://t.me/userinfobot)
3. Configure:

```json
{
  "notifications": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID",
      "alertOn": {
        "tradeExecuted": true,
        "orderPlaced": false,
        "profitThresholdUSD": 10,
        "circuitBreakerTriggered": true,
        "dailySummary": true
      }
    }
  }
}
```

### Slack Setup
```json
{
  "slackBotToken": "xoxb-...",
  "channelId": "C0123456789"
}
```

## Common Operations

### Check Account Balance
```bash
proton account YOUR_ACCOUNT -t
```

### View Open Orders
```bash
proton table dex orderbook --limit 100
```

### Cancel All Orders
```bash
npm run cancel-orders
```

### Claim from Faucet (Testnet)
```bash
# XPR
proton action token.faucet claim '{"programId":1,"account":"YOUR_ACCOUNT"}' YOUR_ACCOUNT@active

# XUSDC
proton action token.faucet claim '{"programId":4,"account":"YOUR_ACCOUNT"}' YOUR_ACCOUNT@active
```

### Mint XMD from XUSDC
```bash
proton action xtokens transfer '{"from":"YOUR_ACCOUNT","to":"xmd.treasury","quantity":"100.000000 XUSDC","memo":"mint"}' YOUR_ACCOUNT@active
```

### Redeem XMD to XUSDC
```bash
proton action xmd.token transfer '{"from":"YOUR_ACCOUNT","to":"xmd.treasury","quantity":"100.000000 XMD","memo":"redeem,XUSDC"}' YOUR_ACCOUNT@active
```

## Configuration Reference

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `PROTON_USERNAME` | Yes | XPR Network account name |
| `PROTON_PRIVATE_KEY` | Yes | Private key (PVT_K1_...) |
| `CLAUDE_API_KEY` | No | Anthropic API key for AI features |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | Telegram chat ID |
| `NODE_ENV` | No | Set to `test` for testnet |

### Networks
| Network | RPC | API |
|---------|-----|-----|
| Mainnet | `https://rpc.api.mainnet.metalx.com` | `https://dex.api.mainnet.metalx.com/dex` |
| Testnet | `https://rpc.api.testnet.metalx.com` | `https://dex.api.testnet.metalx.com/dex` |

### Key Contracts
| Contract | Purpose |
|----------|---------|
| `dex` | MetalX DEX (orders, trades) |
| `proton.swaps` | AMM pools |
| `xmd.treasury` | Mint/redeem XMD |
| `xmd.token` | XMD token contract |
| `xtokens` | Wrapped tokens (XUSDC, XBTC, etc.) |
| `eosio.token` | XPR token contract |

## Profit Opportunities to Exploit

1. **Grid Trading Ranges**
   - Identify sideways markets with clear support/resistance
   - Set grid within the range, profit from oscillation

2. **AMM-DEX Arbitrage**
   - Monitor price discrepancies between proton.swaps and DEX
   - Execute when spread > fees (typically >10 BPS)

3. **Market Making Spreads**
   - Provide liquidity on low-volume pairs
   - Wider spreads = more profit per trade

4. **XMD Treasury Arbitrage**
   - If XMD trades at discount to XUSDC on DEX, buy XMD → redeem for XUSDC
   - If XMD trades at premium, mint XMD from XUSDC → sell on DEX

5. **Inventory Management**
   - Skew orders based on current inventory
   - Reduce position when overweight, increase when underweight

## Competitor Tracking

The bot monitors other arbitrage bots via Hyperion streaming API to learn from their strategies.

**Tracked Competitors:**
| Account | Bot Names | Strategy |
|---------|-----------|----------|
| wwworker | xxxminer, yyyminer, zzzminer | Triangle arb (METAL, XPR) |

**How It Works:**
1. Streams actions from Hyperion WebSocket
2. Detects patterns: AMM swap + DEX trade + Treasury mint/redeem
3. Groups actions by transaction ID (not account) to handle concurrent bots
4. Calculates profit from `waxptreasury` and `mmmaster` memo fields
5. Sends Telegram alerts for successful competitor trades

**Token Identification:**
```typescript
// wwworker's mmmaster memo convention:
if (memo.startsWith('xxx')) token = 'METAL';  // METAL arbs
if (memo.startsWith('yyy')) token = 'XPR';    // XPR arbs
if (memo.startsWith('zzz')) token = 'MIXED';  // Mixed
```

**Ignored Accounts (false positives):**
```typescript
private ignoredAccounts = new Set([
  'proton.swaps', 'dex', 'xmd.treasury', 'eosio.token',
  'supermann1', 'sweeney45', 'metalmarkets', 'snipsniper11'
]);
```

## Post-Trade Analysis

Every trade is automatically verified 60 seconds after execution.

**Flow:**
```
1. startTrade() → Captures pre-trade balances
2. Trade executes → Expected profit logged
3. 60 seconds later → runPostTradeAnalysis()
   - Fetches current balances
   - Calculates actual balance changes
   - Converts to USD using live prices
   - Compares expected vs actual
   - Sends Telegram notification
   - Saves to database
```

**Database Table: `trade_analysis`**
```sql
CREATE TABLE trade_analysis (
  id TEXT PRIMARY KEY,
  strategy TEXT,
  path TEXT,
  expected_profit_bps REAL,
  expected_profit_usd REAL,
  actual_profit_usd REAL,
  balance_changes TEXT,  -- JSON
  timestamp INTEGER
);
```

---

## Database Schema

Orders, trades, and analytics are persisted to SQLite:

```
./data/dex-bot.db
├── orders          # Order history
├── trades          # Trade execution logs
├── arbitrage_opportunities  # Detected arb opportunities
├── daily_pnl       # Daily P&L snapshots
├── metrics         # Performance metrics
└── risk_snapshots  # Risk state snapshots
```

## Debugging

### View Logs
```bash
# Main bot log
tail -f mainnet-bot.log

# Filter for snipe activity
grep -E "Snipe|snipe|🎯|📊" mainnet-bot.log

# Filter for trades
grep -E "Triangle|TRIANGLE|executed|profit" mainnet-bot.log

# Filter for multi-hop activity
grep -E "Multi-hop|METAL_DIRECT|LOAN_BRIDGE|Executing" mainnet-bot.log

# Check profitability metrics
grep -E "Profitability|Expected|Actual|BPS" mainnet-bot.log
```

### Profitability Tracker
The bot tracks expected vs actual P&L for every trade:
```
📊 [TRACKER] Trade started: trade_1_1706612345678
   Strategy: multi-hop-arbitrage | Path: METAL_DIRECT_REV
   Expected: 35.0 BPS ($0.0876)

✅ [TRACKER] Trade completed: trade_1_1706612345678
   Expected: 35.0 BPS ($0.0876)
   Actual:   -84.2 BPS ($-0.2104)  ← RED FLAG! Calculation bug!
   Slippage: 119.2 BPS | Execution: -241%
```

**Key Metrics to Watch:**
- `Profit Accuracy` should be >80% (actual/expected)
- `Avg Slippage` should be <20 BPS
- Negative accuracy = calculation bug, not market conditions

### Understanding Status Logs
The bot logs market state every 30 seconds:
```
📊 Snipe scan: AMM=$0.002882 | Best bid=$0.002871 (-38 BPS) need>0.002920 | Best ask=$0.002894 (-41 BPS) need<0.002845
```

**Reading the log:**
- `AMM=$X` - Current AMM price
- `Best bid=$X (-38 BPS)` - Highest DEX bid, gap vs AMM (negative = below AMM)
- `need>$X` - Minimum bid price needed to profit on AMM→DEX path
- `Best ask=$X (-41 BPS)` - Lowest DEX ask, gap vs AMM
- `need<$X` - Maximum ask price needed to profit on DEX→AMM path

When an opportunity appears:
```
🎯 Found 2 snipe opportunities:
  AMM_TO_DEX: 5000 XPR @ $0.003100 = +150.3 BPS ($0.75)
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "LOW BALANCES" | Fund account with required tokens |
| "Circuit breaker triggered" | Check drawdown, wait for cooldown |
| "Market not found" | Verify market symbol exists |
| "Transaction failed" | Check account permissions, RAM |
| "overdrawn balance" | Account ran out of tokens - run `node recovery-swap.cjs` |
| DEX orders cancelled | Orders used IOC fill_type - now uses normal limit orders |
| Stuck with XPR, no XUSDC | Run recovery swap: `node recovery-swap.cjs` |
| "port 19847 in use" | Another bot instance running - kill it: `pkill -9 -f "ts-node.*index.ts"` |
| No snipe opportunities | Market is well-arbitraged - wait for mispriced orders |
| Fill quality check failed | Orderbook too thin or slippage too high - bot protecting from bad fills |
| Trade executed despite slippage warning | Fill check wasn't blocking - FIXED Feb 3, now returns and blocks |
| Expected profit doesn't match actual | Use post-trade analysis (60s delay) to verify; check AMM slippage calc |
| Competitor alerts show wrong token | Was grouping by account not trxId - FIXED Feb 3 |
| METAL_DIRECT showing profit but losing | AMM slippage bug - FIXED Jan 30 |
| "0% filled" but trade executed | Fill detection bug - FIXED Jan 30 |
| Stuck METAL in account | Earlier failed trades - can sell manually or wait for opportunity |

### Critical Lessons Learned (Feb 3)

**1. Safety Checks Must BLOCK, Not Just WARN**
```typescript
// WRONG - just logs warning, trade continues
if (slippage > threshold) {
  logger.warn(`High slippage: ${slippage}`);
}
await executeTrade();  // Runs anyway!

// RIGHT - actually stops the trade
const check = await checkDexFillQuality(path);
if (!check.proceed) {
  logger.info(`🚫 BLOCKED: ${check.reason}`);
  return;  // STOPS HERE
}
await executeTrade();  // Only if check passed
```

**2. Verify Profit After Trade, Not Just Before**
Expected profit calculations can be wrong due to:
- Orderbook changes between check and execution
- Partial fills
- AMM slippage miscalculation
- Price movement during multi-step execution

Always run post-trade analysis to verify actual P&L.

**3. Group Concurrent Transactions by Transaction ID**
When tracking competitor trades, group by `trxId` not `account`. Competitors run multiple bots concurrently, and grouping by account mixes data from different transactions.

**4. Staking Discount Tiers for AMM Fees**
| XPR Staked | Discount | Effective Fee |
|------------|----------|---------------|
| 0 | 0% | 20 BPS |
| 1M XPR | 66% | 6.8 BPS |
| 10M XPR | 100% | 0 BPS |

Our account (tradingbot) has ~1M staked = 66% discount = 6.8 BPS AMM fee.

---

### Critical Lessons Learned (Jan 30)

**1. AMM Slippage is NOT just the fee!**
```
WRONG: effectiveRate = spotPrice * (1 - 0.002)   // Just subtracting 0.2% fee
RIGHT: effectiveRate = calculateAmmOutput() / inputAmount  // Constant product formula
```
For large trades relative to pool size, slippage can be 1-5% beyond the fee.

**2. Always track balance BEFORE and AFTER**
```typescript
// WRONG - using expected amounts
const tokensReceived = expectedOutput * 0.99;

// RIGHT - measuring actual change
const balanceBefore = await getBalance();
await executeSwap();
const balanceAfter = await getBalance();
const tokensReceived = balanceAfter - balanceBefore;
```

**3. DEX fill detection must use balance diff**
```typescript
// WRONG - comparing sent amount to total balance
const filled = tokensSent - currentBalance;  // Negative if you had tokens before!

// RIGHT - comparing balance before/after DEX trade
const filled = balanceBeforeDex - balanceAfterDex;
```

**4. Verify opportunity calculations match execution**
If expected profit is +35 BPS but actual is -84 BPS, there's a calculation bug.
Check: Are you using spot prices where you should use slippage-adjusted prices?

### DEX Order Fill Types
**Critical lesson learned:** Using `fill_type: 1` (IOC - Immediate or Cancel) causes orders to cancel if no immediate match. For arbitrage, use `fill_type: 0` (normal limit order) which stays on the book.

```typescript
// WRONG - order gets cancelled if no immediate match
fill_type: 1  // IOC

// CORRECT - order stays on book until filled
fill_type: 0  // Normal limit
```

### Recovery Procedures

**When stuck with XPR but low XUSDC:**
```bash
# Run the recovery script to swap XPR back to XUSDC
node recovery-swap.cjs
```

**When bot has open orders stuck:**
```javascript
// In code, call:
await triangleArbitrage.cancelStaleOrders();
```

**Check current balances:**
```bash
curl -s "https://proton.eosusa.io/v1/chain/get_table_rows" \
  -d '{"code":"xtokens","scope":"tradingbot","table":"accounts","json":true}' | jq
```

## Safety Notes

1. **Start Small** - Test with small amounts first
2. **Use Testnet** - Validate strategies on testnet before mainnet
3. **Monitor** - Set up Telegram alerts for important events
4. **Risk Limits** - Always configure circuit breakers
5. **Backup Keys** - Never lose your private key

---

*This bot is designed to find and exploit profitable edges on MetalX DEX. Trade responsibly.*
