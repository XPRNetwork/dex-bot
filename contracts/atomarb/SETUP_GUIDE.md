# AtomArb Setup Guide - Complete Deployment Instructions

## Overview

AtomArb is an atomic arbitrage smart contract for XPR Network that executes multi-leg trades in a single transaction. If any leg fails or profit isn't met, the entire transaction reverts - **guaranteeing no loss**.

## Comparison: AtomArb vs noloss

| Feature | noloss (jamestaggart) | AtomArb (ours) |
|---------|----------------------|----------------|
| Language | C++ (eosio.cdt) | AssemblyScript (proton-tsc) |
| Configuration | Tables for tokens, pools, DEX | Hardcoded initially, tables planned |
| Supported Tokens | 100+ tokens configured | XPR, XUSDC, XMD initially |
| Arbitrage Routes | Many (AMM, DEX, Treasury, Lending) | AMM ↔ DEX ↔ Treasury |
| Authorization | Implicit (user permission) | Explicit authorized users table |
| Trade History | `success` table | `trades` table with full details |
| Stats Tracking | Basic | Total trades, total profit |

### noloss Architecture (Reference)

**Tables:**
- `contracts` - Token symbol → contract name (e.g., XPR → eosio.token)
- `pswap` - AMM pool symbols (e.g., XPRUSDC, METAXPR)
- `adex` - DEX market IDs
- `data` - Active arbitrage state (balance, min_profit)
- `beforelegone` - Intermediate balance tracking
- `success` - Trade success records

**Actions:**
- `savebalance` - Record starting balance
- `arblegone` - First swap leg
- `arblegtwo` / `arblegtwoadd` - Additional swap legs
- `checkbalext` - **Verify profit and ASSERT** (reverts if not profitable)
- `trade` / `supertrade` - Entry points
- `sxsxlegone` / `sxsxsxlegone` - Multi-hop swap legs

### AtomArb Architecture

**Tables:**
- `config` - Contract configuration (owner, paused, limits)
- `authorized` - Authorized users list
- `arbstate` - Active arbitrage state
- `trades` - Complete trade history

**Actions:**
- `init` - Initialize contract with owner
- `addauth` / `rmauth` - Manage authorized users
- `setconfig` - Update configuration
- `ammtodex` - Start AMM→DEX arbitrage route
- `dextoamm` - Start DEX→AMM arbitrage route
- `sellxpr` / `redeemxmd` / `swapxpr` - Continuation actions
- `verify` - Verify profit and complete
- `cancel` - Cancel stuck arbitrage

---

## Account Setup Requirements

### 1. Create Contract Account

```bash
# Check if account name is available
proton account atomarb

# If not found, create it (requires existing account to pay)
# Option A: Via CLI (if you have proton CLI configured)
proton account:create atomarb

# Option B: Via resources portal
# Go to https://resources.xprnetwork.org and create account
```

**Account naming rules:**
- 1-12 characters
- Only a-z and 1-5
- No uppercase, no 0, 6-9
- Good names: `atomarb`, `atmarb`, `atomarb1`

### 2. Fund the Contract Account

The contract account needs RAM to store code and data:

```bash
# Check current RAM
proton account atomarb

# Buy RAM (need ~500KB for contract + tables)
proton ram:buy YOUR_ACCOUNT atomarb "50.0000 XPR"
```

Estimated RAM requirements:
- Contract code: ~200KB
- Config singleton: ~1KB
- Per authorized user: ~100 bytes
- Per active arbitrage: ~100 bytes
- Per trade record: ~100 bytes

### 3. Deploy the Contract

```bash
# Set network to mainnet
proton chain:set proton

# Or testnet for testing first
proton chain:set proton-test

# Build contract
cd contracts/atomarb
npm install
npm run build

# Deploy
proton contract:set atomarb ./assembly/target

# Enable inline actions (REQUIRED for contract to transfer tokens)
proton contract:enableinline atomarb
```

### 4. Initialize the Contract

```bash
proton action atomarb init '{"owner":"tradingbot"}' atomarb@active
```

Replace `tradingbot` with your main trading account.

### 5. Grant eosio.code Permission

**This is the critical step that allows the contract to transfer tokens on your behalf.**

```bash
# Get your current key
proton keys

# Update permission to include atomarb@eosio.code
proton permission tradingbot active \
  '{"threshold":1,"keys":[{"key":"YOUR_PUBLIC_KEY","weight":1}],"accounts":[{"permission":{"actor":"atomarb","permission":"eosio.code"},"weight":1}]}' \
  owner -p tradingbot@owner
```

**Example with actual key:**
```bash
proton permission tradingbot active \
  '{"threshold":1,"keys":[{"key":"PUB_K1_7abc123...","weight":1}],"accounts":[{"permission":{"actor":"atomarb","permission":"eosio.code"},"weight":1}]}' \
  owner -p tradingbot@owner
```

**What this does:**
- Allows `atomarb` contract (via `eosio.code` permission) to execute `transfer` actions on behalf of `tradingbot`
- This is safe because atomarb can ONLY do what it's programmed to do
- Your keys still have full control

### 6. Add Authorized Users

```bash
# Add yourself as authorized user
proton action atomarb addauth '{"user":"tradingbot"}' tradingbot@active

# Optionally add other authorized users
proton action atomarb addauth '{"user":"anotheraccount"}' tradingbot@active
```

---

## Usage

### Route 1: AMM to DEX (when DEX price > AMM price)

**Flow:** XUSDC → XPR (AMM) → XMD (DEX sell) → XUSDC (Treasury redeem)

```bash
# Step 1: Start the arbitrage (swaps XUSDC → XPR on AMM)
proton action atomarb ammtodex '{
  "user": "tradingbot",
  "amount": "50.000000 XUSDC",
  "min_profit_bps": 10
}' tradingbot@active

# Step 2: Sell XPR for XMD on DEX (after receiving XPR)
# This requires DEX integration - see Bot Integration section

# Step 3: Redeem XMD for XUSDC
proton action atomarb redeemxmd '{
  "user": "tradingbot",
  "xmd_amount": "50.123456 XMD"
}' tradingbot@active

# Step 4: Verify profit
proton action atomarb verify '{
  "user": "tradingbot",
  "final_balance": 50250000
}' tradingbot@active
```

### Route 2: DEX to AMM (when AMM price > DEX price)

**Flow:** XUSDC → XMD (Treasury mint) → XPR (DEX buy) → XUSDC (AMM swap)

```bash
# Step 1: Start the arbitrage (mints XMD from XUSDC)
proton action atomarb dextoamm '{
  "user": "tradingbot",
  "amount": "50.000000 XUSDC",
  "min_profit_bps": 10
}' tradingbot@active

# Step 2: Buy XPR with XMD on DEX (after receiving XMD)
# This requires DEX integration - see Bot Integration section

# Step 3: Swap XPR to XUSDC on AMM
proton action atomarb swapxpr '{
  "user": "tradingbot",
  "xpr_amount": "17000.0000 XPR"
}' tradingbot@active

# Step 4: Verify profit
proton action atomarb verify '{
  "user": "tradingbot",
  "final_balance": 50250000
}' tradingbot@active
```

### Cancel Stuck Arbitrage

If something goes wrong and you need to clear the state:

```bash
proton action atomarb cancel '{"user":"tradingbot"}' tradingbot@active
```

---

## Bot Integration

The atomic contract handles token transfers. The bot orchestrates the steps:

```typescript
// In your bot code
async function executeAtomicArbitrage(route: 'AMM_TO_DEX' | 'DEX_TO_AMM', amount: number) {
  if (route === 'AMM_TO_DEX') {
    // 1. Call ammtodex action (swaps XUSDC → XPR on AMM)
    await transact([{
      account: 'atomarb',
      name: 'ammtodex',
      data: {
        user: 'tradingbot',
        amount: `${amount.toFixed(6)} XUSDC`,
        min_profit_bps: 10
      },
      authorization: [{ actor: 'tradingbot', permission: 'active' }]
    }]);

    // 2. Get XPR balance, place DEX order, wait for fill
    // ... DEX integration ...

    // 3. Call redeemxmd action (redeems XMD → XUSDC)
    // 4. Call verify action with final balance
  }
}
```

### Full Atomic Transaction (Advanced)

For true atomicity, you can bundle multiple actions in one transaction:

```typescript
await transact([
  // Action 1: Record balance and swap XUSDC → XPR on AMM
  {
    account: 'atomarb',
    name: 'ammtodex',
    data: { user: 'tradingbot', amount: '50.000000 XUSDC', min_profit_bps: 10 },
    authorization: [{ actor: 'tradingbot', permission: 'active' }]
  },
  // Action 2: Place DEX order (this needs DEX integration)
  {
    account: 'dex',
    name: 'placeorder',
    data: { /* order params */ },
    authorization: [{ actor: 'tradingbot', permission: 'active' }]
  },
  // Action 3: Process/fill the DEX order
  {
    account: 'dex',
    name: 'process',
    data: { /* process params */ },
    authorization: [{ actor: 'tradingbot', permission: 'active' }]
  },
  // Action 4: Withdraw from DEX
  // Action 5: Redeem XMD
  // Action 6: Verify profit
  {
    account: 'atomarb',
    name: 'verify',
    data: { user: 'tradingbot', final_balance: 50250000 },
    authorization: [{ actor: 'tradingbot', permission: 'active' }]
  }
]);
```

**If verify fails (profit not met), the ENTIRE transaction reverts!**

---

## Viewing Contract State

```bash
# View config
proton table atomarb atomarb config

# View authorized users
proton table atomarb atomarb authorized

# View active arbitrage states
proton table atomarb atomarb arbstate

# View trade history
proton table atomarb atomarb trades
```

---

## Admin Actions

```bash
# Update configuration
proton action atomarb setconfig '{
  "min_profit_bps": 10,
  "max_trade_usd": 500,
  "paused": false
}' tradingbot@active

# Pause trading
proton action atomarb setconfig '{
  "min_profit_bps": 10,
  "max_trade_usd": 500,
  "paused": true
}' tradingbot@active

# Remove authorized user
proton action atomarb rmauth '{"user":"badactor"}' tradingbot@active
```

---

## Security Checklist

- [ ] Contract deployed to correct account
- [ ] `enableinline` permission set on contract
- [ ] `eosio.code` permission granted to contract
- [ ] Only trusted users in authorized table
- [ ] Tested on testnet first
- [ ] Reasonable `max_trade_usd` limit set
- [ ] Can pause trading if needed

---

## Differences from noloss

| Aspect | noloss | AtomArb |
|--------|--------|---------|
| **Token Config** | Dynamic `contracts` table | Hardcoded (XPR, XUSDC, XMD) |
| **Pool Config** | Dynamic `pswap` table | Hardcoded XPRUSDC pool |
| **Authorization** | Anyone with permission | Explicit `authorized` table |
| **Profit Check** | `checkbalext` with message | `verify` with final balance |
| **Stats** | `success` table (sparse) | Full `trades` table |

### Future Enhancements

To match noloss flexibility, we can add:
1. `tokencontracts` table - Map symbols to contracts
2. `ammpools` table - Configure AMM pools
3. `dexmarkets` table - Configure DEX market IDs
4. Multi-leg support via `addleg` action

---

## Troubleshooting

### "Not authorized"
- User not in `authorized` table
- Run `addauth` action

### "Contract is paused"
- Contract is paused
- Run `setconfig` with `paused: false`

### "Arbitrage not profitable"
- Final balance didn't meet min_profit requirement
- Transaction will have reverted - no funds lost!

### "No active arbitrage"
- No state stored for user
- Need to call `ammtodex` or `dextoamm` first

### "Already initialized"
- Contract already initialized
- This is expected, contract is ready

### Transaction fails with no error
- Check RAM - contract account may need more
- Check permissions - `eosio.code` may not be set

---

## Quick Reference

| Action | Purpose | Auth |
|--------|---------|------|
| `init` | Initialize contract | Contract |
| `setconfig` | Update limits/pause | Owner |
| `addauth` | Add authorized user | Owner |
| `rmauth` | Remove authorized user | Owner |
| `ammtodex` | Start AMM→DEX route | Authorized user |
| `dextoamm` | Start DEX→AMM route | Authorized user |
| `sellxpr` | Sell XPR on DEX (route 1) | User |
| `redeemxmd` | Redeem XMD → XUSDC | User |
| `swapxpr` | Swap XPR → XUSDC on AMM | User |
| `verify` | Verify profit, complete | User |
| `cancel` | Cancel stuck arbitrage | User |
| `checkstate` | View arbitrage state | Anyone |
