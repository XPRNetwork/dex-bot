import * as _chain from "as-chain";
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



class ExtTokenAccountDB extends _chain.MultiIndex<ExtTokenAccount> {

}

@table("accounts", noabigen, nocodegen)

class ExtTokenAccount implements _chain.MultiIndexValue {
    
  constructor(
    public balance: Asset = new Asset()
  ) {
    
  }

  @primary
  get primary(): u64 {
    return this.balance.symbol.code();
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.balance);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Asset();
            dec.unpack(obj);
            this.balance = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.balance.getSize();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x32114D4F38000000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return ExtTokenAccount.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return ExtTokenAccount.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): ExtTokenAccountDB {
        return new ExtTokenAccountDB(code, scope, this.tableName, this.tableIndexes(code, scope));
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
const AMM_CONTRACT = Name.fromU64(0xADE99A4C18E1AB80);
const TREASURY_CONTRACT = Name.fromU64(0xEC920CDD46C6AFE0);
const DEX_CONTRACT = Name.fromU64(0x4ABA000000000000);

// ============================================================================
// Action Data Classes
// ============================================================================


@packer(nocodegen)
class TransferArgs implements _chain.Packer {
    
  constructor(
    public from: Name = new Name(),
    public to: Name = new Name(),
    public quantity: Asset = new Asset(),
    public memo: string = ""
  ) {
    
  }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.from);
        enc.pack(this.to);
        enc.pack(this.quantity);
        enc.packString(this.memo);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.from = obj;
        }
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.to = obj;
        }
        
        {
            let obj = new Asset();
            dec.unpack(obj);
            this.quantity = obj;
        }
        this.memo = dec.unpackString();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.from.getSize();
        size += this.to.getSize();
        size += this.quantity.getSize();
        size += _chain.Utils.calcPackedStringLength(this.memo);
        return size;
    }
}


@packer(nocodegen)
class DepositArgs implements _chain.Packer {
    
  constructor(
    public account: Name = new Name(),
    public amount: Asset = new Asset()
  ) {
    
  }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.account);
        enc.pack(this.amount);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.account = obj;
        }
        
        {
            let obj = new Asset();
            dec.unpack(obj);
            this.amount = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.account.getSize();
        size += this.amount.getSize();
        return size;
    }
}


@packer(nocodegen)
class PlaceOrderArgs implements _chain.Packer {
    
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
    
  }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.account);
        enc.packNumber<u64>(this.market_id);
        enc.packNumber<u8>(this.order_side);
        enc.packNumber<u8>(this.order_type);
        enc.packNumber<u64>(this.quantity);
        enc.packNumber<u64>(this.price);
        enc.pack(this.bid_symbol);
        enc.pack(this.ask_symbol);
        enc.packNumber<u64>(this.trigger_price);
        enc.packNumber<u8>(this.fill_type);
        enc.pack(this.referrer);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.account = obj;
        }
        this.market_id = dec.unpackNumber<u64>();
        this.order_side = dec.unpackNumber<u8>();
        this.order_type = dec.unpackNumber<u8>();
        this.quantity = dec.unpackNumber<u64>();
        this.price = dec.unpackNumber<u64>();
        
        {
            let obj = new Symbol();
            dec.unpack(obj);
            this.bid_symbol = obj;
        }
        
        {
            let obj = new Symbol();
            dec.unpack(obj);
            this.ask_symbol = obj;
        }
        this.trigger_price = dec.unpackNumber<u64>();
        this.fill_type = dec.unpackNumber<u8>();
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.referrer = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.account.getSize();
        size += sizeof<u64>();
        size += sizeof<u8>();
        size += sizeof<u8>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += this.bid_symbol.getSize();
        size += this.ask_symbol.getSize();
        size += sizeof<u64>();
        size += sizeof<u8>();
        size += this.referrer.getSize();
        return size;
    }
}


@packer(nocodegen)
class WithdrawArgs implements _chain.Packer {
    
  constructor(
    public account: Name = new Name(),
    public amount: Asset = new Asset()
  ) {
    
  }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.account);
        enc.pack(this.amount);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.account = obj;
        }
        
        {
            let obj = new Asset();
            dec.unpack(obj);
            this.amount = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.account.getSize();
        size += this.amount.getSize();
        return size;
    }
}

// ============================================================================
// Tables
// ============================================================================

/**
 * Token contract mapping (like noloss `contracts` table)
 * Maps token symbol to its contract account
 */


class TokenMapDB extends _chain.MultiIndex<TokenMap> {

}

@table("tokenmap", nocodegen)

class TokenMap implements _chain.MultiIndexValue {
    
  constructor(
    public symbol_code: u64 = 0,  // Symbol code as u64
    public contract: Name = new Name(),
    public precision: u8 = 0
  ) {
    
  }

  @primary
  get primary(): u64 {
    return this.symbol_code;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u64>(this.symbol_code);
        enc.pack(this.contract);
        enc.packNumber<u8>(this.precision);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.symbol_code = dec.unpackNumber<u64>();
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.contract = obj;
        }
        this.precision = dec.unpackNumber<u8>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u64>();
        size += this.contract.getSize();
        size += sizeof<u8>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0xCD20A9C8D5000000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return TokenMap.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return TokenMap.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): TokenMapDB {
        return new TokenMapDB(code, scope, this.tableName, this.tableIndexes(code, scope));
    }
}

/**
 * AMM pool configuration (like noloss `pswap` table)
 */


class AmmPoolDB extends _chain.MultiIndex<AmmPool> {

}

@table("ammpool", nocodegen)

class AmmPool implements _chain.MultiIndexValue {
    
  constructor(
    public id: u64 = 0,
    public pool_symbol: string = "",  // e.g., "XPRUSDC"
    public base_symbol: u64 = 0,       // Symbol code
    public quote_symbol: u64 = 0,      // Symbol code
    public fee_bps: u64 = 20,          // 0.2% = 20 bps
    public enabled: boolean = true
  ) {
    
  }

  @primary
  get primary(): u64 {
    return this.id;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u64>(this.id);
        enc.packString(this.pool_symbol);
        enc.packNumber<u64>(this.base_symbol);
        enc.packNumber<u64>(this.quote_symbol);
        enc.packNumber<u64>(this.fee_bps);
        enc.packNumber<boolean>(this.enabled);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.id = dec.unpackNumber<u64>();
        this.pool_symbol = dec.unpackString();
        this.base_symbol = dec.unpackNumber<u64>();
        this.quote_symbol = dec.unpackNumber<u64>();
        this.fee_bps = dec.unpackNumber<u64>();
        this.enabled = dec.unpackNumber<boolean>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u64>();
        size += _chain.Utils.calcPackedStringLength(this.pool_symbol);
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<boolean>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x34A55A5220000000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return AmmPool.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return AmmPool.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): AmmPoolDB {
        return new AmmPoolDB(code, scope, this.tableName, this.tableIndexes(code, scope));
    }
}

/**
 * DEX market configuration (like noloss `adex` table)
 */


class DexMarketDB extends _chain.MultiIndex<DexMarket> {

}

@table("dexmarket", nocodegen)

class DexMarket implements _chain.MultiIndexValue {
    
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
    
  }

  @primary
  get primary(): u64 {
    return this.id;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u64>(this.id);
        enc.packNumber<u64>(this.market_id);
        enc.packString(this.market_symbol);
        enc.packNumber<u64>(this.base_symbol);
        enc.packNumber<u64>(this.quote_symbol);
        enc.packNumber<u64>(this.maker_fee_bps);
        enc.packNumber<u64>(this.taker_fee_bps);
        enc.packNumber<boolean>(this.enabled);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.id = dec.unpackNumber<u64>();
        this.market_id = dec.unpackNumber<u64>();
        this.market_symbol = dec.unpackString();
        this.base_symbol = dec.unpackNumber<u64>();
        this.quote_symbol = dec.unpackNumber<u64>();
        this.maker_fee_bps = dec.unpackNumber<u64>();
        this.taker_fee_bps = dec.unpackNumber<u64>();
        this.enabled = dec.unpackNumber<boolean>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += _chain.Utils.calcPackedStringLength(this.market_symbol);
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<boolean>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x4ABB235E0AC80000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return DexMarket.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return DexMarket.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): DexMarketDB {
        return new DexMarketDB(code, scope, this.tableName, this.tableIndexes(code, scope));
    }
}

/**
 * Active arbitrage state
 */


class ArbStateDB extends _chain.MultiIndex<ArbState> {

}

@table("arbstate", nocodegen)

class ArbState implements _chain.MultiIndexValue {
    
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
    
  }

  @primary
  get primary(): u64 {
    return this.user.N;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user);
        enc.packNumber<u64>(this.starting_balance);
        enc.packNumber<u64>(this.min_profit);
        enc.packNumber<u8>(this.route);
        enc.packNumber<u64>(this.base_symbol);
        enc.packNumber<u64>(this.quote_symbol);
        enc.packNumber<u64>(this.intermediate_symbol);
        enc.packNumber<u64>(this.started_at);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.user = obj;
        }
        this.starting_balance = dec.unpackNumber<u64>();
        this.min_profit = dec.unpackNumber<u64>();
        this.route = dec.unpackNumber<u8>();
        this.base_symbol = dec.unpackNumber<u64>();
        this.quote_symbol = dec.unpackNumber<u64>();
        this.intermediate_symbol = dec.unpackNumber<u64>();
        this.started_at = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user.getSize();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u8>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x35CF8C9B2A000000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return ArbState.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return ArbState.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): ArbStateDB {
        return new ArbStateDB(code, scope, this.tableName, this.tableIndexes(code, scope));
    }
}

/**
 * Contract configuration
 */


class ConfigDB extends _chain.MultiIndex<Config> {

}

@table("config", singleton, nocodegen)

class Config implements _chain.MultiIndexValue {
    
  constructor(
    public owner: Name = new Name(),
    public paused: boolean = false,
    public min_profit_bps: u64 = 5,
    public max_trade_usd: u64 = 100,
    public total_trades: u64 = 0,
    public total_profit: u64 = 0
  ) {
    
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.owner);
        enc.packNumber<boolean>(this.paused);
        enc.packNumber<u64>(this.min_profit_bps);
        enc.packNumber<u64>(this.max_trade_usd);
        enc.packNumber<u64>(this.total_trades);
        enc.packNumber<u64>(this.total_profit);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.owner = obj;
        }
        this.paused = dec.unpackNumber<boolean>();
        this.min_profit_bps = dec.unpackNumber<u64>();
        this.max_trade_usd = dec.unpackNumber<u64>();
        this.total_trades = dec.unpackNumber<u64>();
        this.total_profit = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.owner.getSize();
        size += sizeof<boolean>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x4526B73000000000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return Config.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return Config.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return _chain.Name.fromU64(0x4526B73000000000).N;
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name = _chain.EMPTY_NAME): _chain.Singleton<Config> {
        return new _chain.Singleton<Config>(code, scope, this.tableName);
    }
}

/**
 * Authorized users
 */


class AuthorizedUserDB extends _chain.MultiIndex<AuthorizedUser> {

}

@table("authorized", nocodegen)

class AuthorizedUser implements _chain.MultiIndexValue {
    
  constructor(
    public user: Name = new Name(),
    public added_at: u64 = 0
  ) {
    
  }

  @primary
  get primary(): u64 {
    return this.user.N;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user);
        enc.packNumber<u64>(this.added_at);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.user = obj;
        }
        this.added_at = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user.getSize();
        size += sizeof<u64>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x36B2DA5DDF524000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return AuthorizedUser.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return AuthorizedUser.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): AuthorizedUserDB {
        return new AuthorizedUserDB(code, scope, this.tableName, this.tableIndexes(code, scope));
    }
}

/**
 * Trade history
 */


class TradeRecordDB extends _chain.MultiIndex<TradeRecord> {

}

@table("trades", nocodegen)

class TradeRecord implements _chain.MultiIndexValue {
    
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
    
  }

  @primary
  get primary(): u64 {
    return this.id;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u64>(this.id);
        enc.pack(this.user);
        enc.packNumber<u8>(this.route);
        enc.packNumber<u64>(this.base_symbol);
        enc.packNumber<u64>(this.quote_symbol);
        enc.packNumber<u64>(this.input_amount);
        enc.packNumber<u64>(this.output_amount);
        enc.packNumber<i64>(this.profit);
        enc.packNumber<u64>(this.timestamp);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.id = dec.unpackNumber<u64>();
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.user = obj;
        }
        this.route = dec.unpackNumber<u8>();
        this.base_symbol = dec.unpackNumber<u64>();
        this.quote_symbol = dec.unpackNumber<u64>();
        this.input_amount = dec.unpackNumber<u64>();
        this.output_amount = dec.unpackNumber<u64>();
        this.profit = dec.unpackNumber<i64>();
        this.timestamp = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u64>();
        size += this.user.getSize();
        size += sizeof<u8>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<i64>();
        size += sizeof<u64>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0xCDCC956000000000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return TradeRecord.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return TradeRecord.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): TradeRecordDB {
        return new TradeRecordDB(code, scope, this.tableName, this.tableIndexes(code, scope));
    }
}

/**
 * Intermediate balance tracking (like noloss `beforelegone`)
 */


class LegBalanceDB extends _chain.MultiIndex<LegBalance> {

}

@table("legbalance", nocodegen)

class LegBalance implements _chain.MultiIndexValue {
    
  constructor(
    public user: Name = new Name(),
    public symbol_code: u64 = 0,
    public balance: u64 = 0,
    public leg: u8 = 0
  ) {
    
  }

  @primary
  get primary(): u64 {
    return this.user.N;
  }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user);
        enc.packNumber<u64>(this.symbol_code);
        enc.packNumber<u64>(this.balance);
        enc.packNumber<u8>(this.leg);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new Name();
            dec.unpack(obj);
            this.user = obj;
        }
        this.symbol_code = dec.unpackNumber<u64>();
        this.balance = dec.unpackNumber<u64>();
        this.leg = dec.unpackNumber<u8>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user.getSize();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<u8>();
        return size;
    }

    static get tableName(): _chain.Name {
        return _chain.Name.fromU64(0x8A987344D3428000);
    }

    static tableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        const idxTableBase: u64 = this.tableName.N & 0xfffffffffffffff0;
        const indices: _chain.IDXDB[] = [
        ];
        return indices;
    }

    getTableName(): _chain.Name {
        return LegBalance.tableName;
    }

    getTableIndexes(code: _chain.Name, scope: _chain.Name): _chain.IDXDB[] {
        return LegBalance.tableIndexes(code, scope);
    }

    getPrimaryValue(): u64 {
        return this.primary
    }

    getSecondaryValue(i: i32): _chain.SecondaryValue {
        _chain.check(false, "no secondary value!");
        return new _chain.SecondaryValue(_chain.SecondaryType.U64, new Array<u64>(0));
    }
    
    setSecondaryValue(i: i32, value: _chain.SecondaryValue): void {
        _chain.check(false, "no secondary value!");
    }


    static new(code: _chain.Name, scope: _chain.Name  = _chain.EMPTY_NAME): LegBalanceDB {
        return new LegBalanceDB(code, scope, this.tableName, this.tableIndexes(code, scope));
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
      const xpr = new TokenMap(xprSymCode, Name.fromU64(0x5530EA033482A600), 4);
      this.tokenMapTable.store(xpr, this.receiver);
    }

    // XUSDC - 6 decimals - xtokens
    const xusdcSymCode: u64 = 1146312024; // "XUSDC" as symbol_code
    if (!this.tokenMapTable.exists(xusdcSymCode)) {
      const xusdc = new TokenMap(xusdcSymCode, Name.fromU64(0xEE69054F00000000), 6);
      this.tokenMapTable.store(xusdc, this.receiver);
    }

    // XMD - 6 decimals - xmd.token
    const xmdSymCode: u64 = 4476504; // "XMD" as symbol_code
    if (!this.tokenMapTable.exists(xmdSymCode)) {
      const xmd = new TokenMap(xmdSymCode, Name.fromU64(0xEC920CD20A980000), 6);
      this.tokenMapTable.store(xmd, this.receiver);
    }

    // XMT - 8 decimals - xtokens
    const xmtSymCode: u64 = 5525592; // "XMT" as symbol_code
    if (!this.tokenMapTable.exists(xmtSymCode)) {
      const xmt = new TokenMap(xmtSymCode, Name.fromU64(0xEE69054F00000000), 8);
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
      .act(sell_contract, new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(sell_contract, new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(sell_contract, new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(Name.fromU64(0xEE69054F00000000), new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(Name.fromU64(0xEE69054F00000000), new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(Name.fromU64(0xEC920CD20A980000), new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(Name.fromU64(0x5530EA033482A600), new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(token_contract, new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(DEX_CONTRACT, new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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
      .act(DEX_CONTRACT, new PermissionLevel(user, Name.fromU64(0x3232EDA800000000)))
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


class initAction implements _chain.Packer {
    constructor (
        public owner: _chain.Name | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.owner!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.owner! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.owner!.getSize();
        return size;
    }
}

class addTokenAction implements _chain.Packer {
    constructor (
        public symbol_str: string = "",
        public contract: _chain.Name | null = null,
        public precision: u8 = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packString(this.symbol_str);
        enc.pack(this.contract!);
        enc.packNumber<u8>(this.precision);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.symbol_str = dec.unpackString();
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.contract! = obj;
        }
        this.precision = dec.unpackNumber<u8>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += _chain.Utils.calcPackedStringLength(this.symbol_str);
        size += this.contract!.getSize();
        size += sizeof<u8>();
        return size;
    }
}

class addAmmPoolAction implements _chain.Packer {
    constructor (
        public pool_symbol: string = "",
        public base_symbol: string = "",
        public base_precision: u8 = 0,
        public quote_symbol: string = "",
        public quote_precision: u8 = 0,
        public fee_bps: u64 = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packString(this.pool_symbol);
        enc.packString(this.base_symbol);
        enc.packNumber<u8>(this.base_precision);
        enc.packString(this.quote_symbol);
        enc.packNumber<u8>(this.quote_precision);
        enc.packNumber<u64>(this.fee_bps);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.pool_symbol = dec.unpackString();
        this.base_symbol = dec.unpackString();
        this.base_precision = dec.unpackNumber<u8>();
        this.quote_symbol = dec.unpackString();
        this.quote_precision = dec.unpackNumber<u8>();
        this.fee_bps = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += _chain.Utils.calcPackedStringLength(this.pool_symbol);
        size += _chain.Utils.calcPackedStringLength(this.base_symbol);
        size += sizeof<u8>();
        size += _chain.Utils.calcPackedStringLength(this.quote_symbol);
        size += sizeof<u8>();
        size += sizeof<u64>();
        return size;
    }
}

class addDexMarketAction implements _chain.Packer {
    constructor (
        public market_id: u64 = 0,
        public market_symbol: string = "",
        public base_symbol: string = "",
        public base_precision: u8 = 0,
        public quote_symbol: string = "",
        public quote_precision: u8 = 0,
        public maker_fee_bps: u64 = 0,
        public taker_fee_bps: u64 = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u64>(this.market_id);
        enc.packString(this.market_symbol);
        enc.packString(this.base_symbol);
        enc.packNumber<u8>(this.base_precision);
        enc.packString(this.quote_symbol);
        enc.packNumber<u8>(this.quote_precision);
        enc.packNumber<u64>(this.maker_fee_bps);
        enc.packNumber<u64>(this.taker_fee_bps);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.market_id = dec.unpackNumber<u64>();
        this.market_symbol = dec.unpackString();
        this.base_symbol = dec.unpackString();
        this.base_precision = dec.unpackNumber<u8>();
        this.quote_symbol = dec.unpackString();
        this.quote_precision = dec.unpackNumber<u8>();
        this.maker_fee_bps = dec.unpackNumber<u64>();
        this.taker_fee_bps = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u64>();
        size += _chain.Utils.calcPackedStringLength(this.market_symbol);
        size += _chain.Utils.calcPackedStringLength(this.base_symbol);
        size += sizeof<u8>();
        size += _chain.Utils.calcPackedStringLength(this.quote_symbol);
        size += sizeof<u8>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        return size;
    }
}

class setConfigAction implements _chain.Packer {
    constructor (
        public min_profit_bps: u64 = 0,
        public max_trade_usd: u64 = 0,
        public paused: boolean = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u64>(this.min_profit_bps);
        enc.packNumber<u64>(this.max_trade_usd);
        enc.packNumber<boolean>(this.paused);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.min_profit_bps = dec.unpackNumber<u64>();
        this.max_trade_usd = dec.unpackNumber<u64>();
        this.paused = dec.unpackNumber<boolean>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += sizeof<boolean>();
        return size;
    }
}

class addAuthAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        return size;
    }
}

class removeAuthAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        return size;
    }
}

class saveBalanceAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public token_contract: _chain.Name | null = null,
        public symbol_str: string = "",
        public precision: u8 = 0,
        public min_profit: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.token_contract!);
        enc.packString(this.symbol_str);
        enc.packNumber<u8>(this.precision);
        enc.pack(this.min_profit!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.token_contract! = obj;
        }
        this.symbol_str = dec.unpackString();
        this.precision = dec.unpackNumber<u8>();
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.min_profit! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.token_contract!.getSize();
        size += _chain.Utils.calcPackedStringLength(this.symbol_str);
        size += sizeof<u8>();
        size += this.min_profit!.getSize();
        return size;
    }
}

class arbLegOneAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public buy_contract: _chain.Name | null = null,
        public buy_from: _chain.Name | null = null,
        public buy_memo: string = "",
        public quantity: _chain.Asset | null = null,
        public sell_contract: _chain.Name | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.buy_contract!);
        enc.pack(this.buy_from!);
        enc.packString(this.buy_memo);
        enc.pack(this.quantity!);
        enc.pack(this.sell_contract!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.buy_contract! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.buy_from! = obj;
        }
        this.buy_memo = dec.unpackString();
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.quantity! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.sell_contract! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.buy_contract!.getSize();
        size += this.buy_from!.getSize();
        size += _chain.Utils.calcPackedStringLength(this.buy_memo);
        size += this.quantity!.getSize();
        size += this.sell_contract!.getSize();
        return size;
    }
}

class arbLegTwoAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public sell_contract: _chain.Name | null = null,
        public sell_sym: string = "",
        public sell_precision: u8 = 0,
        public sell_to: _chain.Name | null = null,
        public sell_memo: string = "",
        public quantity: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.sell_contract!);
        enc.packString(this.sell_sym);
        enc.packNumber<u8>(this.sell_precision);
        enc.pack(this.sell_to!);
        enc.packString(this.sell_memo);
        enc.pack(this.quantity!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.sell_contract! = obj;
        }
        this.sell_sym = dec.unpackString();
        this.sell_precision = dec.unpackNumber<u8>();
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.sell_to! = obj;
        }
        this.sell_memo = dec.unpackString();
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.quantity! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.sell_contract!.getSize();
        size += _chain.Utils.calcPackedStringLength(this.sell_sym);
        size += sizeof<u8>();
        size += this.sell_to!.getSize();
        size += _chain.Utils.calcPackedStringLength(this.sell_memo);
        size += this.quantity!.getSize();
        return size;
    }
}

class arbLegAddAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public sell_contract: _chain.Name | null = null,
        public quantity: _chain.Asset | null = null,
        public sell_to: _chain.Name | null = null,
        public sell_memo: string = "",
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.sell_contract!);
        enc.pack(this.quantity!);
        enc.pack(this.sell_to!);
        enc.packString(this.sell_memo);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.sell_contract! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.quantity! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.sell_to! = obj;
        }
        this.sell_memo = dec.unpackString();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.sell_contract!.getSize();
        size += this.quantity!.getSize();
        size += this.sell_to!.getSize();
        size += _chain.Utils.calcPackedStringLength(this.sell_memo);
        return size;
    }
}

class ammToDexAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public amount: _chain.Asset | null = null,
        public min_profit_bps: u64 = 0,
        public min_xpr_out: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.amount!);
        enc.packNumber<u64>(this.min_profit_bps);
        enc.pack(this.min_xpr_out!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.amount! = obj;
        }
        this.min_profit_bps = dec.unpackNumber<u64>();
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.min_xpr_out! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.amount!.getSize();
        size += sizeof<u64>();
        size += this.min_xpr_out!.getSize();
        return size;
    }
}

class dexToAmmAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public amount: _chain.Asset | null = null,
        public min_profit_bps: u64 = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.amount!);
        enc.packNumber<u64>(this.min_profit_bps);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.amount! = obj;
        }
        this.min_profit_bps = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.amount!.getSize();
        size += sizeof<u64>();
        return size;
    }
}

class redeemXmdAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public xmd_amount: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.xmd_amount!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.xmd_amount! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.xmd_amount!.getSize();
        return size;
    }
}

class swapXprAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public xpr_amount: _chain.Asset | null = null,
        public min_xusdc_out: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.xpr_amount!);
        enc.pack(this.min_xusdc_out!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.xpr_amount! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.min_xusdc_out! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.xpr_amount!.getSize();
        size += this.min_xusdc_out!.getSize();
        return size;
    }
}

class dexDepositAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public token_contract: _chain.Name | null = null,
        public amount: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.token_contract!);
        enc.pack(this.amount!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.token_contract! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.amount! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.token_contract!.getSize();
        size += this.amount!.getSize();
        return size;
    }
}

class dexOrderAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public market_id: u64 = 0,
        public order_side: u8 = 0,
        public order_type: u8 = 0,
        public quantity: u64 = 0,
        public price: u64 = 0,
        public bid_symbol_str: string = "",
        public bid_precision: u8 = 0,
        public ask_symbol_str: string = "",
        public ask_precision: u8 = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.packNumber<u64>(this.market_id);
        enc.packNumber<u8>(this.order_side);
        enc.packNumber<u8>(this.order_type);
        enc.packNumber<u64>(this.quantity);
        enc.packNumber<u64>(this.price);
        enc.packString(this.bid_symbol_str);
        enc.packNumber<u8>(this.bid_precision);
        enc.packString(this.ask_symbol_str);
        enc.packNumber<u8>(this.ask_precision);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        this.market_id = dec.unpackNumber<u64>();
        this.order_side = dec.unpackNumber<u8>();
        this.order_type = dec.unpackNumber<u8>();
        this.quantity = dec.unpackNumber<u64>();
        this.price = dec.unpackNumber<u64>();
        this.bid_symbol_str = dec.unpackString();
        this.bid_precision = dec.unpackNumber<u8>();
        this.ask_symbol_str = dec.unpackString();
        this.ask_precision = dec.unpackNumber<u8>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += sizeof<u64>();
        size += sizeof<u8>();
        size += sizeof<u8>();
        size += sizeof<u64>();
        size += sizeof<u64>();
        size += _chain.Utils.calcPackedStringLength(this.bid_symbol_str);
        size += sizeof<u8>();
        size += _chain.Utils.calcPackedStringLength(this.ask_symbol_str);
        size += sizeof<u8>();
        return size;
    }
}

class dexWithdrawAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public amount: _chain.Asset | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.amount!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Asset();
            dec.unpack(obj);
            this.amount! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.amount!.getSize();
        return size;
    }
}

class checkBalExtAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public token_contract: _chain.Name | null = null,
        public symbol_str: string = "",
        public precision: u8 = 0,
        public message: string = "",
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.pack(this.token_contract!);
        enc.packString(this.symbol_str);
        enc.packNumber<u8>(this.precision);
        enc.packString(this.message);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.token_contract! = obj;
        }
        this.symbol_str = dec.unpackString();
        this.precision = dec.unpackNumber<u8>();
        this.message = dec.unpackString();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += this.token_contract!.getSize();
        size += _chain.Utils.calcPackedStringLength(this.symbol_str);
        size += sizeof<u8>();
        size += _chain.Utils.calcPackedStringLength(this.message);
        return size;
    }
}

class verifyAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
        public final_balance: u64 = 0,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        enc.packNumber<u64>(this.final_balance);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        this.final_balance = dec.unpackNumber<u64>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        size += sizeof<u64>();
        return size;
    }
}

class cancelAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        return size;
    }
}

class clearAction implements _chain.Packer {
    constructor (
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        return size;
    }
}

class resetAction implements _chain.Packer {
    constructor (
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        return size;
    }
}

class checkStateAction implements _chain.Packer {
    constructor (
        public user: _chain.Name | null = null,
    ) {
    }

    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.user!);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new _chain.Name();
            dec.unpack(obj);
            this.user! = obj;
        }
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.user!.getSize();
        return size;
    }
}

export function apply(receiver: u64, firstReceiver: u64, action: u64): void {
	const _receiver = new _chain.Name(receiver);
	const _firstReceiver = new _chain.Name(firstReceiver);
	const _action = new _chain.Name(action);

	const mycontract = new AtomArb(_receiver, _firstReceiver, _action);
	const actionData = _chain.readActionData();

	if (receiver == firstReceiver) {
		if (action == 0x74DD900000000000) {//init
            const args = new initAction();
            args.unpack(actionData);
            mycontract.init(args.owner!);
        }
		if (action == 0x32539A4153000000) {//addtoken
            const args = new addTokenAction();
            args.unpack(actionData);
            mycontract.addToken(args.symbol_str,args.contract!,args.precision);
        }
		if (action == 0x3252694AB4A44000) {//addammpool
            const args = new addAmmPoolAction();
            args.unpack(actionData);
            mycontract.addAmmPool(args.pool_symbol,args.base_symbol,args.base_precision,args.quote_symbol,args.quote_precision,args.fee_bps);
        }
		if (action == 0x3252957650C80000) {//adddexmkt
            const args = new addDexMarketAction();
            args.unpack(actionData);
            mycontract.addDexMarket(args.market_id,args.market_symbol,args.base_symbol,args.base_precision,args.quote_symbol,args.quote_precision,args.maker_fee_bps,args.taker_fee_bps);
        }
		if (action == 0xC2B28A4D6E600000) {//setconfig
            const args = new setConfigAction();
            args.unpack(actionData);
            mycontract.setConfig(args.min_profit_bps,args.max_trade_usd,args.paused);
        }
		if (action == 0x32526D65A0000000) {//addauth
            const args = new addAuthAction();
            args.unpack(actionData);
            mycontract.addAuth(args.user!);
        }
		if (action == 0xBC8DACB400000000) {//rmauth
            const args = new removeAuthAction();
            args.unpack(actionData);
            mycontract.removeAuth(args.user!);
        }
		if (action == 0xC1B6A39A269A1400) {//savebalance
            const args = new saveBalanceAction();
            args.unpack(actionData);
            mycontract.saveBalance(args.user!,args.token_contract!,args.symbol_str,args.precision,args.min_profit!);
        }
		if (action == 0x35CF153293500000) {//arblegone
            const args = new arbLegOneAction();
            args.unpack(actionData);
            mycontract.arbLegOne(args.user!,args.buy_contract!,args.buy_from!,args.buy_memo,args.quantity!,args.sell_contract!);
        }
		if (action == 0x35CF15333CA00000) {//arblegtwo
            const args = new arbLegTwoAction();
            args.unpack(actionData);
            mycontract.arbLegTwo(args.user!,args.sell_contract!,args.sell_sym,args.sell_precision,args.sell_to!,args.sell_memo,args.quantity!);
        }
		if (action == 0x35CF1530C9480000) {//arblegadd
            const args = new arbLegAddAction();
            args.unpack(actionData);
            mycontract.arbLegAdd(args.user!,args.sell_contract!,args.quantity!,args.sell_to!,args.sell_memo);
        }
		if (action == 0x34A59A255D000000) {//ammtodex
            const args = new ammToDexAction();
            args.unpack(actionData);
            mycontract.ammToDex(args.user!,args.amount!,args.min_profit_bps,args.min_xpr_out!);
        }
		if (action == 0x4ABB9A1A52000000) {//dextoamm
            const args = new dexToAmmAction();
            args.unpack(actionData);
            mycontract.dexToAmm(args.user!,args.amount!,args.min_profit_bps);
        }
		if (action == 0xBA92A54BB2480000) {//redeemxmd
            const args = new redeemXmdAction();
            args.unpack(actionData);
            mycontract.redeemXmd(args.user!,args.xmd_amount!);
        }
		if (action == 0xC70D5ED6E0000000) {//swapxpr
            const args = new swapXprAction();
            args.unpack(actionData);
            mycontract.swapXpr(args.user!,args.xpr_amount!,args.min_xusdc_out!);
        }
		if (action == 0x4ABA955698764000) {//dexdeposit
            const args = new dexDepositAction();
            args.unpack(actionData);
            mycontract.dexDeposit(args.user!,args.token_contract!,args.amount!);
        }
		if (action == 0x4ABB4BA557000000) {//dexorder
            const args = new dexOrderAction();
            args.unpack(actionData);
            mycontract.dexOrder(args.user!,args.market_id,args.order_side,args.order_type,args.quantity,args.price,args.bid_symbol_str,args.bid_precision,args.ask_symbol_str,args.ask_precision);
        }
		if (action == 0x4ABBC765A9B9B800) {//dexwithdraw
            const args = new dexWithdrawAction();
            args.unpack(actionData);
            mycontract.dexWithdraw(args.user!,args.amount!);
        }
		if (action == 0x4354881CD1577200) {//checkbalext
            const args = new checkBalExtAction();
            args.unpack(actionData);
            mycontract.checkBalExt(args.user!,args.token_contract!,args.symbol_str,args.precision,args.message);
        }
		if (action == 0xDAAEE5F800000000) {//verify
            const args = new verifyAction();
            args.unpack(actionData);
            mycontract.verify(args.user!,args.final_balance);
        }
		if (action == 0x41A6854400000000) {//cancel
            const args = new cancelAction();
            args.unpack(actionData);
            mycontract.cancel(args.user!);
        }
		if (action == 0x44546B8000000000) {//clear
            const args = new clearAction();
            args.unpack(actionData);
            mycontract.clear();
        }
		if (action == 0xBAB0AC8000000000) {//reset
            const args = new resetAction();
            args.unpack(actionData);
            mycontract.reset();
        }
		if (action == 0x4354886326CA8000) {//checkstate
            const args = new checkStateAction();
            args.unpack(actionData);
            mycontract.checkState(args.user!);
        }
	}
  
	if (receiver != firstReceiver) {
		
	}
	return;
}
