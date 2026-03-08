import {
  Contract,
  Table,
  TableStore,
  Singleton,
  Name,
  Asset,
  Symbol,
  check,
  requireAuth,
  hasAuth,
  currentTimeSec,
  print,
  InlineAction,
  PermissionLevel,
  ActionData,
  isAccount
} from 'proton-tsc';

// ============================================================================
// External balance reader (equivalent to proton-tsc/token getBalance)
// Reads the `accounts` table from any token contract
// ============================================================================

@table("accounts", noabigen)
class ExtTokenAccount extends Table {
  constructor(
    public balance: Asset = new Asset()
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.balance.symbol.code();
  }
}

function getBalance(tokenContract: Name, owner: Name, sym: Symbol): Asset {
  const acnts = new TableStore<ExtTokenAccount>(tokenContract, owner);
  const ac = acnts.requireGet(sym.code(), "no balance object found");
  return ac.balance;
}

// ============================================================================
// ATOMARB - Atomic Arbitrage Contract for XPR Network
// ============================================================================
// Supports configurable tokens, AMM pools, and DEX markets like noloss
// ============================================================================

// ============================================================================
// Default Constants (fallback if tables empty)
// ============================================================================
const AMM_CONTRACT = Name.fromString("proton.swaps");
const TREASURY_CONTRACT = Name.fromString("xmd.treasury");
const DEX_CONTRACT = Name.fromString("dex");

// ============================================================================
// Action Data Classes
// ============================================================================

@packer
class TransferArgs extends ActionData {
  constructor(
    public from: Name = new Name(),
    public to: Name = new Name(),
    public quantity: Asset = new Asset(),
    public memo: string = ""
  ) {
    super();
  }
}

@packer
class DepositArgs extends ActionData {
  constructor(
    public account: Name = new Name(),
    public amount: Asset = new Asset()
  ) {
    super();
  }
}

@packer
class PlaceOrderArgs extends ActionData {
  constructor(
    public account: Name = new Name(),
    public market_id: u64 = 0,
    public order_side: u8 = 0,
    public order_type: u8 = 0,
    public quantity: u64 = 0,
    public price: u64 = 0,
    public bid_symbol: Symbol = new Symbol(),
    public ask_symbol: Symbol = new Symbol(),
    public trigger_price: u64 = 0,
    public fill_type: u8 = 0,
    public referrer: Name = new Name()
  ) {
    super();
  }
}

@packer
class WithdrawArgs extends ActionData {
  constructor(
    public account: Name = new Name(),
    public amount: Asset = new Asset()
  ) {
    super();
  }
}

// ============================================================================
// Tables
// ============================================================================

/**
 * Token contract mapping (like noloss `contracts` table)
 * Maps token symbol to its contract account
 */
@table("tokenmap")
class TokenMap extends Table {
  constructor(
    public symbol_code: u64 = 0,  // Symbol code as u64
    public contract: Name = new Name(),
    public precision: u8 = 0
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.symbol_code;
  }
}

/**
 * AMM pool configuration (like noloss `pswap` table)
 */
@table("ammpool")
class AmmPool extends Table {
  constructor(
    public id: u64 = 0,
    public pool_symbol: string = "",  // e.g., "XPRUSDC"
    public base_symbol: u64 = 0,       // Symbol code
    public quote_symbol: u64 = 0,      // Symbol code
    public fee_bps: u64 = 20,          // 0.2% = 20 bps
    public enabled: boolean = true
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.id;
  }
}

/**
 * DEX market configuration (like noloss `adex` table)
 */
@table("dexmarket")
class DexMarket extends Table {
  constructor(
    public id: u64 = 0,
    public market_id: u64 = 0,         // MetalX DEX market ID
    public market_symbol: string = "", // e.g., "XPR_XMD"
    public base_symbol: u64 = 0,
    public quote_symbol: u64 = 0,
    public maker_fee_bps: u64 = 10,    // 0.1%
    public taker_fee_bps: u64 = 10,    // 0.1%
    public enabled: boolean = true
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.id;
  }
}

/**
 * Active arbitrage state
 */
@table("arbstate")
class ArbState extends Table {
  constructor(
    public user: Name = new Name(),
    public starting_balance: u64 = 0,
    public min_profit: u64 = 0,
    public route: u8 = 0,              // 1=AMM_TO_DEX, 2=DEX_TO_AMM
    public base_symbol: u64 = 0,       // Trading pair base (e.g., XPR)
    public quote_symbol: u64 = 0,      // Trading pair quote (e.g., XUSDC)
    public intermediate_symbol: u64 = 0, // Intermediate token (e.g., XMD)
    public started_at: u64 = 0
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.user.N;
  }
}

/**
 * Contract configuration
 */
@table("config", singleton)
class Config extends Table {
  constructor(
    public owner: Name = new Name(),
    public paused: boolean = false,
    public min_profit_bps: u64 = 5,
    public max_trade_usd: u64 = 100,
    public total_trades: u64 = 0,
    public total_profit: u64 = 0
  ) {
    super();
  }
}

/**
 * Authorized users
 */
@table("authorized")
class AuthorizedUser extends Table {
  constructor(
    public user: Name = new Name(),
    public added_at: u64 = 0
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.user.N;
  }
}

/**
 * Trade history
 */
@table("trades")
class TradeRecord extends Table {
  constructor(
    public id: u64 = 0,
    public user: Name = new Name(),
    public route: u8 = 0,
    public base_symbol: u64 = 0,
    public quote_symbol: u64 = 0,
    public input_amount: u64 = 0,
    public output_amount: u64 = 0,
    public profit: i64 = 0,
    public timestamp: u64 = 0
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.id;
  }
}

/**
 * Intermediate balance tracking (like noloss `beforelegone`)
 */
@table("legbalance")
class LegBalance extends Table {
  constructor(
    public user: Name = new Name(),
    public symbol_code: u64 = 0,
    public balance: u64 = 0,
    public leg: u8 = 0
  ) {
    super();
  }

  @primary
  get primary(): u64 {
    return this.user.N;
  }
}

// ============================================================================
// Contract
// ============================================================================

@contract
class AtomArb extends Contract {
  // Tables
  stateTable: TableStore<ArbState> = new TableStore<ArbState>(this.receiver);
  configSingleton: Singleton<Config> = new Singleton<Config>(this.receiver);
  authorizedTable: TableStore<AuthorizedUser> = new TableStore<AuthorizedUser>(this.receiver);
  tradesTable: TableStore<TradeRecord> = new TableStore<TradeRecord>(this.receiver);
  tokenMapTable: TableStore<TokenMap> = new TableStore<TokenMap>(this.receiver);
  ammPoolTable: TableStore<AmmPool> = new TableStore<AmmPool>(this.receiver);
  dexMarketTable: TableStore<DexMarket> = new TableStore<DexMarket>(this.receiver);
  legBalanceTable: TableStore<LegBalance> = new TableStore<LegBalance>(this.receiver);

  // ==========================================================================
  // Admin Actions
  // ==========================================================================

  /**
   * Initialize the contract
   * Note: Re-init will overwrite existing config (owner protected for safety)
   */
  @action("init")
  init(owner: Name): void {
    requireAuth(this.receiver);

    const existing = this.configSingleton.get();
    // If already initialized, require current owner's auth for security
    if (existing !== null && existing.owner.N != 0) {
      requireAuth(existing.owner);
    }
    check(isAccount(owner), "Owner account does not exist");

    const config = new Config(owner, false, 5, 100, 0, 0);
    this.configSingleton.set(config, this.receiver);

    // Add owner as authorized user
    const authUser = new AuthorizedUser(owner, currentTimeSec());
    this.authorizedTable.store(authUser, this.receiver);

    // Set up default token mappings
    this.setupDefaultTokens();
  }

  /**
   * Set up default token contracts
   */
  private setupDefaultTokens(): void {
    // XPR - 4 decimals - eosio.token
    const xprSymCode: u64 = 5197392; // "XPR" as symbol_code
    if (!this.tokenMapTable.exists(xprSymCode)) {
      const xpr = new TokenMap(xprSymCode, Name.fromString("eosio.token"), 4);
      this.tokenMapTable.store(xpr, this.receiver);
    }

    // XUSDC - 6 decimals - xtokens
    const xusdcSymCode: u64 = 1146312024; // "XUSDC" as symbol_code
    if (!this.tokenMapTable.exists(xusdcSymCode)) {
      const xusdc = new TokenMap(xusdcSymCode, Name.fromString("xtokens"), 6);
      this.tokenMapTable.store(xusdc, this.receiver);
    }

    // XMD - 6 decimals - xmd.token
    const xmdSymCode: u64 = 4476504; // "XMD" as symbol_code
    if (!this.tokenMapTable.exists(xmdSymCode)) {
      const xmd = new TokenMap(xmdSymCode, Name.fromString("xmd.token"), 6);
      this.tokenMapTable.store(xmd, this.receiver);
    }

    // XMT - 8 decimals - xtokens
    const xmtSymCode: u64 = 5525592; // "XMT" as symbol_code
    if (!this.tokenMapTable.exists(xmtSymCode)) {
      const xmt = new TokenMap(xmtSymCode, Name.fromString("xtokens"), 8);
      this.tokenMapTable.store(xmt, this.receiver);
    }
  }

  /**
   * Add a token mapping
   */
  @action("addtoken")
  addToken(symbol_str: string, contract: Name, precision: u8): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);

    // Convert symbol string to symbol_code
    const sym = new Symbol(symbol_str, precision);
    const symCode = sym.code();

    // Remove existing if present
    const existing = this.tokenMapTable.get(symCode);
    if (existing !== null) {
      this.tokenMapTable.remove(existing);
    }

    const token = new TokenMap(symCode, contract, precision);
    this.tokenMapTable.store(token, this.receiver);
  }

  /**
   * Add an AMM pool configuration
   */
  @action("addammpool")
  addAmmPool(
    pool_symbol: string,
    base_symbol: string,
    base_precision: u8,
    quote_symbol: string,
    quote_precision: u8,
    fee_bps: u64
  ): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);

    const baseSym = new Symbol(base_symbol, base_precision);
    const quoteSym = new Symbol(quote_symbol, quote_precision);

    const pool = new AmmPool(
      this.ammPoolTable.availablePrimaryKey,
      pool_symbol,
      baseSym.code(),
      quoteSym.code(),
      fee_bps,
      true
    );
    this.ammPoolTable.store(pool, this.receiver);
  }

  /**
   * Add a DEX market configuration
   */
  @action("adddexmkt")
  addDexMarket(
    market_id: u64,
    market_symbol: string,
    base_symbol: string,
    base_precision: u8,
    quote_symbol: string,
    quote_precision: u8,
    maker_fee_bps: u64,
    taker_fee_bps: u64
  ): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);

    const baseSym = new Symbol(base_symbol, base_precision);
    const quoteSym = new Symbol(quote_symbol, quote_precision);

    const market = new DexMarket(
      this.dexMarketTable.availablePrimaryKey,
      market_id,
      market_symbol,
      baseSym.code(),
      quoteSym.code(),
      maker_fee_bps,
      taker_fee_bps,
      true
    );
    this.dexMarketTable.store(market, this.receiver);
  }

  /**
   * Update configuration
   */
  @action("setconfig")
  setConfig(min_profit_bps: u64, max_trade_usd: u64, paused: boolean): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);

    config!.min_profit_bps = min_profit_bps;
    config!.max_trade_usd = max_trade_usd;
    config!.paused = paused;
    this.configSingleton.set(config!, this.receiver);
  }

  /**
   * Add authorized user
   */
  @action("addauth")
  addAuth(user: Name): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);
    check(isAccount(user), "Account does not exist");

    if (!this.authorizedTable.exists(user.N)) {
      const authUser = new AuthorizedUser(user, currentTimeSec());
      this.authorizedTable.store(authUser, this.receiver);
    }
  }

  /**
   * Remove authorized user
   */
  @action("rmauth")
  removeAuth(user: Name): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);

    const authUser = this.authorizedTable.get(user.N);
    if (authUser !== null) {
      this.authorizedTable.remove(authUser);
    }
  }

  // ==========================================================================
  // Balance Saving (like noloss savebalance)
  // ==========================================================================

  /**
   * Save starting balance before arbitrage
   * This is called at the start of any arbitrage route
   */
  @action("savebalance")
  saveBalance(
    user: Name,
    token_contract: Name,
    symbol_str: string,
    precision: u8,
    min_profit: Asset
  ): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    check(!config!.paused, "Contract is paused");

    const sym = new Symbol(symbol_str, precision);

    // Clean up any stale state
    const existingState = this.stateTable.get(user.N);
    if (existingState !== null) {
      this.stateTable.remove(existingState);
    }

    // Read ACTUAL starting balance from chain (trustless)
    const actualBalance = getBalance(token_contract, user, sym);

    const state = new ArbState(
      user,
      <u64>actualBalance.amount,
      <u64>min_profit.amount,
      0,  // Route set by next action
      sym.code(),
      0,  // Quote set by next action
      0,  // Intermediate set by next action
      currentTimeSec()
    );
    this.stateTable.store(state, this.receiver);
  }

  // ==========================================================================
  // Arbitrage Leg Actions (like noloss arblegone/arblegtwo)
  // ==========================================================================

  /**
   * Execute first arbitrage leg - transfer tokens with swap memo
   * Equivalent to noloss arblegone
   */
  @action("arblegone")
  arbLegOne(
    user: Name,
    buy_contract: Name,
    buy_from: Name,
    buy_memo: string,
    quantity: Asset,
    sell_contract: Name
  ): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    check(!config!.paused, "Contract is paused");

    // Execute the transfer
    new InlineAction<TransferArgs>("transfer")
      .act(sell_contract, new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, buy_from, quantity, buy_memo));
  }

  /**
   * Execute second arbitrage leg
   * Equivalent to noloss arblegtwo
   */
  @action("arblegtwo")
  arbLegTwo(
    user: Name,
    sell_contract: Name,
    sell_sym: string,
    sell_precision: u8,
    sell_to: Name,
    sell_memo: string,
    quantity: Asset
  ): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    // Execute the transfer
    new InlineAction<TransferArgs>("transfer")
      .act(sell_contract, new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, sell_to, quantity, sell_memo));
  }

  /**
   * Execute additional arbitrage leg
   * Equivalent to noloss arblegtwoadd
   */
  @action("arblegadd")
  arbLegAdd(
    user: Name,
    sell_contract: Name,
    quantity: Asset,
    sell_to: Name,
    sell_memo: string
  ): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    // Execute the transfer
    new InlineAction<TransferArgs>("transfer")
      .act(sell_contract, new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, sell_to, quantity, sell_memo));
  }

  // ==========================================================================
  // Specific Route Actions (convenience wrappers)
  // ==========================================================================

  /**
   * Start AMM-to-DEX arbitrage
   * XUSDC -> XPR (AMM) -> XMD (DEX) -> XUSDC (Treasury)
   * [SECURITY FIX H2: Prevent overwriting active state]
   * [SECURITY FIX H3: Enforce max trade size]
   * [SECURITY FIX C2: Added slippage protection via min_xpr_out]
   */
  @action("ammtodex")
  ammToDex(user: Name, amount: Asset, min_profit_bps: u64, min_xpr_out: Asset): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    check(!config!.paused, "Contract is paused");

    check(amount.symbol.code() == new Symbol("XUSDC", 6).code(), "Amount must be in XUSDC");
    check(amount.amount > 0, "Amount must be positive");
    check(min_xpr_out.symbol.code() == new Symbol("XPR", 4).code(), "Min output must be XPR");

    // [SECURITY FIX H3] Enforce max trade size
    const maxTradeRaw = config!.max_trade_usd * 1000000; // Convert to 6 decimal raw
    check(<u64>amount.amount <= maxTradeRaw, "Trade exceeds max_trade_usd limit");

    // [SECURITY FIX H2] Prevent overwriting active state
    const existingState = this.stateTable.get(user.N);
    check(existingState === null, "Complete or cancel existing arbitrage first");

    const effectiveMinProfitBps = min_profit_bps > config!.min_profit_bps
      ? min_profit_bps
      : config!.min_profit_bps;

    const minProfitAmount = (amount.amount * effectiveMinProfitBps) / 10000;

    const state = new ArbState(
      user,
      <u64>amount.amount,
      minProfitAmount,
      1, // AMM_TO_DEX
      new Symbol("XPR", 4).code(),
      new Symbol("XUSDC", 6).code(),
      new Symbol("XMD", 6).code(),
      currentTimeSec()
    );
    this.stateTable.store(state, this.receiver);

    // [SECURITY FIX C2] Swap XUSDC -> XPR on AMM with slippage protection
    const memo = "XPRUSDC," + min_xpr_out.toString();
    new InlineAction<TransferArgs>("transfer")
      .act(Name.fromString("xtokens"), new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, AMM_CONTRACT, amount, memo));
  }

  /**
   * Start DEX-to-AMM arbitrage
   * XUSDC -> XMD (Treasury) -> XPR (DEX) -> XUSDC (AMM)
   * [SECURITY FIX H2: Prevent overwriting active state]
   * [SECURITY FIX H3: Enforce max trade size]
   */
  @action("dextoamm")
  dexToAmm(user: Name, amount: Asset, min_profit_bps: u64): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    check(!config!.paused, "Contract is paused");

    check(amount.symbol.code() == new Symbol("XUSDC", 6).code(), "Amount must be in XUSDC");
    check(amount.amount > 0, "Amount must be positive");

    // [SECURITY FIX H3] Enforce max trade size
    const maxTradeRaw = config!.max_trade_usd * 1000000; // Convert to 6 decimal raw
    check(<u64>amount.amount <= maxTradeRaw, "Trade exceeds max_trade_usd limit");

    // [SECURITY FIX H2] Prevent overwriting active state
    const existingState = this.stateTable.get(user.N);
    check(existingState === null, "Complete or cancel existing arbitrage first");

    const effectiveMinProfitBps = min_profit_bps > config!.min_profit_bps
      ? min_profit_bps
      : config!.min_profit_bps;

    const minProfitAmount = (amount.amount * effectiveMinProfitBps) / 10000;

    const state = new ArbState(
      user,
      <u64>amount.amount,
      minProfitAmount,
      2, // DEX_TO_AMM
      new Symbol("XPR", 4).code(),
      new Symbol("XUSDC", 6).code(),
      new Symbol("XMD", 6).code(),
      currentTimeSec()
    );
    this.stateTable.store(state, this.receiver);

    // Mint XMD from XUSDC via Treasury
    new InlineAction<TransferArgs>("transfer")
      .act(Name.fromString("xtokens"), new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, TREASURY_CONTRACT, amount, "mint"));
  }

  /**
   * Redeem XMD for XUSDC via Treasury
   * [SECURITY FIX H1: Added authorization check]
   */
  @action("redeemxmd")
  redeemXmd(user: Name, xmd_amount: Asset): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");
    check(xmd_amount.symbol.code() == new Symbol("XMD", 6).code(), "Must be XMD");
    check(xmd_amount.amount > 0, "Amount must be positive");

    new InlineAction<TransferArgs>("transfer")
      .act(Name.fromString("xmd.token"), new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, TREASURY_CONTRACT, xmd_amount, "redeem,XUSDC"));
  }

  /**
   * Swap XPR to XUSDC on AMM
   * [SECURITY FIX H1: Added authorization check]
   * [SECURITY FIX C2: Added slippage protection via min_xusdc_out]
   */
  @action("swapxpr")
  swapXpr(user: Name, xpr_amount: Asset, min_xusdc_out: Asset): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");
    check(xpr_amount.symbol.code() == new Symbol("XPR", 4).code(), "Must be XPR");
    check(xpr_amount.amount > 0, "Amount must be positive");
    check(min_xusdc_out.symbol.code() == new Symbol("XUSDC", 6).code(), "Min output must be XUSDC");

    // Build memo with slippage protection
    const memo = "XPRUSDC," + min_xusdc_out.toString();

    new InlineAction<TransferArgs>("transfer")
      .act(Name.fromString("eosio.token"), new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, AMM_CONTRACT, xpr_amount, memo));
  }

  // ==========================================================================
  // DEX Order Actions
  // ==========================================================================

  /**
   * Deposit tokens to DEX
   */
  @action("dexdeposit")
  dexDeposit(user: Name, token_contract: Name, amount: Asset): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    new InlineAction<TransferArgs>("transfer")
      .act(token_contract, new PermissionLevel(user, Name.fromString("active")))
      .send(new TransferArgs(user, DEX_CONTRACT, amount, "deposit"));
  }

  /**
   * Place order on DEX
   */
  @action("dexorder")
  dexOrder(
    user: Name,
    market_id: u64,
    order_side: u8,
    order_type: u8,
    quantity: u64,
    price: u64,
    bid_symbol_str: string,
    bid_precision: u8,
    ask_symbol_str: string,
    ask_precision: u8
  ): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    const bidSym = new Symbol(bid_symbol_str, bid_precision);
    const askSym = new Symbol(ask_symbol_str, ask_precision);

    new InlineAction<PlaceOrderArgs>("placeorder")
      .act(DEX_CONTRACT, new PermissionLevel(user, Name.fromString("active")))
      .send(new PlaceOrderArgs(
        user,
        market_id,
        order_side,
        order_type,
        quantity,
        price,
        bidSym,
        askSym,
        0,  // trigger_price
        0,  // fill_type (0 = normal limit)
        new Name()  // no referrer
      ));
  }

  /**
   * Withdraw from DEX
   */
  @action("dexwithdraw")
  dexWithdraw(user: Name, amount: Asset): void {
    requireAuth(user);
    check(this.authorizedTable.exists(user.N), "User not authorized");

    new InlineAction<WithdrawArgs>("withdraw")
      .act(DEX_CONTRACT, new PermissionLevel(user, Name.fromString("active")))
      .send(new WithdrawArgs(user, amount));
  }

  // ==========================================================================
  // Verification (like noloss checkbalext)
  // ==========================================================================

  /**
   * Check balance and verify profit
   * Equivalent to noloss checkbalext - ASSERTS if profit not met
   * Reads actual on-chain balance and reverts entire tx if profit target not met
   */
  @action("checkbalext")
  checkBalExt(user: Name, token_contract: Name, symbol_str: string, precision: u8, message: string): void {
    requireAuth(user);

    const state = this.stateTable.requireGet(user.N, "No active arbitrage");
    const sym = new Symbol(symbol_str, precision);

    // Read ACTUAL current balance from chain
    const actualBalance = getBalance(token_contract, user, sym);
    const currentAmount = <u64>actualBalance.amount;

    // Calculate profit
    const profit = <i64>currentAmount - <i64>state.starting_balance;

    // CRITICAL: Assert profit requirement - reverts entire tx if not met
    check(
      profit >= <i64>state.min_profit,
      "checkbalext: " + message + " profit=" + profit.toString() + " required=" + state.min_profit.toString()
    );

    // Update stats
    const config = this.configSingleton.get()!;
    config.total_trades += 1;
    if (profit > 0) {
      config.total_profit += <u64>profit;
    }
    this.configSingleton.set(config, this.receiver);

    // Record trade
    const trade = new TradeRecord(
      this.tradesTable.availablePrimaryKey,
      user,
      state.route,
      state.base_symbol,
      state.quote_symbol,
      state.starting_balance,
      currentAmount,
      profit,
      currentTimeSec()
    );
    this.tradesTable.store(trade, this.receiver);

    // Clean up state
    this.stateTable.remove(state);

    print("checkbalext OK: " + message + " profit=" + profit.toString());
  }

  /**
   * Verify profit and complete arbitrage
   * This is the CRITICAL action that asserts profit requirement
   *
   * SECURITY NOTE (C1): This action trusts user-provided final_balance.
   * In proton-tsc, reading external contract tables (like token balances)
   * is complex. The noloss contract uses C++ get_balance() which is not
   * directly available in AssemblyScript.
   *
   * Mitigation: Since all actions in the transaction are atomic, if the
   * user lies about final_balance, they only corrupt their own trade stats.
   * There is no direct fund loss risk - the swaps either happened or reverted.
   * The bot should pass the actual balance it observes after swaps complete.
   *
   * Future improvement: Implement deferred balance check or use notification
   * handlers to track incoming transfers.
   */
  @action("verify")
  verify(user: Name, final_balance: u64): void {
    requireAuth(user);

    const state = this.stateTable.requireGet(user.N, "No active arbitrage");

    // Calculate profit
    const profit = <i64>final_balance - <i64>state.starting_balance;

    // CRITICAL: Assert profit requirement
    // If this fails, the ENTIRE transaction reverts!
    check(
      profit >= <i64>state.min_profit,
      "Arbitrage not profitable: profit=" + profit.toString() + " required=" + state.min_profit.toString()
    );

    // Update stats
    const config = this.configSingleton.get()!;
    config.total_trades += 1;
    if (profit > 0) {
      config.total_profit += <u64>profit;
    }
    this.configSingleton.set(config, this.receiver);

    // Record trade
    const trade = new TradeRecord(
      this.tradesTable.availablePrimaryKey,
      user,
      state.route,
      state.base_symbol,
      state.quote_symbol,
      state.starting_balance,
      final_balance,
      profit,
      currentTimeSec()
    );
    this.tradesTable.store(trade, this.receiver);

    // Clean up state
    this.stateTable.remove(state);

    print("Arbitrage successful! Profit: " + profit.toString());
  }

  /**
   * Cancel/cleanup a stuck arbitrage state
   */
  @action("cancel")
  cancel(user: Name): void {
    requireAuth(user);

    const state = this.stateTable.get(user.N);
    if (state !== null) {
      this.stateTable.remove(state);
    }

    const legBal = this.legBalanceTable.get(user.N);
    if (legBal !== null) {
      this.legBalanceTable.remove(legBal);
    }
  }

  /**
   * Clear all data (admin only, for testing)
   */
  @action("clear")
  clear(): void {
    const config = this.configSingleton.get();
    check(config !== null, "Not initialized");
    requireAuth(config!.owner);

    // Note: In production, implement proper table clearing
    print("Clear called - implement table clearing as needed");
  }

  /**
   * Emergency reset - clears config singleton to allow re-initialization
   * Only callable by contract account
   */
  @action("reset")
  reset(): void {
    requireAuth(this.receiver);

    // Clear config singleton if it exists
    const config = this.configSingleton.get();
    if (config !== null) {
      this.configSingleton.remove();
    }

    print("Config cleared - can now call init()");
  }

  // ==========================================================================
  // View helpers
  // ==========================================================================

  @action("checkstate")
  checkState(user: Name): void {
    const state = this.stateTable.get(user.N);
    if (state !== null) {
      print("User: " + state.user.toString());
      print("Starting: " + state.starting_balance.toString());
      print("Min profit: " + state.min_profit.toString());
      print("Route: " + state.route.toString());
    } else {
      print("No active arbitrage for user");
    }
  }
}
