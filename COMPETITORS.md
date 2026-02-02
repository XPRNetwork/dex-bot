# Competitor Tracking

This bot monitors other arbitrageurs on the XPR Network to understand market competition and optimize our trading thresholds.

## How It Works

The competitor tracker polls the Hyperion API every 10 seconds looking for:

1. **AMM Swaps** - Transfers to `proton.swaps` with pool memo
2. **DEX Orders** - `placeorder` actions on the `dex` contract
3. **Treasury Operations** - Mints/redeems on `xmd.treasury`

When it detects an account doing an AMM+DEX combo trade within a 2-minute window, it:
- Calculates their estimated profit
- Sends a Telegram alert
- Saves to the database for analysis

## Database Tables

### `competitor_arbs`
Individual competitor arbitrage trades.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| account | TEXT | XPR Network account name |
| arb_type | TEXT | AMM_TO_DEX, DEX_TO_AMM, or TRIANGLE |
| token | TEXT | Token being arbitraged (XPR, METAL, etc.) |
| input_amount | REAL | Amount spent |
| output_amount | REAL | Amount received |
| profit_usd | REAL | Estimated profit in USD |
| profit_percent | REAL | Profit as percentage |
| trx_ids | TEXT | Comma-separated transaction IDs |
| detected_at | DATETIME | When the arb was detected |

### `competitor_stats`
Aggregated statistics by account and time period.

| Column | Type | Description |
|--------|------|-------------|
| account | TEXT | XPR Network account name |
| period | TEXT | HOURLY, DAILY, WEEKLY, ALL_TIME |
| total_arbs | INTEGER | Number of arbs in period |
| total_profit_usd | REAL | Total profit |
| avg_profit_usd | REAL | Average profit per arb |
| max_profit_usd | REAL | Largest single arb |
| preferred_path | TEXT | Most used arb path |
| last_seen | DATETIME | Last activity |

## Database Queries

### View Recent Competitor Arbs
```sql
SELECT account, arb_type, profit_usd, detected_at
FROM competitor_arbs
ORDER BY detected_at DESC
LIMIT 20;
```

### Top Competitors by Profit
```sql
SELECT
  account,
  COUNT(*) as total_arbs,
  SUM(profit_usd) as total_profit,
  AVG(profit_usd) as avg_profit,
  MAX(profit_usd) as max_profit
FROM competitor_arbs
GROUP BY account
ORDER BY total_profit DESC
LIMIT 10;
```

### Profit by Hour
```sql
SELECT
  strftime('%Y-%m-%d %H:00', detected_at) as hour,
  COUNT(*) as arbs,
  SUM(profit_usd) as total_profit,
  COUNT(DISTINCT account) as unique_traders
FROM competitor_arbs
GROUP BY hour
ORDER BY hour DESC
LIMIT 24;
```

### Most Active Arbitrage Paths
```sql
SELECT
  arb_type,
  COUNT(*) as count,
  SUM(profit_usd) as total_profit,
  AVG(profit_usd) as avg_profit
FROM competitor_arbs
GROUP BY arb_type
ORDER BY total_profit DESC;
```

### Competitor Activity by Day of Week
```sql
SELECT
  strftime('%w', detected_at) as day_of_week,
  COUNT(*) as arbs,
  SUM(profit_usd) as profit
FROM competitor_arbs
GROUP BY day_of_week
ORDER BY day_of_week;
```

### Find Whales (Large Profit Arbs)
```sql
SELECT *
FROM competitor_arbs
WHERE profit_usd > 1.0
ORDER BY profit_usd DESC
LIMIT 20;
```

## CLI Queries

```bash
# Quick stats
sqlite3 ./data/dex-bot-mainnet.db "SELECT COUNT(*) as arbs, SUM(profit_usd) as profit FROM competitor_arbs;"

# Top 5 competitors
sqlite3 ./data/dex-bot-mainnet.db "SELECT account, COUNT(*) as arbs, printf('%.2f', SUM(profit_usd)) as profit FROM competitor_arbs GROUP BY account ORDER BY SUM(profit_usd) DESC LIMIT 5;"

# Last 10 arbs
sqlite3 ./data/dex-bot-mainnet.db "SELECT account, arb_type, printf('%.2f', profit_usd) as profit, detected_at FROM competitor_arbs ORDER BY detected_at DESC LIMIT 10;"

# Hourly summary
sqlite3 ./data/dex-bot-mainnet.db "SELECT strftime('%H:00', detected_at) as hour, COUNT(*) as arbs, printf('%.2f', SUM(profit_usd)) as profit FROM competitor_arbs GROUP BY hour ORDER BY hour;"
```

## API Methods

The `competitorTracker` singleton provides these methods:

```typescript
import { competitorTracker } from './monitoring/competitor-tracker.js';

// Get top competitors
const stats = competitorTracker.getCompetitorStats();
// Returns: [{ account, totalArbs, totalProfit, avgProfit, lastSeen }, ...]

// Get recent arbs
const recent = competitorTracker.getRecentArbs(20);
// Returns: DetectedArb[]

// Get summary for time period
const summary = competitorTracker.getProfitSummary(24); // last 24 hours
// Returns: { totalArbs, totalProfit, uniqueAccounts, topAccount }
```

## Telegram Alerts

When a competitor arb is detected, you'll receive:

```
🔍 COMPETITOR ARB DETECTED

Account: sometrader
Type: AMM_TO_DEX
Token: XPR
Profit: +$0.35 (1.40%)
Time: 3:45:22 PM

TxIDs: a1b2c3d4, e5f6g7h8...
```

## Ignored Accounts

The tracker ignores these accounts:
- Our own account (`tradingbot`)
- System contracts: `proton.swaps`, `dex`, `xmd.treasury`, `eosio.token`, `xtokens`, `xmd.token`, `loan.token`, `fees.swaps`

## Insights

Use competitor data to:

1. **Optimize Thresholds** - If competitors are profiting at 30 BPS, maybe our 75 BPS threshold is too conservative
2. **Identify Peak Times** - When are arb opportunities most frequent?
3. **Find New Paths** - Are competitors using paths we haven't implemented?
4. **Gauge Competition** - How many active arb bots are there?

## Limitations

- Profit estimates are approximate (based on token quantities, not exact exchange rates)
- Only detects arbs within 2-minute windows
- May miss complex multi-transaction arbs
- Relies on Hyperion API availability
