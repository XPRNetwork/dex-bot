/**
 * Multi-Hop Arbitrage Strategy
 *
 * Monitors multiple AMM pools and DEX markets for arbitrage opportunities.
 * Supports paths through bridge tokens like METAL.
 *
 * Paths monitored:
 * 1. XPR ↔ XUSDC (direct via XPRUSDC pool)
 * 2. XPR ↔ METAL ↔ XMD (via METAXPR + METAL_XMD DEX)
 * 3. XPR ↔ LOAN ↔ XMD (via XPRLOAN + LOAN_XMD DEX)
 * 4. METAL ↔ XMD (via METAXMD pool + METAL_XMD DEX)
 */

import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';
import { profitabilityTracker } from '../analytics/profitability-tracker.js';
import { circuitBreaker } from '../risk/circuit-breaker.js';

const logger = getLogger();

// Strategy name for circuit breaker tracking
const STRATEGY_NAME = 'multi-hop-arbitrage';

interface PoolState {
  symbol: string;
  token1: string;
  token1Amount: number;
  token1Contract: string;
  token1Precision: number;
  token2: string;
  token2Amount: number;
  token2Contract: string;
  token2Precision: number;
  price: number;  // token2 per token1
}

interface DexMarket {
  symbol: string;
  marketId: number;
  baseToken: string;
  baseContract: string;
  basePrecision: number;
  quoteToken: string;
  quoteContract: string;
  quotePrecision: number;
  bestBid: number;
  bestAsk: number;
  bidDepth: number;
  askDepth: number;
}

interface ArbPath {
  name: string;
  direction: string;
  steps: string[];
  profitBps: number;
  profitUsd: number;
  tradeSizeUsd: number;
}

interface PathConfig {
  name: string;
  enabled: boolean;
  description: string;
}

interface MultiHopConfig {
  enabled: boolean;
  checkIntervalMs: number;
  minProfitBps: number;
  maxTradeUsd: number;
  dryRun: boolean;
  paths: PathConfig[];
}

// Pool definitions
const POOLS = {
  XPRUSDC: { symbol: 'XPRUSDC', token1: 'XPR', token1Contract: 'eosio.token', token1Precision: 4, token2: 'XUSDC', token2Contract: 'xtokens', token2Precision: 6 },
  METAXPR: { symbol: 'METAXPR', token1: 'METAL', token1Contract: 'xtokens', token1Precision: 8, token2: 'XPR', token2Contract: 'eosio.token', token2Precision: 4 },
  METAXMD: { symbol: 'METAXMD', token1: 'METAL', token1Contract: 'xtokens', token1Precision: 8, token2: 'XMD', token2Contract: 'xmd.token', token2Precision: 6 },
  XPRLOAN: { symbol: 'XPRLOAN', token1: 'XPR', token1Contract: 'eosio.token', token1Precision: 4, token2: 'LOAN', token2Contract: 'loan.token', token2Precision: 4 },
};

// DEX market definitions
const DEX_MARKETS = {
  XPR_XMD: { symbol: 'XPR_XMD', marketId: 1, baseToken: 'XPR', baseContract: 'eosio.token', basePrecision: 4, quoteToken: 'XMD', quoteContract: 'xmd.token', quotePrecision: 6 },
  METAL_XMD: { symbol: 'METAL_XMD', marketId: 10, baseToken: 'METAL', baseContract: 'xtokens', basePrecision: 8, quoteToken: 'XMD', quoteContract: 'xmd.token', quotePrecision: 6 },
  LOAN_XMD: { symbol: 'LOAN_XMD', marketId: 9, baseToken: 'LOAN', baseContract: 'loan.token', basePrecision: 4, quoteToken: 'XMD', quoteContract: 'xmd.token', quotePrecision: 6 },
};

export class MultiHopArbitrage {
  private rpc: JsonRpc;
  private api: Api;
  private config: MultiHopConfig;
  private username: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastTradeTime: number = 0;
  private cooldownMs: number = 10000;
  private isExecuting: boolean = false;

  // Cached pool states
  private poolStates: Map<string, PoolState> = new Map();
  private dexMarkets: Map<string, DexMarket> = new Map();

  // Fee constants - tradingbot has 0% DEX fee + 66% AMM discount (1M XPR staked)
  private readonly AMM_FEE = 0.00068; // 0.068% (0.2% * 0.34 after 66% discount)
  private readonly DEX_FEE = 0.000; // 0% - tradingbot has no DEX fees!

  // Track P&L for circuit breaker
  private lastTradeStartValue: number = 0;

  // Recovery timers (same pattern as triangle arbitrage)
  private lastRecoveryTime: number = 0;
  private recoveryIntervalMs: number = 30000;  // Auto-redeem XMD every 30s
  private lastCleanupTime: number = 0;
  private cleanupIntervalMs: number = 120000;  // Check stale orders every 2 min
  private baselineLoan: number = 0;  // Captured on startup, protect from recovery
  private baselineMetal: number = 0; // Captured on startup, protect from recovery

  // SAFETY LIMITS - Prevent catastrophic trades
  private readonly MAX_SINGLE_TRADE_USD = 100; // Never trade more than $100 in one operation
  private readonly MAX_BALANCE_PERCENT = 10; // Never swap more than 10% of any token balance
  private readonly MAX_TOKEN_AMOUNTS: Record<string, number> = {
    'LOAN': 100000,   // Max 100k LOAN per trade (~$43)
    'METAL': 500,     // Max 500 METAL per trade (~$72)
    'XPR': 50000,     // Max 50k XPR per trade (~$145)
    'XMD': 100,       // Max 100 XMD per trade
    'XUSDC': 100,     // Max 100 XUSDC per trade
  };

  constructor() {
    const config = getConfig() as any;

    this.config = {
      enabled: config.multiHopArbitrage?.enabled ?? false,
      checkIntervalMs: config.multiHopArbitrage?.checkIntervalMs ?? 5000,
      minProfitBps: config.multiHopArbitrage?.minProfitBps ?? 10,
      maxTradeUsd: config.multiHopArbitrage?.maxTradeUsd ?? 50,
      dryRun: config.multiHopArbitrage?.dryRun ?? true,
      paths: config.multiHopArbitrage?.paths ?? [],
    };

    this.username = process.env.PROTON_USERNAME || '';
    const privateKey = process.env.PROTON_PRIVATE_KEY || '';

    this.rpc = new JsonRpc(config.rpc.endpoints);
    this.api = new Api({
      rpc: this.rpc,
      signatureProvider: new JsSignatureProvider([privateKey])
    });
  }

  /**
   * Calculate maximum allowed slippage based on expected profit.
   * Slippage tolerance is linked to profit: never let slippage exceed 50% of expected profit.
   *
   * @param expectedProfitBps Expected profit in basis points
   * @returns Slippage tolerance as a decimal (e.g., 0.005 for 50 BPS)
   */
  private calculateMaxSlippage(expectedProfitBps: number): number {
    // Never let slippage exceed 50% of expected profit
    const maxSlippageBps = expectedProfitBps * 0.5;

    // Floor at 10 BPS (minimum price precision on DEX)
    // Ceiling at 50 BPS (never accept more than 0.5% slippage)
    const clampedBps = Math.max(10, Math.min(maxSlippageBps, 50));

    return clampedBps / 10000; // Convert to decimal
  }

  /**
   * Calculate DEX limit price for sells (below market) based on profit
   */
  private calculateSellLimitPrice(bestBid: number, expectedProfitBps: number): number {
    const maxSlippage = this.calculateMaxSlippage(expectedProfitBps);
    return bestBid * (1 - maxSlippage);
  }

  /**
   * Calculate DEX limit price for buys (above market) based on profit
   */
  private calculateBuyLimitPrice(bestAsk: number, expectedProfitBps: number): number {
    const maxSlippage = this.calculateMaxSlippage(expectedProfitBps);
    return bestAsk * (1 + maxSlippage);
  }

  /**
   * Check if a path is enabled in config
   */
  private isPathEnabled(pathName: string): boolean {
    const pathConfig = this.config.paths.find(p => p.name === pathName);
    return pathConfig?.enabled ?? false;
  }

  /**
   * SAFETY: Validate trade amount before execution
   * Returns the safe amount to trade (may be less than requested)
   *
   * @param isArbitrage - If true, skip balance % checks (arbitrage buys then sells same tokens)
   */
  private validateTradeAmount(
    token: string,
    requestedAmount: number,
    currentBalance: number,
    priceUsd: number,
    isArbitrage: boolean = true  // Default true for multi-hop (all trades are arbitrage)
  ): { safe: boolean; amount: number; reason?: string } {
    // Check 1: Max USD value - ALWAYS enforced
    const valueUsd = requestedAmount * priceUsd;
    if (valueUsd > this.MAX_SINGLE_TRADE_USD) {
      const safeAmount = this.MAX_SINGLE_TRADE_USD / priceUsd;
      logger.warn(`⚠️ SAFETY: ${token} trade $${valueUsd.toFixed(2)} exceeds max $${this.MAX_SINGLE_TRADE_USD}. Limiting to ${safeAmount.toFixed(4)} ${token}`);
      return { safe: true, amount: safeAmount, reason: 'USD limit' };
    }

    // Check 2: Hard token amount limit - ALWAYS enforced
    const maxAmount = this.MAX_TOKEN_AMOUNTS[token];
    if (maxAmount && requestedAmount > maxAmount) {
      logger.warn(`⚠️ SAFETY: ${token} trade ${requestedAmount.toFixed(4)} exceeds max ${maxAmount}. Limiting.`);
      return { safe: true, amount: maxAmount, reason: 'Token limit' };
    }

    // Check 3: Balance percentage - SKIP for arbitrage (we buy then sell same tokens)
    // Only apply to non-arbitrage trades to prevent selling existing holdings
    if (!isArbitrage) {
      const percentOfBalance = (requestedAmount / currentBalance) * 100;
      if (percentOfBalance > this.MAX_BALANCE_PERCENT) {
        const safeAmount = currentBalance * (this.MAX_BALANCE_PERCENT / 100);
        logger.warn(`⚠️ SAFETY: ${token} trade is ${percentOfBalance.toFixed(1)}% of balance. Limiting to ${this.MAX_BALANCE_PERCENT}% (${safeAmount.toFixed(4)} ${token})`);
        return { safe: true, amount: safeAmount, reason: 'Balance % limit' };
      }

      // Sanity check for non-arbitrage
      if (percentOfBalance > 50) {
        logger.error(`🚫 SAFETY BLOCK: ${token} trade would use ${percentOfBalance.toFixed(1)}% of balance. BLOCKED.`);
        return { safe: false, amount: 0, reason: 'Would use >50% of balance' };
      }
    }

    logger.info(`✅ SAFETY: ${token} trade ${requestedAmount.toFixed(4)} ($${valueUsd.toFixed(2)}) approved`);
    return { safe: true, amount: requestedAmount };
  }

  /**
   * Get current balance for a token
   */
  private async getTokenBalance(token: string, contract: string): Promise<number> {
    const res = await this.rpc.get_table_rows({
      code: contract,
      scope: this.username,
      table: 'accounts',
      limit: 20,
      json: true
    });

    for (const row of res.rows) {
      if (row.balance?.includes(token)) {
        return parseFloat(row.balance);
      }
    }
    return 0;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Multi-hop arbitrage disabled');
      return;
    }

    logger.info('🔀 Multi-hop arbitrage starting...');
    logger.info(`Check interval: ${this.config.checkIntervalMs}ms`);
    logger.info(`Min profit: ${this.config.minProfitBps} BPS`);
    logger.info(`Max trade: $${this.config.maxTradeUsd}`);
    logger.info(`Dry run: ${this.config.dryRun}`);

    // Initialize circuit breaker for this strategy
    circuitBreaker.initializeStrategy(STRATEGY_NAME);
    logger.info('Circuit breaker initialized for multi-hop arbitrage');

    // Capture baseline LOAN and METAL balances
    // Recovery will only swap amounts ABOVE these baselines to protect existing holdings
    this.baselineLoan = await this.getTokenBalance('LOAN', 'loan.token');
    this.baselineMetal = await this.getTokenBalance('METAL', 'xtokens');
    logger.info(`Baseline balances: LOAN=${this.baselineLoan.toFixed(4)}, METAL=${this.baselineMetal.toFixed(8)}`);

    // Log enabled paths
    const enabledPaths = this.config.paths.filter(p => p.enabled);
    if (enabledPaths.length === 0) {
      logger.warn('⚠️ No multi-hop paths enabled!');
    } else {
      logger.info(`Enabled paths: ${enabledPaths.map(p => p.name).join(', ')}`);
    }

    // Initial scan
    await this.scanAllPaths();

    // Start continuous monitoring
    this.checkInterval = setInterval(() => this.scanAllPaths(), this.config.checkIntervalMs);

    logger.info('🔀 Multi-hop arbitrage monitor active');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Multi-hop arbitrage stopped');
  }

  /**
   * Fetch all AMM pool states
   */
  private async fetchPoolStates(): Promise<void> {
    try {
      const poolsRes = await this.rpc.get_table_rows({
        code: 'proton.swaps',
        scope: 'proton.swaps',
        table: 'pools',
        limit: 100,
        json: true
      });

      for (const pool of poolsRes.rows) {
        const symbol = pool.lt_symbol.split(',')[1];
        const poolDef = Object.values(POOLS).find(p => p.symbol === symbol);

        if (poolDef) {
          const token1Amount = parseFloat(pool.pool1.quantity);
          const token2Amount = parseFloat(pool.pool2.quantity);

          this.poolStates.set(symbol, {
            symbol,
            token1: poolDef.token1,
            token1Amount,
            token1Contract: poolDef.token1Contract,
            token1Precision: poolDef.token1Precision,
            token2: poolDef.token2,
            token2Amount,
            token2Contract: poolDef.token2Contract,
            token2Precision: poolDef.token2Precision,
            price: token2Amount / token1Amount
          });
        }
      }
    } catch (error: any) {
      logger.error('Failed to fetch pool states:', error.message);
    }
  }

  /**
   * Fetch DEX orderbook for a market
   */
  private async fetchDexMarket(marketSymbol: string): Promise<void> {
    try {
      const marketDef = Object.values(DEX_MARKETS).find(m => m.symbol === marketSymbol);
      if (!marketDef) return;

      const res = await fetch(`https://dex.api.mainnet.metalx.com/dex/v1/orders/depth?symbol=${marketSymbol}&step=1000000&limit=20`);
      const data = await res.json() as any;

      const bids = data.data?.bids || [];
      const asks = data.data?.asks || [];

      const bestBid = bids.length > 0 ? bids[0].level : 0;
      const bestAsk = asks.length > 0 ? asks[0].level : 0;
      const bidDepth = bids.reduce((sum: number, b: any) => sum + b.bid, 0);
      const askDepth = asks.reduce((sum: number, a: any) => sum + a.bid, 0);

      this.dexMarkets.set(marketSymbol, {
        ...marketDef,
        bestBid,
        bestAsk,
        bidDepth,
        askDepth
      });
    } catch (error: any) {
      logger.error(`Failed to fetch ${marketSymbol} orderbook:`, error.message);
    }
  }

  /**
   * Calculate AMM swap output with price impact
   */
  private calculateAmmOutput(inputAmount: number, pool: PoolState, inputIsToken1: boolean): number {
    const feeMultiplier = 1 - this.AMM_FEE;

    if (inputIsToken1) {
      // Swapping token1 -> token2
      const inputAfterFee = inputAmount * feeMultiplier;
      return (inputAfterFee * pool.token2Amount) / (pool.token1Amount + inputAfterFee);
    } else {
      // Swapping token2 -> token1
      const inputAfterFee = inputAmount * feeMultiplier;
      return (inputAfterFee * pool.token1Amount) / (pool.token2Amount + inputAfterFee);
    }
  }

  /**
   * Scan all arbitrage paths
   */
  private async scanAllPaths(): Promise<void> {
    if (this.isExecuting) return;

    // Step 0a: Auto-redeem stuck XMD BEFORE circuit breaker check
    // Runs even when circuit breaker is triggered, so delayed DEX fills get recovered
    const now = Date.now();
    if (now - this.lastRecoveryTime >= this.recoveryIntervalMs) {
      this.lastRecoveryTime = now;
      try {
        await this.autoRedeemStuckXmd();
      } catch (e: any) {
        logger.debug(`Multi-hop auto-redeem check failed: ${e.message}`);
      }
    }

    // Step 0b: Cleanup stale orders on LOAN_XMD and METAL_XMD markets
    if (now - this.lastCleanupTime >= this.cleanupIntervalMs) {
      this.lastCleanupTime = now;
      try {
        await this.cleanupStaleOrders();
      } catch (e: any) {
        logger.debug(`Multi-hop cleanup check failed: ${e.message}`);
      }
    }

    // Check circuit breaker before scanning
    if (!circuitBreaker.canTrade(STRATEGY_NAME)) {
      const state = circuitBreaker.getState(STRATEGY_NAME);
      logger.warn(`🛑 Circuit breaker triggered for ${STRATEGY_NAME}: ${state?.triggerReason || 'Unknown reason'}`);
      return;
    }

    try {
      // Refresh market data
      await this.fetchPoolStates();
      await Promise.all([
        this.fetchDexMarket('XPR_XMD'),
        this.fetchDexMarket('METAL_XMD'),
        this.fetchDexMarket('LOAN_XMD'),
      ]);

      const opportunities: ArbPath[] = [];

      // Path 1: XPR → METAL → XMD → XUSDC → XPR (via METAXPR AMM + METAL_XMD DEX)
      if (this.isPathEnabled('METAL_BRIDGE')) {
        const metalPath = await this.checkMetalPath();
        if (metalPath) opportunities.push(metalPath);
      }

      // Path 2: XPR → LOAN → XMD → XUSDC → XPR (via XPRLOAN AMM + LOAN_XMD DEX)
      if (this.isPathEnabled('LOAN_BRIDGE')) {
        const loanPath = await this.checkLoanPath();
        if (loanPath) opportunities.push(loanPath);
      }

      // Path 3: Direct METAL/XMD arbitrage (METAXMD AMM vs METAL_XMD DEX)
      if (this.isPathEnabled('METAL_DIRECT')) {
        const metalDirectPath = await this.checkMetalDirectPath();
        if (metalDirectPath) opportunities.push(metalDirectPath);
      }

      // Log opportunities (only at info level if actionable)
      if (opportunities.length > 0) {
        const best = opportunities.sort((a, b) => b.profitBps - a.profitBps)[0];
        if (best.profitBps >= this.config.minProfitBps) {
          logger.info(`🔥 Found ${opportunities.length} multi-hop opportunities:`);
          for (const opp of opportunities) {
            logger.info(`  ${opp.name}: ${opp.direction} = ${opp.profitBps.toFixed(1)} BPS ($${opp.profitUsd.toFixed(3)})`);
          }
        } else {
          logger.debug(`Multi-hop: ${opportunities.length} opportunities found, best: ${best.name} ${best.profitBps.toFixed(1)} BPS (below ${this.config.minProfitBps} BPS threshold)`);
        }

        // Execute best opportunity
        if (best.profitBps >= this.config.minProfitBps && !this.config.dryRun) {
          await this.executeArbPath(best);
        }
      } else {
        // Periodic status log
        const xprusdc = this.poolStates.get('XPRUSDC');
        const metalXmd = this.dexMarkets.get('METAL_XMD');
        const loanXmd = this.dexMarkets.get('LOAN_XMD');

        if (xprusdc && metalXmd && loanXmd) {
          logger.info(`📊 Multi-hop scan: XPR=$${xprusdc.price.toFixed(6)} | METAL_XMD bid=${metalXmd.bestBid} ask=${metalXmd.bestAsk} | LOAN_XMD bid=${loanXmd.bestBid} ask=${loanXmd.bestAsk}`);
        }
      }

    } catch (error: any) {
      logger.error('Multi-hop scan error:', error.message);
    }
  }

  /**
   * Check METAL bridge path profitability
   * Path: XPR → METAL (AMM) → XMD (DEX) → XUSDC (Treasury) → XPR (AMM)
   */
  private async checkMetalPath(): Promise<ArbPath | null> {
    const metaxpr = this.poolStates.get('METAXPR');
    const xprusdc = this.poolStates.get('XPRUSDC');
    const metalXmd = this.dexMarkets.get('METAL_XMD');

    if (!metaxpr || !xprusdc || !metalXmd || metalXmd.bestBid === 0) {
      logger.debug(`METAL_BRIDGE skip: metaxpr=${!!metaxpr}, xprusdc=${!!xprusdc}, metalXmd=${!!metalXmd}, bid=${metalXmd?.bestBid || 0}`);
      return null;
    }

    // Simulate: Start with $50 worth of XPR
    const startUsd = this.config.maxTradeUsd;
    const xprPrice = xprusdc.price;  // XUSDC per XPR
    const startXpr = startUsd / xprPrice;

    // Step 1: XPR → METAL (via METAXPR pool)
    // METAXPR has METAL as token1, XPR as token2
    const metalOut = this.calculateAmmOutput(startXpr, metaxpr, false); // XPR is token2

    // Step 2: METAL → XMD (sell on DEX at bid)
    const xmdOut = metalOut * metalXmd.bestBid * (1 - this.DEX_FEE);

    // Step 3: XMD → XUSDC (Treasury 1:1)
    const xusdcOut = xmdOut;

    // Step 4: XUSDC → XPR (via XPRUSDC pool)
    const endXpr = this.calculateAmmOutput(xusdcOut, xprusdc, false); // XUSDC is token2

    // Calculate profit
    const profitXpr = endXpr - startXpr;
    const profitUsd = profitXpr * xprPrice;
    const profitBps = (profitXpr / startXpr) * 10000;

    // Check reverse direction: XUSDC → XPR → METAL → XMD
    const revStartUsd = startUsd;

    // Step 1: XUSDC → XPR (via XPRUSDC pool)
    const revXprOut = this.calculateAmmOutput(revStartUsd, xprusdc, false);

    // Step 2: XPR → METAL (via METAXPR pool)
    const revMetalOut = this.calculateAmmOutput(revXprOut, metaxpr, false);

    // Step 3: METAL → XMD (sell on DEX)
    const revXmdOut = revMetalOut * metalXmd.bestBid * (1 - this.DEX_FEE);

    // Step 4: XMD → XUSDC (Treasury)
    const revXusdcOut = revXmdOut;

    const revProfitUsd = revXusdcOut - revStartUsd;
    const revProfitBps = (revProfitUsd / revStartUsd) * 10000;

    // Log both directions
    logger.debug(`METAL_BRIDGE calc: fwd=${profitBps.toFixed(1)} BPS, rev=${revProfitBps.toFixed(1)} BPS | metalOut=${metalOut.toFixed(4)}, xmdOut=${xmdOut.toFixed(4)}`);

    if (profitBps > 0) {
      return {
        name: 'METAL_BRIDGE',
        direction: 'XPR→METAL→XMD→XUSDC→XPR',
        steps: ['METAXPR_AMM', 'METAL_XMD_DEX', 'TREASURY', 'XPRUSDC_AMM'],
        profitBps,
        profitUsd,
        tradeSizeUsd: startUsd
      };
    }

    if (revProfitBps > 0) {
      return {
        name: 'METAL_BRIDGE_REV',
        direction: 'XUSDC→XPR→METAL→XMD→XUSDC',
        steps: ['XPRUSDC_AMM', 'METAXPR_AMM', 'METAL_XMD_DEX', 'TREASURY'],
        profitBps: revProfitBps,
        profitUsd: revProfitUsd,
        tradeSizeUsd: revStartUsd
      };
    }

    return null;
  }

  /**
   * Check LOAN bridge path profitability
   * Path: XPR → LOAN (AMM) → XMD (DEX) → XUSDC (Treasury) → XPR (AMM)
   */
  private async checkLoanPath(): Promise<ArbPath | null> {
    const xprloan = this.poolStates.get('XPRLOAN');
    const xprusdc = this.poolStates.get('XPRUSDC');
    const loanXmd = this.dexMarkets.get('LOAN_XMD');

    if (!xprloan || !xprusdc || !loanXmd || loanXmd.bestBid === 0) return null;

    // Start with $50 worth of XPR
    const startUsd = this.config.maxTradeUsd;
    const xprPrice = xprusdc.price;
    const startXpr = startUsd / xprPrice;

    // Step 1: XPR → LOAN (via XPRLOAN pool)
    // XPRLOAN has XPR as token1, LOAN as token2
    const loanOut = this.calculateAmmOutput(startXpr, xprloan, true); // XPR is token1

    // Step 2: LOAN → XMD (sell on DEX at bid)
    const xmdOut = loanOut * loanXmd.bestBid * (1 - this.DEX_FEE);

    // Step 3: XMD → XUSDC (Treasury 1:1)
    const xusdcOut = xmdOut;

    // Step 4: XUSDC → XPR (via XPRUSDC pool)
    const endXpr = this.calculateAmmOutput(xusdcOut, xprusdc, false);

    // Calculate profit
    const profitXpr = endXpr - startXpr;
    const profitUsd = profitXpr * xprPrice;
    const profitBps = (profitXpr / startXpr) * 10000;

    if (profitBps > 0) {
      return {
        name: 'LOAN_BRIDGE',
        direction: 'XPR→LOAN→XMD→XUSDC→XPR',
        steps: ['XPRLOAN_AMM', 'LOAN_XMD_DEX', 'TREASURY', 'XPRUSDC_AMM'],
        profitBps,
        profitUsd,
        tradeSizeUsd: startUsd
      };
    }

    // Check reverse: Buy LOAN on DEX, sell to AMM for XPR
    // XUSDC → XMD (Treasury) → LOAN (DEX buy) → XPR (AMM)
    const revStartUsd = startUsd;

    // Step 1: XUSDC → XMD (Treasury mint)
    const revXmdOut = revStartUsd;

    // Step 2: XMD → LOAN (buy on DEX at ask)
    if (loanXmd.bestAsk === 0) return null;
    const revLoanOut = (revXmdOut / loanXmd.bestAsk) * (1 - this.DEX_FEE);

    // Step 3: LOAN → XPR (via XPRLOAN pool)
    const revXprOut = this.calculateAmmOutput(revLoanOut, xprloan, false); // LOAN is token2

    // Step 4: XPR → XUSDC (via XPRUSDC pool)
    const revXusdcOut = this.calculateAmmOutput(revXprOut, xprusdc, true); // XPR is token1

    const revProfitUsd = revXusdcOut - revStartUsd;
    const revProfitBps = (revProfitUsd / revStartUsd) * 10000;

    if (revProfitBps > 0) {
      return {
        name: 'LOAN_BRIDGE_REV',
        direction: 'XUSDC→XMD→LOAN→XPR→XUSDC',
        steps: ['TREASURY', 'LOAN_XMD_DEX', 'XPRLOAN_AMM', 'XPRUSDC_AMM'],
        profitBps: revProfitBps,
        profitUsd: revProfitUsd,
        tradeSizeUsd: revStartUsd
      };
    }

    return null;
  }

  /**
   * Check direct METAL/XMD arbitrage
   * Compare METAXMD AMM price vs METAL_XMD DEX
   * CRITICAL: Use actual AMM output calculation (constant product formula)
   * to account for slippage, not just spot price!
   */
  private async checkMetalDirectPath(): Promise<ArbPath | null> {
    const metaxmd = this.poolStates.get('METAXMD');
    const metalXmd = this.dexMarkets.get('METAL_XMD');

    if (!metaxmd || !metalXmd || metalXmd.bestBid === 0 || metalXmd.bestAsk === 0) return null;

    const tradeSizeUsd = this.config.maxTradeUsd; // e.g., 25 XMD
    const dexBid = metalXmd.bestBid;
    const dexAsk = metalXmd.bestAsk;

    // Path A: XMD → METAL (AMM) → XMD (DEX sell)
    // Buy METAL on AMM with XMD, sell METAL on DEX for XMD
    // Calculate ACTUAL AMM output with slippage using constant product formula
    const metalFromAmm = this.calculateAmmOutput(tradeSizeUsd, metaxmd, false); // XMD is token2
    const xmdFromDexSell = metalFromAmm * dexBid * (1 - this.DEX_FEE); // Sell METAL at bid minus fee

    // DEBUG: Log calculation details for METAL_DIRECT
    const ammSpotPriceA = metaxmd.token2Amount / metaxmd.token1Amount;
    logger.debug(`METAL_DIRECT calc: DEX bid=${dexBid.toFixed(5)}, AMM spot=${ammSpotPriceA.toFixed(5)}, pool METAL=${metaxmd.token1Amount.toFixed(0)}, pool XMD=${metaxmd.token2Amount.toFixed(0)}`);
    logger.debug(`  metalFromAmm=${metalFromAmm.toFixed(2)}, xmdFromDexSell=${xmdFromDexSell.toFixed(4)}, profit=${((xmdFromDexSell - tradeSizeUsd) / tradeSizeUsd * 10000).toFixed(1)} BPS`);

    if (xmdFromDexSell > tradeSizeUsd) {
      const profitUsd = xmdFromDexSell - tradeSizeUsd;
      const profitBps = (profitUsd / tradeSizeUsd) * 10000;

      return {
        name: 'METAL_DIRECT',
        direction: 'XMD→METAL(AMM)→XMD(DEX)',
        steps: ['METAXMD_AMM_BUY', 'METAL_XMD_DEX_SELL'],
        profitBps,
        profitUsd,
        tradeSizeUsd
      };
    }

    // Path B: XMD → METAL (DEX buy) → XMD (AMM sell)
    // Buy METAL on DEX with XMD, sell METAL to AMM for XMD
    // Calculate how much METAL we get from DEX buy (XMD / ask price, minus fee)
    const metalFromDexBuy = (tradeSizeUsd / dexAsk) * (1 - this.DEX_FEE);
    // Calculate ACTUAL AMM output with slippage - METAL is token1
    const xmdFromAmmSell = this.calculateAmmOutput(metalFromDexBuy, metaxmd, true);

    // DEBUG: Log calculation details
    const ammSpotPrice = metaxmd.token2Amount / metaxmd.token1Amount;
    logger.debug(`METAL_DIRECT_REV calc: DEX ask=${dexAsk.toFixed(5)}, AMM spot=${ammSpotPrice.toFixed(5)}, pool METAL=${metaxmd.token1Amount.toFixed(0)}, pool XMD=${metaxmd.token2Amount.toFixed(0)}`);
    logger.debug(`  metalFromDexBuy=${metalFromDexBuy.toFixed(2)}, xmdFromAmmSell=${xmdFromAmmSell.toFixed(4)}, profit=${((xmdFromAmmSell - tradeSizeUsd) / tradeSizeUsd * 10000).toFixed(1)} BPS`);

    if (xmdFromAmmSell > tradeSizeUsd) {
      const profitUsd = xmdFromAmmSell - tradeSizeUsd;
      const profitBps = (profitUsd / tradeSizeUsd) * 10000;

      return {
        name: 'METAL_DIRECT_REV',
        direction: 'XMD→METAL(DEX)→XMD(AMM)',
        steps: ['METAL_XMD_DEX_BUY', 'METAXMD_AMM_SELL'],
        profitBps,
        profitUsd,
        tradeSizeUsd
      };
    }

    return null;
  }

  /**
   * Check DEX fill quality by simulating orderbook slippage
   * Returns whether to proceed and expected slippage
   */
  private async checkDexFillQuality(path: ArbPath): Promise<{
    proceed: boolean;
    reason: string;
    slippageBps: number;
    adjustedProfitBps: number;
  }> {
    try {
      // Determine which DEX market this path uses
      let marketSymbol: string | null = null;
      let isBuy: boolean = false; // Are we buying on DEX (taker at ask) or selling (taker at bid)?
      let tradeAmountUsd: number = path.tradeSizeUsd;

      if (path.name === 'LOAN_BRIDGE' || path.name === 'LOAN_BRIDGE_REV') {
        marketSymbol = 'LOAN_XMD';
        isBuy = path.name === 'LOAN_BRIDGE_REV'; // REV = buy LOAN on DEX
      } else if (path.name === 'METAL_BRIDGE' || path.name === 'METAL_BRIDGE_REV') {
        marketSymbol = 'METAL_XMD';
        isBuy = path.name === 'METAL_BRIDGE_REV';
      } else if (path.name === 'METAL_DIRECT' || path.name === 'METAL_DIRECT_REV') {
        marketSymbol = 'METAL_XMD';
        isBuy = path.name === 'METAL_DIRECT_REV';
      }

      if (!marketSymbol) {
        return { proceed: true, reason: 'Unknown path', slippageBps: 0, adjustedProfitBps: path.profitBps };
      }

      const market = this.dexMarkets.get(marketSymbol);
      if (!market) {
        return { proceed: false, reason: `Market ${marketSymbol} not found`, slippageBps: 0, adjustedProfitBps: 0 };
      }

      // Fetch fresh orderbook with more depth
      const res = await fetch(`https://dex.api.mainnet.metalx.com/dex/v1/orders/depth?symbol=${marketSymbol}&step=1000000&limit=50`);
      const data = await res.json() as any;

      const bids = data.data?.bids || [];
      const asks = data.data?.asks || [];

      if (isBuy && asks.length === 0) {
        return { proceed: false, reason: 'No asks available', slippageBps: 0, adjustedProfitBps: 0 };
      }
      if (!isBuy && bids.length === 0) {
        return { proceed: false, reason: 'No bids available', slippageBps: 0, adjustedProfitBps: 0 };
      }

      // Simulate fill: walk through orderbook levels
      const levels = isBuy ? asks : bids;
      const bestPrice = levels[0].level;
      let remainingUsd = tradeAmountUsd;
      let totalFilled = 0;
      let totalCost = 0;

      for (const level of levels) {
        const price = level.level;
        const availableQty = level.bid; // Token quantity at this level
        const availableUsd = availableQty * price; // Approximate USD value

        if (remainingUsd <= 0) break;

        const fillUsd = Math.min(remainingUsd, availableUsd);
        const fillQty = fillUsd / price;

        totalFilled += fillQty;
        totalCost += fillUsd;
        remainingUsd -= fillUsd;
      }

      if (remainingUsd > tradeAmountUsd * 0.1) {
        return { proceed: false, reason: `Insufficient liquidity: only ${((1 - remainingUsd/tradeAmountUsd) * 100).toFixed(0)}% fillable`, slippageBps: 999, adjustedProfitBps: -999 };
      }

      // Calculate effective price and slippage
      const effectivePrice = totalCost / totalFilled;
      const slippagePercent = Math.abs(effectivePrice - bestPrice) / bestPrice;
      const slippageBps = slippagePercent * 10000;

      // Adjust profit for slippage
      const adjustedProfitBps = path.profitBps - slippageBps;

      // Reject if slippage eats into profit
      const MIN_PROFIT_AFTER_SLIPPAGE = 5; // Must have at least 5 BPS profit after slippage
      if (adjustedProfitBps < MIN_PROFIT_AFTER_SLIPPAGE) {
        return {
          proceed: false,
          reason: `Slippage too high: ${slippageBps.toFixed(1)} BPS reduces profit from ${path.profitBps.toFixed(1)} to ${adjustedProfitBps.toFixed(1)} BPS`,
          slippageBps,
          adjustedProfitBps
        };
      }

      return { proceed: true, reason: 'OK', slippageBps, adjustedProfitBps };

    } catch (error: any) {
      logger.error(`Fill quality check failed: ${error.message}`);
      // On error, be conservative and block the trade
      return { proceed: false, reason: `Check failed: ${error.message}`, slippageBps: 0, adjustedProfitBps: 0 };
    }
  }

  /**
   * Execute an arbitrage path
   */
  private async executeArbPath(path: ArbPath): Promise<void> {
    if (this.isExecuting) return;
    this.isExecuting = true;

    let tradeId: string | null = null;

    try {
      const now = Date.now();
      if (now - this.lastTradeTime < this.cooldownMs) {
        logger.info('Multi-hop: In cooldown period');
        return;
      }

      // SAFETY CHECK 0: Block _REV paths (DEX buys) - DEX buy settlement is unreliable
      if (path.name.endsWith('_REV')) {
        logger.info(`🚫 MULTI-HOP BLOCKED: ${path.name} disabled - DEX buy settlement issues`);
        return;
      }

      // SAFETY CHECK 1: Reject unrealistic profit (>500 BPS = 5% is very suspicious for multi-hop)
      const MAX_REASONABLE_PROFIT_BPS = 500;
      if (path.profitBps > MAX_REASONABLE_PROFIT_BPS) {
        logger.error(`🚫 MULTI-HOP BLOCKED: Profit ${path.profitBps.toFixed(1)} BPS is unrealistic (max ${MAX_REASONABLE_PROFIT_BPS}). Likely a bug!`);
        return;
      }

      // SAFETY CHECK 2: Minimum trade size to avoid dust trades
      if (path.tradeSizeUsd < 5) {
        logger.info('Multi-hop: Trade size too small, skipping');
        return;
      }

      // SAFETY CHECK 3: Validate DEX fill quality (slippage check)
      const fillCheck = await this.checkDexFillQuality(path);
      if (!fillCheck.proceed) {
        logger.info(`🚫 MULTI-HOP BLOCKED: ${fillCheck.reason}`);
        return;
      }
      logger.info(`✅ Fill quality OK: Expected slippage ${fillCheck.slippageBps.toFixed(1)} BPS, adjusted profit ${fillCheck.adjustedProfitBps.toFixed(1)} BPS`);

      // Start tracking this trade (captures pre-trade balances)
      tradeId = await profitabilityTracker.startTrade(
        'multi-hop-arbitrage',
        path.name,
        path.profitBps,
        path.profitUsd,
        path.tradeSizeUsd
      );

      logger.info(`🚀 Executing multi-hop: ${path.name} (${path.direction})`);
      logger.info(`Expected profit: ${path.profitBps.toFixed(1)} BPS ($${path.profitUsd.toFixed(4)})`);

      await telegramNotifier.notify(
        `🔀 *MULTI-HOP ARB*\n\nPath: ${path.name}\nDirection: ${path.direction}\nExpected: +${path.profitBps.toFixed(1)} BPS ($${path.profitUsd.toFixed(4)})\n\n${this.config.dryRun ? '⚠️ DRY RUN' : '🚀 EXECUTING'}`,
        'high'
      );

      // Get start balances for P&L calculation
      const startXusdc = await this.getTokenBalance('XUSDC', 'xtokens');
      const startXmd = await this.getTokenBalance('XMD', 'xmd.token');
      const startValue = startXusdc + startXmd; // Both are USD-pegged

      // Execute based on path type
      switch (path.name) {
        case 'METAL_BRIDGE':
        case 'METAL_BRIDGE_REV':
          await this.executeMetalBridge(path);
          break;
        case 'LOAN_BRIDGE':
        case 'LOAN_BRIDGE_REV':
          await this.executeLoanBridge(path);
          break;
        case 'METAL_DIRECT':
        case 'METAL_DIRECT_REV':
          await this.executeMetalDirect(path);
          break;
        default:
          logger.warn(`Unknown path type: ${path.name}`);
      }

      this.lastTradeTime = now;

      // Get end balances for logging (NOT for circuit breaker - DEX fills are async)
      await new Promise(resolve => setTimeout(resolve, 500));
      const endXusdc = await this.getTokenBalance('XUSDC', 'xtokens');
      const endXmd = await this.getTokenBalance('XMD', 'xmd.token');
      const endValue = endXusdc + endXmd;

      // NOTE: Do NOT record P&L with circuit breaker here!
      // DEX fills are async (10-60+ seconds), so immediate measurement shows false losses.
      // Triangle arbitrage's periodic checkPortfolioPnl() handles circuit breaker updates.
      const immediatePnl = endValue - startValue;
      logger.info(`📊 Trade P&L (immediate, unreliable): $${immediatePnl.toFixed(4)} - actual verified via portfolio check`);

      if (tradeId) {
        profitabilityTracker.completeTrade(
          tradeId,
          path.tradeSizeUsd,
          path.tradeSizeUsd + immediatePnl,
          []
        );
      }

    } catch (error: any) {
      logger.error('Multi-hop execution failed:', error.message);

      // Don't record with circuit breaker - periodic portfolio check handles it

      if (tradeId) {
        profitabilityTracker.failTrade(tradeId, error.message);
      }
      await telegramNotifier.notify(`❌ Multi-hop failed: ${error.message}`, 'high');
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute METAL bridge path
   * XPR → METAL (AMM) → XMD (DEX) → XUSDC (Treasury) → XPR (AMM)
   */
  private async executeMetalBridge(path: ArbPath): Promise<void> {
    const xprusdc = this.poolStates.get('XPRUSDC')!;
    const metaxpr = this.poolStates.get('METAXPR')!;
    const metalXmd = this.dexMarkets.get('METAL_XMD')!;

    const startXpr = path.tradeSizeUsd / xprusdc.price;

    // Get METAL balance BEFORE swap to track exactly what we receive
    const metalBalBeforeRes = await this.rpc.get_table_rows({
      code: 'xtokens',
      scope: this.username,
      table: 'accounts',
      limit: 20,
      json: true
    });
    let metalBalanceBefore = 0;
    for (const row of metalBalBeforeRes.rows) {
      if (row.balance?.includes('METAL')) {
        metalBalanceBefore = parseFloat(row.balance);
      }
    }
    logger.info(`METAL balance before swap: ${metalBalanceBefore.toFixed(8)}`);

    // Step 1: XPR → METAL via METAXPR AMM
    const expectedMetal = this.calculateAmmOutput(startXpr, metaxpr, false);
    const minMetal = expectedMetal * 0.99;

    logger.info(`Step 1: Swap ${startXpr.toFixed(4)} XPR → ~${expectedMetal.toFixed(8)} METAL`);

    const swapActions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'proton.swaps',
        quantity: `${startXpr.toFixed(4)} XPR`,
        memo: `METAXPR,${minMetal.toFixed(8)} METAL`
      }
    }];

    const swapResult = await this.api.transact({ actions: swapActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

    // Wait longer for RPC to sync and retry balance check
    let metalBalanceAfter = 0;
    let actualMetalReceived = 0;

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metalBalRes = await this.rpc.get_table_rows({
        code: 'xtokens',
        scope: this.username,
        table: 'accounts',
        limit: 20,
        json: true
      });

      metalBalanceAfter = 0;
      for (const row of metalBalRes.rows) {
        if (row.balance?.includes('METAL')) {
          metalBalanceAfter = parseFloat(row.balance);
        }
      }

      actualMetalReceived = metalBalanceAfter - metalBalanceBefore;
      logger.info(`Balance check attempt ${attempt}: METAL=${metalBalanceAfter.toFixed(8)}, received=${actualMetalReceived.toFixed(8)}`);

      if (actualMetalReceived >= expectedMetal * 0.95) {
        break;
      }

      if (attempt < 5) {
        logger.info(`METAL not yet visible, retrying...`);
      }
    }

    if (actualMetalReceived < 1) {
      throw new Error(`Insufficient METAL received after 5 retries: ${actualMetalReceived.toFixed(8)} (expected ~${expectedMetal.toFixed(8)})`);
    }

    // Step 2: Sell METAL on DEX for XMD
    // CRITICAL FIX: Sell EXACTLY what we just received, not 50% of total balance!
    const metalPriceUsd = 0.144;
    const intendedMetalSell = actualMetalReceived * 0.999; // Sell 99.9% of what we received (tiny buffer for rounding)
    const safetyCheck = this.validateTradeAmount('METAL', intendedMetalSell, metalBalanceAfter, metalPriceUsd);

    if (!safetyCheck.safe) {
      throw new Error(`SAFETY BLOCKED: ${safetyCheck.reason}`);
    }

    const metalToSell = safetyCheck.amount;
    const metalRaw = Math.floor(metalToSell * 1e8);

    // Use profit-linked slippage tolerance instead of hardcoded 2%
    const sellLimitPrice = this.calculateSellLimitPrice(metalXmd.bestBid, path.profitBps);
    const priceRaw = Math.floor(sellLimitPrice * 1e6);
    const slippageBps = ((metalXmd.bestBid - sellLimitPrice) / metalXmd.bestBid) * 10000;

    logger.info(`Step 2: Sell ${metalToSell.toFixed(8)} METAL on DEX @ ${sellLimitPrice.toFixed(6)} (${slippageBps.toFixed(0)} BPS below bid)`);

    const dexActions = [
      {
        account: 'xtokens',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${metalToSell.toFixed(8)} METAL`,
          memo: ''
        }
      },
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: metalXmd.marketId,
          account: this.username,
          order_type: 1,
          order_side: 2, // Sell
          quantity: metalRaw,
          price: priceRaw,
          bid_symbol: { sym: '8,METAL', contract: 'xtokens' },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0,
          referrer: ''
        }
      },
      {
        account: 'dex',
        name: 'process',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { q_size: 10, show_error_msg: 0 }
      },
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { account: this.username }
      }
    ];

    const dexResult = await this.api.transact({ actions: dexActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('DEX sell executed: ' + (dexResult as any).transaction_id);

    // DEX sell placed. DEX fills are async (10-60+ seconds).
    // Do NOT wait for XMD - autoRedeemStuckXmd() will handle it when it arrives.
    // If the order doesn't fill, cleanupStaleOrders() will cancel and recover.
    logger.info(`METAL_BRIDGE: DEX sell placed, stopping here. Auto-redeem will handle XMD when fill arrives.`);

    await telegramNotifier.notify(
      `✅ *METAL Bridge DEX Sell Placed*\n\nPath: ${path.direction}\nExpected profit: +${path.profitBps.toFixed(1)} BPS\n\n⏳ Waiting for async DEX fill → auto-redeem`,
      'high'
    );
  }

  /**
   * Execute LOAN bridge path
   * Forward: XPR → LOAN (AMM) → XMD (DEX sell, async fill)
   * Auto-redeem handles XMD → XUSDC when DEX fill arrives.
   */
  private async executeLoanBridge(path: ArbPath): Promise<void> {
    const xprusdc = this.poolStates.get('XPRUSDC')!;
    const xprloan = this.poolStates.get('XPRLOAN')!;
    const loanXmd = this.dexMarkets.get('LOAN_XMD')!;

    // Handle reverse path: Buy LOAN on DEX, sell to AMM
    if (path.name === 'LOAN_BRIDGE_REV') {
      await this.executeLoanBridgeReverse(path, xprusdc, xprloan, loanXmd);
      return;
    }

    // Pre-flight: Re-fetch FRESH prices and re-calculate profitability
    // (same pattern as executeMetalDirect)
    await this.fetchDexMarket('LOAN_XMD');
    await this.fetchPoolStates();

    const freshXprusdc = this.poolStates.get('XPRUSDC')!;
    const freshXprloan = this.poolStates.get('XPRLOAN')!;
    const freshLoanXmd = this.dexMarkets.get('LOAN_XMD')!;

    const freshPath = await this.checkLoanPath();
    if (!freshPath || freshPath.profitBps < this.config.minProfitBps) {
      const currentProfit = freshPath ? freshPath.profitBps.toFixed(1) : 'N/A';
      logger.warn(`❌ LOAN_BRIDGE ABORTED: Price moved. Fresh profit: ${currentProfit} BPS < required ${this.config.minProfitBps} BPS`);
      await telegramNotifier.notify(
        `❌ LOAN BRIDGE aborted: Price moved. Fresh profit ${currentProfit} BPS (need ${this.config.minProfitBps})`,
        'normal'
      );
      throw new Error(`Price moved: profit dropped to ${currentProfit} BPS`);
    }

    if (freshPath.name !== path.name) {
      logger.warn(`❌ LOAN_BRIDGE ABORTED: Path direction flipped to ${freshPath.name}`);
      throw new Error(`Path direction flipped to ${freshPath.name}`);
    }

    logger.info(`✅ Pre-flight check passed: LOAN_BRIDGE still profitable at ${freshPath.profitBps.toFixed(1)} BPS`);

    // Forward path: Sell LOAN on DEX
    const startXpr = path.tradeSizeUsd / freshXprusdc.price;

    // Get LOAN balance BEFORE swap to track exactly what we receive
    const loanBalBeforeRes = await this.rpc.get_table_rows({
      code: 'loan.token',
      scope: this.username,
      table: 'accounts',
      limit: 10,
      json: true
    });
    let loanBalanceBefore = 0;
    for (const row of loanBalBeforeRes.rows) {
      if (row.balance?.includes('LOAN')) {
        loanBalanceBefore = parseFloat(row.balance);
      }
    }
    logger.info(`LOAN balance before swap: ${loanBalanceBefore.toFixed(4)}`);

    // Step 1: XPR → LOAN via XPRLOAN AMM
    // XPRLOAN pool: pool1=XPR, pool2=LOAN
    const expectedLoan = this.calculateAmmOutput(startXpr, freshXprloan, true); // true = forward direction (XPR→LOAN)
    const minLoan = expectedLoan * 0.99;

    logger.info(`Step 1: Swap ${startXpr.toFixed(4)} XPR → ~${expectedLoan.toFixed(4)} LOAN`);

    const swapActions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'proton.swaps',
        quantity: `${startXpr.toFixed(4)} XPR`,
        memo: `XPRLOAN,${minLoan.toFixed(4)} LOAN`
      }
    }];

    const swapResult = await this.api.transact({ actions: swapActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

    // Wait longer for RPC to sync and retry balance check
    let loanBalanceAfter = 0;
    let actualLoanReceived = 0;

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const loanBalRes = await this.rpc.get_table_rows({
        code: 'loan.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      });

      loanBalanceAfter = 0;
      for (const row of loanBalRes.rows) {
        if (row.balance?.includes('LOAN')) {
          loanBalanceAfter = parseFloat(row.balance);
        }
      }

      actualLoanReceived = loanBalanceAfter - loanBalanceBefore;
      logger.info(`Balance check attempt ${attempt}: LOAN=${loanBalanceAfter.toFixed(4)}, received=${actualLoanReceived.toFixed(4)}`);

      if (actualLoanReceived >= expectedLoan * 0.95) {
        break;
      }

      if (attempt < 5) {
        logger.info(`LOAN not yet visible, retrying...`);
      }
    }

    if (actualLoanReceived < 100) {
      throw new Error(`Insufficient LOAN received after 5 retries: ${actualLoanReceived.toFixed(4)} (expected ~${expectedLoan.toFixed(4)})`);
    }

    // Step 2: Sell LOAN on DEX for XMD
    // CRITICAL FIX: Sell EXACTLY what we just received, not 50% of total balance!
    const loanPriceUsd = 0.00043;
    const intendedLoanSell = actualLoanReceived * 0.999; // Sell 99.9% of what we received (tiny buffer for rounding)
    const safetyCheck = this.validateTradeAmount('LOAN', intendedLoanSell, loanBalanceAfter, loanPriceUsd);

    if (!safetyCheck.safe) {
      throw new Error(`SAFETY BLOCKED: ${safetyCheck.reason}`);
    }

    const loanToSell = safetyCheck.amount;
    const loanRaw = Math.floor(loanToSell * 1e4); // LOAN has 4 decimals

    // Use profit-linked slippage tolerance instead of hardcoded 2%
    const sellLimitPrice = this.calculateSellLimitPrice(freshLoanXmd.bestBid, path.profitBps);
    const priceRaw = Math.floor(sellLimitPrice * 1e6);
    const slippageBps = ((freshLoanXmd.bestBid - sellLimitPrice) / freshLoanXmd.bestBid) * 10000;

    logger.info(`Step 2: Sell ${loanToSell.toFixed(4)} LOAN on DEX @ ${sellLimitPrice.toFixed(6)} (${slippageBps.toFixed(0)} BPS below bid)`);

    const dexActions = [
      {
        account: 'loan.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${loanToSell.toFixed(4)} LOAN`,
          memo: ''
        }
      },
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: freshLoanXmd.marketId,
          account: this.username,
          order_type: 1,
          order_side: 2, // Sell
          quantity: loanRaw,
          price: priceRaw,
          bid_symbol: { sym: '4,LOAN', contract: 'loan.token' },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0,
          referrer: ''
        }
      },
      {
        account: 'dex',
        name: 'process',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { q_size: 10, show_error_msg: 0 }
      },
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { account: this.username }
      }
    ];

    const dexResult = await this.api.transact({ actions: dexActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('DEX sell executed: ' + (dexResult as any).transaction_id);

    // DEX sell placed. DEX fills are async (10-60+ seconds).
    // Do NOT wait for XMD - autoRedeemStuckXmd() will handle it when it arrives.
    // If the order doesn't fill, cleanupStaleOrders() will cancel and recover.
    logger.info(`LOAN_BRIDGE: DEX sell placed, stopping here. Auto-redeem will handle XMD when fill arrives.`);

    await telegramNotifier.notify(
      `✅ *LOAN Bridge DEX Sell Placed*\n\nPath: ${path.direction}\nExpected profit: +${path.profitBps.toFixed(1)} BPS\n\n⏳ Waiting for async DEX fill → auto-redeem`,
      'high'
    );
  }

  /**
   * Execute LOAN bridge reverse path:
   * XUSDC → XMD (Treasury) → LOAN (DEX buy) → XPR (AMM) → XUSDC (AMM)
   */
  private async executeLoanBridgeReverse(
    path: ArbPath,
    xprusdc: PoolState,
    xprloan: PoolState,
    loanXmd: DexMarket
  ): Promise<void> {
    // SAFETY: Validate DEX prices are reasonable before execution
    if (loanXmd.bestAsk === 0 || loanXmd.bestAsk < 0.0001 || loanXmd.bestAsk > 0.01) {
      throw new Error(`SAFETY: Invalid LOAN bestAsk price: ${loanXmd.bestAsk}. Expected ~0.0004. Aborting.`);
    }
    logger.info(`Pre-execution validation: LOAN bestAsk=${loanXmd.bestAsk.toFixed(6)} (OK)`);

    // Step 1: Check XUSDC balance, mint XMD
    const xusdcBalRes = await this.rpc.get_table_rows({
      code: 'xtokens',
      scope: this.username,
      table: 'accounts',
      limit: 20,
      json: true
    });

    let xusdcBalance = 0;
    for (const row of xusdcBalRes.rows) {
      if (row.balance?.includes('XUSDC')) {
        xusdcBalance = parseFloat(row.balance);
      }
    }

    if (xusdcBalance < path.tradeSizeUsd) {
      throw new Error(`Not enough XUSDC. Have: ${xusdcBalance.toFixed(2)}, need: ${path.tradeSizeUsd}`);
    }

    const xmdToMint = Math.min(path.tradeSizeUsd, xusdcBalance * 0.95);
    logger.info(`Step 1: Mint ${xmdToMint.toFixed(6)} XMD from XUSDC`);

    const mintActions = [{
      account: 'xtokens',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'xmd.treasury',
        quantity: `${xmdToMint.toFixed(6)} XUSDC`,
        memo: 'mint'
      }
    }];

    await this.api.transact({ actions: mintActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Get LOAN balance BEFORE DEX buy to track what we actually receive
    const loanBalBeforeRes = await this.rpc.get_table_rows({
      code: 'loan.token',
      scope: this.username,
      table: 'accounts',
      limit: 10,
      json: true
    });
    let loanBalanceBefore = 0;
    for (const row of loanBalBeforeRes.rows) {
      if (row.balance?.includes('LOAN')) {
        loanBalanceBefore = parseFloat(row.balance);
      }
    }
    logger.info(`LOAN balance before DEX buy: ${loanBalanceBefore.toFixed(4)}`);

    // Step 2: Buy LOAN on DEX with XMD
    // Use profit-linked slippage tolerance instead of hardcoded 2%
    const effectivePrice = this.calculateBuyLimitPrice(loanXmd.bestAsk, path.profitBps);
    const slippageBps = ((effectivePrice - loanXmd.bestAsk) / loanXmd.bestAsk) * 10000;
    const loanToBuy = xmdToMint / effectivePrice; // Expected LOAN to receive
    const priceRaw = Math.floor(effectivePrice * 1e6);
    const xmdNeeded = xmdToMint; // Use exactly what we minted, don't overspend

    // CRITICAL FIX: For BUY orders, quantity = XMD amount to spend (in raw 6-decimal format)
    // NOT the LOAN amount to buy!
    const xmdToSpendRaw = Math.floor(xmdNeeded * 1e6); // XMD has 6 decimals

    logger.info(`Step 2: Buy ~${loanToBuy.toFixed(4)} LOAN on DEX @ ${effectivePrice.toFixed(6)} (${slippageBps.toFixed(0)} BPS above ask)`);
    logger.info(`  Spending: ${xmdNeeded.toFixed(6)} XMD (raw: ${xmdToSpendRaw})`);
    logger.info(`  Price raw: ${priceRaw}`);

    if (xmdNeeded > this.MAX_SINGLE_TRADE_USD * 2) {
      throw new Error(`SAFETY: Trade size ${xmdNeeded.toFixed(2)} XMD exceeds max $${this.MAX_SINGLE_TRADE_USD * 2}! Aborting.`);
    }

    const dexActions = [
      {
        account: 'xmd.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${xmdNeeded.toFixed(6)} XMD`,
          memo: ''
        }
      },
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: loanXmd.marketId,
          account: this.username,
          order_type: 1,
          order_side: 1, // Buy
          quantity: xmdToSpendRaw,  // FIXED: XMD amount to spend, not LOAN amount!
          price: priceRaw,
          bid_symbol: { sym: '4,LOAN', contract: 'loan.token' },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0,
          referrer: ''
        }
      },
      {
        account: 'dex',
        name: 'process',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { q_size: 10, show_error_msg: 0 }
      },
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { account: this.username }
      }
    ];

    const dexResult = await this.api.transact({ actions: dexActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('DEX buy executed: ' + (dexResult as any).transaction_id);

    // Wait longer for RPC to sync and retry balance check
    let loanBalance = 0;
    let actualLoanReceived = 0;

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const loanBalRes = await this.rpc.get_table_rows({
        code: 'loan.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      });

      loanBalance = 0;
      for (const row of loanBalRes.rows) {
        if (row.balance?.includes('LOAN')) {
          loanBalance = parseFloat(row.balance);
        }
      }

      actualLoanReceived = loanBalance - loanBalanceBefore;
      logger.info(`Balance check attempt ${attempt}: LOAN=${loanBalance.toFixed(4)}, received=${actualLoanReceived.toFixed(4)}`);

      if (actualLoanReceived >= loanToBuy * 0.90) {
        break;
      }

      if (attempt < 5) {
        logger.info(`LOAN not yet visible, retrying...`);
      }
    }

    if (actualLoanReceived < 100) {
      throw new Error(`DEX buy failed after 5 retries - only received ${actualLoanReceived.toFixed(4)} LOAN`);
    }

    // Step 3: Swap LOAN → XPR via XPRLOAN AMM
    // CRITICAL: Only swap the LOAN we actually received, not expected amount!
    const intendedLoanSwap = actualLoanReceived * 0.999;

    // SAFETY VALIDATION: Check trade amount before swapping
    const loanPriceUsd = 0.00043; // Approximate LOAN price
    const safetyCheck = this.validateTradeAmount('LOAN', intendedLoanSwap, loanBalance, loanPriceUsd);

    if (!safetyCheck.safe) {
      throw new Error(`SAFETY BLOCKED: ${safetyCheck.reason}`);
    }

    const loanToSwap = safetyCheck.amount;
    logger.info(`Step 3: Swap ${loanToSwap.toFixed(4)} LOAN (safety validated) → XPR`);

    // Get XPR balance BEFORE swap to track what we actually receive
    const xprBalBeforeRes = await this.rpc.get_table_rows({
      code: 'eosio.token',
      scope: this.username,
      table: 'accounts',
      limit: 10,
      json: true
    });
    let xprBalanceBefore = 0;
    for (const row of xprBalBeforeRes.rows) {
      if (row.balance?.includes('XPR')) {
        xprBalanceBefore = parseFloat(row.balance);
      }
    }
    logger.info(`XPR balance before swap: ${xprBalanceBefore.toFixed(4)}`);

    const expectedXpr = this.calculateAmmOutput(loanToSwap, xprloan, false); // LOAN is token2, so false
    const minXpr = expectedXpr * 0.99;

    logger.info(`Step 3: Expecting ~${expectedXpr.toFixed(4)} XPR from ${loanToSwap.toFixed(4)} LOAN`);

    const swapActions = [{
      account: 'loan.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'proton.swaps',
        quantity: `${loanToSwap.toFixed(4)} LOAN`,
        memo: `XPRLOAN,${minXpr.toFixed(4)} XPR`
      }
    }];

    const swapResult = await this.api.transact({ actions: swapActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

    // Wait longer for RPC to sync and retry balance check
    let xprBalanceAfter = 0;
    let actualXprReceived = 0;

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const xprBalRes = await this.rpc.get_table_rows({
        code: 'eosio.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      });

      xprBalanceAfter = 0;
      for (const row of xprBalRes.rows) {
        if (row.balance?.includes('XPR')) {
          xprBalanceAfter = parseFloat(row.balance);
        }
      }

      actualXprReceived = xprBalanceAfter - xprBalanceBefore;
      logger.info(`Balance check attempt ${attempt}: XPR=${xprBalanceAfter.toFixed(4)}, received=${actualXprReceived.toFixed(4)}`);

      if (actualXprReceived >= expectedXpr * 0.95) {
        break;
      }

      if (attempt < 5) {
        logger.info(`XPR not yet visible, retrying...`);
      }
    }

    if (actualXprReceived < 100) {
      throw new Error(`AMM swap failed after 5 retries - only received ${actualXprReceived.toFixed(4)} XPR`);
    }

    // CRITICAL FIX: Swap exactly what we received, NOT 50% of total balance!
    const xprToSwap = actualXprReceived * 0.999; // 99.9% of what we received
    const expectedXusdc = this.calculateAmmOutput(xprToSwap, xprusdc, true); // XPR is token1
    const minXusdc = expectedXusdc * 0.99;

    logger.info(`Step 4: Swap ${xprToSwap.toFixed(4)} XPR → ~${expectedXusdc.toFixed(6)} XUSDC`);

    const finalSwapActions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'proton.swaps',
        quantity: `${xprToSwap.toFixed(4)} XPR`,
        memo: `XPRUSDC,${minXusdc.toFixed(6)} XUSDC`
      }
    }];

    const finalResult = await this.api.transact({ actions: finalSwapActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });
    logger.info('Final swap executed: ' + (finalResult as any).transaction_id);

    await telegramNotifier.notify(
      `✅ *LOAN Bridge REV Complete*\n\nPath: ${path.direction}\nExpected profit: +${path.profitBps.toFixed(1)} BPS`,
      'high'
    );
  }

  /**
   * Execute direct METAL/XMD arbitrage
   * Compares METAXMD AMM vs METAL_XMD DEX
   */
  private async executeMetalDirect(path: ArbPath): Promise<void> {
    // CRITICAL: Re-fetch FRESH prices before executing
    // The cached prices may be stale (prices moved between detection and execution)
    await this.fetchDexMarket('METAL_XMD');
    await this.fetchPoolStates();

    const metaxmd = this.poolStates.get('METAXMD')!;
    const metalXmd = this.dexMarkets.get('METAL_XMD')!;

    // Re-calculate profitability with fresh prices
    const freshPath = await this.checkMetalDirectPath();
    if (!freshPath || freshPath.profitBps < this.config.minProfitBps) {
      const currentProfit = freshPath ? freshPath.profitBps.toFixed(1) : 'N/A';
      logger.warn(`❌ ${path.name} ABORTED: Price moved. Fresh profit: ${currentProfit} BPS < required ${this.config.minProfitBps} BPS`);
      await telegramNotifier.notify(
        `❌ ${path.name} aborted: Price moved. Fresh profit ${currentProfit} BPS (need ${this.config.minProfitBps})`,
        'normal'
      );
      throw new Error(`Price moved: profit dropped to ${currentProfit} BPS`);
    }

    // Also verify the path direction didn't flip
    if (freshPath.name !== path.name) {
      logger.warn(`❌ ${path.name} ABORTED: Path direction flipped to ${freshPath.name}`);
      await telegramNotifier.notify(
        `❌ ${path.name} aborted: Direction flipped to ${freshPath.name}`,
        'normal'
      );
      throw new Error(`Path direction flipped to ${freshPath.name}`);
    }

    logger.info(`✅ Pre-flight check passed: ${path.name} still profitable at ${freshPath.profitBps.toFixed(1)} BPS`);

    if (path.name === 'METAL_DIRECT') {
      // Path: XMD → METAL (AMM) → XMD (DEX sell)
      // Buy METAL on AMM, sell on DEX

      // Check current XMD balance
      const xmdBalRes = await this.rpc.get_table_rows({
        code: 'xmd.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      });

      let xmdBalance = 0;
      for (const row of xmdBalRes.rows) {
        if (row.balance?.includes('XMD')) {
          xmdBalance = parseFloat(row.balance);
        }
      }

      // If no XMD, mint from XUSDC first
      if (xmdBalance < path.tradeSizeUsd) {
        const xusdcBalRes = await this.rpc.get_table_rows({
          code: 'xtokens',
          scope: this.username,
          table: 'accounts',
          limit: 20,
          json: true
        });

        let xusdcBalance = 0;
        for (const row of xusdcBalRes.rows) {
          if (row.balance?.includes('XUSDC')) {
            xusdcBalance = parseFloat(row.balance);
          }
        }

        if (xusdcBalance < path.tradeSizeUsd) {
          throw new Error(`Not enough XUSDC to mint XMD. Have: ${xusdcBalance.toFixed(2)}, need: ${path.tradeSizeUsd}`);
        }

        // Mint XMD from XUSDC
        const xmdToMint = Math.min(path.tradeSizeUsd, xusdcBalance * 0.95);
        logger.info(`Step 0: Mint ${xmdToMint.toFixed(6)} XMD from XUSDC`);

        const mintActions = [{
          account: 'xtokens',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'xmd.treasury',
            quantity: `${xmdToMint.toFixed(6)} XUSDC`,
            memo: 'mint'
          }
        }];

        await this.api.transact({ actions: mintActions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        xmdBalance = xmdToMint;
      }

      const xmdToSwap = Math.min(xmdBalance, path.tradeSizeUsd);

      // Get METAL balance BEFORE swap to track exactly what we receive
      const metalBalBeforeRes = await this.rpc.get_table_rows({
        code: 'xtokens',
        scope: this.username,
        table: 'accounts',
        limit: 20,
        json: true
      });
      let metalBalanceBefore = 0;
      for (const row of metalBalBeforeRes.rows) {
        if (row.balance?.includes('METAL')) {
          metalBalanceBefore = parseFloat(row.balance);
        }
      }
      logger.info(`METAL balance before swap: ${metalBalanceBefore.toFixed(8)}`);

      // Step 1: XMD → METAL via METAXMD AMM
      // METAXMD pool: token1=METAL, token2=XMD
      const expectedMetal = this.calculateAmmOutput(xmdToSwap, metaxmd, false); // XMD is token2
      const minMetal = expectedMetal * 0.99;

      logger.info(`Step 1: Swap ${xmdToSwap.toFixed(6)} XMD → ~${expectedMetal.toFixed(8)} METAL`);

      const swapActions = [{
        account: 'xmd.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'proton.swaps',
          quantity: `${xmdToSwap.toFixed(6)} XMD`,
          memo: `METAXMD,${minMetal.toFixed(8)} METAL`
        }
      }];

      const swapResult = await this.api.transact({ actions: swapActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });
      logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

      // Wait longer for RPC to sync and retry balance check
      let metalBalanceAfter = 0;
      let actualMetalReceived = 0;

      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts

        // Get METAL balance AFTER swap
        const metalBalRes = await this.rpc.get_table_rows({
          code: 'xtokens',
          scope: this.username,
          table: 'accounts',
          limit: 20,
          json: true
        });

        metalBalanceAfter = 0;
        for (const row of metalBalRes.rows) {
          if (row.balance?.includes('METAL')) {
            metalBalanceAfter = parseFloat(row.balance);
          }
        }

        actualMetalReceived = metalBalanceAfter - metalBalanceBefore;
        logger.info(`Balance check attempt ${attempt}: METAL=${metalBalanceAfter.toFixed(8)}, received=${actualMetalReceived.toFixed(8)}`);

        if (actualMetalReceived >= expectedMetal * 0.95) {
          break; // Got expected amount, proceed
        }

        if (attempt < 5) {
          logger.info(`METAL not yet visible, retrying...`);
        }
      }

      if (actualMetalReceived < 1) {
        throw new Error(`Insufficient METAL received after 5 retries: ${actualMetalReceived.toFixed(8)} (expected ~${expectedMetal.toFixed(8)})`);
      }

      // Step 2: Sell METAL on DEX for XMD
      // CRITICAL FIX: Sell EXACTLY what we just received, not 50% of total balance!
      const metalPriceUsd = 0.144;
      const intendedMetalSell = actualMetalReceived * 0.999; // Sell 99.9% of what we received
      const safetyCheck = this.validateTradeAmount('METAL', intendedMetalSell, metalBalanceAfter, metalPriceUsd);

      if (!safetyCheck.safe) {
        throw new Error(`SAFETY BLOCKED: ${safetyCheck.reason}`);
      }

      const metalToSell = safetyCheck.amount;
      const metalRaw = Math.floor(metalToSell * 1e8);

      // Use profit-linked slippage tolerance instead of hardcoded 2%
      const sellLimitPrice = this.calculateSellLimitPrice(metalXmd.bestBid, path.profitBps);
      const priceRaw = Math.floor(sellLimitPrice * 1e6);
      const slippageBps = ((metalXmd.bestBid - sellLimitPrice) / metalXmd.bestBid) * 10000;

      logger.info(`Step 2: Sell ${metalToSell.toFixed(8)} METAL on DEX @ ${sellLimitPrice.toFixed(6)} (${slippageBps.toFixed(0)} BPS below bid)`);

      const dexActions = [
        {
          account: 'xtokens',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'dex',
            quantity: `${metalToSell.toFixed(8)} METAL`,
            memo: ''
          }
        },
        {
          account: 'dex',
          name: 'placeorder',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            market_id: metalXmd.marketId,
            account: this.username,
            order_type: 1,
            order_side: 2, // Sell
            quantity: metalRaw,
            price: priceRaw,
            bid_symbol: { sym: '8,METAL', contract: 'xtokens' },
            ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
            trigger_price: 0,
            fill_type: 0, // Normal limit order
            referrer: ''
          }
        },
        {
          account: 'dex',
          name: 'process',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: { q_size: 10, show_error_msg: 0 }
        },
        {
          account: 'dex',
          name: 'withdrawall',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: { account: this.username }
        }
      ];

      const dexResult = await this.api.transact({ actions: dexActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });
      logger.info('DEX sell executed: ' + (dexResult as any).transaction_id);

      await telegramNotifier.notify(
        `✅ *METAL Direct ARB Complete*\n\nPath: Buy METAL on AMM, sell on DEX\nExpected profit: +${path.profitBps.toFixed(1)} BPS`,
        'high'
      );

    } else if (path.name === 'METAL_DIRECT_REV') {
      // Path: XMD → METAL (DEX buy) → XMD (AMM sell)
      // Buy METAL on DEX, sell to AMM

      // SAFETY: Validate DEX prices are reasonable before execution
      if (metalXmd.bestAsk === 0 || metalXmd.bestAsk < 0.05 || metalXmd.bestAsk > 1.0) {
        throw new Error(`SAFETY: Invalid METAL bestAsk price: ${metalXmd.bestAsk}. Expected ~0.14. Aborting.`);
      }
      logger.info(`Pre-execution validation: METAL bestAsk=${metalXmd.bestAsk.toFixed(6)} (OK)`);

      // Check XMD balance, mint if needed
      const xmdBalRes = await this.rpc.get_table_rows({
        code: 'xmd.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      });

      let xmdBalance = 0;
      for (const row of xmdBalRes.rows) {
        if (row.balance?.includes('XMD')) {
          xmdBalance = parseFloat(row.balance);
        }
      }

      if (xmdBalance < path.tradeSizeUsd) {
        const xusdcBalRes = await this.rpc.get_table_rows({
          code: 'xtokens',
          scope: this.username,
          table: 'accounts',
          limit: 20,
          json: true
        });

        let xusdcBalance = 0;
        for (const row of xusdcBalRes.rows) {
          if (row.balance?.includes('XUSDC')) {
            xusdcBalance = parseFloat(row.balance);
          }
        }

        if (xusdcBalance < path.tradeSizeUsd) {
          throw new Error(`Not enough XUSDC to mint XMD. Have: ${xusdcBalance.toFixed(2)}, need: ${path.tradeSizeUsd}`);
        }

        const xmdToMint = Math.min(path.tradeSizeUsd, xusdcBalance * 0.95);
        logger.info(`Step 0: Mint ${xmdToMint.toFixed(6)} XMD from XUSDC`);

        const mintActions = [{
          account: 'xtokens',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'xmd.treasury',
            quantity: `${xmdToMint.toFixed(6)} XUSDC`,
            memo: 'mint'
          }
        }];

        await this.api.transact({ actions: mintActions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        xmdBalance = xmdToMint;
      }

      const xmdToUse = Math.min(xmdBalance, path.tradeSizeUsd);

      // Get METAL balance BEFORE DEX buy to track what we actually receive
      const metalBalBeforeRes = await this.rpc.get_table_rows({
        code: 'xtokens',
        scope: this.username,
        table: 'accounts',
        limit: 20,
        json: true
      });
      let metalBalanceBefore = 0;
      for (const row of metalBalBeforeRes.rows) {
        if (row.balance?.includes('METAL')) {
          metalBalanceBefore = parseFloat(row.balance);
        }
      }
      logger.info(`METAL balance before DEX buy: ${metalBalanceBefore.toFixed(8)}`);

      // Step 1: Buy METAL on DEX with XMD
      // Use profit-linked slippage tolerance instead of hardcoded 2%
      const effectivePrice = this.calculateBuyLimitPrice(metalXmd.bestAsk, path.profitBps);
      const slippageBps = ((effectivePrice - metalXmd.bestAsk) / metalXmd.bestAsk) * 10000;
      const metalToBuy = xmdToUse / effectivePrice;  // Expected METAL to receive
      const priceRaw = Math.floor(effectivePrice * 1e6);
      const xmdNeeded = xmdToUse;  // Use exactly what we have, don't overspend

      // CRITICAL FIX: For BUY orders, quantity = XMD amount to spend (in raw 6-decimal format)
      // NOT the METAL amount to buy!
      const xmdToSpendRaw = Math.floor(xmdNeeded * 1e6); // XMD has 6 decimals

      logger.info(`Step 1: Buy ~${metalToBuy.toFixed(8)} METAL on DEX @ ${effectivePrice.toFixed(6)} (${slippageBps.toFixed(0)} BPS above ask)`);
      logger.info(`  Spending: ${xmdNeeded.toFixed(6)} XMD (raw: ${xmdToSpendRaw})`);
      logger.info(`  Price raw: ${priceRaw}`);

      if (xmdNeeded > this.MAX_SINGLE_TRADE_USD * 2) {
        throw new Error(`SAFETY: Trade size ${xmdNeeded.toFixed(2)} XMD exceeds max $${this.MAX_SINGLE_TRADE_USD * 2}! Aborting.`);
      }

      const dexActions = [
        {
          account: 'xmd.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'dex',
            quantity: `${xmdNeeded.toFixed(6)} XMD`,
            memo: ''
          }
        },
        {
          account: 'dex',
          name: 'placeorder',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            market_id: metalXmd.marketId,
            account: this.username,
            order_type: 1,
            order_side: 1, // Buy
            quantity: xmdToSpendRaw,  // FIXED: XMD amount to spend, not METAL amount!
            price: priceRaw,
            bid_symbol: { sym: '8,METAL', contract: 'xtokens' },
            ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
            trigger_price: 0,
            fill_type: 0,
            referrer: ''
          }
        },
        {
          account: 'dex',
          name: 'process',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: { q_size: 10, show_error_msg: 0 }
        },
        {
          account: 'dex',
          name: 'withdrawall',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: { account: this.username }
        }
      ];

      const dexResult = await this.api.transact({ actions: dexActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });
      logger.info('DEX buy executed: ' + (dexResult as any).transaction_id);

      // Wait longer for RPC to sync and retry balance check
      let metalBalance = 0;
      let actualMetalReceived = 0;
      const expectedMetalFromDex = metalToBuy; // Use the already-calculated expected amount

      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const metalBalRes = await this.rpc.get_table_rows({
          code: 'xtokens',
          scope: this.username,
          table: 'accounts',
          limit: 20,
          json: true
        });

        metalBalance = 0;
        for (const row of metalBalRes.rows) {
          if (row.balance?.includes('METAL')) {
            metalBalance = parseFloat(row.balance);
          }
        }

        actualMetalReceived = metalBalance - metalBalanceBefore;
        logger.info(`Balance check attempt ${attempt}: METAL=${metalBalance.toFixed(8)}, received=${actualMetalReceived.toFixed(8)}`);

        if (actualMetalReceived >= expectedMetalFromDex * 0.90) {
          break;
        }

        if (attempt < 5) {
          logger.info(`METAL not yet visible, retrying...`);
        }
      }

      if (actualMetalReceived < 1) {
        throw new Error(`DEX buy failed after 5 retries - only received ${actualMetalReceived.toFixed(8)} METAL`);
      }

      // Step 2: Sell METAL to AMM for XMD
      // CRITICAL: Only sell the METAL we actually received from DEX, not entire balance!
      const metalPriceUsd = 0.144;
      logger.info(`METAL received from DEX: ${actualMetalReceived.toFixed(8)} (was: ${metalBalanceBefore.toFixed(8)}, now: ${metalBalance.toFixed(8)})`);


      const intendedMetalSell = actualMetalReceived * 0.999; // Sell exactly what we received minus tiny buffer
      const safetyCheck = this.validateTradeAmount('METAL', intendedMetalSell, metalBalance, metalPriceUsd);

      if (!safetyCheck.safe) {
        throw new Error(`SAFETY BLOCKED: ${safetyCheck.reason}`);
      }

      const metalToSell = safetyCheck.amount;
      const expectedXmd = this.calculateAmmOutput(metalToSell, metaxmd, true); // METAL is token1
      const minXmd = expectedXmd * 0.99;

      logger.info(`Step 2: Swap ${metalToSell.toFixed(8)} METAL (safety validated) → ~${expectedXmd.toFixed(6)} XMD`);

      const swapActions = [{
        account: 'xtokens',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'proton.swaps',
          quantity: `${metalToSell.toFixed(8)} METAL`,
          memo: `METAXMD,${minXmd.toFixed(6)} XMD`
        }
      }];

      const swapResult = await this.api.transact({ actions: swapActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });
      logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

      await telegramNotifier.notify(
        `✅ *METAL Direct ARB Complete*\n\nPath: Buy METAL on DEX, sell to AMM\nExpected profit: +${path.profitBps.toFixed(1)} BPS`,
        'high'
      );
    }
  }

  /**
   * Auto-redeem any stuck XMD to XUSDC via treasury.
   * Handles async DEX fills that arrive after the trade function returns.
   * Idempotent - safe if triangle arb also redeems in the same cycle.
   */
  private async autoRedeemStuckXmd(): Promise<void> {
    const xmdBalance = await this.getTokenBalance('XMD', 'xmd.token');

    if (xmdBalance > 1) {
      logger.info(`🔄 Multi-hop auto-recovery: Found ${xmdBalance.toFixed(6)} stuck XMD, redeeming to XUSDC...`);

      try {
        const treasuryActions = [{
          account: 'xmd.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'xmd.treasury',
            quantity: `${xmdBalance.toFixed(6)} XMD`,
            memo: 'redeem,XUSDC'
          }
        }];

        const result = await this.api.transact({ actions: treasuryActions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });

        logger.info('Multi-hop auto-recovery: XMD redeemed - ' + (result as any).transaction_id);
        await telegramNotifier.notify(
          `🔄 *Multi-hop Auto-Recovery*\nRedeemed ${xmdBalance.toFixed(2)} XMD to XUSDC`,
          'normal'
        );
      } catch (error: any) {
        logger.error('Multi-hop auto-recovery failed:', error.message);
      }
    }
  }

  /**
   * Cleanup stale orders on LOAN_XMD (market 9) and METAL_XMD (market 10).
   * Queries on-chain DEX orderbook (not API, which returns 404 for open orders).
   * Cancels any tradingbot orders, withdraws funds, then recovers stuck tokens.
   */
  private async cleanupStaleOrders(): Promise<void> {
    try {
      // Query on-chain orderbook for our orders on markets 9 and 10
      const orderbookRes = await this.rpc.get_table_rows({
        code: 'dex',
        scope: 'dex',
        table: 'orderbook',
        reverse: true,
        limit: 200,
        json: true
      });

      const ourOrders = orderbookRes.rows.filter((order: any) =>
        order.account_name === this.username &&
        (order.market_id === 9 || order.market_id === 10)
      );

      if (ourOrders.length === 0) {
        return;
      }

      logger.info(`🧹 Multi-hop cleanup: Found ${ourOrders.length} stale orders on markets 9/10`);

      for (const order of ourOrders) {
        try {
          const cancelActions = [{
            account: 'dex',
            name: 'cancelorder',
            authorization: [{ actor: this.username, permission: 'active' }],
            data: {
              account: this.username,
              order_id: order.order_id,
              market_id: order.market_id
            }
          }];

          await this.api.transact({ actions: cancelActions }, {
            blocksBehind: 3,
            expireSeconds: 120
          });

          const marketName = order.market_id === 9 ? 'LOAN_XMD' : 'METAL_XMD';
          logger.info(`Cancelled stale order ${order.order_id} on ${marketName}`);
        } catch (e: any) {
          logger.error(`Failed to cancel order ${order.order_id}:`, e.message);
        }
      }

      // Withdraw any stuck funds from DEX
      const withdrawActions = [{
        account: 'dex',
        name: 'withdrawall',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { account: this.username }
      }];

      await this.api.transact({ actions: withdrawActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });

      logger.info('Multi-hop cleanup: Withdrew all funds from DEX');

      await telegramNotifier.notify(
        `🧹 *Multi-hop Cleanup*\nCancelled ${ourOrders.length} stale orders on LOAN_XMD/METAL_XMD`,
        'normal'
      );

      // After cleanup, try to recover stuck tokens
      await this.recoverStuckTokens();

    } catch (error: any) {
      logger.error('Multi-hop cleanup failed:', error.message);
    }
  }

  /**
   * Recover stuck LOAN/METAL tokens above baseline by swapping back via AMM.
   * Only swaps amounts ABOVE the baseline captured at startup.
   * Uses 3% slippage tolerance (recovery, not profit optimization).
   */
  private async recoverStuckTokens(): Promise<void> {
    try {
      // Check LOAN above baseline
      const loanBalance = await this.getTokenBalance('LOAN', 'loan.token');
      const excessLoan = loanBalance - this.baselineLoan;

      if (excessLoan > 100) { // Only recover if meaningful amount (100+ LOAN ≈ $0.04)
        logger.info(`🔄 Recovering excess LOAN: ${excessLoan.toFixed(4)} (balance=${loanBalance.toFixed(4)}, baseline=${this.baselineLoan.toFixed(4)})`);

        const xprloan = this.poolStates.get('XPRLOAN');
        if (xprloan) {
          const expectedXpr = this.calculateAmmOutput(excessLoan, xprloan, false); // LOAN is token2
          const minXpr = (expectedXpr * 0.97).toFixed(4); // 3% slippage tolerance for recovery

          const swapActions = [{
            account: 'loan.token',
            name: 'transfer',
            authorization: [{ actor: this.username, permission: 'active' }],
            data: {
              from: this.username,
              to: 'proton.swaps',
              quantity: `${excessLoan.toFixed(4)} LOAN`,
              memo: `XPRLOAN,${minXpr} XPR`
            }
          }];

          const result = await this.api.transact({ actions: swapActions }, {
            blocksBehind: 3,
            expireSeconds: 120
          });
          logger.info(`Recovered ${excessLoan.toFixed(4)} LOAN → XPR: ` + (result as any).transaction_id);
          await telegramNotifier.notify(
            `🔄 *Token Recovery*\nSwapped ${excessLoan.toFixed(4)} excess LOAN → XPR`,
            'normal'
          );
        }
      }

      // Check METAL above baseline
      const metalBalance = await this.getTokenBalance('METAL', 'xtokens');
      const excessMetal = metalBalance - this.baselineMetal;

      if (excessMetal > 1) { // Only recover if meaningful amount (1+ METAL ≈ $0.14)
        logger.info(`🔄 Recovering excess METAL: ${excessMetal.toFixed(8)} (balance=${metalBalance.toFixed(8)}, baseline=${this.baselineMetal.toFixed(8)})`);

        const metaxmd = this.poolStates.get('METAXMD');
        if (metaxmd) {
          const expectedXmd = this.calculateAmmOutput(excessMetal, metaxmd, true); // METAL is token1
          const minXmd = (expectedXmd * 0.97).toFixed(6); // 3% slippage tolerance for recovery

          const swapActions = [{
            account: 'xtokens',
            name: 'transfer',
            authorization: [{ actor: this.username, permission: 'active' }],
            data: {
              from: this.username,
              to: 'proton.swaps',
              quantity: `${excessMetal.toFixed(8)} METAL`,
              memo: `METAXMD,${minXmd} XMD`
            }
          }];

          const result = await this.api.transact({ actions: swapActions }, {
            blocksBehind: 3,
            expireSeconds: 120
          });
          logger.info(`Recovered ${excessMetal.toFixed(8)} METAL → XMD: ` + (result as any).transaction_id);
          await telegramNotifier.notify(
            `🔄 *Token Recovery*\nSwapped ${excessMetal.toFixed(8)} excess METAL → XMD (auto-redeemed later)`,
            'normal'
          );
        }
      }
    } catch (error: any) {
      logger.error('Token recovery failed:', error.message);
    }
  }

  /**
   * Get current status
   */
  getStatus(): { pools: Map<string, PoolState>; markets: Map<string, DexMarket> } {
    return {
      pools: this.poolStates,
      markets: this.dexMarkets
    };
  }
}

export const multiHopArbitrage = new MultiHopArbitrage();
