# AtomArb - Atomic Arbitrage Smart Contract

Executes multi-leg arbitrage trades **atomically** on XPR Network. All swaps happen in a single transaction - if any step fails or profit target isn't met, everything reverts.

## Features

- **Atomic execution** - All-or-nothing trades, no partial fills
- **Profit verification** - Transaction reverts if minimum profit not achieved
- **Configurable tokens** - Dynamic token contract mappings (like noloss)
- **Configurable AMM pools** - Support any proton.swaps pool
- **Configurable DEX markets** - Support any MetalX DEX market
- **Multi-leg support** - Chain multiple swaps together
- **Authorization system** - Only approved users can execute
- **Trade history** - All trades recorded on-chain with full details
- **Admin controls** - Pause, limits, configuration

## Comparison with noloss

| Feature | noloss | AtomArb |
|---------|--------|---------|
| Language | C++ | AssemblyScript |
| Token mappings | `contracts` table | `tokenmap` table |
| AMM pools | `pswap` table | `ammpool` table |
| DEX markets | `adex` table | `dexmarket` table |
| Leg actions | arblegone/arblegtwo | arblegone/arblegtwo/arblegadd |
| Balance check | checkbalext | checkbalext + verify |
| DEX support | Limited | Full deposit/order/withdraw |
| Authorization | Implicit | Explicit authorized table |
| Stats | Basic success table | Full trade history |

## Build

```bash
cd contracts/atomarb
npm install
npm run build
```

Output in `assembly/target/`:
- `atomarb.contract.wasm` - WebAssembly bytecode
- `atomarb.contract.abi` - Contract ABI

## Quick Start

```bash
# 1. Deploy contract (see SETUP_GUIDE.md for full details)
proton contract:set atomarb ./assembly/target
proton contract:enableinline atomarb

# 2. Initialize
proton action atomarb init '{"owner":"tradingbot"}' atomarb@active

# 3. Grant eosio.code permission to your trading account
proton permission tradingbot active \
  '{"threshold":1,"keys":[{"key":"YOUR_KEY","weight":1}],"accounts":[{"permission":{"actor":"atomarb","permission":"eosio.code"},"weight":1}]}' \
  owner -p tradingbot@owner

# 4. Execute arbitrage!
proton action atomarb ammtodex '{"user":"tradingbot","amount":"50.000000 XUSDC","min_profit_bps":10}' tradingbot@active
```

## Contract Actions

### Admin Actions

| Action | Description | Auth |
|--------|-------------|------|
| `init` | Initialize contract | Contract |
| `setconfig` | Update limits/pause | Owner |
| `addauth` | Add authorized user | Owner |
| `rmauth` | Remove authorized user | Owner |
| `addtoken` | Add token contract mapping | Owner |
| `addammpool` | Add AMM pool config | Owner |
| `adddexmkt` | Add DEX market config | Owner |
| `clear` | Clear all data (testing) | Owner |

### Arbitrage Actions

| Action | Description | Auth |
|--------|-------------|------|
| `savebalance` | Record starting balance | Authorized |
| `arblegone` | Execute first swap leg | Authorized |
| `arblegtwo` | Execute second swap leg | Authorized |
| `arblegadd` | Execute additional swap leg | Authorized |
| `checkbalext` | Check balance (no assert) | User |
| `verify` | **Verify profit and ASSERT** | User |
| `cancel` | Cancel stuck arbitrage | User |

### Convenience Actions (XPR/XUSDC/XMD)

| Action | Description | Auth |
|--------|-------------|------|
| `ammtodex` | Start AMM→DEX route | Authorized |
| `dextoamm` | Start DEX→AMM route | Authorized |
| `redeemxmd` | Redeem XMD → XUSDC | User |
| `swapxpr` | Swap XPR → XUSDC on AMM | User |

### DEX Actions

| Action | Description | Auth |
|--------|-------------|------|
| `dexdeposit` | Deposit tokens to DEX | Authorized |
| `dexorder` | Place order on DEX | Authorized |
| `dexwithdraw` | Withdraw from DEX | Authorized |

## Tables

| Table | Description |
|-------|-------------|
| `config` | Contract configuration (singleton) |
| `authorized` | Authorized users list |
| `tokenmap` | Token symbol → contract mappings |
| `ammpool` | AMM pool configurations |
| `dexmarket` | DEX market configurations |
| `arbstate` | Active arbitrage state |
| `legbalance` | Intermediate balance tracking |
| `trades` | Complete trade history |

## Arbitrage Routes

### Route 1: AMM_TO_DEX (when DEX price > AMM price)

```
XUSDC → XPR (AMM swap) → XMD (DEX sell) → XUSDC (Treasury redeem)
```

```bash
# Single action that initiates the route
proton action atomarb ammtodex '{
  "user": "tradingbot",
  "amount": "50.000000 XUSDC",
  "min_profit_bps": 10
}' tradingbot@active
```

### Route 2: DEX_TO_AMM (when AMM price > DEX price)

```
XUSDC → XMD (Treasury mint) → XPR (DEX buy) → XUSDC (AMM swap)
```

```bash
proton action atomarb dextoamm '{
  "user": "tradingbot",
  "amount": "50.000000 XUSDC",
  "min_profit_bps": 10
}' tradingbot@active
```

### Generic Multi-Leg (like noloss)

For maximum flexibility, use the generic leg actions:

```bash
# 1. Save starting balance
proton action atomarb savebalance '{
  "user": "tradingbot",
  "token_contract": "xmd.token",
  "symbol_str": "XMD",
  "precision": 6,
  "min_profit": "0.010000 XMD"
}' tradingbot@active

# 2. First leg: XMD → XPR on DEX
proton action atomarb arblegone '{
  "user": "tradingbot",
  "buy_contract": "eosio.token",
  "buy_from": "dex",
  "buy_memo": "...",
  "quantity": "50.000000 XMD",
  "sell_contract": "xmd.token"
}' tradingbot@active

# 3. Second leg: XPR → XUSDC on AMM
proton action atomarb arblegtwo '{
  "user": "tradingbot",
  "sell_contract": "eosio.token",
  "sell_sym": "XPR",
  "sell_precision": 4,
  "sell_to": "proton.swaps",
  "sell_memo": "XPRUSDC,1",
  "quantity": "17000.0000 XPR"
}' tradingbot@active

# 4. Third leg: XUSDC → XMD via Treasury
proton action atomarb arblegadd '{
  "user": "tradingbot",
  "sell_contract": "xtokens",
  "quantity": "50.150000 XUSDC",
  "sell_to": "xmd.treasury",
  "sell_memo": "mint"
}' tradingbot@active

# 5. Verify profit (CRITICAL - reverts if not profitable!)
proton action atomarb verify '{
  "user": "tradingbot",
  "final_balance": 50150000
}' tradingbot@active
```

## Configuration

### Add Token Mapping

```bash
proton action atomarb addtoken '{
  "symbol_str": "METAL",
  "contract": "xtokens",
  "precision": 8
}' tradingbot@active
```

### Add AMM Pool

```bash
proton action atomarb addammpool '{
  "pool_symbol": "METAXPR",
  "base_symbol": "XMT",
  "base_precision": 8,
  "quote_symbol": "XPR",
  "quote_precision": 4,
  "fee_bps": 20
}' tradingbot@active
```

### Add DEX Market

```bash
proton action atomarb adddexmkt '{
  "market_id": 9,
  "market_symbol": "XPR_XMT",
  "base_symbol": "XPR",
  "base_precision": 4,
  "quote_symbol": "XMT",
  "quote_precision": 8,
  "maker_fee_bps": 10,
  "taker_fee_bps": 10
}' tradingbot@active
```

## Viewing State

```bash
# Config
proton table atomarb atomarb config

# Authorized users
proton table atomarb atomarb authorized

# Token mappings
proton table atomarb atomarb tokenmap

# AMM pools
proton table atomarb atomarb ammpool

# DEX markets
proton table atomarb atomarb dexmarket

# Active arbitrages
proton table atomarb atomarb arbstate

# Trade history
proton table atomarb atomarb trades
```

## Security

1. **eosio.code permission** - Required for contract to transfer on your behalf
2. **Authorized users** - Only approved accounts can execute
3. **Profit verification** - Automatic revert if not profitable
4. **Pause capability** - Owner can halt all trading
5. **Configurable limits** - Max trade size enforcement
6. **Full audit trail** - All trades recorded on-chain

## How Atomicity Works

```
┌──────────────────────────────────────────────────────────────┐
│                   SINGLE TRANSACTION                          │
├──────────────────────────────────────────────────────────────┤
│  1. ammtodex()     → Record balance, swap XUSDC→XPR on AMM   │
│  2. [DEX ops]      → Sell XPR for XMD on DEX                 │
│  3. redeemxmd()    → Redeem XMD for XUSDC                    │
│  4. verify()       → CHECK: XUSDC balance >= start + profit  │
│                                                               │
│  If verify() fails → ENTIRE TRANSACTION REVERTS              │
│                   → No tokens lost, no state changed         │
└──────────────────────────────────────────────────────────────┘
```

## Testing

1. Deploy to testnet first: `proton chain:set proton-test`
2. Use small amounts ($1-5)
3. Test both routes
4. Test failure cases (verify that revert works)
5. Check trade history table

## See Also

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Complete deployment instructions
- [../ATOMIC_ARB_DESIGN.md](../ATOMIC_ARB_DESIGN.md) - Design document
