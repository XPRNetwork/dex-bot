# Atomic Arbitrage Smart Contract Design

## Analysis of `noloss` Contract

### How It Works

The `noloss` contract executes multi-leg arbitrage trades **atomically** - all swaps happen in a single transaction. If any step fails or profit target isn't met, the entire transaction reverts.

### Transaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SINGLE ATOMIC TRANSACTION                     │
├─────────────────────────────────────────────────────────────────┤
│  1. trade(user, unique)        → Entry point                    │
│  2. savebalance(XMD, 0)        → Record starting: 24564.28 XMD  │
│  3. arblegone(XMD→dex,"XPR")   → Buy XPR on DEX with XMD        │
│  4. arblegtwoadd(XPR→AMM)      → Swap XPR → XUSDC on AMM        │
│  5. arblegtwo(XUSDC→treasury)  → Mint XMD from XUSDC            │
│  6. checkbalext(XMD)           → ASSERT: balance > 24564.28     │
│                                                                  │
│  If checkbalext fails → ALL ACTIONS REVERT (no loss!)           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Actions Analyzed

#### `savebalance`
```cpp
// Stores starting balance in RAM
ACTION savebalance(name user, name contract, symbol_code sym, asset min_profit) {
    // Get current balance from token contract
    asset balance = get_balance(contract, user, sym);

    // Store in data table
    data_table.emplace(user, [&](auto& row) {
        row.user = user;
        row.balance = balance;
        row.min_profit = min_profit;
    });
}
```

#### `arblegone` (First Leg)
```cpp
ACTION arblegone(
    name user,
    name buy_contract,      // Token contract to receive
    name buy_from,          // Where to send funds (DEX, AMM, treasury)
    string buy_memo,        // Swap instructions
    asset quantity,         // How much to spend
    name sell_contract,     // Token contract to spend from
    symbol_code sell_sym    // Symbol to spend
) {
    // Transfer tokens to destination with memo
    action(
        permission_level{get_self(), "active"_n},
        sell_contract,
        "transfer"_n,
        std::make_tuple(user, buy_from, quantity, buy_memo)
    ).send();
}
```

#### `checkbalext` (Verify Profit)
```cpp
ACTION checkbalext(name user, name contract, symbol_code sym, string message) {
    // Get current balance
    asset current = get_balance(contract, user, sym);

    // Get stored starting balance
    auto& stored = data_table.get(user.value);

    // CRITICAL: Assert profit requirement
    check(current >= stored.balance + stored.min_profit,
          "Arbitrage not profitable: " + message);

    // Clean up
    data_table.erase(stored);
}
```

### Observed Trade Patterns

#### Pattern 1: DEX → AMM → Treasury
```
XMD → XPR (DEX buy)
XPR → XUSDC (AMM swap)
XUSDC → XMD (Treasury mint)
```

#### Pattern 2: Treasury → AMM → DEX
```
XMD → XUSDC (Treasury redeem)
XUSDC → XPR (AMM swap)
XPR → XMD (DEX sell)
```

#### Pattern 3: Multi-hop AMM (METAL triangle)
```
XMD → METAL (AMM: METAXMD pool)
METAL → XPR (AMM: METAXPR pool)
XPR → XUSDC (AMM: XPRUSDC pool)
XUSDC → XMD (Treasury mint)
```

### Contract Tables

| Table | Purpose |
|-------|---------|
| `data` | Store user's starting balance and min_profit |
| `contracts` | Map token symbols to contract names |
| `beforelegone` | Intermediate balance tracking |
| `success` | Track successful trades (stats) |

---

## Our Contract Design: `atomarb`

### Simplified Architecture

We need a simpler contract focused on our specific use case:
- Triangle arbitrage: AMM ↔ DEX ↔ Treasury
- Single base token (XPR initially)
- Clear profit verification

### Proposed Actions

```cpp
// Entry point - starts atomic arbitrage
ACTION execute(
    name user,
    asset start_balance,      // Starting XUSDC/XMD amount
    uint8_t path,             // 1=AMM_TO_DEX, 2=DEX_TO_AMM
    asset trade_amount,       // How much to trade
    uint64_t min_profit_bps   // Minimum profit in basis points
);

// Internal: Execute AMM swap
ACTION ammswap(
    name user,
    name from_contract,
    asset quantity,
    string pool_memo          // e.g., "XPRUSDC,1"
);

// Internal: Execute DEX order
ACTION dexorder(
    name user,
    uint64_t market_id,
    uint8_t order_side,       // 1=buy, 2=sell
    asset quantity,
    uint64_t price
);

// Internal: Treasury mint/redeem
ACTION treasury(
    name user,
    asset quantity,
    string action             // "mint" or "redeem,XUSDC"
);

// Final: Verify profit and complete
ACTION verify(
    name user,
    name token_contract,
    symbol_code sym,
    asset min_expected
);
```

### Path 1: AMM_TO_DEX (Buy AMM, Sell DEX)

```
execute(user, 50 XUSDC, AMM_TO_DEX, 17000 XPR, 50 BPS)
  │
  ├─► ammswap(XUSDC → proton.swaps, "XPRUSDC,1")
  │     └─► Receive ~17000 XPR
  │
  ├─► dexorder(XPR_XMD, SELL, 17000 XPR, market_price)
  │     └─► Receive ~50.25 XMD
  │
  ├─► treasury(50.25 XMD, "redeem,XUSDC")
  │     └─► Receive 50.25 XUSDC
  │
  └─► verify(XUSDC >= 50.00 + 0.25)
        └─► SUCCESS or REVERT
```

### Path 2: DEX_TO_AMM (Buy DEX, Sell AMM)

```
execute(user, 50 XUSDC, DEX_TO_AMM, 17000 XPR, 50 BPS)
  │
  ├─► treasury(50 XUSDC, "mint")
  │     └─► Receive 50 XMD
  │
  ├─► dexorder(XPR_XMD, BUY, 50 XMD worth of XPR, market_price)
  │     └─► Receive ~17000 XPR
  │
  ├─► ammswap(XPR → proton.swaps, "XPRUSDC,1")
  │     └─► Receive ~50.25 XUSDC
  │
  └─► verify(XUSDC >= 50.00 + 0.25)
        └─► SUCCESS or REVERT
```

---

## Implementation Plan

### File Structure

```
contracts/
├── atomarb/
│   ├── atomarb.cpp          # Main contract implementation
│   ├── atomarb.hpp          # Header with structs and tables
│   ├── atomarb.abi          # Generated ABI
│   └── atomarb.wasm         # Compiled WebAssembly
├── build.sh                  # Build script
└── deploy.sh                 # Deployment script
```

### Dependencies

- EOSIO CDT (Contract Development Toolkit) v3.0+
- Proton CLI for deployment

### Key Implementation Details

#### 1. Inline Actions
All swaps must be inline actions that execute within the same transaction:

```cpp
void atomarb::send_transfer(name from, name to, asset quantity, string memo, name contract) {
    action(
        permission_level{from, "active"_n},
        contract,
        "transfer"_n,
        std::make_tuple(from, to, quantity, memo)
    ).send();
}
```

#### 2. Balance Tracking
Store balances in RAM table during execution:

```cpp
TABLE balances {
    name user;
    asset starting_balance;
    asset min_profit;
    uint64_t primary_key() const { return user.value; }
};
typedef multi_index<"balances"_n, balances> balances_table;
```

#### 3. Profit Verification
Critical assertion at the end:

```cpp
void atomarb::verify(name user, name contract, symbol_code sym, asset min_expected) {
    asset current = get_balance(contract, user, sym);
    check(current >= min_expected, "Arbitrage failed: insufficient profit");
}
```

#### 4. Handling Token Receipts
Use `on_notify` to handle incoming token transfers:

```cpp
[[eosio::on_notify("*::transfer")]]
void atomarb::on_transfer(name from, name to, asset quantity, string memo) {
    if (to != get_self()) return;
    // Track received tokens
}
```

---

## Advantages Over Current Bot

| Current Bot | Atomic Contract |
|-------------|-----------------|
| 3 separate transactions | 1 atomic transaction |
| Can fail mid-trade | All-or-nothing execution |
| Slippage between legs | No slippage risk |
| ~6 seconds total | ~0.5 seconds (1 block) |
| Can get stuck with tokens | Never stuck |

---

## Deployment Steps

1. **Create contract account**: `atomarb` or similar
2. **Set permissions**: Contract needs `active` permission to send tokens on behalf of user
3. **Deploy WASM**: Upload compiled contract
4. **Set ABI**: Upload ABI for action parsing
5. **Grant permissions**: User grants `atomarb@active` permission to transfer tokens

---

## Security Considerations

1. **Authorization**: Only authorized users can call execute()
2. **Reentrancy**: Use mutex/flag to prevent reentrancy
3. **Integer overflow**: Use safe math for calculations
4. **Permission scope**: Minimize permissions needed
5. **Slippage protection**: Verify amounts at each step

---

## Next Steps

1. Write C++ contract code
2. Test on testnet
3. Audit for security
4. Deploy to mainnet
5. Integrate with bot for opportunity detection
