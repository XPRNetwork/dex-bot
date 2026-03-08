# dexbot

An institutional-grade trading bot for the MetalX.com DEX on XPR Network. Features automated arbitrage, launch sniping, and multi-strategy execution.

## Active Strategies

| Strategy | File | Description |
|----------|------|-------------|
| **Launch Sniper** | `src/strategies/launch-sniper.ts` | Auto-buy new simplelaunch tokens, momentum exit, graduation dump |
| **SimpleDEX Arbitrage** | `src/strategies/simpledex-arbitrage.ts` | Triangle arbs on SimpleDEX pools + SDEX↔MetalX DEX atomic arbs |
| **Multi-Hop Arbitrage** | `src/strategies/multi-hop-arbitrage.ts` | LOAN/METAL bridge paths between AMM, DEX, Treasury |
| **Cross-Venue Arbitrage** | `src/strategies/cross-venue-arbitrage.ts` | AMM vs DEX price arbitrage |
| **Competitor Tracker** | `src/monitoring/competitor-tracker.ts` | Monitors other arb bots (wwworker, andrew4.gm) |

## Quick Start

```bash
npm install --legacy-peer-deps

export PROTON_USERNAME=your-account
export PROTON_PRIVATE_KEY=PVT_K1_your-key
export TELEGRAM_BOT_TOKEN=...     # Optional
export TELEGRAM_CHAT_ID=...       # Optional

npm run bot
```

---

## Launch Sniper (`src/strategies/launch-sniper.ts`)

Automatically buys new tokens on [simplelaunch](https://dex.protonnz.com) bonding curves and sells for profit.

### How It Works

1. **Discovery** (2s loop): Monitors `simplelaunch` contract for new curve deployments
2. **Buy**: Sends XPR to `simplelaunch` with memo `buy:CURVE_ID:MIN_TOKENS_OUT`
3. **Anti-snipe retry**: Creator-only period is 60s — retries every 500ms until allowed
4. **Monitor** (5s loop): Watches price via bonding curve math, triggers sells
5. **Graduation**: When curve graduates to SimpleDEX, claims tokens and optionally dumps

### Sell Strategy (2-Lot + Moonbag)

| Stage | Trigger | Action |
|-------|---------|--------|
| **Momentum exit (Lot 1)** | 2.2x within 30min | Sell 40%, min hold 30s |
| **Sell target (Lot 2)** | 2.5x | Sell 40% |
| **Sell target 2** | 5.0x | Sell 15% |
| **Moonbag** | Never | Keep remaining ~5% forever |

Splitting into 2 lots reduces price impact on the bonding curve — lot 2 gets a better price.

### Graduation Handling

When a token graduates from bonding curve to SimpleDEX:
- **If we already took profit** (momentum exit done): **Keep moonbag**, just claim tokens
- **If we never sold**: Claim and dump everything on SimpleDEX for XPR

### Key Config (`config/mainnet.json`)

```json
{
  "launchSniper": {
    "enabled": true,
    "buyAmountXPR": 4444,
    "buyDelaySeconds": 0,
    "checkIntervalMs": 2000,
    "maxEntryXpr": 5000,
    "maxConcurrentPositions": 10,
    "sellTargets": [
      { "percentToSell": 40, "priceMultiple": 2.5 },
      { "percentToSell": 15, "priceMultiple": 5.0 }
    ],
    "momentumExit": {
      "enabled": true,
      "minPriceMultiple": 2.2,
      "maxAgeSeconds": 1800,
      "percentToSell": 40,
      "minHoldSeconds": 30
    },
    "stopLoss": { "enabled": false, "priceMultiple": 0.5 },
    "dryRun": false,
    "indexerUrl": "https://indexer.protonnz.com"
  }
}
```

### Bonding Curve Math

```typescript
// Buy: how many tokens for X XPR
xprAfterFee = xprAmount * 0.99;  // 1% buy fee
tokensOut = (virtualTokens * xprAfterFee) / (virtualXpr + xprAfterFee);

// Price: current XPR per token
currentPrice = virtualXpr / virtualTokens;

// Price multiple: how much has it pumped
priceMultiple = currentPrice / entryPriceXprPerToken;
```

### Key Contracts

| Contract | Purpose |
|----------|---------|
| `simplelaunch` | Bonding curve (buy/sell before graduation) |
| `simpletoken` | Token balances (after graduation) |
| `simpledex` | DEX pools (after graduation, swap via transfer with memo) |

### Swap Memos

```
Buy on curve:  transfer XPR → simplelaunch, memo "buy:CURVE_ID:MIN_TOKENS_OUT"
Sell on curve: simplelaunch::sell(seller, tokenId, tokenAmount, minXpr)
Dump on DEX:   transfer tokens → simpledex, memo "swap:POOL_ID:0:0"
```

### Database Table

```sql
-- src/persistence/models/launch-sniper.model.ts
CREATE TABLE launch_sniper_positions (
  curve_id INTEGER PRIMARY KEY,
  symbol TEXT, token_contract TEXT, precision_val INTEGER,
  tokens_held TEXT, original_tokens_bought TEXT,
  entry_price REAL, buy_executed_at INTEGER,
  status TEXT,  -- waiting|bought|partial_sold|fully_sold|stopped_out|graduated
  sell_targets_hit TEXT,  -- JSON array of booleans
  momentum_exit_done INTEGER DEFAULT 0
);
```

### Architecture: Split Tick Loops

Discovery (new launches + buys) runs on a **fast 2s loop**. Position monitoring (sells) runs on a **separate 5s loop**. Discovery is never blocked by slow RPC calls from monitoring.

### Competitor: andrew4.gm

| Metric | Value |
|--------|-------|
| Median sell multiple | ~1.6x |
| Hold time | 2-24 minutes |
| Buy size | 3,000-12,000 XPR |
| Strategy | Quick flip, sells at 1.5-1.8x |

### Lessons Learned

- **Speed is everything** — even 5 seconds late means worse entry price
- **Anti-snipe retry at 500ms** is critical — the 60s creator-only window is the bottleneck
- **Graduation dump must preserve moonbag** — check `momentumExitDone` before dumping
- **Late-buy scaling disabled** — creators self-buy during anti-snipe, inflating thresholds
- **2-lot sells beat single dump** — less price impact, lot 2 gets better price
- **Post-trade balance check needs delay** — 1.5s after claim TX for chain state to update

---

## New in v2.1: Order Sniping & Fill Simulation (Jan 2026)

The bot now features intelligent order sniping with precise fill simulation:

| Feature | Description |
|---------|-------------|
| **Order Sniping** | Detects mispriced orders on DEX and sizes trades exactly to match them |
| **Full Precision Orderbook** | Uses 0.000001 price precision to see individual orders |
| **Fill Simulation** | Simulates orderbook fills before trading to predict actual execution price |
| **Slippage Protection** | Only executes if simulated fill remains profitable after slippage |
| **Status Logging** | Logs market state every 30s showing opportunities vs required thresholds |

### How Order Sniping Works

```
Example:
AMM price: $0.002895
DEX has bid at $0.003100 for 8,000 XPR (7% premium!)

Bot snipes:
1. Buy exactly 8,000 XPR from AMM: $23.16
2. Sell exactly 8,000 XPR on DEX at $0.003100: $24.80
3. After 0.3% fees: ~$1.40 profit
```

Instead of using a fixed trade size and walking through multiple price levels (causing slippage), the bot:
1. Scans every orderbook level for mispriced orders
2. Calculates exact profit for each order
3. Sizes the trade precisely to match the profitable order
4. Executes a clean fill at the target price

### Status Logging

The bot logs market state every 30 seconds:
```
📊 Snipe scan: AMM=$0.002882 | Best bid=$0.002871 (-38 BPS) need>0.002920 | Best ask=$0.002894 (-41 BPS) need<0.002845
```

When opportunities are found:
```
🎯 Found 2 snipe opportunities:
  AMM_TO_DEX: 5000 XPR @ $0.003100 = +150.3 BPS ($0.75)
```

---

## New in v2.0: Institutional-Grade Upgrade

This release transforms the bot into an enterprise-ready trading platform. See **[WHATSNEW.md](./WHATSNEW.md)** for complete documentation.

### New Features

| Feature | Description |
|---------|-------------|
| **SQLite Persistence** | Full order/trade history with audit trail |
| **Risk Management** | Position limits, circuit breakers, exposure monitoring |
| **AMM-DEX Arbitrage** | Automated arbitrage between proton.swaps and MetalX DEX |
| **Claude AI Integration** | AI-powered market analysis and adaptive decision making |
| **Adaptive Market Maker** | Dynamic spread adjustment based on market conditions |
| **P&L Analytics** | Real-time performance tracking with Sharpe ratio, drawdown |
| **Multi-Strategy** | Run multiple strategies concurrently |

### Quick Start (New Features)

```bash
# Install dependencies (includes new packages)
npm install --legacy-peer-deps

# Set environment variables
export PROTON_USERNAME=your-account
export PROTON_PRIVATE_KEY=your-key
export CLAUDE_API_KEY=sk-ant-...  # Optional, for AI features

# Run with new strategies
npm run bot
```

### New Strategies

- **`amm-dex-arbitrage`** - Exploits price differences between AMM pools and DEX orderbook
- **`claude-adaptive-mm`** - AI-driven market making with dynamic spread optimization

### Configuration (New Sections)

```json
{
  "bot": {
    "strategy": "claude-adaptive-mm",
    "strategies": [
      { "name": "amm-dex-arbitrage", "enabled": true },
      { "name": "claude-adaptive-mm", "enabled": true }
    ],
    "persistence": { "type": "sqlite", "path": "./data/dex-bot.db" },
    "risk": { "maxDrawdownPercent": 5, "dailyLossLimitUSD": 1000 },
    "claude": { "enabled": true, "analysisIntervalMS": 60000 },
    "arbitrage": { "minProfitBPS": 10, "enabled": true }
  }
}
```

---

## Original Features

This is the code for both market maker and grid trading bot strategies against the MetalX.com DEX
### API and docs information
  Website: https://metalx.com. 

  App: https://app.metalx.com
  
  Docs: https://docs.metalx.com. 
  
  API Reference: https://docs.metalx.com/dex/what-is-metal-x
  
[![ESLint SAST scan workflow](https://github.com/squdgy/dexbot/actions/workflows/eslint.yml/badge.svg?event=push)](https://github.com/squdgy/dexbot/security/code-scanning)

![Tests](https://github.com/squdgy/dexbot/actions/workflows/test.js.yml/badge.svg?event=push)

GRID BOT:
  Grid Trading Bots are programs that allow users to automatically buy at low and sell at high within a pre-set price range. When one sell order is fully executed, the Grid Trading Bot places a buy order in next round based on timeinterval set in tool at a lower grid level, and vice versa. The Grid Trading strategy might perform best in volatile markets, making profits through a series of orders as token’s price fluctuates.
  
  Working Model:
    Bot automatically buys low and sells high based on the parameters you have set.
    
    Example:
      "symbol": "XBTC_XMD",
      "upperLimit": 23000,
      "lowerLimit": 21000,
      "gridLevels": 10,
      "bidAmountPerLevel": 0.0001

    Above setting would set 10 grid levels with each grid size i.e. (23300 - 23100)/10 = 200
    Note: The orders closet to the sale price would be elimiated on placing Initial orders.

Market Maker BOT:
 This bot works against multiple markets to place orders based on levels defined in settings. The purpose of the market making strategy is to put buy and sell orders on the DEX' order books. This strategy doesn’t care about which way the market’s going. The strategy places a ladder of sells at regular intervals above base price, and another ladder of buys beneath it. Use this as a reference and implement yor own trading algorithm.

The bots has been tested on the mainnet with different pairs like XPR_XUSDC, XPR_XMD, and XETH_XMD etc. A new market can always be added under pairs section and restart bot to take effect.

NOTE: Cancelling orders - Script called `cancel-orders-mainnet.js` and `cancel-orders-testnet.js` are available to cancel either market specific or all open orders by the user.

NOTE: User balance and open orders can be integrated to slack channel on running gridbot based periodic intervals. Options slackBotToken and channelId needs to be updated in the config file. Slack bot token can be created by following the documentation at https://api.slack.com/authentication/basics and make sure that invite app into the slack channel

## Getting Started

### prerequisites
- an XPR Network account (You can use WebAuth.com from the app store or online [WebAuth.com](https://wauth.co)
- enough funds in your account to buy and/or sell in the market that you want to trade in

### run the code
1. `npm install`
1. Add your account name and private key to environment variables, eg
```
Mac and Linux:
export PROTON_USERNAME=user1
export PROTON_PRIVATE_KEY=private_key

Windows using powershell:
$env:PROTON_USERNAME = 'user1'
$env:PROTON_PRIVATE_KEY = 'private_key'
```
1. edit config/default.json to use the market you would like to trade in (symbol value)
1. `npm run bot`
1. To run on testnet: `npm run bot:test` (windows - `$env:NODE_ENV = 'test'` and `npm run bot`)

## config params
config/default.json has other config values you can change
```
{
  "bot" : {
    // how often to attempt trade
    "tradeIntervalMS": "5000",

    // Slack bot token eg: xoxb-5672345689032-4846869117232-1clJ35VeuI2y3F1oczinKKHm
    "slackBotToken": "",
    // This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID for the slack bot
    "channelId" = '';

    // set to true in order to cancel all open orders when the bot shuts down
    "cancelOpenOrdersOnExit": false,

    // Enable this to true if you want to place orders always one level above/below depends on buy/sell order for the executed orders 
    "gridPlacement": true,

    // strategy to be applied, marketmaker or gridbot
    "strategy": "gridBot",
    "marketMaker": {
      // represents pairs(markets ids) for the market maker strategy
      "pairs": [
          // symbol: market to trade in

          // gridLevels: how many buy and how many sell orders to put on the books

          // gridInterval: interval(price step or spread between each grid level 0.01 = 1%)

          // base: base for start price to place order - AVERAGE: avg of highestBid and lowestAsk, BID: highestBid price
          //                                       ASK: lowestAsk price, LAST: last price traded

          // orderSide: orderSide represents whether to place gird orders for BOTH(BUY and SELL) or BUY or SELL
          // Options are "BOTH", "BUY", "SELL"
        {
          "symbol": "XPR_XMD",
          "gridLevels": 3,
          "gridInterval": 0.01,
          "base": "BID"
          "orderSide": "BUY"
        },
        {
          "symbol": "XETH_XMD",
          "gridLevels": 2,
          "gridInterval": 0.01,
          "base": "LAST"
          "orderSide": "SELL"
        }
      ]
    },
    // represents pairs(markets ids) for the gridbot strategy
   "gridBot": {
      "pairs": [
        // symbol: market to trade in
        // upperLimit: represents price - upper limit of the trading range
        // lowerLimit: represents price - upper limit of the trading range
        // gridLevels: number of orders to keep
        // bidAmountPerLevel: Amount to bid/ask per each level
        {
          "symbol": "XPR_XMD",
          "upperLimit": 0.0019,
          "lowerLimit": 0.0016,
          "gridLevels": 10,
          "bidAmountPerLevel": 800.00
        },
        {
          "symbol": "XBTC_XMD",
          "upperLimit": 23000,
          "lowerLimit": 21000,
          "gridLevels": 10,
          "bidAmountPerLevel": 0.00006
        }   
      ]
    },
    // permissions on the key ex. active or owner
    "privateKeyPermission": "active"
    "rpc": {

      // endpoints for RPC API
      "endpoints" : [
        "https://rpc.api.mainnet.metalx.com"
      ],

      // api for readonly dex api
      "apiRoot": "https://dex.api.mainnet.metalx.com/dex",

      // api for readonly proton api
      "lightApiRoot": "https://lightapi.eosamsterdam.net/api"
    }
  }
}
```

## Below actions used in this bot code base

### Markets
- **fetchLatestPrice** - retrieves the latest price for a given symbol
```
    const price = await fetchLatestPrice('XPR_XUSDC');
    logger.info(price);
```
- **fetchMarkets** - retrieves all markets that exist on metalx trading
```
    const response = await fetchMarkets();
    logger.info(response);
```
- **fetchOrderBook** - retrieves order book data for a single market
```
    const response = await fetchOrderBook('XBTC_XUSDC', 100, 0.01);
    logger.info(response);
```
- **fetchTrades** - retrieves trades on the given market
```
    const response = await fetchTrades('XPR_XUSDC', 100, 0);
    logger.info(response);
```

### Orders
- **cancelOrder** - cancel a single order
```
    const orderId = 966550;
    cancelOrder(orderId);
```
- **cancelAllOrders** - cancel all orders for a given user
```
    cancelAllOrders();
```
- **fetchOpenOrders** - retrieve all open orders for a given user
```
    const response = await fetchOpenOrders(username);
    logger.info(response);
```
- **fetchOrderHistory** - retrieves order history for a given user
```
    const response = await fetchOrderHistory('metallicus', 20, 0);
    logger.info(response);
```
- **prepareLimitOrder** - submit a buy or sell limit order to the dex in postonly mode (ensure it is a maker trade)
```
    // place an order to sell XPR into USDC
    const quantity = 570;
    const price = 0.002020;
    prepareLimitOrder('XPR_XUSDC', ORDERSIDES.SELL, quantity, price);
```

### Accounts
- **fetchBalances** - retrieves all balances for a given user
```    
    const response = await fetchBalances('metallicus');
    logger.info(response);
```

### coding references
- basics for a simple limit order placement, including signing: [https://docs.metalx.com/developers-dex/examples/submit-dex-order](https://docs.metalx.com/developers-dex/examples/submit-dex-order)
- instructions on finding your private key: https://help.xprnetwork.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
- actions available on the DEX contract: https://docs.metalx.com/developers-dex/smart-contract/actions
- general documentation on interacting with XPR Network contracts: https://docs.xprnetwork.org/
- base version imported from https://github.com/squdgy/dexbot
