/**
 * SimpleDEX Cross-Venue Atomic Arbitrage
 *
 * Scans for arbitrage between SimpleDEX (simpledex contract) pools and
 * proton.swaps AMM pools. Executes atomically via raw multi-action transactions.
 *
 * Key insight: Both SimpleDEX and proton.swaps support memo-based swaps with
 * slippage protection. SimpleDEX's MIN_OUT on the final swap acts as atomic
 * profit verification — if output < minOut, the entire tx reverts.
 *
 * Routes:
 * - LOAN_TRIANGLE:     XPR → LOAN (proton.swaps) → EXIT (SimpleDEX 16) → XPR (SimpleDEX 15)
 * - LOAN_TRIANGLE_REV: XPR → EXIT (SimpleDEX 15) → LOAN (SimpleDEX 16) → XPR (proton.swaps)
 * - LOAN_DIRECT:       XPR → LOAN (proton.swaps) → XPR (SimpleDEX 24)
 * - LOAN_DIRECT_REV:   XPR → LOAN (SimpleDEX 24) → XPR (proton.swaps)
 * - SNIPS_CROSS:       XPR → SNIPS (SimpleDEX 25) → XPR (proton.swaps SNIPSXP)
 * - SNIPS_CROSS_REV:   XPR → SNIPS (proton.swaps SNIPSXP) → XPR (SimpleDEX 25)
 */

import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';
import { profitabilityTracker } from '../analytics/profitability-tracker.js';
import { circuitBreaker } from '../risk/circuit-breaker.js';
import { simpleDexPoolMonitor, SimpleDexPool } from '../simpledex/pool-monitor.js';

const logger = getLogger();
const STRATEGY_NAME = 'simpledex-arbitrage';

// Token definitions
const TOKENS = {
  XPR:  { symbol: 'XPR',  contract: 'eosio.token',  precision: 4 },
  XUSDC:{ symbol: 'XUSDC',contract: 'xtokens',      precision: 6 },
  XMD:  { symbol: 'XMD',  contract: 'xmd.token',    precision: 6 },
  LOAN: { symbol: 'LOAN', contract: 'loan.token',    precision: 4 },
  EXIT: { symbol: 'EXIT', contract: 'simpletoken',   precision: 4 },
  SNIPS:{ symbol: 'SNIPS',contract: 'snipcoins',     precision: 4 },
} as const;

// proton.swaps pool symbols
const AMM_POOLS = {
  XPRLOAN: 'XPRLOAN',  // XPR(pool1) / LOAN(pool2)
  SNIPSXP: 'SNIPSXP',  // SNIPS(pool1) / XPR(pool2)
  XPRUSDC: 'XPRUSDC',  // For USD price reference
} as const;

// SimpleDEX pool IDs
const SDEX_POOLS = {
  XPR_XMD:   1,   // tokenA=XPR, tokenB=XMD
  XPR_EXIT:  15,  // tokenA=XPR, tokenB=EXIT
  EXIT_LOAN: 16,  // tokenA=EXIT, tokenB=LOAN
  XPR_LOAN:  24,  // tokenA=XPR, tokenB=LOAN
  SNIPS_XPR: 25,  // tokenA=SNIPS, tokenB=XPR
} as const;

// Auto-discovered SimpleDEX triangle route
// Forward: XPR → tokenA (leg1) → tokenB (leg2) → XPR (leg3)
// Reverse: XPR → tokenB (leg3 reversed) → tokenA (leg2 reversed) → XPR (leg1 reversed)
interface AutoTriangleRoute {
  name: string;           // e.g. "COOK_EXIT" or "HONEY_MILK"
  tokenA: string;
  tokenAContract: string;
  tokenAPrecision: number;
  tokenB: string;
  tokenBContract: string;
  tokenBPrecision: number;
  leg1PoolId: number;     // XPR → tokenA
  leg1XprIsA: boolean;    // Is XPR tokenA in this pool?
  leg2PoolId: number;     // tokenA → tokenB
  leg2TokenAIsA: boolean; // Is tokenA the tokenA of this pool?
  leg3PoolId: number;     // tokenB → XPR
  leg3TokenBIsA: boolean; // Is tokenB the tokenA of this pool?
}

interface AmmPoolState {
  symbol: string;
  token1: string;
  token1Amount: number;
  token1Contract: string;
  token1Precision: number;
  token2: string;
  token2Amount: number;
  token2Contract: string;
  token2Precision: number;
  exchangeFee: number;  // basis points from on-chain pool config
}

interface RouteResult {
  route: string;
  startAmount: bigint;
  endAmount: bigint;
  profitBps: number;
  profitUsd: number;
  tradeSizeUsd: number;
}

interface SimpleDexConfig {
  enabled: boolean;
  checkIntervalMs: number;
  minProfitBps: number;
  minProfitUsd: number;
  maxTradeUsd: number;
  dryRun: boolean;
  enabledRoutes: string[];
}

// MetalX DEX orderbook types
interface DexOrderbookLevel {
  level: number;   // price
  bid: number;     // quantity at this level
}

interface DexOrderbook {
  bids: DexOrderbookLevel[];
  asks: DexOrderbookLevel[];
}

export class SimpleDexArbitrage {
  private rpc: JsonRpc;
  private api: Api;
  private config: SimpleDexConfig;
  private username: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private isExecuting: boolean = false;
  private lastTradeTime: number = 0;
  private cooldownMs: number = 5000;
  private consecutiveErrors: number = 0;
  private blacklistedRoutes: Set<string> = new Set();

  // Cached proton.swaps pool states
  private ammPools: Map<string, AmmPoolState> = new Map();

  // MetalX DEX orderbook cache (XPR_XMD market)
  private dexOrderbook: DexOrderbook | null = null;
  private readonly DEX_API_ROOT: string;
  private readonly ATOMARB_CONTRACT: string;

  // Auto-discovered SimpleDEX triangles
  private discoveredTriangles: AutoTriangleRoute[] = [];
  private lastDiscoveryTime: number = 0;
  private lastPoolCount: number = 0;

  // proton.swaps fee: 20 bps base. We use the on-chain exchange_fee value.
  // The 66% staking discount may or may not be applied in the swap math.
  // Using the full 20 bps is conservative — if discount is applied on-chain,
  // actual output will be higher than calculated (better for us).
  private readonly AMM_FEE_BPS_DEFAULT = 20;

  // Cached XMD balance for cross-venue routes (set in scanRoutes)
  private cachedMaxXmd: number = 0;

  // Safety limits
  private readonly MAX_POOL_IMPACT_PERCENT = 2;  // Max 2% of smallest pool reserve

  constructor() {
    const config = getConfig() as any;

    this.config = {
      enabled: config.simpleDexArbitrage?.enabled ?? false,
      checkIntervalMs: config.simpleDexArbitrage?.checkIntervalMs ?? 2000,
      minProfitBps: config.simpleDexArbitrage?.minProfitBps ?? 15,
      minProfitUsd: config.simpleDexArbitrage?.minProfitUsd ?? 0.10,
      maxTradeUsd: config.simpleDexArbitrage?.maxTradeUsd ?? 25,
      dryRun: config.simpleDexArbitrage?.dryRun ?? true,
      enabledRoutes: config.simpleDexArbitrage?.enabledRoutes ?? [],
    };

    this.username = process.env.PROTON_USERNAME || '';
    const privateKey = process.env.PROTON_PRIVATE_KEY || '';

    this.DEX_API_ROOT = config.rpc?.apiRoot || 'https://dex.api.mainnet.metalx.com/dex';
    this.ATOMARB_CONTRACT = config.atomicArbitrage?.contractAccount || 'atomarb';

    this.rpc = new JsonRpc(config.rpc.endpoints);
    this.api = new Api({
      rpc: this.rpc,
      signatureProvider: new JsSignatureProvider([privateKey])
    });
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('SimpleDEX arbitrage disabled');
      return;
    }

    logger.info('🔷 SimpleDEX arbitrage starting...');
    logger.info(`  Check interval: ${this.config.checkIntervalMs}ms`);
    logger.info(`  Min profit: ${this.config.minProfitBps} BPS`);
    logger.info(`  Max trade: $${this.config.maxTradeUsd}`);
    logger.info(`  Dry run: ${this.config.dryRun}`);
    logger.info(`  Routes: ${this.config.enabledRoutes.join(', ')}`);

    // Initialize circuit breaker
    circuitBreaker.initializeStrategy(STRATEGY_NAME);

    // Initialize SimpleDEX pool monitor
    await simpleDexPoolMonitor.initialize();

    // Initial scan
    await this.scanRoutes();

    // Start continuous monitoring
    this.checkInterval = setInterval(() => this.scanRoutes(), this.config.checkIntervalMs);

    logger.info('🔷 SimpleDEX arbitrage monitor active');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('SimpleDEX arbitrage stopped');
  }

  // ============================================================
  // Market data fetching
  // ============================================================

  /**
   * Fetch proton.swaps AMM pool states
   */
  private async fetchAmmPools(): Promise<void> {
    try {
      const result = await this.rpc.get_table_rows({
        json: true,
        code: 'proton.swaps',
        scope: 'proton.swaps',
        table: 'pools',
        limit: 100
      });

      for (const row of result.rows) {
        const ltSymbol = row.lt_symbol?.split(',')[1];
        if (!ltSymbol) continue;

        const pool1Parts = this.parseAsset(row.pool1?.quantity);
        const pool2Parts = this.parseAsset(row.pool2?.quantity);
        if (!pool1Parts || !pool2Parts) continue;

        this.ammPools.set(ltSymbol, {
          symbol: ltSymbol,
          token1: pool1Parts.symbol,
          token1Amount: pool1Parts.amount,
          token1Contract: row.pool1?.contract || 'eosio.token',
          token1Precision: pool1Parts.precision,
          token2: pool2Parts.symbol,
          token2Amount: pool2Parts.amount,
          token2Contract: row.pool2?.contract || 'xtokens',
          token2Precision: pool2Parts.precision,
          exchangeFee: row.fee?.exchange_fee ?? this.AMM_FEE_BPS_DEFAULT
        });
      }
    } catch (error: any) {
      logger.error('Failed to fetch AMM pools:', error.message);
    }
  }

  private parseAsset(assetStr: string): { amount: number; symbol: string; precision: number } | null {
    if (!assetStr) return null;
    const parts = assetStr.trim().split(' ');
    if (parts.length !== 2) return null;
    const amount = parseFloat(parts[0]);
    const symbol = parts[1];
    const decParts = parts[0].split('.');
    const precision = decParts.length > 1 ? decParts[1].length : 0;
    return { amount, symbol, precision };
  }

  /**
   * Calculate proton.swaps AMM output using BigInt integer math
   *
   * The on-chain math:
   *   fee = input * exchange_fee / 10000
   *   netInput = input - fee
   *   output = netInput * reserveOut / (reserveIn + netInput)
   */
  private calculateAmmOutputBigInt(
    inputRaw: bigint,
    reserveInRaw: bigint,
    reserveOutRaw: bigint,
    feeBps: number
  ): bigint {
    const fee = inputRaw * BigInt(feeBps) / 10000n;
    const netInput = inputRaw - fee;
    return netInput * reserveOutRaw / (reserveInRaw + netInput);
  }

  /**
   * Calculate AMM output as float (convenience)
   */
  private calculateAmmOutputFloat(
    inputAmount: number,
    pool: AmmPoolState,
    inputIsToken1: boolean
  ): number {
    const inputPrec = inputIsToken1 ? pool.token1Precision : pool.token2Precision;
    const outputPrec = inputIsToken1 ? pool.token2Precision : pool.token1Precision;
    const reserveIn = inputIsToken1 ? pool.token1Amount : pool.token2Amount;
    const reserveOut = inputIsToken1 ? pool.token2Amount : pool.token1Amount;
    const reserveInPrec = inputIsToken1 ? pool.token1Precision : pool.token2Precision;
    const reserveOutPrec = inputIsToken1 ? pool.token2Precision : pool.token1Precision;

    const inputRaw = BigInt(Math.floor(inputAmount * (10 ** inputPrec)));
    const reserveInRaw = BigInt(Math.floor(reserveIn * (10 ** reserveInPrec)));
    const reserveOutRaw = BigInt(Math.floor(reserveOut * (10 ** reserveOutPrec)));

    const outputRaw = this.calculateAmmOutputBigInt(inputRaw, reserveInRaw, reserveOutRaw, pool.exchangeFee);
    return Number(outputRaw) / (10 ** outputPrec);
  }

  private async getXprPrice(): Promise<number> {
    const pool = this.ammPools.get(AMM_POOLS.XPRUSDC);
    if (!pool) return 0;
    return pool.token2Amount / pool.token1Amount;
  }

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

  // ============================================================
  // MetalX DEX orderbook
  // ============================================================

  /**
   * Fetch MetalX DEX orderbook for XPR_XMD market (full precision)
   */
  private async fetchDexOrderbook(): Promise<void> {
    try {
      const url = `${this.DEX_API_ROOT}/v1/orders/depth?symbol=XPR_XMD&step=1000000&limit=50`;
      const res = await fetch(url);
      if (!res.ok) {
        logger.debug(`DEX orderbook fetch failed: ${res.status}`);
        return;
      }
      const json = await res.json() as any;
      this.dexOrderbook = json.data || null;
    } catch (error: any) {
      logger.debug(`DEX orderbook fetch error: ${error.message}`);
    }
  }

  /**
   * Simulate selling XPR on DEX orderbook (walking bids from top)
   * Returns total XMD received for selling xprAmount of XPR
   */
  private simulateDexSell(xprAmount: number): { xmdReceived: number; avgPrice: number; levelsUsed: number } | null {
    if (!this.dexOrderbook || this.dexOrderbook.bids.length === 0) return null;

    let xprRemaining = xprAmount;
    let totalXmd = 0;
    let levelsUsed = 0;

    for (const bid of this.dexOrderbook.bids) {
      if (xprRemaining <= 0) break;
      const fillXpr = Math.min(xprRemaining, bid.bid);
      totalXmd += fillXpr * bid.level;
      xprRemaining -= fillXpr;
      levelsUsed++;
    }

    // If we couldn't fill the entire order
    if (xprRemaining > xprAmount * 0.01) return null; // >1% unfilled

    const actualXprSold = xprAmount - xprRemaining;
    return {
      xmdReceived: totalXmd,
      avgPrice: totalXmd / actualXprSold,
      levelsUsed
    };
  }

  /**
   * Simulate buying XPR on DEX orderbook (walking asks from bottom)
   * Returns total XPR bought for spending xmdAmount of XMD
   */
  private simulateDexBuy(xmdAmount: number): { xprReceived: number; avgPrice: number; levelsUsed: number } | null {
    if (!this.dexOrderbook || this.dexOrderbook.asks.length === 0) return null;

    let xmdRemaining = xmdAmount;
    let totalXpr = 0;
    let levelsUsed = 0;

    for (const ask of this.dexOrderbook.asks) {
      if (xmdRemaining <= 0) break;
      const xmdAtLevel = ask.bid * ask.level; // XMD cost for all XPR at this level
      const xmdToSpend = Math.min(xmdRemaining, xmdAtLevel);
      const xprBought = xmdToSpend / ask.level;
      totalXpr += xprBought;
      xmdRemaining -= xmdToSpend;
      levelsUsed++;
    }

    // If we couldn't spend the full amount
    if (xmdRemaining > xmdAmount * 0.01) return null;

    const actualXmdSpent = xmdAmount - xmdRemaining;
    return {
      xprReceived: totalXpr,
      avgPrice: actualXmdSpent / totalXpr,
      levelsUsed
    };
  }

  // ============================================================
  // Route scanning
  // ============================================================

  private async scanRoutes(): Promise<void> {
    if (this.isExecuting) return;

    // Check circuit breaker
    if (!circuitBreaker.canTrade(STRATEGY_NAME)) {
      const state = circuitBreaker.getState(STRATEGY_NAME);
      logger.warn(`🛑 Circuit breaker triggered for ${STRATEGY_NAME}: ${state?.triggerReason || 'Unknown'}`);
      return;
    }

    // Cooldown check
    if (Date.now() - this.lastTradeTime < this.cooldownMs) return;

    try {
      // Refresh all pool data (including DEX orderbook for cross-venue routes)
      await Promise.all([
        this.fetchAmmPools(),
        simpleDexPoolMonitor.refreshPools(),
        this.fetchDexOrderbook()
      ]);

      const xprPrice = await this.getXprPrice();
      if (xprPrice === 0) {
        logger.debug('SimpleDEX arb: No XPR price available');
        return;
      }

      // Determine max XPR trade size
      const maxXprFromUsd = this.config.maxTradeUsd / xprPrice;
      const xprBalance = await this.getTokenBalance('XPR', 'eosio.token');
      const maxXpr = Math.min(maxXprFromUsd, xprBalance * 0.9); // Leave 10% buffer

      if (maxXpr < 100) {
        logger.debug('SimpleDEX arb: Insufficient XPR balance');
        return;
      }

      // For cross-venue routes (SDEX_METALX, METALX_SDEX): use XUSDC balance since we mint XMD atomically
      const hasXmdRoutes = this.config.enabledRoutes.some(r => r === 'SDEX_METALX' || r === 'METALX_SDEX');
      if (hasXmdRoutes) {
        const xusdcBalance = await this.getTokenBalance('XUSDC', 'xtokens');
        this.cachedMaxXmd = Math.min(this.config.maxTradeUsd, xusdcBalance * 0.9);
      }

      // Re-discover triangles when pool count changes or every 5 minutes
      this.refreshDiscoveredTriangles();

      const opportunities: RouteResult[] = [];

      // Check configured routes (AMM-based: LOAN_TRIANGLE, SNIPS_CROSS, etc.)
      for (const routeName of this.config.enabledRoutes) {
        try {
          const result = this.evaluateRoute(routeName, maxXpr, xprPrice);
          if (result && result.profitBps >= this.config.minProfitBps && result.profitUsd >= this.config.minProfitUsd) {
            opportunities.push(result);
          }
        } catch (e: any) {
          logger.debug(`Route ${routeName} eval error: ${e.message}`);
        }
      }

      // Check auto-discovered SimpleDEX triangles (both forward and reverse)
      for (const tri of this.discoveredTriangles) {
        try {
          const fwd = this.evalAutoTriForward(tri, maxXpr, xprPrice);
          if (fwd && fwd.profitBps >= this.config.minProfitBps && fwd.profitUsd >= this.config.minProfitUsd) {
            opportunities.push(fwd);
          }
          const rev = this.evalAutoTriReverse(tri, maxXpr, xprPrice);
          if (rev && rev.profitBps >= this.config.minProfitBps && rev.profitUsd >= this.config.minProfitUsd) {
            opportunities.push(rev);
          }
        } catch (e: any) {
          logger.debug(`Auto triangle ${tri.name} eval error: ${e.message}`);
        }
      }

      // Log scan status periodically (every ~30 seconds)
      this.logScanStatus(xprPrice);

      if (opportunities.length === 0) return;

      // Filter out blacklisted routes and sort by profit
      const viable = opportunities.filter(o => !this.blacklistedRoutes.has(o.route));
      if (viable.length === 0) return;
      viable.sort((a, b) => b.profitBps - a.profitBps);
      const best = viable[0];

      logger.info(`🔷 SimpleDEX opportunity: ${best.route} = ${best.profitBps.toFixed(1)} BPS ($${best.profitUsd.toFixed(4)})`);

      if (this.config.dryRun) {
        const isXmd = best.route === 'SDEX_METALX' || best.route === 'METALX_SDEX';
        const amt = isXmd ? Number(best.startAmount) / 1000000 : Number(best.startAmount) / 10000;
        const unit = isXmd ? 'XMD' : 'XPR';
        logger.info(`  [DRY RUN] Would trade ${amt} ${unit}`);
        return;
      }

      // Execute
      await this.executeRoute(best);

    } catch (error: any) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors > 3) {
        this.cooldownMs = Math.min(this.cooldownMs * 2, 60000);
        logger.warn(`SimpleDEX arb: ${this.consecutiveErrors} consecutive errors, cooldown=${this.cooldownMs}ms`);
      }
      logger.error(`SimpleDEX scan error: ${error.message}`);
    }
  }

  private scanLogCounter = 0;

  private logScanStatus(xprPrice: number): void {
    this.scanLogCounter++;
    if (this.scanLogCounter % 15 !== 0) return; // Every ~30s at 2s interval

    const parts: string[] = [`XPR=$${xprPrice.toFixed(6)}`];

    // XPRLOAN AMM info
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN);
    if (xprloan) {
      const loanPerXpr = xprloan.token2Amount / xprloan.token1Amount;
      parts.push(`LOAN/XPR=${loanPerXpr.toFixed(4)}`);
    }

    // SimpleDEX pool 24 (XPR/LOAN) info
    const sdex24 = simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_LOAN);
    if (sdex24) {
      const price = simpleDexPoolMonitor.getSpotPrice(SDEX_POOLS.XPR_LOAN);
      if (price) parts.push(`SDEX24=${price.toFixed(4)}`);
    }

    // SimpleDEX pool 15 (XPR/EXIT) info
    const sdex15 = simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_EXIT);
    if (sdex15) {
      const price = simpleDexPoolMonitor.getSpotPrice(SDEX_POOLS.XPR_EXIT);
      if (price) parts.push(`SDEX15=${price.toFixed(6)}`);
    }

    // MetalX DEX orderbook info (for cross-venue routes)
    if (this.dexOrderbook) {
      const bestBid = this.dexOrderbook.bids[0]?.level;
      const bestAsk = this.dexOrderbook.asks[0]?.level;
      if (bestBid && bestAsk) {
        parts.push(`DEX bid=${bestBid.toFixed(6)} ask=${bestAsk.toFixed(6)}`);
      }
    }

    // SimpleDEX pool 1 (XPR/XMD) spot price
    const sdex1Price = simpleDexPoolMonitor.getSpotPrice(SDEX_POOLS.XPR_XMD);
    if (sdex1Price) {
      parts.push(`SDEX1=${sdex1Price.toFixed(6)}`);
    }

    logger.info(`📊 SimpleDEX scan: ${parts.join(' | ')}`);
  }

  // ============================================================
  // Route evaluation (all BigInt math)
  // ============================================================

  private evaluateRoute(routeName: string, maxXpr: number, xprPrice: number): RouteResult | null {
    switch (routeName) {
      case 'LOAN_TRIANGLE':     return this.evalLoanTriangle(maxXpr, xprPrice);
      case 'LOAN_TRIANGLE_REV': return this.evalLoanTriangleRev(maxXpr, xprPrice);
      case 'LOAN_DIRECT':       return this.evalLoanDirect(maxXpr, xprPrice);
      case 'LOAN_DIRECT_REV':   return this.evalLoanDirectRev(maxXpr, xprPrice);
      case 'SNIPS_CROSS':       return this.evalSnipsCross(maxXpr, xprPrice);
      case 'SNIPS_CROSS_REV':   return this.evalSnipsCrossRev(maxXpr, xprPrice);
      case 'SDEX_METALX':       return this.evalSdexMetalx(this.cachedMaxXmd, xprPrice);
      case 'METALX_SDEX':       return this.evalMetalxSdex(this.cachedMaxXmd, xprPrice);
      default:
        logger.debug(`Unknown configured route: ${routeName}`);
        return null;
    }
  }

  /**
   * Find optimal trade size that maximizes USD profit while staying above minProfitBps.
   *
   * These SimpleDEX pools are small, so slippage grows fast. We try a range of sizes
   * and pick the one with the highest USD profit that's still above our BPS threshold.
   *
   * @param routeName - Route name for the result
   * @param maxXpr - Maximum XPR to trade
   * @param xprPrice - Current XPR price in USD
   * @param calcEndXpr - Function that calculates output XPR raw for a given input XPR raw
   * @returns Best RouteResult or null if nothing profitable
   */
  private findOptimalSize(
    routeName: string,
    maxXpr: number,
    xprPrice: number,
    calcEndXpr: (startRaw: bigint) => bigint | null
  ): RouteResult | null {
    // Try sizes from 50 XPR up to maxXpr, geometrically spaced
    const sizes: number[] = [];
    for (let s = 50; s <= maxXpr; s = Math.floor(s * 1.5)) {
      sizes.push(s);
    }
    if (sizes[sizes.length - 1] < maxXpr) sizes.push(Math.floor(maxXpr));

    let bestResult: RouteResult | null = null;
    let bestProfitUsd = 0;

    for (const size of sizes) {
      const startRaw = BigInt(size * 10000); // 4 decimal XPR
      const endRaw = calcEndXpr(startRaw);
      if (!endRaw || endRaw <= startRaw) continue;

      const profitBps = Number((endRaw - startRaw) * 10000n / startRaw);
      if (profitBps < this.config.minProfitBps) continue;

      const profitXpr = Number(endRaw - startRaw) / 10000;
      const profitUsd = profitXpr * xprPrice;

      if (profitUsd > bestProfitUsd) {
        bestProfitUsd = profitUsd;
        bestResult = {
          route: routeName,
          startAmount: startRaw,
          endAmount: endRaw,
          profitBps,
          profitUsd,
          tradeSizeUsd: size * xprPrice
        };
      }
    }

    return bestResult;
  }

  /**
   * LOAN_TRIANGLE: XPR → LOAN (proton.swaps) → EXIT (SimpleDEX 16) → XPR (SimpleDEX 15)
   */
  private evalLoanTriangle(maxXpr: number, xprPrice: number): RouteResult | null {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN);
    if (!xprloan) return null;
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.EXIT_LOAN) || !simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_EXIT)) return null;

    const ammReserveInRaw = BigInt(Math.floor(xprloan.token1Amount * (10 ** xprloan.token1Precision)));
    const ammReserveOutRaw = BigInt(Math.floor(xprloan.token2Amount * (10 ** xprloan.token2Precision)));
    const fee = xprloan.exchangeFee;

    // Simulate with safe intermediate amounts (matching execution path)
    return this.findOptimalSize('LOAN_TRIANGLE', maxXpr, xprPrice, (startRaw) => {
      const loanRaw = this.calculateAmmOutputBigInt(startRaw, ammReserveInRaw, ammReserveOutRaw, fee);
      const safeLoan = this.safeMinOut(loanRaw);
      const exitRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.EXIT_LOAN, safeLoan, false);
      if (!exitRaw) return null;
      const safeExit = this.safeMinOut(exitRaw);
      return simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_EXIT, safeExit, false);
    });
  }

  /**
   * LOAN_TRIANGLE_REV: XPR → EXIT (SimpleDEX 15) → LOAN (SimpleDEX 16) → XPR (proton.swaps)
   */
  private evalLoanTriangleRev(maxXpr: number, xprPrice: number): RouteResult | null {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN);
    if (!xprloan) return null;
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_EXIT) || !simpleDexPoolMonitor.getPool(SDEX_POOLS.EXIT_LOAN)) return null;

    const ammReserveXprRaw = BigInt(Math.floor(xprloan.token1Amount * (10 ** xprloan.token1Precision)));
    const ammReserveLoanRaw = BigInt(Math.floor(xprloan.token2Amount * (10 ** xprloan.token2Precision)));
    const fee = xprloan.exchangeFee;

    return this.findOptimalSize('LOAN_TRIANGLE_REV', maxXpr, xprPrice, (startRaw) => {
      const exitRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_EXIT, startRaw, true);
      if (!exitRaw) return null;
      const safeExit = this.safeMinOut(exitRaw);
      const loanRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.EXIT_LOAN, safeExit, true);
      if (!loanRaw) return null;
      const safeLoan = this.safeMinOut(loanRaw);
      return this.calculateAmmOutputBigInt(safeLoan, ammReserveLoanRaw, ammReserveXprRaw, fee);
    });
  }

  /**
   * LOAN_DIRECT: XPR → LOAN (proton.swaps) → XPR (SimpleDEX pool 24)
   */
  private evalLoanDirect(maxXpr: number, xprPrice: number): RouteResult | null {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN);
    if (!xprloan) return null;
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_LOAN)) return null;

    const ammReserveInRaw = BigInt(Math.floor(xprloan.token1Amount * (10 ** xprloan.token1Precision)));
    const ammReserveOutRaw = BigInt(Math.floor(xprloan.token2Amount * (10 ** xprloan.token2Precision)));
    const fee = xprloan.exchangeFee;

    return this.findOptimalSize('LOAN_DIRECT', maxXpr, xprPrice, (startRaw) => {
      const loanRaw = this.calculateAmmOutputBigInt(startRaw, ammReserveInRaw, ammReserveOutRaw, fee);
      const safeLoan = this.safeMinOut(loanRaw);
      return simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_LOAN, safeLoan, false);
    });
  }

  /**
   * LOAN_DIRECT_REV: XPR → LOAN (SimpleDEX pool 24) → XPR (proton.swaps)
   */
  private evalLoanDirectRev(maxXpr: number, xprPrice: number): RouteResult | null {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN);
    if (!xprloan) return null;
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_LOAN)) return null;

    const ammReserveXprRaw = BigInt(Math.floor(xprloan.token1Amount * (10 ** xprloan.token1Precision)));
    const ammReserveLoanRaw = BigInt(Math.floor(xprloan.token2Amount * (10 ** xprloan.token2Precision)));
    const fee = xprloan.exchangeFee;

    return this.findOptimalSize('LOAN_DIRECT_REV', maxXpr, xprPrice, (startRaw) => {
      const loanRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_LOAN, startRaw, true);
      if (!loanRaw) return null;
      const safeLoan = this.safeMinOut(loanRaw);
      return this.calculateAmmOutputBigInt(safeLoan, ammReserveLoanRaw, ammReserveXprRaw, fee);
    });
  }

  /**
   * SNIPS_CROSS: XPR → SNIPS (SimpleDEX pool 25) → XPR (proton.swaps SNIPSXP)
   */
  private evalSnipsCross(maxXpr: number, xprPrice: number): RouteResult | null {
    const snipsxp = this.ammPools.get(AMM_POOLS.SNIPSXP);
    if (!snipsxp) return null;
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.SNIPS_XPR)) return null;

    const ammReserveSnipsRaw = BigInt(Math.floor(snipsxp.token1Amount * (10 ** snipsxp.token1Precision)));
    const ammReserveXprRaw = BigInt(Math.floor(snipsxp.token2Amount * (10 ** snipsxp.token2Precision)));
    const fee = snipsxp.exchangeFee;

    return this.findOptimalSize('SNIPS_CROSS', maxXpr, xprPrice, (startRaw) => {
      const snipsRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.SNIPS_XPR, startRaw, false);
      if (!snipsRaw) return null;
      const safeSnips = this.safeMinOut(snipsRaw);
      return this.calculateAmmOutputBigInt(safeSnips, ammReserveSnipsRaw, ammReserveXprRaw, fee);
    });
  }

  /**
   * SNIPS_CROSS_REV: XPR → SNIPS (proton.swaps SNIPSXP) → XPR (SimpleDEX pool 25)
   */
  private evalSnipsCrossRev(maxXpr: number, xprPrice: number): RouteResult | null {
    const snipsxp = this.ammPools.get(AMM_POOLS.SNIPSXP);
    if (!snipsxp) return null;
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.SNIPS_XPR)) return null;

    const ammReserveSnipsRaw = BigInt(Math.floor(snipsxp.token1Amount * (10 ** snipsxp.token1Precision)));
    const ammReserveXprRaw = BigInt(Math.floor(snipsxp.token2Amount * (10 ** snipsxp.token2Precision)));
    const fee = snipsxp.exchangeFee;

    return this.findOptimalSize('SNIPS_CROSS_REV', maxXpr, xprPrice, (startRaw) => {
      const snipsRaw = this.calculateAmmOutputBigInt(startRaw, ammReserveXprRaw, ammReserveSnipsRaw, fee);
      const safeSnips = this.safeMinOut(snipsRaw);
      return simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.SNIPS_XPR, safeSnips, true);
    });
  }

  // ============================================================
  // SimpleDEX ↔ MetalX DEX cross-venue routes (XMD-denominated)
  // ============================================================

  /**
   * Find optimal XMD-denominated trade size for cross-venue routes.
   * Similar to findOptimalSize but works in XMD raw (6 decimals).
   */
  private findOptimalSizeXmd(
    routeName: string,
    maxXmd: number,
    xprPrice: number,
    calcEndXmd: (startRaw: bigint) => bigint | null
  ): RouteResult | null {
    // Try sizes from 2 XMD up to maxXmd, geometrically spaced
    // Pool 1 is very small (~300 XMD), so start tiny to find profitable sizes
    // Min 2 XMD to stay above DEX minimum order size (1 XMD) after slippage
    const sizes: number[] = [];
    for (let s = 2; s <= maxXmd; s = Math.max(s + 1, Math.floor(s * 1.5))) {
      sizes.push(s);
    }
    if (sizes.length > 0 && sizes[sizes.length - 1] < maxXmd) sizes.push(Math.floor(maxXmd));

    let bestResult: RouteResult | null = null;
    let bestProfitUsd = 0;

    for (const size of sizes) {
      const startRaw = BigInt(size * 1000000); // 6 decimal XMD
      const endRaw = calcEndXmd(startRaw);
      if (!endRaw || endRaw <= startRaw) continue;

      const profitBps = Number((endRaw - startRaw) * 10000n / startRaw);
      if (profitBps < this.config.minProfitBps) continue;

      const profitXmd = Number(endRaw - startRaw) / 1000000;
      const profitUsd = profitXmd; // XMD ≈ $1

      if (profitUsd > bestProfitUsd) {
        bestProfitUsd = profitUsd;
        bestResult = {
          route: routeName,
          startAmount: startRaw,
          endAmount: endRaw,
          profitBps,
          profitUsd,
          tradeSizeUsd: size  // XMD ≈ USD
        };
      }
    }

    return bestResult;
  }

  /**
   * SDEX_METALX: Buy XPR cheap on SimpleDEX pool 1, sell on MetalX DEX
   * XMD → XPR (SimpleDEX pool 1) → XMD (DEX sell at bid)
   */
  private evalSdexMetalx(maxXmd: number, xprPrice: number): RouteResult | null {
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_XMD)) return null;
    if (!this.dexOrderbook || this.dexOrderbook.bids.length === 0) return null;

    return this.findOptimalSizeXmd('SDEX_METALX', maxXmd, xprPrice, (startXmdRaw) => {
      // Step 1: Buy XPR on SimpleDEX pool 1 (send XMD as tokenB, get XPR as tokenA)
      // isTokenAIn=false because we're sending XMD (tokenB)
      const xprRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_XMD, startXmdRaw, false);
      if (!xprRaw) return null;

      // Step 2: Sell XPR on DEX for XMD (walk bid levels)
      const xprAmount = Number(xprRaw) / 10000; // Convert raw to human
      const dexResult = this.simulateDexSell(xprAmount);
      if (!dexResult) return null;

      // DEX is 0% fee for tradingbot, so xmdReceived is net
      const xmdReceivedRaw = BigInt(Math.floor(dexResult.xmdReceived * 1000000));
      return xmdReceivedRaw;
    });
  }

  /**
   * METALX_SDEX: Buy XPR cheap on MetalX DEX, sell on SimpleDEX pool 1
   * XMD → XPR (DEX buy at ask) → XMD (SimpleDEX pool 1)
   */
  private evalMetalxSdex(maxXmd: number, xprPrice: number): RouteResult | null {
    if (!simpleDexPoolMonitor.getPool(SDEX_POOLS.XPR_XMD)) return null;
    if (!this.dexOrderbook || this.dexOrderbook.asks.length === 0) return null;

    return this.findOptimalSizeXmd('METALX_SDEX', maxXmd, xprPrice, (startXmdRaw) => {
      // Step 1: Buy XPR on DEX (walk ask levels, spending XMD)
      const xmdAmount = Number(startXmdRaw) / 1000000;
      const dexResult = this.simulateDexBuy(xmdAmount);
      if (!dexResult) return null;

      // Step 2: Sell XPR on SimpleDEX pool 1 (send XPR as tokenA, get XMD as tokenB)
      // Eval uses full amount (safeMinOut only in action builder for MIN_OUT param)
      const xprRaw = BigInt(Math.floor(dexResult.xprReceived * 10000));
      // isTokenAIn=true because we're sending XPR (tokenA)
      const xmdOutRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_XMD, xprRaw, true);
      if (!xmdOutRaw) return null;

      return xmdOutRaw;
    });
  }

  // ============================================================
  // Auto-discovered SimpleDEX triangle routes
  // ============================================================

  /**
   * Scan all SimpleDEX pools and find every 3-pool triangle that starts/ends with XPR.
   * Runs on startup and whenever pool count changes.
   */
  private discoverTriangles(): AutoTriangleRoute[] {
    const allPools = simpleDexPoolMonitor.getAllPools();
    if (allPools.length === 0) return [];

    // Build adjacency: for each token, which pools connect to which other tokens
    interface PoolEdge {
      poolId: number;
      toToken: string;
      fromIsA: boolean;     // Is the "from" token the tokenA of the pool?
      toContract: string;
      toPrecision: number;
    }
    const adj = new Map<string, PoolEdge[]>();

    // Minimum reserve: skip pools where either reserve is tiny (< 10K raw units)
    // This avoids discovering routes through imbalanced/illiquid pools that always exceed swap limits
    const MIN_RESERVE = 100000n;  // 10 XPR at 4 decimals
    for (const pool of allPools) {
      if (pool.reserveA === 0n || pool.reserveB === 0n) continue;
      if (pool.reserveA < MIN_RESERVE || pool.reserveB < MIN_RESERVE) continue;
      if (!adj.has(pool.tokenASymbol)) adj.set(pool.tokenASymbol, []);
      if (!adj.has(pool.tokenBSymbol)) adj.set(pool.tokenBSymbol, []);
      adj.get(pool.tokenASymbol)!.push({
        poolId: pool.id, toToken: pool.tokenBSymbol, fromIsA: true,
        toContract: pool.tokenBContract, toPrecision: pool.tokenBPrecision,
      });
      adj.get(pool.tokenBSymbol)!.push({
        poolId: pool.id, toToken: pool.tokenASymbol, fromIsA: false,
        toContract: pool.tokenAContract, toPrecision: pool.tokenAPrecision,
      });
    }

    const xprEdges = adj.get('XPR') || [];
    const routes: AutoTriangleRoute[] = [];
    const seen = new Set<string>();

    // For each pair of XPR-adjacent tokens, check if they connect to each other
    for (const leg1 of xprEdges) {
      const aEdges = adj.get(leg1.toToken) || [];
      for (const leg2 of aEdges) {
        if (leg2.toToken === 'XPR' || leg2.toToken === leg1.toToken) continue;

        // Check if leg2.toToken connects back to XPR
        const bEdges = adj.get(leg2.toToken) || [];
        const leg3 = bEdges.find(e => e.toToken === 'XPR');
        if (!leg3) continue;

        // Dedup: alphabetical key for the pair
        const key = [leg1.toToken, leg2.toToken].sort().join('_');
        if (seen.has(key)) continue;
        seen.add(key);

        routes.push({
          name: `${leg1.toToken}_${leg2.toToken}`,
          tokenA: leg1.toToken,
          tokenAContract: leg1.toContract,
          tokenAPrecision: leg1.toPrecision,
          tokenB: leg2.toToken,
          tokenBContract: leg2.toContract,
          tokenBPrecision: leg2.toPrecision,
          leg1PoolId: leg1.poolId,
          leg1XprIsA: leg1.fromIsA,
          leg2PoolId: leg2.poolId,
          leg2TokenAIsA: leg2.fromIsA,
          leg3PoolId: leg3.poolId,
          leg3TokenBIsA: leg3.fromIsA,
        });
      }
    }

    return routes;
  }

  private refreshDiscoveredTriangles(): void {
    const poolCount = simpleDexPoolMonitor.getAllPools().length;
    const now = Date.now();

    if (poolCount !== this.lastPoolCount || now - this.lastDiscoveryTime > 300000) {
      this.discoveredTriangles = this.discoverTriangles();
      this.lastDiscoveryTime = now;

      if (poolCount !== this.lastPoolCount) {
        this.lastPoolCount = poolCount;
        logger.info(`🔷 Auto-discovered ${this.discoveredTriangles.length} SimpleDEX triangles from ${poolCount} pools`);
        if (this.discoveredTriangles.length > 0) {
          const names = this.discoveredTriangles.map(t => t.name).join(', ');
          logger.info(`  Triangles: ${names}`);
        }
      }
    }
  }

  private findAutoTriangle(routeName: string): AutoTriangleRoute | undefined {
    return this.discoveredTriangles.find(tri =>
      routeName === `${tri.name}_TRI` || routeName === `${tri.name}_TRI_REV`
    );
  }

  /**
   * Forward: XPR → tokenA (leg1) → tokenB (leg2) → XPR (leg3)
   */
  private evalAutoTriForward(route: AutoTriangleRoute, maxXpr: number, xprPrice: number): RouteResult | null {
    const p1 = simpleDexPoolMonitor.getPool(route.leg1PoolId);
    const p2 = simpleDexPoolMonitor.getPool(route.leg2PoolId);
    const p3 = simpleDexPoolMonitor.getPool(route.leg3PoolId);
    if (!p1 || !p2 || !p3) return null;

    // Pre-check: skip if minimum trade (50 XPR) already exceeds any pool's 50% swap limit.
    // This prevents discovering routes through imbalanced pools that can never execute.
    const minTestRaw = 500000n; // 50 XPR
    const testA = simpleDexPoolMonitor.calculateSwapOutput(route.leg1PoolId, minTestRaw, route.leg1XprIsA);
    if (!testA) return null;
    const testB = simpleDexPoolMonitor.calculateSwapOutput(route.leg2PoolId, testA, route.leg2TokenAIsA);
    if (!testB) return null;
    const testC = simpleDexPoolMonitor.calculateSwapOutput(route.leg3PoolId, testB, route.leg3TokenBIsA);
    if (!testC) return null;

    return this.findOptimalSize(`${route.name}_TRI`, maxXpr, xprPrice, (startRaw) => {
      const aRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg1PoolId, startRaw, route.leg1XprIsA);
      if (!aRaw || aRaw <= 0n) return null;

      const bRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg2PoolId, aRaw, route.leg2TokenAIsA);
      if (!bRaw || bRaw <= 0n) return null;

      const cRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg3PoolId, bRaw, route.leg3TokenBIsA);
      if (!cRaw || cRaw <= 0n) return null;

      return cRaw;
    });
  }

  /**
   * Reverse: XPR → tokenB (leg3 reversed) → tokenA (leg2 reversed) → XPR (leg1 reversed)
   */
  private evalAutoTriReverse(route: AutoTriangleRoute, maxXpr: number, xprPrice: number): RouteResult | null {
    const p1 = simpleDexPoolMonitor.getPool(route.leg1PoolId);
    const p2 = simpleDexPoolMonitor.getPool(route.leg2PoolId);
    const p3 = simpleDexPoolMonitor.getPool(route.leg3PoolId);
    if (!p1 || !p2 || !p3) return null;

    const minTestRaw = 500000n;
    const testB = simpleDexPoolMonitor.calculateSwapOutput(route.leg3PoolId, minTestRaw, !route.leg3TokenBIsA);
    if (!testB) return null;
    const testA = simpleDexPoolMonitor.calculateSwapOutput(route.leg2PoolId, testB, !route.leg2TokenAIsA);
    if (!testA) return null;
    const testC = simpleDexPoolMonitor.calculateSwapOutput(route.leg1PoolId, testA, !route.leg1XprIsA);
    if (!testC) return null;

    return this.findOptimalSize(`${route.name}_TRI_REV`, maxXpr, xprPrice, (startRaw) => {
      const bRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg3PoolId, startRaw, !route.leg3TokenBIsA);
      if (!bRaw || bRaw <= 0n) return null;

      const aRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg2PoolId, bRaw, !route.leg2TokenAIsA);
      if (!aRaw || aRaw <= 0n) return null;

      const cRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg1PoolId, aRaw, !route.leg1XprIsA);
      if (!cRaw || cRaw <= 0n) return null;

      return cRaw;
    });
  }

  /**
   * Build actions for forward: XPR → tokenA → tokenB → XPR
   */
  private buildAutoTriForwardActions(route: AutoTriangleRoute, result: RouteResult): any[] {
    const startXprRaw = result.startAmount;

    const aRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg1PoolId, startXprRaw, route.leg1XprIsA)!;
    const safeA = this.safeMinOut(aRaw);
    const bRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg2PoolId, safeA, route.leg2TokenAIsA)!;
    const safeB = this.safeMinOut(bRaw);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction('eosio.token', 'simpledex',
        this.formatAmount(startXprRaw, 4, 'XPR'),
        `swap:${route.leg1PoolId}:${safeA}:${route.leg1XprIsA ? 1 : 0}`),
      this.transferAction(route.tokenAContract, 'simpledex',
        this.formatAmount(safeA, route.tokenAPrecision, route.tokenA),
        `swap:${route.leg2PoolId}:${safeB}:${route.leg2TokenAIsA ? 1 : 0}`),
      this.transferAction(route.tokenBContract, 'simpledex',
        this.formatAmount(safeB, route.tokenBPrecision, route.tokenB),
        `swap:${route.leg3PoolId}:${minXprOut}:${route.leg3TokenBIsA ? 1 : 0}`),
    ];
  }

  /**
   * Build actions for reverse: XPR → tokenB → tokenA → XPR
   */
  private buildAutoTriReverseActions(route: AutoTriangleRoute, result: RouteResult): any[] {
    const startXprRaw = result.startAmount;

    const bRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg3PoolId, startXprRaw, !route.leg3TokenBIsA)!;
    const safeB = this.safeMinOut(bRaw);
    const aRaw = simpleDexPoolMonitor.calculateSwapOutput(route.leg2PoolId, safeB, !route.leg2TokenAIsA)!;
    const safeA = this.safeMinOut(aRaw);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction('eosio.token', 'simpledex',
        this.formatAmount(startXprRaw, 4, 'XPR'),
        `swap:${route.leg3PoolId}:${safeB}:${!route.leg3TokenBIsA ? 1 : 0}`),
      this.transferAction(route.tokenBContract, 'simpledex',
        this.formatAmount(safeB, route.tokenBPrecision, route.tokenB),
        `swap:${route.leg2PoolId}:${safeA}:${!route.leg2TokenAIsA ? 1 : 0}`),
      this.transferAction(route.tokenAContract, 'simpledex',
        this.formatAmount(safeA, route.tokenAPrecision, route.tokenA),
        `swap:${route.leg1PoolId}:${minXprOut}:${!route.leg1XprIsA ? 1 : 0}`),
    ];
  }

  // ============================================================
  // Trade execution — atomic multi-action transactions
  // ============================================================

  private async executeRoute(result: RouteResult): Promise<void> {
    this.isExecuting = true;
    this.lastTradeTime = Date.now();

    const xprPrice = await this.getXprPrice();
    const tradeId = await profitabilityTracker.startTrade(
      STRATEGY_NAME,
      result.route,
      result.profitBps,
      result.profitUsd,
      result.tradeSizeUsd
    );

    try {
      let actions: any[];

      switch (result.route) {
        case 'LOAN_TRIANGLE':
          actions = this.buildLoanTriangleActions(result);
          break;
        case 'LOAN_TRIANGLE_REV':
          actions = this.buildLoanTriangleRevActions(result);
          break;
        case 'LOAN_DIRECT':
          actions = this.buildLoanDirectActions(result);
          break;
        case 'LOAN_DIRECT_REV':
          actions = this.buildLoanDirectRevActions(result);
          break;
        case 'SNIPS_CROSS':
          actions = this.buildSnipsCrossActions(result);
          break;
        case 'SNIPS_CROSS_REV':
          actions = this.buildSnipsCrossRevActions(result);
          break;
        case 'SDEX_METALX':
          actions = this.buildSdexMetalxActions(result);
          break;
        case 'METALX_SDEX':
          actions = this.buildMetalxSdexActions(result);
          break;
        default: {
          const autoTri = this.findAutoTriangle(result.route);
          if (autoTri) {
            actions = result.route.endsWith('_TRI_REV')
              ? this.buildAutoTriReverseActions(autoTri, result)
              : this.buildAutoTriForwardActions(autoTri, result);
            break;
          }
          throw new Error(`Unknown route: ${result.route}`);
        }
      }

      logger.info(`🔷 Executing ${result.route}: ${actions.length} actions, expected +${result.profitBps.toFixed(1)} BPS ($${result.profitUsd.toFixed(4)})`);

      const txResult = await this.api.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });

      const txId = (txResult as any)?.transaction_id || 'unknown';
      logger.info(`✅ SimpleDEX ${result.route} executed: ${txId}`);

      // Reset error tracking on success
      this.consecutiveErrors = 0;
      this.cooldownMs = 5000;

      // Record success
      profitabilityTracker.completeTrade(tradeId, result.tradeSizeUsd, result.tradeSizeUsd + result.profitUsd, [txId]);
      circuitBreaker.recordTradeResult(STRATEGY_NAME, result.profitUsd);

      // Send Telegram notification
      const isXmdRoute = result.route === 'SDEX_METALX' || result.route === 'METALX_SDEX';
      const denom = isXmdRoute ? 'XMD' : 'XPR';
      const precision = isXmdRoute ? 1000000 : 10000;
      const decimals = isXmdRoute ? 6 : 4;
      const startAmt = Number(result.startAmount) / precision;
      const endAmt = Number(result.endAmount) / precision;
      const profitAmt = endAmt - startAmt;
      await telegramNotifier.sendMessage(
        `🔷 SimpleDEX ${result.route}\n` +
        `${startAmt.toFixed(decimals)} ${denom} → ${endAmt.toFixed(decimals)} ${denom}\n` +
        `Profit: +${profitAmt.toFixed(decimals)} ${denom} (+${result.profitBps.toFixed(1)} BPS, $${result.profitUsd.toFixed(4)})\n` +
        `TX: ${txId}`
      );

    } catch (error: any) {
      const msg = error.message || String(error);
      logger.error(`❌ SimpleDEX ${result.route} failed: ${msg}`);

      // If tx reverted due to MIN_OUT, that's safe — no tokens lost
      // But still count as error to back off and stop spamming
      this.consecutiveErrors++;
      if (this.consecutiveErrors > 2) {
        this.cooldownMs = Math.min(this.cooldownMs * 2, 60000);
        logger.warn(`SimpleDEX ${result.route}: ${this.consecutiveErrors} consecutive failures, cooldown=${this.cooldownMs}ms`);
      }
      const safeRevert = msg.includes('min_out') || msg.includes('INSUFFICIENT_OUTPUT') ||
        msg.includes('assertion failure') || msg.includes('Swap exceeds');
      if (safeRevert) {
        logger.info('  Transaction reverted safely (MIN_OUT protection)');
        // Blacklist route after 5 consecutive failures to stop spam
        if (this.consecutiveErrors >= 5) {
          this.blacklistedRoutes.add(result.route);
          logger.warn(`SimpleDEX ${result.route}: blacklisted after ${this.consecutiveErrors} failures`);
        }
      } else {
        // Record failure
        circuitBreaker.recordTradeResult(STRATEGY_NAME, -0.01); // Small penalty for failed tx
        // Only send Telegram for non-safe failures
        await telegramNotifier.sendMessage(
          `❌ SimpleDEX ${result.route} FAILED\n${msg.substring(0, 200)}`
        );
      }
    } finally {
      this.isExecuting = false;
    }
  }

  // ============================================================
  // Action builders
  // ============================================================

  private auth() {
    return [{ actor: this.username, permission: 'active' }];
  }

  private transferAction(tokenContract: string, to: string, quantity: string, memo: string) {
    return {
      account: tokenContract,
      name: 'transfer',
      authorization: this.auth(),
      data: {
        from: this.username,
        to,
        quantity,
        memo
      }
    };
  }

  /**
   * Format raw BigInt amount as asset string
   */
  private formatAmount(raw: bigint, precision: number, symbol: string): string {
    const amount = Number(raw) / (10 ** precision);
    return `${amount.toFixed(precision)} ${symbol}`;
  }

  /**
   * Apply a safety buffer to intermediate MIN_OUT values.
   * Reduces by 0.5% to account for pool state changes between read and execution.
   * Final step MIN_OUT stays tight (profit protection).
   */
  private safeMinOut(raw: bigint): bigint {
    return raw * 998n / 1000n; // 0.2% buffer
  }

  /**
   * LOAN_TRIANGLE: XPR → LOAN (proton.swaps) → EXIT (SimpleDEX 16) → XPR (SimpleDEX 15)
   *
   * Key: intermediate transfer amounts must equal the MIN_OUT from the previous step.
   * We can only transfer what we're GUARANTEED to receive. Excess stays as dust.
   */
  private buildLoanTriangleActions(result: RouteResult): any[] {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN)!;
    const startXprRaw = result.startAmount;

    // Recalculate intermediates at full precision
    const ammReserveInRaw = BigInt(Math.floor(xprloan.token1Amount * (10 ** xprloan.token1Precision)));
    const ammReserveOutRaw = BigInt(Math.floor(xprloan.token2Amount * (10 ** xprloan.token2Precision)));
    const loanRaw = this.calculateAmmOutputBigInt(startXprRaw, ammReserveInRaw, ammReserveOutRaw, xprloan.exchangeFee);
    const exitRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.EXIT_LOAN, loanRaw, false)!;

    // Safe amounts: what we KNOW we'll have after each step (0.5% buffer)
    const safeLoan = this.safeMinOut(loanRaw);
    // Recalculate exit based on safe LOAN amount (less input = less output)
    const safeExitFromSafeLoan = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.EXIT_LOAN, safeLoan, false)!;
    const safeExit = this.safeMinOut(safeExitFromSafeLoan);
    // Final: must profit or revert
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction(TOKENS.XPR.contract, 'proton.swaps',
        this.formatAmount(startXprRaw, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `XPRLOAN,${this.formatAmount(safeLoan, TOKENS.LOAN.precision, TOKENS.LOAN.symbol)}`),
      this.transferAction(TOKENS.LOAN.contract, 'simpledex',
        this.formatAmount(safeLoan, TOKENS.LOAN.precision, TOKENS.LOAN.symbol),
        `swap:${SDEX_POOLS.EXIT_LOAN}:${safeExit}:0`),
      this.transferAction(TOKENS.EXIT.contract, 'simpledex',
        this.formatAmount(safeExit, TOKENS.EXIT.precision, TOKENS.EXIT.symbol),
        `swap:${SDEX_POOLS.XPR_EXIT}:${minXprOut}:0`),
    ];
  }

  /**
   * LOAN_TRIANGLE_REV: XPR → EXIT (SimpleDEX 15) → LOAN (SimpleDEX 16) → XPR (proton.swaps)
   */
  private buildLoanTriangleRevActions(result: RouteResult): any[] {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN)!;
    const startXprRaw = result.startAmount;

    // Calculate intermediates
    const exitRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_EXIT, startXprRaw, true)!;
    const safeExit = this.safeMinOut(exitRaw);
    const loanFromSafeExit = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.EXIT_LOAN, safeExit, true)!;
    const safeLoan = this.safeMinOut(loanFromSafeExit);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction(TOKENS.XPR.contract, 'simpledex',
        this.formatAmount(startXprRaw, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `swap:${SDEX_POOLS.XPR_EXIT}:${safeExit}:1`),
      this.transferAction(TOKENS.EXIT.contract, 'simpledex',
        this.formatAmount(safeExit, TOKENS.EXIT.precision, TOKENS.EXIT.symbol),
        `swap:${SDEX_POOLS.EXIT_LOAN}:${safeLoan}:1`),
      this.transferAction(TOKENS.LOAN.contract, 'proton.swaps',
        this.formatAmount(safeLoan, TOKENS.LOAN.precision, TOKENS.LOAN.symbol),
        `XPRLOAN,${this.formatAmount(minXprOut, TOKENS.XPR.precision, TOKENS.XPR.symbol)}`),
    ];
  }

  /**
   * LOAN_DIRECT: XPR → LOAN (proton.swaps) → XPR (SimpleDEX pool 24)
   */
  private buildLoanDirectActions(result: RouteResult): any[] {
    const xprloan = this.ammPools.get(AMM_POOLS.XPRLOAN)!;
    const startXprRaw = result.startAmount;

    const ammReserveInRaw = BigInt(Math.floor(xprloan.token1Amount * (10 ** xprloan.token1Precision)));
    const ammReserveOutRaw = BigInt(Math.floor(xprloan.token2Amount * (10 ** xprloan.token2Precision)));
    const loanRaw = this.calculateAmmOutputBigInt(startXprRaw, ammReserveInRaw, ammReserveOutRaw, xprloan.exchangeFee);
    const safeLoan = this.safeMinOut(loanRaw);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction(TOKENS.XPR.contract, 'proton.swaps',
        this.formatAmount(startXprRaw, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `XPRLOAN,${this.formatAmount(safeLoan, TOKENS.LOAN.precision, TOKENS.LOAN.symbol)}`),
      this.transferAction(TOKENS.LOAN.contract, 'simpledex',
        this.formatAmount(safeLoan, TOKENS.LOAN.precision, TOKENS.LOAN.symbol),
        `swap:${SDEX_POOLS.XPR_LOAN}:${minXprOut}:0`),
    ];
  }

  /**
   * LOAN_DIRECT_REV: XPR → LOAN (SimpleDEX pool 24) → XPR (proton.swaps)
   */
  private buildLoanDirectRevActions(result: RouteResult): any[] {
    const startXprRaw = result.startAmount;

    const loanRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_LOAN, startXprRaw, true)!;
    const safeLoan = this.safeMinOut(loanRaw);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction(TOKENS.XPR.contract, 'simpledex',
        this.formatAmount(startXprRaw, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `swap:${SDEX_POOLS.XPR_LOAN}:${safeLoan}:1`),
      this.transferAction(TOKENS.LOAN.contract, 'proton.swaps',
        this.formatAmount(safeLoan, TOKENS.LOAN.precision, TOKENS.LOAN.symbol),
        `XPRLOAN,${this.formatAmount(minXprOut, TOKENS.XPR.precision, TOKENS.XPR.symbol)}`),
    ];
  }

  /**
   * SNIPS_CROSS: XPR → SNIPS (SimpleDEX pool 25) → XPR (proton.swaps SNIPSXP)
   */
  private buildSnipsCrossActions(result: RouteResult): any[] {
    const startXprRaw = result.startAmount;
    const pool25 = simpleDexPoolMonitor.getPool(SDEX_POOLS.SNIPS_XPR)!;

    const snipsRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.SNIPS_XPR, startXprRaw, false)!;
    const safeSnips = this.safeMinOut(snipsRaw);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction(TOKENS.XPR.contract, 'simpledex',
        this.formatAmount(startXprRaw, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `swap:${SDEX_POOLS.SNIPS_XPR}:${safeSnips}:0`),
      this.transferAction(TOKENS.SNIPS.contract, 'proton.swaps',
        this.formatAmount(safeSnips, pool25.tokenAPrecision, pool25.tokenASymbol),
        `SNIPSXP,${this.formatAmount(minXprOut, TOKENS.XPR.precision, TOKENS.XPR.symbol)}`),
    ];
  }

  /**
   * SNIPS_CROSS_REV: XPR → SNIPS (proton.swaps SNIPSXP) → XPR (SimpleDEX pool 25)
   */
  private buildSnipsCrossRevActions(result: RouteResult): any[] {
    const snipsxp = this.ammPools.get(AMM_POOLS.SNIPSXP)!;
    const startXprRaw = result.startAmount;
    const pool25 = simpleDexPoolMonitor.getPool(SDEX_POOLS.SNIPS_XPR)!;

    const ammReserveSnipsRaw = BigInt(Math.floor(snipsxp.token1Amount * (10 ** snipsxp.token1Precision)));
    const ammReserveXprRaw = BigInt(Math.floor(snipsxp.token2Amount * (10 ** snipsxp.token2Precision)));
    const snipsRaw = this.calculateAmmOutputBigInt(startXprRaw, ammReserveXprRaw, ammReserveSnipsRaw, snipsxp.exchangeFee);
    const safeSnips = this.safeMinOut(snipsRaw);
    const minXprOut = startXprRaw + 1n;

    return [
      this.transferAction(TOKENS.XPR.contract, 'proton.swaps',
        this.formatAmount(startXprRaw, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `SNIPSXP,${this.formatAmount(safeSnips, pool25.tokenAPrecision, pool25.tokenASymbol)}`),
      this.transferAction(TOKENS.SNIPS.contract, 'simpledex',
        this.formatAmount(safeSnips, pool25.tokenAPrecision, pool25.tokenASymbol),
        `swap:${SDEX_POOLS.SNIPS_XPR}:${minXprOut}:1`),
    ];
  }

  // ============================================================
  // SimpleDEX ↔ MetalX DEX atomic action builders
  // ============================================================

  /**
   * SDEX_METALX: XMD → XPR (SimpleDEX pool 1) → XMD (DEX sell)
   * Uses atomarb savebalance/checkbalext for atomic profit verification.
   *
   * Flow:
   * 1. savebalance → record starting XMD balance on atomarb
   * 2. transfer XMD → simpledex (buy XPR)
   * 3. transfer XPR → dex (deposit)
   * 4. dex.placeorder → sell XPR for XMD
   * 5. dex.process → match orders
   * 6. dex.withdrawall → withdraw XMD
   * 7. checkbalext → assert XMD >= start + min_profit (reverts if not)
   */
  private buildSdexMetalxActions(result: RouteResult): any[] {
    const startXmdRaw = result.startAmount;

    // Recalculate XPR output from SimpleDEX
    const xprRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_XMD, startXmdRaw, false)!;
    const safeXpr = this.safeMinOut(xprRaw);

    // Get best bid price for aggressive sell (2% below to ensure fill)
    const bestBid = this.dexOrderbook!.bids[0].level;
    const aggressivePrice = Math.floor(bestBid * 0.98 * 1000000);

    const xprQuantity = Number(safeXpr);
    const minProfitRaw = 1;

    // XUSDC amount = XMD amount (1:1 via treasury, 0% fee)
    const xusdcRaw = startXmdRaw;

    return [
      // 1. Mint XMD from XUSDC (free via treasury)
      this.transferAction(TOKENS.XUSDC.contract, 'xmd.treasury',
        this.formatAmount(xusdcRaw, TOKENS.XUSDC.precision, TOKENS.XUSDC.symbol),
        'mint'),
      // 2. Record XMD balance AFTER mint (savebalance reads actual on-chain balance)
      {
        account: this.ATOMARB_CONTRACT,
        name: 'savebalance',
        authorization: this.auth(),
        data: {
          user: this.username,
          token_contract: TOKENS.XMD.contract,
          symbol_str: TOKENS.XMD.symbol,
          precision: TOKENS.XMD.precision,
          min_profit: this.formatAmount(BigInt(minProfitRaw), TOKENS.XMD.precision, TOKENS.XMD.symbol)
        }
      },
      // 3. Buy XPR on SimpleDEX pool 1 (send XMD, get XPR)
      this.transferAction(TOKENS.XMD.contract, 'simpledex',
        this.formatAmount(startXmdRaw, TOKENS.XMD.precision, TOKENS.XMD.symbol),
        `swap:${SDEX_POOLS.XPR_XMD}:${safeXpr}:0`),
      // 4. Deposit XPR to MetalX DEX
      this.transferAction(TOKENS.XPR.contract, 'dex',
        this.formatAmount(safeXpr, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        ''),
      // 5. Sell XPR on DEX (order_side=2=sell, order_type=1=limit)
      {
        account: 'dex',
        name: 'placeorder',
        authorization: this.auth(),
        data: {
          account: this.username,
          market_id: 1,
          order_side: 2,
          order_type: 1,
          quantity: xprQuantity,
          price: aggressivePrice,
          bid_symbol: { sym: '4,XPR', contract: 'eosio.token' },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0,
          referrer: ''
        }
      },
      // 6. Process DEX matching
      {
        account: 'dex',
        name: 'process',
        authorization: this.auth(),
        data: { q_size: 10, show_error_msg: 0 }
      },
      // 7. Withdraw all from DEX
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: this.auth(),
        data: { account: this.username }
      },
      // 8. Verify profit (XMD balance must be > post-mint balance, reverts if not)
      {
        account: this.ATOMARB_CONTRACT,
        name: 'checkbalext',
        authorization: this.auth(),
        data: {
          user: this.username,
          token_contract: TOKENS.XMD.contract,
          symbol_str: TOKENS.XMD.symbol,
          precision: TOKENS.XMD.precision,
          message: 'SDEX_METALX'
        }
      },
    ];
  }

  /**
   * METALX_SDEX: XMD → XPR (DEX buy) → XMD (SimpleDEX pool 1 sell)
   * Uses atomarb savebalance/checkbalext for atomic profit verification.
   *
   * Flow:
   * 1. savebalance → record starting XMD balance on atomarb
   * 2. transfer XMD → dex (deposit)
   * 3. dex.placeorder → buy XPR with XMD
   * 4. dex.process → match orders
   * 5. dex.withdrawall → withdraw XPR + leftover XMD
   * 6. transfer XPR → simpledex (sell for XMD)
   * 7. checkbalext → assert XMD >= start + min_profit (reverts if not)
   */
  private buildMetalxSdexActions(result: RouteResult): any[] {
    const startXmdRaw = result.startAmount;

    // Get best ask price and simulate buy
    const xmdAmount = Number(startXmdRaw) / 1000000;
    const dexResult = this.simulateDexBuy(xmdAmount)!;
    const xprRaw = BigInt(Math.floor(dexResult.xprReceived * 10000));
    const safeXpr = this.safeMinOut(xprRaw);

    // Aggressive buy price (2% above best ask to ensure fill)
    const bestAsk = this.dexOrderbook!.asks[0].level;
    const aggressivePrice = Math.floor(bestAsk * 1.02 * 1000000);

    const xmdForOrder = Number(startXmdRaw);

    // SimpleDEX output: sell XPR on pool 1 (send XPR as tokenA, get XMD as tokenB)
    const xmdOutRaw = simpleDexPoolMonitor.calculateSwapOutput(SDEX_POOLS.XPR_XMD, safeXpr, true)!;
    const minXmdOut = this.safeMinOut(xmdOutRaw);

    const minProfitRaw = 1;
    const xusdcRaw = startXmdRaw;

    return [
      // 1. Mint XMD from XUSDC (free via treasury)
      this.transferAction(TOKENS.XUSDC.contract, 'xmd.treasury',
        this.formatAmount(xusdcRaw, TOKENS.XUSDC.precision, TOKENS.XUSDC.symbol),
        'mint'),
      // 2. Record XMD balance AFTER mint
      {
        account: this.ATOMARB_CONTRACT,
        name: 'savebalance',
        authorization: this.auth(),
        data: {
          user: this.username,
          token_contract: TOKENS.XMD.contract,
          symbol_str: TOKENS.XMD.symbol,
          precision: TOKENS.XMD.precision,
          min_profit: this.formatAmount(BigInt(minProfitRaw), TOKENS.XMD.precision, TOKENS.XMD.symbol)
        }
      },
      // 3. Deposit XMD to MetalX DEX
      this.transferAction(TOKENS.XMD.contract, 'dex',
        this.formatAmount(startXmdRaw, TOKENS.XMD.precision, TOKENS.XMD.symbol),
        ''),
      // 4. Buy XPR on DEX (order_side=1=buy, order_type=1=limit)
      {
        account: 'dex',
        name: 'placeorder',
        authorization: this.auth(),
        data: {
          account: this.username,
          market_id: 1,
          order_side: 1,
          order_type: 1,
          quantity: xmdForOrder,
          price: aggressivePrice,
          bid_symbol: { sym: '4,XPR', contract: 'eosio.token' },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0,
          referrer: ''
        }
      },
      // 5. Process DEX matching
      {
        account: 'dex',
        name: 'process',
        authorization: this.auth(),
        data: { q_size: 10, show_error_msg: 0 }
      },
      // 6. Withdraw all from DEX (XPR + leftover XMD)
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: this.auth(),
        data: { account: this.username }
      },
      // 7. Sell XPR on SimpleDEX pool 1 (send XPR, get XMD)
      this.transferAction(TOKENS.XPR.contract, 'simpledex',
        this.formatAmount(safeXpr, TOKENS.XPR.precision, TOKENS.XPR.symbol),
        `swap:${SDEX_POOLS.XPR_XMD}:${minXmdOut}:1`),
      // 8. Verify profit (XMD balance must be > post-mint balance, reverts if not)
      {
        account: this.ATOMARB_CONTRACT,
        name: 'checkbalext',
        authorization: this.auth(),
        data: {
          user: this.username,
          token_contract: TOKENS.XMD.contract,
          symbol_str: TOKENS.XMD.symbol,
          precision: TOKENS.XMD.precision,
          message: 'METALX_SDEX'
        }
      },
    ];
  }
}
