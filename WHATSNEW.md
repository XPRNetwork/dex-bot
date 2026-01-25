# Institutional-Grade DEX Bot Upgrade

This document describes the comprehensive upgrade to the MetalX DEX trading bot, transforming it into an institutional-grade trading platform with advanced strategies, AI-powered decision making, AMM-DEX arbitrage, comprehensive risk management, and enterprise monitoring capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Persistence Layer](#persistence-layer)
4. [Risk Management](#risk-management)
5. [AMM Integration](#amm-integration)
6. [AMM-DEX Arbitrage Strategy](#amm-dex-arbitrage-strategy)
7. [Claude AI Integration](#claude-ai-integration)
8. [Claude Adaptive Market Maker](#claude-adaptive-market-maker)
9. [Analytics & P&L Tracking](#analytics--pnl-tracking)
10. [Multi-Strategy Orchestration](#multi-strategy-orchestration)
11. [Configuration](#configuration)
12. [Getting Started](#getting-started)
13. [Environment Variables](#environment-variables)

---

## Overview

### What's New

| Feature | Description |
|---------|-------------|
| **SQLite Persistence** | Full order/trade history with audit trail |
| **Risk Management** | Position limits, circuit breakers, exposure monitoring |
| **AMM Integration** | proton.swaps pool monitoring and swap execution |
| **AMM-DEX Arbitrage** | Automated arbitrage between AMM pools and DEX orderbook |
| **Claude AI** | AI-powered market analysis and adaptive decision making |
| **Adaptive Market Maker** | Dynamic spread adjustment based on market conditions |
| **P&L Analytics** | Real-time performance tracking with Sharpe ratio, drawdown |
| **Multi-Strategy** | Run multiple strategies concurrently |

### New Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.71.0",  // Claude AI integration
  "better-sqlite3": "^11.0.0",     // SQLite database
  "zod": "^3.22.4",                // Configuration validation
  "decimal.js": "^10.4.0",         // Precision math
  "prom-client": "^15.0.0"         // Prometheus metrics
}
```

---

## Architecture

### Project Structure

```
src/
├── index.ts                    # Main entry point (multi-strategy orchestration)
├── core/
│   └── constants.ts            # Proton constants re-exports
├── config/
│   ├── schema.ts               # Zod configuration validation
│   └── index.ts
├── strategies/
│   ├── base.ts                 # Base strategy class
│   ├── gridbot.ts              # Grid trading strategy
│   ├── marketmaker.ts          # Simple market maker
│   ├── amm-dex-arbitrage.ts    # NEW: AMM-DEX arbitrage
│   ├── claude-adaptive-mm.ts   # NEW: AI-powered market maker
│   └── index.ts                # Strategy factory
├── amm/
│   ├── pool-monitor.ts         # proton.swaps pool queries
│   ├── price-calculator.ts     # Constant product AMM math
│   ├── swap-executor.ts        # Execute AMM swaps
│   └── index.ts
├── ai/
│   ├── claude-client.ts        # Anthropic SDK wrapper
│   ├── prompts.ts              # Market analysis prompts
│   ├── market-analyzer.ts      # AI market analysis
│   └── index.ts
├── persistence/
│   ├── database.ts             # SQLite connection & migrations
│   ├── models/
│   │   ├── order.model.ts      # Order repository
│   │   ├── trade.model.ts      # Trade repository
│   │   └── arbitrage.model.ts  # Arbitrage opportunity repository
│   └── index.ts
├── risk/
│   ├── position-tracker.ts     # Position & exposure tracking
│   ├── circuit-breaker.ts      # Trading halt on losses
│   ├── manager.ts              # Risk orchestration
│   └── index.ts
├── analytics/
│   ├── pnl.ts                  # P&L calculation & metrics
│   └── index.ts
├── dexapi.ts                   # DEX REST API client
├── dexrpc.ts                   # On-chain RPC interactions
├── slackapi.ts                 # Slack notifications
└── utils.ts                    # Configuration & logging
```

---

## Persistence Layer

### Location: `src/persistence/`

The persistence layer provides durable storage for all trading activity using SQLite.

### Database Schema

#### Orders Table
Tracks all orders placed by the bot.

```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  order_side TEXT NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'FAILED')),
  dex_order_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  filled_at DATETIME,
  filled_quantity REAL DEFAULT 0,
  average_fill_price REAL,
  fee REAL DEFAULT 0,
  error_message TEXT
);
```

#### Trades Table
Records individual trade executions.

```sql
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  strategy TEXT NOT NULL,
  market_symbol TEXT NOT NULL,
  trade_side TEXT NOT NULL CHECK (trade_side IN ('BUY', 'SELL')),
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  total REAL NOT NULL,
  fee REAL DEFAULT 0,
  fee_token TEXT,
  realized_pnl REAL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Arbitrage Opportunities Table
Logs detected and executed arbitrage opportunities.

```sql
CREATE TABLE arbitrage_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pool_symbol TEXT NOT NULL,
  amm_price REAL NOT NULL,
  dex_bid REAL NOT NULL,
  dex_ask REAL NOT NULL,
  spread_bps REAL NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('AMM_TO_DEX', 'DEX_TO_AMM')),
  potential_profit REAL NOT NULL,
  trade_size REAL,
  executed INTEGER DEFAULT 0,
  execution_profit REAL,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME
);
```

#### Risk Events Table
Audit trail for all risk-related events.

```sql
CREATE TABLE risk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('POSITION_LIMIT', 'EXPOSURE_LIMIT', 'DRAWDOWN_ALERT', 'CIRCUIT_BREAKER', 'DAILY_LOSS_LIMIT', 'KILL_SWITCH')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  strategy TEXT,
  market_symbol TEXT,
  threshold_value REAL,
  actual_value REAL,
  action_taken TEXT,
  message TEXT NOT NULL,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Usage

```typescript
import { initializeDatabase, orderRepository, tradeRepository } from './persistence/index.js';

// Initialize database (runs migrations automatically)
initializeDatabase({ type: 'sqlite', path: './data/dex-bot.db' });

// Create an order
const order = orderRepository.createOrder({
  strategy: 'gridBot',
  market_symbol: 'XPR_XUSDC',
  order_side: 'BUY',
  price: 0.001,
  quantity: 10000
});

// Record a trade
const trade = tradeRepository.createTrade({
  order_id: order.id,
  strategy: 'gridBot',
  market_symbol: 'XPR_XUSDC',
  trade_side: 'BUY',
  price: 0.001,
  quantity: 10000,
  realized_pnl: 5.50
});

// Query statistics
const stats = tradeRepository.getTradeStats('gridBot');
console.log(`Win rate: ${(stats.winningTrades / stats.totalTrades * 100).toFixed(1)}%`);
```

---

## Risk Management

### Location: `src/risk/`

The risk management module provides comprehensive protection against losses.

### Components

#### Position Tracker (`position-tracker.ts`)

Tracks real-time positions and exposure across all strategies.

```typescript
import { positionTracker } from './risk/index.js';

// Update position after a trade
positionTracker.addToPosition('gridBot', 'XPR_XUSDC', 'BUY', 10000, 0.001);

// Get current position
const position = positionTracker.getPosition('gridBot', 'XPR_XUSDC');
// { strategy: 'gridBot', marketSymbol: 'XPR_XUSDC', side: 'LONG', size: 10000, ... }

// Get total exposure
const exposure = positionTracker.getTotalExposure();
// { totalExposureUSD: 50000, longExposureUSD: 30000, shortExposureUSD: 20000, ... }
```

#### Circuit Breaker (`circuit-breaker.ts`)

Automatically halts trading when risk thresholds are exceeded.

**Triggers:**
- **Max Drawdown**: Trading stops when drawdown exceeds configured percentage
- **Daily Loss Limit**: Trading stops when daily losses exceed USD limit
- **Consecutive Losses**: Trading stops after N consecutive losing trades

```typescript
import { circuitBreaker } from './risk/index.js';

// Initialize for a strategy
circuitBreaker.initializeStrategy('gridBot', 10000); // $10k starting equity

// Record a trade result
const canContinue = circuitBreaker.recordTradeResult('gridBot', -100); // $100 loss
if (!canContinue) {
  console.log('Circuit breaker triggered!');
}

// Manual kill switch
circuitBreaker.killSwitch('gridBot', 'Market conditions too volatile');

// Reset after review
circuitBreaker.reset('gridBot', 'Conditions normalized');
```

#### Risk Manager (`manager.ts`)

Orchestrates all risk checks before order placement.

```typescript
import { riskManager } from './risk/index.js';

// Pre-trade risk check
const riskCheck = riskManager.checkOrder({
  strategy: 'gridBot',
  marketSymbol: 'XPR_XUSDC',
  side: 'BUY',
  quantity: 50000,
  price: 0.001
});

if (!riskCheck.allowed) {
  console.log(`Order rejected: ${riskCheck.reason}`);
} else if (riskCheck.adjustedSize) {
  console.log(`Order size reduced to ${riskCheck.adjustedSize}`);
}

// Get current risk status
const status = riskManager.getRiskStatus('gridBot');
console.log(`Can trade: ${status.canTrade}`);
console.log(`Warnings: ${status.warnings.join(', ')}`);
```

### Configuration

```json
{
  "risk": {
    "maxPositionUSD": 10000,          // Max position per pair
    "maxTotalExposureUSD": 50000,     // Max total exposure
    "maxPositionPercent": 20,         // Max position as % of portfolio
    "minOrderSizeUSD": 1,             // Minimum order size
    "maxOrdersPerMinute": 60,         // Rate limiting
    "maxDrawdownPercent": 5,          // Circuit breaker trigger
    "dailyLossLimitUSD": 1000,        // Daily loss limit
    "consecutiveLossLimit": 10,       // Max consecutive losses
    "circuitBreakerEnabled": true,
    "cooldownMinutes": 60,            // Time before auto-reset
    "autoReset": false                // Auto-reset after cooldown
  }
}
```

---

## AMM Integration

### Location: `src/amm/`

Integration with proton.swaps AMM pools for price discovery and swap execution.

### Pool Monitor (`pool-monitor.ts`)

Fetches and caches pool state from the proton.swaps contract.

```typescript
import { ammPoolMonitor } from './amm/index.js';

// Initialize
await ammPoolMonitor.initialize();

// Get pool data
const pool = await ammPoolMonitor.getPool('XPRUSDC');
console.log(`Pool: ${pool.symbol}`);
console.log(`Token1: ${pool.token1.symbol} (${pool.token1.amount})`);
console.log(`Token2: ${pool.token2.symbol} (${pool.token2.amount})`);
console.log(`Price: ${pool.price}`);
console.log(`Liquidity: $${pool.liquidityUSD}`);

// Refresh pool data
await ammPoolMonitor.refreshPool('XPRUSDC');

// Start polling for updates
const pollInterval = ammPoolMonitor.startPolling(5000, ['XPRUSDC', 'XMTUSDC']);
```

### Price Calculator (`price-calculator.ts`)

Implements constant product AMM math (x * y = k).

```typescript
import { ammPriceCalculator } from './amm/index.js';

// Calculate swap output
const outputAmount = ammPriceCalculator.calculateSwapOutput(
  1000,   // Input amount
  100000, // Reserve in
  50000,  // Reserve out
  20      // Fee in basis points (0.2%)
);
// Output: ~476.19 (minus fees)

// Get swap quote
const quote = ammPriceCalculator.getSwapQuote(pool, 'XPR', 1000, 50);
console.log(`Input: ${quote.inputAmount} ${quote.inputToken}`);
console.log(`Output: ${quote.outputAmount} ${quote.outputToken}`);
console.log(`Price Impact: ${quote.priceImpact.toFixed(2)}%`);
console.log(`Fee: ${quote.fee}`);

// Find arbitrage opportunity
const arb = ammPriceCalculator.findArbitrageOpportunity(
  pool,
  0.00095,  // DEX bid
  0.00105,  // DEX ask
  10        // Min profit in bps
);
console.log(`Profitable: ${arb.profitable}`);
console.log(`Direction: ${arb.direction}`);
console.log(`Expected Profit: $${arb.expectedProfit}`);
```

### Swap Executor (`swap-executor.ts`)

Executes token swaps on proton.swaps.

```typescript
import { swapExecutor } from './amm/index.js';

// Execute a swap
const result = await swapExecutor.executeSwap({
  poolSymbol: 'XPRUSDC',
  inputToken: 'XUSDC',
  inputAmount: 100,
  minOutputAmount: 95000,  // Slippage protection
  slippageBps: 50          // 0.5% slippage tolerance
});

if (result.success) {
  console.log(`Swapped ${result.inputAmount} ${result.inputToken}`);
  console.log(`Received ${result.outputAmount} ${result.outputToken}`);
} else {
  console.log(`Swap failed: ${result.error}`);
}
```

---

## AMM-DEX Arbitrage Strategy

### Location: `src/strategies/amm-dex-arbitrage.ts`

Automatically exploits price discrepancies between proton.swaps AMM pools and the MetalX DEX orderbook.

### How It Works

1. **Monitor**: Continuously fetches AMM pool prices and DEX orderbook
2. **Detect**: Calculates spread between AMM and DEX prices
3. **Evaluate**: Checks if spread exceeds minimum profit threshold (accounting for fees)
4. **Execute**: Places atomic trades to capture the spread

### Arbitrage Directions

| Direction | Condition | Action |
|-----------|-----------|--------|
| **AMM_TO_DEX** | AMM price < DEX bid | Buy on AMM, sell on DEX |
| **DEX_TO_AMM** | AMM price > DEX ask | Buy on DEX, sell on AMM |

### Example

```
AMM Pool: XPRUSDC
  - XPR Reserve: 7,400,000
  - XUSDC Reserve: 368,000
  - AMM Price: 0.0497 XUSDC per XPR

DEX Orderbook: XPR_XUSDC
  - Highest Bid: 0.0510
  - Lowest Ask: 0.0520

Opportunity Detected:
  - AMM Price (0.0497) < DEX Bid (0.0510)
  - Direction: AMM_TO_DEX
  - Spread: 26 bps (after 20 bps AMM fee = 6 bps net)
  - Action: Buy XPR on AMM, sell on DEX
```

### Configuration

```json
{
  "arbitrage": {
    "minProfitBPS": 10,           // Minimum profit in basis points
    "maxTradeSizeUSD": 1000,      // Maximum trade size
    "checkIntervalMS": 5000,      // How often to check
    "dryRun": false,              // Log but don't execute
    "enabled": true,
    "pools": [
      {
        "poolSymbol": "XPRUSDC",
        "dexMarketSymbol": "XPR_XUSDC",
        "baseToken": "XPR",
        "quoteToken": "XUSDC",
        "enabled": true
      },
      {
        "poolSymbol": "XMTUSDC",
        "dexMarketSymbol": "XMT_XUSDC",
        "baseToken": "XMT",
        "quoteToken": "XUSDC",
        "enabled": true
      }
    ]
  }
}
```

### Usage

```typescript
import { AMMDEXArbitrageStrategy } from './strategies/amm-dex-arbitrage.js';

const arbitrage = new AMMDEXArbitrageStrategy();
await arbitrage.initialize({
  minProfitBPS: 10,
  maxTradeSizeUSD: 500,
  dryRun: true,  // Test mode
  pools: [
    {
      poolSymbol: 'XPRUSDC',
      dexMarketSymbol: 'XPR_XUSDC',
      baseToken: 'XPR',
      quoteToken: 'XUSDC',
      enabled: true
    }
  ]
});

// Run one cycle
await arbitrage.trade();

// Get statistics
const stats = arbitrage.getStats();
console.log(`Opportunities detected: ${stats.opportunitiesDetected}`);
console.log(`Opportunities executed: ${stats.opportunitiesExecuted}`);
console.log(`Total profit: $${stats.totalProfit.toFixed(2)}`);
```

---

## Claude AI Integration

### Location: `src/ai/`

Integration with Anthropic's Claude API for intelligent market analysis.

### Claude Client (`claude-client.ts`)

Wrapper around the Anthropic SDK with retry logic and rate limiting.

```typescript
import { claudeClient } from './ai/index.js';

// Initialize with API key
claudeClient.initialize(process.env.CLAUDE_API_KEY);

// Simple analysis
const response = await claudeClient.analyze(
  'What is the current sentiment for XPR based on recent price action?',
  'You are a cryptocurrency market analyst.'
);
console.log(response.content);

// JSON response
const analysis = await claudeClient.analyzeJSON<{
  sentiment: string;
  confidence: number;
}>('Analyze market sentiment and return JSON', systemPrompt);
console.log(analysis.sentiment);
```

### Market Analyzer (`market-analyzer.ts`)

High-level interface for AI-powered market analysis.

```typescript
import { marketAnalyzer } from './ai/index.js';

// Initialize
marketAnalyzer.initialize(process.env.CLAUDE_API_KEY);

// Analyze market conditions
const analysis = await marketAnalyzer.analyzeMarket('XPR_XUSDC');
console.log(`Condition: ${analysis.marketCondition}`);
console.log(`Sentiment: ${analysis.sentiment} (${analysis.sentimentScore})`);
console.log(`Volatility: ${analysis.volatilityLevel}`);
console.log(`Orderbook Imbalance: ${analysis.orderbookImbalance}`);
console.log(`Recommended Action: ${analysis.recommendedAction}`);
console.log(`Reasoning: ${analysis.reasoning}`);

// Get spread optimization
const spreadRec = await marketAnalyzer.optimizeSpread({
  symbol: 'XPR_XUSDC',
  currentSpreadBps: 50,
  volatilityHourly: 0.02,
  volatilityDaily: 0.05,
  averageTradeSize: 10000,
  bidAskImbalance: 0.2,
  positionSize: 50000,
  positionSide: 'LONG',
  targetProfitBps: 25
});
console.log(`Recommended Spread: ${spreadRec.recommendedSpreadBps} bps`);
console.log(`Bid Skew: ${spreadRec.bidSkewBps} bps`);
console.log(`Ask Skew: ${spreadRec.askSkewBps} bps`);

// Inventory recommendation
const invRec = await marketAnalyzer.analyzeInventory({
  symbol: 'XPR_XUSDC',
  baseBalance: 100000,
  quoteBalance: 1000,
  baseValueUSD: 500,
  quoteValueUSD: 1000,
  totalValueUSD: 1500,
  targetAllocation: 0.5,
  currentAllocation: 0.33,
  unrealizedPnL: 50,
  recentPriceChange: -2.5,
  marketTrend: 'DOWN'
});
console.log(`Action: ${invRec.action}`);
console.log(`Urgency: ${invRec.urgency}`);
console.log(`Skew Direction: ${invRec.skewDirection}`);
```

### Prompt Templates (`prompts.ts`)

Pre-built prompts for market analysis:

- `buildMarketAnalysisPrompt()` - Overall market condition analysis
- `buildSpreadOptimizationPrompt()` - Optimal spread calculation
- `buildInventoryPrompt()` - Inventory rebalancing recommendations
- `buildTradeDecisionPrompt()` - Trade approval/rejection
- `buildTradeReasoningPrompt()` - Human-readable trade explanations

---

## Claude Adaptive Market Maker

### Location: `src/strategies/claude-adaptive-mm.ts`

AI-driven market making strategy that dynamically adjusts parameters based on Claude's analysis.

### Features

- **Dynamic Spread Adjustment**: Widens spread in volatile conditions, tightens in calm markets
- **Sentiment-Aware Skewing**: Biases orders based on market sentiment
- **Inventory Management**: Automatically rebalances position to target allocation
- **Trade Reasoning Logs**: Human-readable explanations for every trade

### How It Works

1. **Analyze**: Calls Claude API to analyze current market conditions
2. **Optimize**: Gets spread and inventory recommendations from AI
3. **Calculate**: Computes order parameters (price, size, skew)
4. **Execute**: Places grid of buy/sell orders around mid-price
5. **Log**: Records trade reasoning for audit trail

### Configuration

```json
{
  "claude": {
    "model": "claude-sonnet-4-20250514",
    "analysisIntervalMS": 60000,
    "maxTokens": 1024,
    "temperature": 0.3,
    "enabled": true
  },
  "claudeAdaptiveMM": {
    "pairs": [
      {
        "symbol": "XPR_XUSDC",
        "bidAmountPerLevel": 10000,
        "baseSpreadBps": 50,
        "enabled": true
      }
    ],
    "analysisIntervalMS": 60000,
    "orderRefreshMS": 30000,
    "baseSpreadBps": 50,
    "targetInventoryRatio": 0.5,
    "maxPositionUSD": 10000,
    "gridLevels": 3,
    "enabled": true
  }
}
```

### Usage

```typescript
import { ClaudeAdaptiveMMStrategy } from './strategies/claude-adaptive-mm.js';

const adaptiveMM = new ClaudeAdaptiveMMStrategy();
await adaptiveMM.initialize({
  pairs: [
    {
      symbol: 'XPR_XUSDC',
      bidAmountPerLevel: 5000,
      baseSpreadBps: 40,
      enabled: true
    }
  ],
  analysisIntervalMS: 60000,
  gridLevels: 3,
  claudeApiKey: process.env.CLAUDE_API_KEY
});

// Run one cycle
await adaptiveMM.trade();

// Get pair states
const states = adaptiveMM.getPairStates();
for (const [symbol, state] of states) {
  console.log(`${symbol}:`);
  console.log(`  Current Spread: ${state.currentSpreadBps} bps`);
  console.log(`  Inventory Skew: ${state.inventorySkew}`);
  console.log(`  Last Analysis: ${state.lastAnalysis?.marketCondition}`);
}
```

### Example Trade Log

```
[2024-01-15 10:30:15] Analysis for XPR_XUSDC:
  Condition: TRENDING_UP, Sentiment: BULLISH
  Recommended spread: 35 bps
  Inventory action: SKEW_ASKS

[2024-01-15 10:30:16] Placing 6 orders for XPR_XUSDC
[2024-01-15 10:30:16] Trade reasoning: Placing BUY order at 0.00498 to
  capture upward momentum. Spread tightened due to low volatility and
  bullish orderbook imbalance. Bid side favored to reduce long exposure.
```

---

## Analytics & P&L Tracking

### Location: `src/analytics/`

Real-time performance tracking and reporting.

### P&L Calculator (`pnl.ts`)

Calculates comprehensive trading metrics.

```typescript
import { pnlCalculator } from './analytics/index.js';

// Calculate metrics
const metrics = pnlCalculator.calculateMetrics('gridBot', 'DAILY');
console.log(`Total P&L: $${metrics.totalPnl.toFixed(2)}`);
console.log(`Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
console.log(`Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
console.log(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
console.log(`Max Drawdown: $${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPercent.toFixed(1)}%)`);
console.log(`Total Volume: $${metrics.totalVolume.toFixed(2)}`);
console.log(`Total Fees: $${metrics.totalFees.toFixed(2)}`);

// Save daily snapshot
pnlCalculator.saveDailyPnL('gridBot', unrealizedPnl);

// Get history
const history = pnlCalculator.getDailyPnLHistory('gridBot', 30);

// Generate report
const report = pnlCalculator.generateReport('gridBot');
console.log(report);
```

### Available Metrics

| Metric | Description |
|--------|-------------|
| `totalPnl` | Total realized + unrealized P&L |
| `realizedPnl` | Profit/loss from closed trades |
| `unrealizedPnl` | Profit/loss from open positions |
| `winRate` | Percentage of winning trades |
| `avgWin` | Average profit on winning trades |
| `avgLoss` | Average loss on losing trades |
| `profitFactor` | Gross profit / Gross loss |
| `sharpeRatio` | Risk-adjusted return (annualized) |
| `maxDrawdown` | Largest peak-to-trough decline |
| `maxDrawdownPercent` | Max drawdown as percentage |
| `totalVolume` | Total trading volume |
| `totalFees` | Total fees paid |
| `largestWin` | Biggest single winning trade |
| `largestLoss` | Biggest single losing trade |

### Sample Report Output

```
=== Performance Report: gridBot ===

--- Today ---
Trades: 45
P&L: $127.50
Win Rate: 62.2%
Volume: $15,432.00

--- All Time ---
Total Trades: 1,234
Total P&L: $5,432.10
Win Rate: 58.3%
Avg Win: $12.50
Avg Loss: $8.75
Profit Factor: 1.43
Sharpe Ratio: 1.85
Max Drawdown: $450.00 (8.2%)
Total Volume: $523,456.00
Total Fees: $104.69
Largest Win: $85.00
Largest Loss: $62.00

Generated: 2024-01-15T10:30:00.000Z
```

---

## Multi-Strategy Orchestration

### Location: `src/index.ts`

The main entry point now supports running multiple strategies concurrently.

### Features

- **Concurrent Execution**: Run GridBot, MarketMaker, Arbitrage, and AI strategies together
- **Independent Risk**: Each strategy has its own risk tracking
- **Graceful Shutdown**: Saves state and cancels orders on exit
- **Infrastructure Integration**: Automatic database, risk, and analytics initialization

### Configuration

```json
{
  "strategies": [
    {
      "name": "gridBot",
      "enabled": true
    },
    {
      "name": "amm-dex-arbitrage",
      "enabled": true
    },
    {
      "name": "claude-adaptive-mm",
      "enabled": true
    }
  ]
}
```

### Execution Flow

```
1. Initialize Infrastructure
   ├── Database (SQLite)
   ├── Risk Management
   ├── AI Analyzer (if configured)
   ├── AMM Pool Monitor (if arbitrage enabled)
   └── DEX API

2. Initialize Strategies
   ├── Load enabled strategies from config
   ├── Initialize each with strategy-specific options
   └── Register with risk manager

3. Start Loops
   ├── Trade Loop (every tradeIntervalMS)
   │   ├── Check risk status for each strategy
   │   ├── Execute trade() for allowed strategies
   │   └── Record results
   ├── Analytics Loop (every 5 minutes)
   │   ├── Save P&L snapshots
   │   ├── Calculate metrics
   │   └── Save risk snapshots
   └── Slack Loop (every slackIntervalMS)
       └── Post balance/order updates

4. Shutdown (on SIGINT/SIGTERM)
   ├── Stop all strategies
   ├── Cancel open orders (if configured)
   ├── Save final analytics
   └── Close database
```

---

## Configuration

### Location: `config/default.json`

Full configuration schema with Zod validation.

### Complete Configuration Example

```json
{
  "bot": {
    "tradeIntervalMS": 10000,
    "slackIntervalMS": 1000000,
    "slackBotToken": "",
    "channelId": "",
    "cancelOpenOrdersOnExit": true,
    "gridPlacement": true,
    "strategy": "gridBot",
    "username": "your-proton-account",

    "rpc": {
      "privateKeyPermission": "active",
      "endpoints": [
        "https://rpc.api.mainnet.metalx.com"
      ],
      "apiRoot": "https://dex.api.mainnet.metalx.com/dex",
      "lightApiRoot": "https://lightapi.eosamsterdam.net/api"
    },

    "persistence": {
      "type": "sqlite",
      "path": "./data/dex-bot.db"
    },

    "risk": {
      "maxPositionUSD": 10000,
      "maxTotalExposureUSD": 50000,
      "maxPositionPercent": 20,
      "minOrderSizeUSD": 1,
      "maxOrdersPerMinute": 60,
      "maxDrawdownPercent": 5,
      "dailyLossLimitUSD": 1000,
      "consecutiveLossLimit": 10,
      "circuitBreakerEnabled": true,
      "cooldownMinutes": 60,
      "autoReset": false
    },

    "claude": {
      "model": "claude-sonnet-4-20250514",
      "analysisIntervalMS": 60000,
      "maxTokens": 1024,
      "temperature": 0.3,
      "enabled": true
    },

    "arbitrage": {
      "minProfitBPS": 10,
      "maxTradeSizeUSD": 1000,
      "checkIntervalMS": 5000,
      "dryRun": false,
      "enabled": true,
      "pools": [
        {
          "poolSymbol": "XPRUSDC",
          "dexMarketSymbol": "XPR_XUSDC",
          "baseToken": "XPR",
          "quoteToken": "XUSDC",
          "enabled": true
        }
      ]
    },

    "claudeAdaptiveMM": {
      "pairs": [
        {
          "symbol": "XPR_XUSDC",
          "bidAmountPerLevel": 10000,
          "baseSpreadBps": 50,
          "enabled": true
        }
      ],
      "analysisIntervalMS": 60000,
      "orderRefreshMS": 30000,
      "baseSpreadBps": 50,
      "targetInventoryRatio": 0.5,
      "maxPositionUSD": 10000,
      "gridLevels": 3,
      "enabled": true
    },

    "strategies": [
      { "name": "gridBot", "enabled": true },
      { "name": "amm-dex-arbitrage", "enabled": false },
      { "name": "claude-adaptive-mm", "enabled": false }
    ],

    "gridBot": {
      "pairs": [
        {
          "symbol": "XPR_XUSDC",
          "upperLimit": 0.006,
          "lowerLimit": 0.004,
          "gridLevels": 10,
          "bidAmountPerLevel": 5000
        }
      ]
    },

    "marketMaker": {
      "pairs": [
        {
          "symbol": "XPR_XUSDC",
          "gridLevels": 5,
          "gridInterval": 0.01,
          "base": "AVERAGE",
          "orderSide": "BOTH",
          "bidAmountPerLevel": 10000
        }
      ]
    }
  }
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Proton/XPR Network account with trading permissions
- Private key for the account
- (Optional) Claude API key for AI features

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/dex-bot.git
cd dex-bot

# Install dependencies
npm install --legacy-peer-deps

# Create data directory
mkdir -p data

# Copy and configure settings
cp config/default.json config/local.json
# Edit config/local.json with your settings
```

### Running

```bash
# Production (mainnet)
npm run bot

# Testnet
npm run bot:test

# With custom config
NODE_ENV=local npm run bot
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PROTON_USERNAME` | Your Proton account name | Yes |
| `PROTON_PRIVATE_KEY` | Private key for signing | Yes |
| `CLAUDE_API_KEY` | Anthropic API key for AI features | No |
| `NODE_ENV` | Config environment (default, test, local) | No |

### Example `.env` file

```bash
PROTON_USERNAME=myaccount
PROTON_PRIVATE_KEY=5K...
CLAUDE_API_KEY=sk-ant-...
```

---

## Testnet Configuration

For testing, use `npm run bot:test` or set `NODE_ENV=test`. This automatically uses:

- RPC: `https://rpc.api.testnet.metalx.com`
- API: `https://dex.api.testnet.metalx.com/dex`

---

## Safety Recommendations

1. **Start with DryRun**: Enable `arbitrage.dryRun: true` to test without executing
2. **Small Sizes**: Start with small `maxTradeSizeUSD` values
3. **Conservative Risk**: Use tight `maxDrawdownPercent` (2-5%)
4. **Monitor**: Watch the logs and database for unusual activity
5. **Testnet First**: Always test on testnet before mainnet
6. **Backup Keys**: Keep private keys secure and backed up

---

## Support

For issues and feature requests, please open an issue on GitHub.
