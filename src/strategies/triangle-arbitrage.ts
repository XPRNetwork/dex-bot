/**
 * Triangle Arbitrage Strategy
 *
 * Monitors XPR/XUSDC/XMD triangle for arbitrage opportunities:
 * - PATH 1: XUSDC -> XMD (Treasury) -> XPR (DEX) -> XUSDC (AMM)
 * - PATH 2: XUSDC -> XPR (AMM) -> XMD (DEX) -> XUSDC (Treasury)
 *
 * Executes automatically when gap > fees (0.3%)
 */

import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';
import { profitabilityTracker } from '../analytics/profitability-tracker.js';

const logger = getLogger();

interface TriangleState {
  pair: PairConfig;
  ammPrice: number;
  dexPrice: number;
  gap: number;
  gapPercent: number;
  profitable: boolean;
  bestPath: 'AMM_TO_DEX' | 'DEX_TO_AMM' | null;
  expectedProfit: number;
  expectedProfitPercent: number;
}

interface TriangleConfig {
  enabled: boolean;
  checkIntervalMs: number;
  minProfitBPS: number;
  maxTradeUSD: number;
  dryRun: boolean;
  minPoolLiquidityUSD: number;
  pairs: PairConfig[];
}

interface PairConfig {
  name: string;
  enabled: boolean;
  monitorOnly?: boolean;  // If true, log opportunities but don't trade
  baseToken: string;
  baseContract: string;
  basePrecision: number;
  ammPoolSymbol: string;
  dexMarketSymbol: string;
  dexMarketId: number;
  // For indirect pools that go through XPR (e.g., METAL, LOAN)
  indirect?: boolean;           // If true, needs 2 AMM hops
  bridgePoolSymbol?: string;    // First hop pool (e.g., XPRUSDC)
  bridgeToken?: string;         // Intermediate token (e.g., XPR)
  bridgePrecision?: number;     // Precision of bridge token
}

interface Balances {
  xpr: number;
  xusdc: number;
  xmd: number;
  loan?: number;
  metal?: number;
}

interface DexLiquidity {
  hasBids: boolean;
  hasAsks: boolean;
  bestBid: number;
  bestAsk: number;
  bidDepth: number;
  askDepth: number;
}

interface OrderbookLevel {
  price: number;     // Price at this level
  quantity: number;  // Quantity (XPR) available at this price
}

interface DetailedOrderbook {
  bids: OrderbookLevel[];  // Sorted high to low (best bid first)
  asks: OrderbookLevel[];  // Sorted low to high (best ask first)
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadBps: number;
}

interface FillSimulation {
  avgFillPrice: number;      // Weighted average fill price
  totalQuantity: number;     // Total quantity that would fill
  totalCost: number;         // Total XMD cost/received
  slippageBps: number;       // Slippage in basis points vs best price
  fullyFillable: boolean;    // Whether the full order can be filled
  levelsFilled: number;      // Number of price levels consumed
}

interface SnipeOpportunity {
  path: 'AMM_TO_DEX' | 'DEX_TO_AMM';
  level: OrderbookLevel;     // The specific order to snipe
  ammPrice: number;          // Current AMM price
  profitBps: number;         // Profit in basis points after fees
  profitUsd: number;         // Expected profit in USD
  tradeSizeUsd: number;      // Trade size in USD
  tradeSizeXpr: number;      // Trade size in XPR
}

export class TriangleArbitrage {
  private rpc: JsonRpc;
  private api: Api;
  private config: TriangleConfig;
  private username: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastTradeTime: number = 0;
  private cooldownMs: number = 5000; // 5 second cooldown between trades (aggressive)
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 3;
  private lastBalances: Balances = { xpr: 0, xusdc: 0, xmd: 0 };
  private lastRecoveryTime: number = 0;
  private recoveryIntervalMs: number = 30000; // Check for stuck funds every 30 seconds
  private isExecuting: boolean = false; // Prevents race conditions during multi-step execution
  private lastSnipeLogTime: number = 0; // For periodic status logging

  // Fee constants
  private readonly AMM_FEE = 0.002; // 0.2%
  private readonly DEX_FEE = 0.001; // 0.1%
  private readonly TOTAL_FEES = 0.003; // 0.3%

  // SAFETY: Track last verified price to detect stale data
  private lastVerifiedAmmPrice: number = 0;
  private lastVerifiedTime: number = 0;
  private readonly PRICE_STALENESS_MAX_MS = 30000; // 30 seconds max age
  private readonly PRICE_DEVIATION_MAX = 0.02; // 2% max deviation from verified

  // Backup RPC endpoints for price verification
  private readonly BACKUP_RPCS = [
    'https://proton.eosusa.io',
    'https://proton.greymass.com',
    'https://proton.eoscafeblock.com'
  ];

  constructor() {
    const config = getConfig() as any;

    // Default XPR pair if none configured
    const defaultPairs: PairConfig[] = [{
      name: 'XPR',
      enabled: true,
      baseToken: 'XPR',
      baseContract: 'eosio.token',
      basePrecision: 4,
      ammPoolSymbol: 'XPRUSDC',
      dexMarketSymbol: 'XPR_XMD',
      dexMarketId: 1
    }];

    this.config = {
      enabled: config.triangleArbitrage?.enabled ?? true,
      checkIntervalMs: config.triangleArbitrage?.checkIntervalMs ?? 5000,
      minProfitBPS: config.triangleArbitrage?.minProfitBPS ?? 5,
      maxTradeUSD: config.triangleArbitrage?.maxTradeUSD ?? 50,
      dryRun: config.triangleArbitrage?.dryRun ?? false,
      minPoolLiquidityUSD: config.triangleArbitrage?.minPoolLiquidityUSD ?? 100000,
      pairs: config.triangleArbitrage?.pairs ?? defaultPairs
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
   * CRITICAL SAFETY: Verify AMM price from multiple RPC endpoints
   * - 2 prices match → verified, proceed
   * - 2 prices MISMATCH → HALT (real discrepancy)
   * - 1 price (endpoint down) → NOTIFY but proceed
   * - 0 prices → HALT (can't trade blind)
   */
  private async verifyAmmPrice(poolSymbol: string): Promise<{ verified: boolean; price: number; error?: string }> {
    const prices: { endpoint: string; price: number }[] = [];
    const errors: string[] = [];

    // Query from multiple endpoints
    for (const endpoint of this.BACKUP_RPCS.slice(0, 2)) {
      try {
        const backupRpc = new JsonRpc([endpoint]);
        const result = await backupRpc.get_table_rows({
          code: 'proton.swaps',
          scope: 'proton.swaps',
          table: 'pools',
          limit: 100,
          json: true
        });

        const pool = result.rows.find((p: any) => p.lt_symbol?.includes(poolSymbol));
        if (pool) {
          const token1 = parseFloat(pool.pool1.quantity);
          const token2 = parseFloat(pool.pool2.quantity);
          const price = token2 / token1;
          prices.push({ endpoint, price });
        }
      } catch (e: any) {
        errors.push(`${endpoint}: ${e.message}`);
      }
    }

    // Case: NO prices at all - HALT
    if (prices.length === 0) {
      return { verified: false, price: 0, error: `ALL RPC ENDPOINTS FAILED: ${errors.join(', ')}` };
    }

    // Case: Only 1 price (one endpoint down) - NOTIFY but proceed
    if (prices.length === 1) {
      const msg = `⚠️ RPC endpoint down: ${errors.join(', ')} - continuing with ${prices[0].endpoint}`;
      logger.warn(msg);
      await telegramNotifier.notify(msg, 'normal');

      // Still update verified price and proceed
      this.lastVerifiedAmmPrice = prices[0].price;
      this.lastVerifiedTime = Date.now();
      return { verified: true, price: prices[0].price };
    }

    // Case: 2 prices - check if they match
    const deviation = Math.abs(prices[0].price - prices[1].price) / prices[0].price;
    if (deviation > 0.005) {
      // REAL PRICE MISMATCH - this is serious, HALT
      return {
        verified: false,
        price: 0,
        error: `PRICE MISMATCH: ${prices[0].endpoint}=$${prices[0].price.toFixed(6)} vs ${prices[1].endpoint}=$${prices[1].price.toFixed(6)} (${(deviation * 100).toFixed(2)}% diff)`
      };
    }

    const avgPrice = (prices[0].price + prices[1].price) / 2;

    // Check for sudden large moves from last verified price
    if (this.lastVerifiedAmmPrice > 0) {
      const moveFromLast = Math.abs(avgPrice - this.lastVerifiedAmmPrice) / this.lastVerifiedAmmPrice;
      if (moveFromLast > this.PRICE_DEVIATION_MAX) {
        const timeSinceLast = Date.now() - this.lastVerifiedTime;
        // Only warn if the move happened quickly (within 60 seconds)
        if (timeSinceLast < 60000) {
          const msg = `⚠️ LARGE PRICE MOVE: ${(moveFromLast * 100).toFixed(2)}% in ${(timeSinceLast / 1000).toFixed(0)}s - $${this.lastVerifiedAmmPrice.toFixed(6)} → $${avgPrice.toFixed(6)}`;
          logger.warn(msg);
          await telegramNotifier.notify(msg, 'normal');
        }
      }
    }

    // Update verified price
    this.lastVerifiedAmmPrice = avgPrice;
    this.lastVerifiedTime = Date.now();

    return { verified: true, price: avgPrice };
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Triangle arbitrage disabled');
      return;
    }

    logger.info('Triangle arbitrage starting...');
    logger.info(`Check interval: ${this.config.checkIntervalMs}ms`);
    logger.info(`Min profit: ${this.config.minProfitBPS} BPS (0.${this.config.minProfitBPS}%)`);
    logger.info(`Max trade: $${this.config.maxTradeUSD}`);
    logger.info(`Min pool liquidity: $${(this.config.minPoolLiquidityUSD / 1000).toFixed(0)}K`);
    logger.info(`Dry run: ${this.config.dryRun}`);

    const enabledPairs = this.config.pairs.filter(p => p.enabled);
    const tradingPairs = enabledPairs.filter(p => !p.monitorOnly);
    const monitorOnlyPairs = enabledPairs.filter(p => p.monitorOnly);
    logger.info(`Trading ${tradingPairs.length} pairs: ${tradingPairs.map(p => p.name).join(', ') || 'none'}`);
    if (monitorOnlyPairs.length > 0) {
      logger.info(`👁️ Monitor-only ${monitorOnlyPairs.length} pairs: ${monitorOnlyPairs.map(p => p.name).join(', ')}`);
    }

    // Initial check
    await this.checkAndExecute();

    // Start continuous monitoring
    this.checkInterval = setInterval(() => this.checkAndExecute(), this.config.checkIntervalMs);

    logger.info('Triangle arbitrage monitor active');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Triangle arbitrage stopped');
  }

  /**
   * Get current token balances
   */
  private async getBalances(): Promise<Balances> {
    const [xprRes, xusdcRes, xmdRes, loanRes] = await Promise.all([
      this.rpc.get_table_rows({
        code: 'eosio.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      }),
      this.rpc.get_table_rows({
        code: 'xtokens',
        scope: this.username,
        table: 'accounts',
        limit: 20,
        json: true
      }),
      this.rpc.get_table_rows({
        code: 'xmd.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      }),
      this.rpc.get_table_rows({
        code: 'loan.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      })
    ]);

    let xpr = 0, xusdc = 0, xmd = 0, loan = 0, metal = 0;

    for (const row of xprRes.rows) {
      if (row.balance?.includes('XPR')) xpr = parseFloat(row.balance);
    }
    for (const row of xusdcRes.rows) {
      if (row.balance?.includes('XUSDC')) xusdc = parseFloat(row.balance);
      if (row.balance?.includes('METAL')) metal = parseFloat(row.balance);
    }
    for (const row of xmdRes.rows) {
      if (row.balance?.includes('XMD')) xmd = parseFloat(row.balance);
    }
    for (const row of loanRes.rows) {
      if (row.balance?.includes('LOAN')) loan = parseFloat(row.balance);
    }

    this.lastBalances = { xpr, xusdc, xmd, loan, metal };
    return { xpr, xusdc, xmd, loan, metal };
  }

  /**
   * Get balance for a specific token
   */
  private async getTokenBalance(tokenSymbol: string, tokenContract: string): Promise<number> {
    const res = await this.rpc.get_table_rows({
      code: tokenContract,
      scope: this.username,
      table: 'accounts',
      limit: 20,
      json: true
    });

    for (const row of res.rows) {
      if (row.balance?.includes(tokenSymbol)) {
        return parseFloat(row.balance);
      }
    }
    return 0;
  }

  /**
   * Get detailed orderbook with full precision (step=1000000 = 0.000001)
   * Returns individual price levels for accurate fill simulation
   */
  private async getDetailedOrderbook(dexSymbol: string = 'XPR_XMD'): Promise<DetailedOrderbook> {
    try {
      // Use step=1000000 for full 0.000001 precision (matches DEX native precision)
      const res = await fetch(`https://dex.api.mainnet.metalx.com/dex/v1/orders/depth?symbol=${dexSymbol}&step=1000000&limit=100`);
      const data = await res.json() as any;

      const rawBids = data.data?.bids || [];
      const rawAsks = data.data?.asks || [];

      // Convert to OrderbookLevel format and sort
      const bids: OrderbookLevel[] = rawBids
        .map((b: any) => ({ price: b.level, quantity: b.bid }))
        .sort((a: OrderbookLevel, b: OrderbookLevel) => b.price - a.price); // High to low

      const asks: OrderbookLevel[] = rawAsks
        .map((a: any) => ({ price: a.level, quantity: a.bid }))
        .sort((a: OrderbookLevel, b: OrderbookLevel) => a.price - b.price); // Low to high

      const bestBid = bids.length > 0 ? bids[0].price : 0;
      const bestAsk = asks.length > 0 ? asks[0].price : 0;
      const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
      const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;

      return { bids, asks, bestBid, bestAsk, spread, spreadBps };
    } catch (error: any) {
      logger.error('Failed to get detailed orderbook:', error.message);
      return { bids: [], asks: [], bestBid: 0, bestAsk: 0, spread: 0, spreadBps: 0 };
    }
  }

  /**
   * Simulate filling an order by walking through orderbook levels
   * Returns expected average fill price and slippage
   *
   * @param side 'buy' or 'sell' (from our perspective)
   * @param quantityXpr Amount of XPR to trade
   * @param orderbook The detailed orderbook
   * @param maxSlippageBps Maximum acceptable slippage in basis points (default 500 = 5%)
   */
  private simulateFill(
    side: 'buy' | 'sell',
    quantityXpr: number,
    orderbook: DetailedOrderbook,
    maxSlippageBps: number = 500
  ): FillSimulation {
    // For selling XPR: we hit bids (buyers)
    // For buying XPR: we hit asks (sellers)
    const levels = side === 'sell' ? orderbook.bids : orderbook.asks;
    const bestPrice = side === 'sell' ? orderbook.bestBid : orderbook.bestAsk;

    if (levels.length === 0 || bestPrice === 0) {
      return {
        avgFillPrice: 0,
        totalQuantity: 0,
        totalCost: 0,
        slippageBps: Infinity,
        fullyFillable: false,
        levelsFilled: 0
      };
    }

    let remainingQty = quantityXpr;
    let totalCost = 0;      // Total XMD
    let totalFilled = 0;    // Total XPR filled
    let levelsFilled = 0;
    let worstPrice = bestPrice;

    for (const level of levels) {
      if (remainingQty <= 0) break;

      // Check if this level is within acceptable slippage
      const priceSlippage = side === 'sell'
        ? ((bestPrice - level.price) / bestPrice) * 10000  // Selling: lower price = worse
        : ((level.price - bestPrice) / bestPrice) * 10000; // Buying: higher price = worse

      if (priceSlippage > maxSlippageBps) {
        // Stop filling at levels beyond max slippage
        break;
      }

      const fillQty = Math.min(remainingQty, level.quantity);
      const fillCost = fillQty * level.price;

      totalFilled += fillQty;
      totalCost += fillCost;
      remainingQty -= fillQty;
      levelsFilled++;
      worstPrice = level.price;
    }

    const avgFillPrice = totalFilled > 0 ? totalCost / totalFilled : 0;
    const slippageBps = bestPrice > 0
      ? Math.abs((avgFillPrice - bestPrice) / bestPrice) * 10000
      : 0;

    return {
      avgFillPrice,
      totalQuantity: totalFilled,
      totalCost,
      slippageBps,
      fullyFillable: remainingQty <= 0,
      levelsFilled
    };
  }

  /**
   * Check DEX orderbook liquidity via DEX API
   * Returns actual best bid/ask prices and depth at those levels
   * Uses full precision orderbook and simulates fill quality
   */
  private async getDexLiquidity(dexSymbol: string = 'XPR_XMD', marketPrice: number = 0): Promise<DexLiquidity> {
    try {
      // Get full precision orderbook
      const orderbook = await this.getDetailedOrderbook(dexSymbol);

      let bidDepth = 0, askDepth = 0;
      let usableBidDepth = 0, usableAskDepth = 0;

      // Calculate total and usable depth from detailed orderbook
      for (const level of orderbook.bids) {
        bidDepth += level.quantity;
        // Count "usable" depth within 10% of market price
        if (marketPrice > 0 && level.price >= marketPrice * 0.90) {
          usableBidDepth += level.quantity;
        }
      }

      for (const level of orderbook.asks) {
        askDepth += level.quantity;
        // Count "usable" depth within 10% of market price
        if (marketPrice > 0 && level.price <= marketPrice * 1.10) {
          usableAskDepth += level.quantity;
        }
      }

      // Log detailed liquidity info
      if (marketPrice > 0) {
        const bidGap = orderbook.bestBid > 0
          ? ((orderbook.bestBid - marketPrice) / marketPrice * 100).toFixed(2)
          : 'N/A';
        const askGap = orderbook.bestAsk > 0
          ? ((orderbook.bestAsk - marketPrice) / marketPrice * 100).toFixed(2)
          : 'N/A';

        logger.info(`DEX Orderbook: ${orderbook.bids.length} bid levels, ${orderbook.asks.length} ask levels`);
        logger.info(`Best bid: $${orderbook.bestBid.toFixed(6)} (${bidGap}% vs AMM), Best ask: $${orderbook.bestAsk.toFixed(6)} (${askGap}% vs AMM)`);
        logger.info(`Spread: ${orderbook.spreadBps.toFixed(1)} BPS ($${orderbook.spread.toFixed(6)})`);
        logger.info(`Usable depth: ${usableBidDepth.toFixed(0)} XPR bids, ${usableAskDepth.toFixed(0)} XPR asks (within 10% of market)`);

        // Show top 3 bid/ask levels for debugging
        if (orderbook.bids.length > 0) {
          const topBids = orderbook.bids.slice(0, 3)
            .map(l => `$${l.price.toFixed(6)}:${l.quantity.toFixed(0)}`)
            .join(', ');
          logger.info(`Top bids: ${topBids}`);
        }
        if (orderbook.asks.length > 0) {
          const topAsks = orderbook.asks.slice(0, 3)
            .map(l => `$${l.price.toFixed(6)}:${l.quantity.toFixed(0)}`)
            .join(', ');
          logger.info(`Top asks: ${topAsks}`);
        }
      }

      // Only consider liquidity "available" if best price is within 10% of market
      const hasBids = orderbook.bestBid > 0 &&
        (marketPrice === 0 || orderbook.bestBid >= marketPrice * 0.90) &&
        usableBidDepth > 1000;
      const hasAsks = orderbook.bestAsk > 0 &&
        (marketPrice === 0 || orderbook.bestAsk <= marketPrice * 1.10) &&
        usableAskDepth > 1000;

      return {
        hasBids,
        hasAsks,
        bestBid: orderbook.bestBid,
        bestAsk: orderbook.bestAsk,
        bidDepth: usableBidDepth > 0 ? usableBidDepth : bidDepth,
        askDepth: usableAskDepth > 0 ? usableAskDepth : askDepth
      };
    } catch (error: any) {
      logger.error('Failed to get DEX liquidity:', error.message);
      // Return FALSE to block trading if liquidity check fails
      return {
        hasBids: false,
        hasAsks: false,
        bestBid: 0,
        bestAsk: 0,
        bidDepth: 0,
        askDepth: 0
      };
    }
  }

  /**
   * Check if a trade can be executed profitably given orderbook depth
   * Returns expected fill quality and whether trade should proceed
   */
  private async checkFillQuality(
    dexSymbol: string,
    side: 'buy' | 'sell',
    quantityXpr: number,
    expectedPrice: number,
    minProfitBps: number
  ): Promise<{ proceed: boolean; fillSim: FillSimulation; reason: string }> {
    const orderbook = await this.getDetailedOrderbook(dexSymbol);

    // Max slippage we can tolerate while still being profitable
    // If we need 300 BPS profit and fees are 30 BPS, we can tolerate ~270 BPS slippage
    const maxSlippageBps = Math.max(minProfitBps - 30, 50); // At least 50 BPS tolerance

    const fillSim = this.simulateFill(side, quantityXpr, orderbook, maxSlippageBps);

    if (!fillSim.fullyFillable) {
      return {
        proceed: false,
        fillSim,
        reason: `Insufficient depth: only ${fillSim.totalQuantity.toFixed(0)}/${quantityXpr.toFixed(0)} XPR fillable within ${maxSlippageBps} BPS slippage`
      };
    }

    // Calculate if trade is still profitable after slippage
    const priceDiff = side === 'sell'
      ? ((expectedPrice - fillSim.avgFillPrice) / expectedPrice) * 10000
      : ((fillSim.avgFillPrice - expectedPrice) / expectedPrice) * 10000;

    const effectiveProfitBps = minProfitBps - priceDiff;

    if (effectiveProfitBps < 10) { // Minimum 10 BPS profit after slippage
      return {
        proceed: false,
        fillSim,
        reason: `Slippage too high: ${fillSim.slippageBps.toFixed(1)} BPS reduces profit to ${effectiveProfitBps.toFixed(1)} BPS`
      };
    }

    logger.info(`Fill simulation: ${side} ${quantityXpr.toFixed(0)} XPR @ avg $${fillSim.avgFillPrice.toFixed(6)} (${fillSim.levelsFilled} levels, ${fillSim.slippageBps.toFixed(1)} BPS slippage)`);

    return {
      proceed: true,
      fillSim,
      reason: `OK: Expected fill @ $${fillSim.avgFillPrice.toFixed(6)} with ${fillSim.slippageBps.toFixed(1)} BPS slippage`
    };
  }

  /**
   * Find snipeable orders on the DEX that are mispriced vs AMM
   * Returns specific orders that can be profitably sniped with exact sizing
   *
   * @param dexSymbol The DEX market symbol
   * @param ammPrice Current AMM price
   * @param minProfitBps Minimum profit required in basis points
   * @param maxTradeUsd Maximum trade size in USD
   * @param minTradeUsd Minimum trade size in USD (default $5)
   */
  private async findSnipeOpportunities(
    dexSymbol: string,
    ammPrice: number,
    minProfitBps: number,
    maxTradeUsd: number,
    minTradeUsd: number = 5
  ): Promise<SnipeOpportunity[]> {
    const orderbook = await this.getDetailedOrderbook(dexSymbol);
    const opportunities: SnipeOpportunity[] = [];

    // Total fees: AMM 0.2% + DEX 0.1% = 0.3%
    const totalFeeBps = 30;

    // Add buffer for AMM price impact (~5 BPS for small trades)
    // This ensures we don't waste time on marginal opportunities that fail the final check
    const priceImpactBuffer = 5;
    const effectiveMinProfitBps = minProfitBps + priceImpactBuffer;

    // Check bids (for AMM_TO_DEX path: buy on AMM, sell on DEX)
    // Profitable when DEX bid > AMM price + fees + price impact buffer
    for (const level of orderbook.bids) {
      const gapBps = ((level.price - ammPrice) / ammPrice) * 10000;
      const profitBps = gapBps - totalFeeBps - priceImpactBuffer;  // Account for impact in profit calc

      if (profitBps >= minProfitBps) {  // Still use original minProfitBps for filtering
        const tradeSizeXpr = level.quantity;
        const tradeSizeUsd = tradeSizeXpr * ammPrice;

        // Skip if too small or too large
        if (tradeSizeUsd < minTradeUsd) continue;

        // Cap at max trade size
        const cappedXpr = tradeSizeUsd > maxTradeUsd ? maxTradeUsd / ammPrice : tradeSizeXpr;
        const cappedUsd = Math.min(tradeSizeUsd, maxTradeUsd);

        opportunities.push({
          path: 'AMM_TO_DEX',
          level: { price: level.price, quantity: cappedXpr },
          ammPrice,
          profitBps,
          profitUsd: (profitBps / 10000) * cappedUsd,
          tradeSizeUsd: cappedUsd,
          tradeSizeXpr: cappedXpr
        });
      }
    }

    // Check asks (for DEX_TO_AMM path: buy on DEX, sell to AMM)
    // Profitable when DEX ask < AMM price - fees - price impact buffer
    for (const level of orderbook.asks) {
      const gapBps = ((ammPrice - level.price) / ammPrice) * 10000;
      const profitBps = gapBps - totalFeeBps - priceImpactBuffer;  // Account for impact

      if (profitBps >= minProfitBps) {
        const tradeSizeXpr = level.quantity;
        const tradeSizeUsd = tradeSizeXpr * ammPrice;

        // Skip if too small or too large
        if (tradeSizeUsd < minTradeUsd) continue;

        // Cap at max trade size
        const cappedXpr = tradeSizeUsd > maxTradeUsd ? maxTradeUsd / ammPrice : tradeSizeXpr;
        const cappedUsd = Math.min(tradeSizeUsd, maxTradeUsd);

        opportunities.push({
          path: 'DEX_TO_AMM',
          level: { price: level.price, quantity: cappedXpr },
          ammPrice,
          profitBps,
          profitUsd: (profitBps / 10000) * cappedUsd,
          tradeSizeUsd: cappedUsd,
          tradeSizeXpr: cappedXpr
        });
      }
    }

    // Sort by profit (highest first)
    opportunities.sort((a, b) => b.profitBps - a.profitBps);

    // Calculate thresholds for logging
    const minBidForProfit = ammPrice * (1 + (totalFeeBps + minProfitBps) / 10000);
    const maxAskForProfit = ammPrice * (1 - (totalFeeBps + minProfitBps) / 10000);

    // Log findings
    if (opportunities.length > 0) {
      logger.info(`🎯 Found ${opportunities.length} snipe opportunities:`);
      for (const opp of opportunities.slice(0, 5)) {
        logger.info(`  ${opp.path}: ${opp.tradeSizeXpr.toFixed(0)} XPR @ $${opp.level.price.toFixed(6)} = +${opp.profitBps.toFixed(1)} BPS ($${opp.profitUsd.toFixed(2)})`);
      }
    } else {
      // Log status every 5 seconds
      if (!this.lastSnipeLogTime || Date.now() - this.lastSnipeLogTime > 5000) {
        this.lastSnipeLogTime = Date.now();
        const bestBid = orderbook.bestBid;
        const bestAsk = orderbook.bestAsk;
        const bidGapBps = ((bestBid - ammPrice) / ammPrice) * 10000;
        const askGapBps = ((ammPrice - bestAsk) / ammPrice) * 10000;

        logger.info(`📊 Snipe scan: AMM=$${ammPrice.toFixed(6)} | Best bid=$${bestBid.toFixed(6)} (${bidGapBps.toFixed(0)} BPS) need>${minBidForProfit.toFixed(6)} | Best ask=$${bestAsk.toFixed(6)} (${askGapBps.toFixed(0)} BPS) need<${maxAskForProfit.toFixed(6)}`);
      }
    }

    return opportunities;
  }

  /**
   * Execute a snipe trade - sized exactly to match a specific order
   */
  private async executeSnipe(snipe: SnipeOpportunity, pair: PairConfig): Promise<void> {
    logger.info(`🎯 SNIPING: ${snipe.path} ${snipe.tradeSizeXpr.toFixed(0)} XPR @ $${snipe.level.price.toFixed(6)}`);
    logger.info(`Expected profit (spot): ${snipe.profitBps.toFixed(1)} BPS ($${snipe.profitUsd.toFixed(2)})`);

    // SAFETY CHECK 1: Only allow XPR pair (disable METAL/LOAN until properly implemented)
    if (pair.baseToken !== 'XPR') {
      logger.error(`🚫 BLOCKED: Only XPR trading is allowed, not ${pair.baseToken}`);
      throw new Error(`Trading ${pair.baseToken} is not supported yet`);
    }

    // SAFETY CHECK 2: Reject obviously wrong profit calculations (>1000 BPS = 10% is suspicious)
    const MAX_REASONABLE_PROFIT_BPS = 1000; // 10% max - anything higher is likely a bug
    if (snipe.profitBps > MAX_REASONABLE_PROFIT_BPS) {
      logger.error(`🚫 BLOCKED: Profit ${snipe.profitBps.toFixed(1)} BPS is unrealistic (max ${MAX_REASONABLE_PROFIT_BPS}). Likely a price data bug!`);
      throw new Error(`Unrealistic profit detected: ${snipe.profitBps.toFixed(1)} BPS - likely wrong price data`);
    }

    // SAFETY CHECK 3: DEX price must be within 50% of AMM price (sanity check)
    const priceRatio = snipe.level.price / snipe.ammPrice;
    if (priceRatio < 0.5 || priceRatio > 2.0) {
      logger.error(`🚫 BLOCKED: DEX price $${snipe.level.price.toFixed(6)} is ${((priceRatio - 1) * 100).toFixed(0)}% from AMM $${snipe.ammPrice.toFixed(6)} - likely wrong market!`);
      throw new Error(`Price mismatch: DEX $${snipe.level.price.toFixed(6)} vs AMM $${snipe.ammPrice.toFixed(6)}`);
    }

    // CRITICAL: Verify profitability with AMM price impact BEFORE executing
    const profitCheck = await this.verifyAmmProfitability(
      snipe.path,
      snipe.tradeSizeUsd,
      snipe.level.price,
      this.config.minProfitBPS
    );

    if (!profitCheck.profitable) {
      logger.warn(`❌ Snipe ABORTED: ${profitCheck.reason}`);
      await telegramNotifier.notify(
        `⚠️ *Snipe Aborted*\n\n${profitCheck.reason}\n\nTrade size: $${snipe.tradeSizeUsd.toFixed(2)}\nPrice impact: ${profitCheck.priceImpact?.toFixed(2)}%`,
        'normal'
      );
      throw new Error(`Profitability check failed: ${profitCheck.reason}`);
    }

    logger.info(`✅ Profitability verified: ${profitCheck.reason}`);

    // Alert via Telegram
    await telegramNotifier.notify(
      `🎯 *SNIPE TRADE*\n\nPath: ${snipe.path}\nTarget: $${snipe.level.price.toFixed(6)}\nSize: ${snipe.tradeSizeXpr.toFixed(0)} XPR ($${snipe.tradeSizeUsd.toFixed(2)})\nAMM Impact: ${profitCheck.priceImpact?.toFixed(2)}%\n✅ Verified profitable`,
      'high'
    );

    // Create a state object for the execution methods
    const state: TriangleState = {
      pair,
      ammPrice: snipe.ammPrice,
      dexPrice: snipe.level.price,
      gap: snipe.level.price - snipe.ammPrice,
      gapPercent: ((snipe.level.price - snipe.ammPrice) / snipe.ammPrice) * 100,
      profitable: true,
      bestPath: snipe.path,
      expectedProfit: snipe.profitUsd,
      expectedProfitPercent: snipe.profitBps / 100
    };

    // Execute using the exact snipe size
    if (snipe.path === 'AMM_TO_DEX') {
      await this.executeAmmToDex(state, snipe.tradeSizeUsd);
    } else {
      await this.executeDexToAmm(state, snipe.tradeSizeUsd);
    }
  }

  /**
   * Recovery: Sell XPR to get XUSDC
   * Tries triangle path first (DEX + Treasury, 0.1% fee), falls back to AMM (0.2% fee)
   */
  async recoverXprToXusdc(maxXpr?: number): Promise<void> {
    const balances = await this.getBalances();
    const ammPrice = await this.getAmmPrice();

    // Calculate how much XPR to sell
    const targetXusdc = this.config.maxTradeUSD * 3; // Keep enough for 3 trades

    if (balances.xusdc >= targetXusdc) {
      logger.info('Sufficient XUSDC balance, no recovery needed');
      return;
    }

    // Calculate XPR to sell to reach target
    const needXusdc = targetXusdc - balances.xusdc;
    let xprToSell = needXusdc / (ammPrice * 0.998); // Account for slippage

    // Apply limits
    if (maxXpr) xprToSell = Math.min(xprToSell, maxXpr);
    xprToSell = Math.min(xprToSell, balances.xpr * 0.9); // Keep 10% reserve

    if (xprToSell < 1000) {
      logger.info('Not enough XPR to recover meaningfully');
      return;
    }

    // Try triangle path first: XPR → XMD (DEX) → XUSDC (Treasury)
    logger.info(`RECOVERY: Attempting triangle path for ${xprToSell.toFixed(0)} XPR`);

    let triangleSuccess = false;
    try {
      // Get DEX price
      const tradesRes = await fetch('https://dex.api.mainnet.metalx.com/dex/v1/trades/recent?symbol=XPR_XMD&limit=1');
      const tradesData = await tradesRes.json() as { data: { price: number }[] };
      const dexPrice = tradesData.data[0]?.price || ammPrice;

      // Step 1: Sell XPR on DEX for XMD (aggressive limit order)
      const xprRaw = Math.floor(xprToSell * 10000);
      const aggressivePriceRaw = Math.floor(dexPrice * 0.98 * 1000000); // 2% below market (reduced from 5%)

      logger.info(`Recovery Step 1: LIMIT SELL ${xprToSell.toFixed(0)} XPR @ 2% below market`);

      const dexActions = [
        {
          account: 'eosio.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'dex',
            quantity: `${xprToSell.toFixed(4)} XPR`,
            memo: ''
          }
        },
        {
          account: 'dex',
          name: 'placeorder',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            market_id: 1,
            account: this.username,
            order_type: 1, // Limit order
            order_side: 2, // Sell
            quantity: xprRaw,
            price: aggressivePriceRaw,
            bid_symbol: { sym: '4,XPR', contract: 'eosio.token' },
            ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
            trigger_price: 0,
            fill_type: 0, // Normal - can fill across multiple orders
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

      await this.api.transact({ actions: dexActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });

      // Wait and check XMD balance
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newBalances = await this.getBalances();

      if (newBalances.xmd > 1) {
        // Step 2: Redeem XMD at Treasury
        logger.info(`Recovery Step 2: Redeem ${newBalances.xmd.toFixed(2)} XMD at Treasury`);

        const treasuryActions = [{
          account: 'xmd.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'xmd.treasury',
            quantity: `${newBalances.xmd.toFixed(6)} XMD`,
            memo: 'redeem,XUSDC'
          }
        }];

        await this.api.transact({ actions: treasuryActions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });

        triangleSuccess = true;
        logger.info('Recovery via triangle path complete');
        await telegramNotifier.notify(
          `🔄 *Recovery (Triangle)*\nSold ${xprToSell.toFixed(0)} XPR → ${newBalances.xmd.toFixed(2)} XMD → XUSDC`,
          'normal'
        );
      } else {
        logger.info('DEX IOC did not fill, falling back to AMM');
      }
    } catch (error: any) {
      logger.warn('Triangle recovery failed, falling back to AMM:', error.message);
    }

    // Fallback: Direct AMM swap if triangle didn't work
    if (!triangleSuccess) {
      logger.info(`RECOVERY FALLBACK: Direct AMM swap for ${xprToSell.toFixed(0)} XPR`);
      const minXusdcOut = (xprToSell * ammPrice * 0.97).toFixed(6);

      try {
        const actions = [{
          account: 'eosio.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'proton.swaps',
            quantity: `${xprToSell.toFixed(4)} XPR`,
            memo: `XPRUSDC,${minXusdcOut} XUSDC`
          }
        }];

        const result = await this.api.transact({ actions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });

        logger.info('Recovery AMM swap executed: ' + (result as any).transaction_id);
        await telegramNotifier.notify(
          `🔄 *Recovery (AMM Fallback)*\nSold ${xprToSell.toFixed(0)} XPR for ~${minXusdcOut} XUSDC`,
          'normal'
        );
      } catch (error: any) {
        logger.error('Recovery AMM fallback failed:', error.message);
      }
    }
  }

  /**
   * Auto-recover: Redeem any stuck XMD back to XUSDC
   * This runs periodically to clean up after failed trades
   */
  private async autoRedeemStuckXmd(): Promise<boolean> {
    const balances = await this.getBalances();

    // If we have XMD > $1, redeem it
    if (balances.xmd > 1) {
      logger.info(`Auto-recovery: Found ${balances.xmd.toFixed(6)} stuck XMD, redeeming to XUSDC...`);

      try {
        const treasuryActions = [{
          account: 'xmd.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'xmd.treasury',
            quantity: `${balances.xmd.toFixed(6)} XMD`,
            memo: 'redeem,XUSDC'
          }
        }];

        const result = await this.api.transact({ actions: treasuryActions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });

        logger.info('Auto-recovery: XMD redeemed - ' + (result as any).transaction_id);
        await telegramNotifier.notify(
          `🔄 *Auto-Recovery*\nRedeemed ${balances.xmd.toFixed(2)} XMD to XUSDC`,
          'normal'
        );
        return true;
      } catch (error: any) {
        logger.error('Auto-recovery failed:', error.message);
        return false;
      }
    }

    return false;
  }

  /**
   * Calculate safe trade size based on actual balance
   * Returns the lower of: maxTradeUSD config or 90% of available XUSDC
   */
  private calculateSafeTradeSize(xusdcBalance: number): number {
    const maxFromConfig = this.config.maxTradeUSD;
    const maxFromBalance = xusdcBalance * 0.9; // Keep 10% reserve
    const safeSize = Math.min(maxFromConfig, maxFromBalance);

    // Minimum viable trade size
    if (safeSize < 10) {
      return 0; // Too small to trade
    }

    return Math.floor(safeSize); // Round down for safety
  }

  /**
   * Get AMM price for XPR/XUSDC
   */
  private async getAmmPrice(): Promise<number> {
    const poolsRes = await this.rpc.get_table_rows({
      code: 'proton.swaps',
      scope: 'proton.swaps',
      table: 'pools',
      limit: 100,
      json: true
    });

    const xprusdc = poolsRes.rows.find((p: any) => p.lt_symbol.includes('XPRUSDC'));
    if (!xprusdc) throw new Error('XPRUSDC pool not found');

    const ammXpr = parseFloat(xprusdc.pool1.quantity);
    const ammUsdc = parseFloat(xprusdc.pool2.quantity);
    return ammUsdc / ammXpr;
  }

  /**
   * Calculate AMM output with price impact using constant product formula
   * This gives us the ACTUAL expected output, not the spot price estimate
   *
   * Formula: output = (input * poolOut * (1 - fee)) / (poolIn + input * (1 - fee))
   *
   * @param inputAmount Amount of input token
   * @param inputIsXusdc True if swapping XUSDC -> XPR, false for XPR -> XUSDC
   * @returns Expected output amount and effective price
   */
  private async calculateAmmOutput(inputAmount: number, inputIsXusdc: boolean): Promise<{
    outputAmount: number;
    effectivePrice: number;  // XUSDC per XPR
    priceImpact: number;     // Percentage price impact
    spotPrice: number;       // Current spot price for comparison
  }> {
    const poolsRes = await this.rpc.get_table_rows({
      code: 'proton.swaps',
      scope: 'proton.swaps',
      table: 'pools',
      limit: 100,
      json: true
    });

    const pool = poolsRes.rows.find((p: any) => p.lt_symbol.includes('XPRUSDC'));
    if (!pool) throw new Error('XPRUSDC pool not found');

    const poolXpr = parseFloat(pool.pool1.quantity);
    const poolUsdc = parseFloat(pool.pool2.quantity);
    const spotPrice = poolUsdc / poolXpr;

    // AMM uses 0.2% fee
    const feeMultiplier = 1 - this.AMM_FEE;

    let outputAmount: number;
    let effectivePrice: number;

    if (inputIsXusdc) {
      // Swapping XUSDC -> XPR
      // output_xpr = (input_usdc * pool_xpr * feeMultiplier) / (pool_usdc + input_usdc * feeMultiplier)
      const inputAfterFee = inputAmount * feeMultiplier;
      outputAmount = (inputAfterFee * poolXpr) / (poolUsdc + inputAfterFee);
      effectivePrice = inputAmount / outputAmount;  // XUSDC per XPR (what we paid per XPR)
    } else {
      // Swapping XPR -> XUSDC
      // output_usdc = (input_xpr * pool_usdc * feeMultiplier) / (pool_xpr + input_xpr * feeMultiplier)
      const inputAfterFee = inputAmount * feeMultiplier;
      outputAmount = (inputAfterFee * poolUsdc) / (poolXpr + inputAfterFee);
      effectivePrice = outputAmount / inputAmount;  // XUSDC per XPR (what we received per XPR)
    }

    const priceImpact = Math.abs((effectivePrice - spotPrice) / spotPrice) * 100;

    return { outputAmount, effectivePrice, priceImpact, spotPrice };
  }

  /**
   * Pre-flight check for AMM trade profitability
   * Verifies the trade will be profitable AFTER price impact
   *
   * @returns True if trade is still profitable, false otherwise
   */
  private async verifyAmmProfitability(
    path: 'AMM_TO_DEX' | 'DEX_TO_AMM',
    tradeUsd: number,
    dexPrice: number,  // DEX bid (for AMM_TO_DEX) or ask (for DEX_TO_AMM)
    minProfitBps: number
  ): Promise<{ profitable: boolean; reason: string; effectivePrice?: number; priceImpact?: number }> {

    if (path === 'AMM_TO_DEX') {
      // We buy XPR from AMM with XUSDC, then sell on DEX for XMD
      const ammCalc = await this.calculateAmmOutput(tradeUsd, true);

      // Effective cost per XPR (including AMM fees and price impact)
      const costPerXpr = ammCalc.effectivePrice;

      // What we'll receive per XPR on DEX (minus DEX fee)
      const receivePerXpr = dexPrice * (1 - this.DEX_FEE);

      // Profit per XPR
      const profitPerXpr = receivePerXpr - costPerXpr;
      const profitBps = (profitPerXpr / costPerXpr) * 10000;

      logger.info(`AMM Pre-flight: Buy @ $${costPerXpr.toFixed(6)}/XPR (${ammCalc.priceImpact.toFixed(2)}% impact), Sell @ $${receivePerXpr.toFixed(6)}/XPR = ${profitBps.toFixed(1)} BPS`);

      if (profitBps < minProfitBps) {
        return {
          profitable: false,
          reason: `After AMM impact (${ammCalc.priceImpact.toFixed(2)}%), profit ${profitBps.toFixed(1)} BPS < required ${minProfitBps} BPS`,
          effectivePrice: costPerXpr,
          priceImpact: ammCalc.priceImpact
        };
      }

      return {
        profitable: true,
        reason: `Profitable: ${profitBps.toFixed(1)} BPS after ${ammCalc.priceImpact.toFixed(2)}% price impact`,
        effectivePrice: costPerXpr,
        priceImpact: ammCalc.priceImpact
      };

    } else {
      // DEX_TO_AMM: We buy XPR on DEX, then sell to AMM for XUSDC
      // First estimate XPR we'd get from DEX
      const xprFromDex = tradeUsd / dexPrice;

      // Calculate what AMM will give us for that XPR
      const ammCalc = await this.calculateAmmOutput(xprFromDex, false);

      // Cost per XPR (what we paid on DEX including fee)
      const costPerXpr = dexPrice * (1 + this.DEX_FEE);

      // What we receive per XPR from AMM (after price impact)
      const receivePerXpr = ammCalc.effectivePrice;

      // Profit per XPR
      const profitPerXpr = receivePerXpr - costPerXpr;
      const profitBps = (profitPerXpr / costPerXpr) * 10000;

      logger.info(`AMM Pre-flight: Buy @ $${costPerXpr.toFixed(6)}/XPR on DEX, Sell @ $${receivePerXpr.toFixed(6)}/XPR (${ammCalc.priceImpact.toFixed(2)}% impact) = ${profitBps.toFixed(1)} BPS`);

      if (profitBps < minProfitBps) {
        return {
          profitable: false,
          reason: `After AMM impact (${ammCalc.priceImpact.toFixed(2)}%), profit ${profitBps.toFixed(1)} BPS < required ${minProfitBps} BPS`,
          effectivePrice: receivePerXpr,
          priceImpact: ammCalc.priceImpact
        };
      }

      return {
        profitable: true,
        reason: `Profitable: ${profitBps.toFixed(1)} BPS after ${ammCalc.priceImpact.toFixed(2)}% price impact`,
        effectivePrice: receivePerXpr,
        priceImpact: ammCalc.priceImpact
      };
    }
  }

  private async checkAndExecute(): Promise<void> {
    // Prevent race conditions - skip if already in a check/execute cycle
    if (this.isExecuting) {
      return;
    }

    // Acquire lock immediately to prevent overlapping async operations
    this.isExecuting = true;

    try {
      const now = Date.now();

      // Step 0: Periodic auto-recovery check for stuck funds
      if (now - this.lastRecoveryTime >= this.recoveryIntervalMs) {
        const recovered = await this.autoRedeemStuckXmd();
        if (recovered) {
          this.lastRecoveryTime = now;
          // Wait a moment after recovery before trading
          return;
        }
        this.lastRecoveryTime = now;
      }

      // Step 1: Check current balances
      const balances = await this.getBalances();
      const ammPrice = await this.getAmmPrice();
      const xprValueUsd = balances.xpr * ammPrice;

      // Step 2: Calculate safe trade size based on actual balance
      const safeTradeSize = this.calculateSafeTradeSize(balances.xusdc);

      if (safeTradeSize === 0) {
        // Not enough XUSDC - check if we need XPR recovery
        // Only trigger recovery when XPR value is very high (5x maxTradeUSD = $250)
        // to avoid unnecessary selling at discount
        if (xprValueUsd > this.config.maxTradeUSD * 5) {
          logger.info(`Low XUSDC ($${balances.xusdc.toFixed(2)}), high XPR ($${xprValueUsd.toFixed(0)} value). Running recovery...`);

          // Check cooldown before recovery
          if (now - this.lastTradeTime >= this.cooldownMs) {
            await this.recoverXprToXusdc(this.config.maxTradeUSD / ammPrice);
            this.lastTradeTime = now;
            this.consecutiveErrors = 0;
          }
        } else {
          logger.info(`Insufficient funds: XUSDC=$${balances.xusdc.toFixed(2)}, XPR=$${xprValueUsd.toFixed(0)}`);
        }
        return;
      }

      // Step 3: Look for snipe opportunities first (exact order matching)
      const enabledPairs = this.config.pairs.filter(p => p.enabled);

      // Check cooldown before looking for opportunities
      if (now - this.lastTradeTime < this.cooldownMs) {
        return; // In cooldown, skip all checks
      }

      for (const pair of enabledPairs) {
        try {
          // Find specific orders that can be sniped profitably
          const snipeOpps = await this.findSnipeOpportunities(
            pair.dexMarketSymbol,
            ammPrice,
            this.config.minProfitBPS,
            safeTradeSize,
            5 // Min $5 trade
          );

          if (snipeOpps.length > 0) {
            // Take the best snipe opportunity
            const bestSnipe = snipeOpps[0];

            // Check if this pair is monitor-only
            if (pair.monitorOnly) {
              logger.info(`👁️ MONITOR ONLY [${pair.name}]: ${bestSnipe.path} snipe - ${bestSnipe.tradeSizeXpr.toFixed(0)} ${pair.baseToken} @ $${bestSnipe.level.price.toFixed(6)} = ${bestSnipe.profitBps.toFixed(1)} BPS ($${bestSnipe.profitUsd.toFixed(2)})`);
              continue; // Skip to next pair
            }

            // Verify we have enough balance for this snipe
            if (bestSnipe.tradeSizeUsd <= balances.xusdc * 0.95) {
              logger.info(`🎯 Executing snipe: ${bestSnipe.path} ${bestSnipe.tradeSizeXpr.toFixed(0)} XPR @ $${bestSnipe.level.price.toFixed(6)}`);

              try {
                await this.executeSnipe(bestSnipe, pair);
                this.lastTradeTime = now;
                this.consecutiveErrors = 0;
                return; // Exit after successful snipe
              } catch (error: any) {
                this.consecutiveErrors++;
                logger.error(`Snipe execution failed: ${error.message}`);

                if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                  logger.warn(`${this.maxConsecutiveErrors} consecutive failures. Extending cooldown.`);
                  this.lastTradeTime = now + this.cooldownMs;
                }
              }
            }
          }
        } catch (error: any) {
          logger.debug(`Snipe check failed for ${pair.name}: ${error.message}`);
        }
      }

      // Step 4: Fall back to regular triangle arbitrage check (spread-based)
      let bestState: TriangleState | null = null;

      for (const pair of enabledPairs) {
        try {
          const state = await this.getTriangleState(pair);
          if (state.profitable && state.bestPath) {
            // Pick the most profitable opportunity
            if (!bestState || state.expectedProfitPercent > bestState.expectedProfitPercent) {
              bestState = state;
            }
          }
        } catch (error: any) {
          // Skip pairs with errors (e.g., no recent trades)
          logger.debug(`Skipping ${pair.name}: ${error.message}`);
        }
      }

      if (bestState && bestState.bestPath) {
        const state = bestState;

        // Step 5: Check DEX liquidity and simulate fill quality
        const liquidity = await this.getDexLiquidity(state.pair.dexMarketSymbol, state.ammPrice);

        // For AMM_TO_DEX path, we need bids on DEX (buyers for our XPR) within 10% of market
        // For DEX_TO_AMM path, we need asks on DEX (sellers of XPR) within 10% of market
        if (state.bestPath === 'AMM_TO_DEX' && !liquidity.hasBids) {
          logger.info(`No usable DEX bids - best bid $${liquidity.bestBid.toFixed(6)} vs market $${state.ammPrice.toFixed(6)}`);
          return;
        }

        if (state.bestPath === 'DEX_TO_AMM' && !liquidity.hasAsks) {
          logger.info(`No usable DEX asks - best ask $${liquidity.bestAsk.toFixed(6)} vs market $${state.ammPrice.toFixed(6)}`);
          return;
        }

        // Calculate trade size in XPR
        const tradeXpr = safeTradeSize / ammPrice;

        // Step 5: Simulate fill quality to predict actual execution price
        const fillSide = state.bestPath === 'AMM_TO_DEX' ? 'sell' : 'buy';
        const expectedDexPrice = state.bestPath === 'AMM_TO_DEX' ? liquidity.bestBid : liquidity.bestAsk;

        const fillCheck = await this.checkFillQuality(
          state.pair.dexMarketSymbol,
          fillSide,
          tradeXpr,
          expectedDexPrice,
          this.config.minProfitBPS
        );

        if (!fillCheck.proceed) {
          logger.info(`Fill quality check failed: ${fillCheck.reason}`);
          return;
        }

        // Update expected profit based on simulated fill price
        const actualGapPercent = state.bestPath === 'AMM_TO_DEX'
          ? ((fillCheck.fillSim.avgFillPrice - state.ammPrice) / state.ammPrice) * 100
          : ((state.ammPrice - fillCheck.fillSim.avgFillPrice) / state.ammPrice) * 100;

        const actualProfitPercent = actualGapPercent - (this.TOTAL_FEES * 100);

        if (actualProfitPercent < this.config.minProfitBPS / 100) {
          logger.info(`After fill simulation, profit ${actualProfitPercent.toFixed(2)}% < min ${(this.config.minProfitBPS / 100).toFixed(2)}%`);
          return;
        }

        logger.info(`Simulated profit after slippage: ${actualProfitPercent.toFixed(2)}% (gap: ${actualGapPercent.toFixed(2)}%)`);

        // Check if DEX liquidity depth is sufficient (use safe trade size)
        const requiredDepth = tradeXpr * 0.5; // Need at least 50% of trade size

        if (state.bestPath === 'AMM_TO_DEX' && liquidity.bidDepth < requiredDepth) {
          logger.info(`Insufficient DEX bid depth (${liquidity.bidDepth.toFixed(0)} XPR < ${requiredDepth.toFixed(0)} needed)`);
          return;
        }

        if (state.bestPath === 'DEX_TO_AMM' && liquidity.askDepth < requiredDepth) {
          logger.info(`Insufficient DEX ask depth (${liquidity.askDepth.toFixed(0)} XPR < ${requiredDepth.toFixed(0)} needed)`);
          return;
        }

        // Update state with safe trade size and simulated fill info
        const adjustedState = {
          ...state,
          expectedProfit: actualProfitPercent / 100 * safeTradeSize,
          expectedProfitPercent: actualProfitPercent
        };

        // Check if this pair is monitor-only (alert but don't execute)
        if (state.pair.monitorOnly) {
          await this.alertOpportunity(adjustedState, safeTradeSize, fillCheck.fillSim);
          logger.info(`👁️ MONITOR ONLY [${state.pair.name}]: ${state.bestPath} opportunity - $${safeTradeSize.toFixed(2)} trade would profit ${actualProfitPercent.toFixed(2)}%`);
          return;
        }

        if (!this.config.dryRun) {
          try {
            // CRITICAL: Final profitability check with AMM price impact BEFORE alerting
            // state.bestPath is guaranteed non-null here (checked above in `if (bestState && bestState.bestPath)`)
            const bestPath = state.bestPath!;
            const dexTargetPrice = bestPath === 'AMM_TO_DEX' ? liquidity.bestBid : liquidity.bestAsk;
            const profitCheck = await this.verifyAmmProfitability(
              bestPath,
              safeTradeSize,
              dexTargetPrice,
              this.config.minProfitBPS
            );

            if (!profitCheck.profitable) {
              logger.warn(`❌ Trade ABORTED: ${profitCheck.reason}`);
              return;
            }

            // Only alert AFTER profitability is confirmed
            logger.info(`✅ Final profitability check passed: ${profitCheck.reason}`);
            await this.alertOpportunity(adjustedState, safeTradeSize, fillCheck.fillSim);
            await this.executeArbitrage(adjustedState, safeTradeSize);
            this.lastTradeTime = now;
            this.consecutiveErrors = 0;
          } catch (error: any) {
            this.consecutiveErrors++;
            logger.error(`Triangle execution failed (attempt ${this.consecutiveErrors}):`, error.message);

            // NOTIFY on ALL execution failures
            await telegramNotifier.notify(
              `⚠️ Execution failed (${this.consecutiveErrors}/${this.maxConsecutiveErrors}): ${error.message}`,
              'high'
            );

            // After error, try to recover any stuck funds
            if (error.message?.includes('overdrawn balance')) {
              logger.info('Overdrawn balance detected - scheduling recovery');
              this.lastRecoveryTime = 0; // Force recovery check next cycle
            }

            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
              logger.warn(`${this.maxConsecutiveErrors} consecutive failures. Forcing cooldown.`);
              await telegramNotifier.notify(
                `🛑 BOT PAUSED: ${this.maxConsecutiveErrors} consecutive failures. Extended cooldown.`,
                'high'
              );
              this.lastTradeTime = now + this.cooldownMs; // Extra cooldown
            }
          }
        } else {
          // DRY RUN: Still do profitability check and alert, but don't execute
          const bestPath = state.bestPath!;
          const dexTargetPrice = bestPath === 'AMM_TO_DEX' ? liquidity.bestBid : liquidity.bestAsk;
          const profitCheck = await this.verifyAmmProfitability(
            bestPath,
            safeTradeSize,
            dexTargetPrice,
            this.config.minProfitBPS
          );

          if (!profitCheck.profitable) {
            logger.warn(`❌ DRY RUN - Trade would be ABORTED: ${profitCheck.reason}`);
            return;
          }

          await this.alertOpportunity(adjustedState, safeTradeSize, fillCheck.fillSim);
          logger.info('DRY RUN - Would execute: ' + state.bestPath);
        }
      }
    } catch (error: any) {
      logger.error('Triangle check error:', error.message);
      // NOTIFY on any RPC/API failures
      if (error.message?.includes('fetch') ||
          error.message?.includes('network') ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('getaddrinfo')) {
        await telegramNotifier.notify(`🔴 RPC/API ERROR: ${error.message}`, 'high');
      }
    } finally {
      // Always release the lock
      this.isExecuting = false;
    }
  }

  private async getTriangleState(pair: PairConfig): Promise<TriangleState> {
    // Get AMM price for this pair
    const poolsRes = await this.rpc.get_table_rows({
      code: 'proton.swaps',
      scope: 'proton.swaps',
      table: 'pools',
      limit: 100,
      json: true
    });

    const pool = poolsRes.rows.find((p: any) => p.lt_symbol.includes(pair.ammPoolSymbol));
    if (!pool) {
      throw new Error(`AMM pool ${pair.ammPoolSymbol} not found`);
    }

    const ammToken = parseFloat(pool.pool1.quantity);
    const ammUsdc = parseFloat(pool.pool2.quantity);
    const ammPrice = ammUsdc / ammToken;

    // Check pool liquidity (total TVL is roughly 2x the USDC side)
    const poolLiquidityUSD = ammUsdc * 2;
    if (poolLiquidityUSD < this.config.minPoolLiquidityUSD) {
      throw new Error(`Pool ${pair.ammPoolSymbol} liquidity $${poolLiquidityUSD.toFixed(0)} < min $${this.config.minPoolLiquidityUSD}`);
    }

    // Get DEX recent trade price
    const tradesRes = await fetch(
      `https://dex.api.mainnet.metalx.com/dex/v1/trades/recent?symbol=${pair.dexMarketSymbol}&limit=5`
    );
    const tradesData = await tradesRes.json() as { data: { price: number }[] };
    const dexPrice = tradesData.data[0]?.price || ammPrice;

    // Calculate gap
    const gap = dexPrice - ammPrice;
    const gapPercent = (gap / ammPrice) * 100;

    // Determine if profitable (gap must exceed total fees)
    // minProfitBPS is the total gap required (must cover fees + desired profit)
    // e.g., if fees are 30 BPS and we want 5 BPS profit, set minProfitBPS = 35
    const minGapRequired = this.config.minProfitBPS / 100; // Convert BPS to percent
    const profitable = Math.abs(gapPercent) > minGapRequired;

    let bestPath: 'AMM_TO_DEX' | 'DEX_TO_AMM' | null = null;
    let expectedProfitPercent = 0;

    if (profitable) {
      if (gapPercent > 0) {
        // DEX price higher than AMM -> Buy from AMM, Sell on DEX
        bestPath = 'AMM_TO_DEX';
        expectedProfitPercent = gapPercent - (this.TOTAL_FEES * 100);
      } else {
        // AMM price higher than DEX -> Buy from DEX, Sell to AMM
        bestPath = 'DEX_TO_AMM';
        expectedProfitPercent = Math.abs(gapPercent) - (this.TOTAL_FEES * 100);
      }
    }

    const expectedProfit = (expectedProfitPercent / 100) * this.config.maxTradeUSD;

    return {
      pair,
      ammPrice,
      dexPrice,
      gap,
      gapPercent,
      profitable,
      bestPath,
      expectedProfit,
      expectedProfitPercent
    };
  }

  private async alertOpportunity(state: TriangleState, tradeSize?: number, fillSim?: FillSimulation): Promise<void> {
    const actualTradeSize = tradeSize || this.config.maxTradeUSD;
    const pairName = state.pair.name;
    const pathName = state.bestPath === 'AMM_TO_DEX'
      ? `XUSDC → ${pairName} (AMM) → XMD (DEX) → XUSDC`
      : `XUSDC → XMD → ${pairName} (DEX) → XUSDC (AMM)`;

    // Include fill simulation info if available
    const fillInfo = fillSim
      ? `\nSimulated Fill: $${fillSim.avgFillPrice.toFixed(6)} (${fillSim.levelsFilled} levels, ${fillSim.slippageBps.toFixed(1)} BPS slip)`
      : '';

    const message = `🔺 *TRIANGLE ARB: ${pairName}*

Path: ${pathName}
AMM Price: $${state.ammPrice.toFixed(6)}
DEX Price: $${state.dexPrice.toFixed(6)}
Gap: ${state.gapPercent.toFixed(3)}%${fillInfo}

Expected Profit: $${state.expectedProfit.toFixed(2)} (${state.expectedProfitPercent.toFixed(2)}%)
Trade Size: $${actualTradeSize}

${this.config.dryRun ? '⚠️ DRY RUN MODE' : '🚀 EXECUTING NOW...'}`;

    await telegramNotifier.notify(message, 'high');
    logger.info(`Triangle opportunity: ${pairName} ${state.bestPath} profit: ${state.expectedProfitPercent.toFixed(3)}%`);
  }

  private async executeArbitrage(state: TriangleState, tradeSize?: number): Promise<void> {
    const actualTradeSize = tradeSize || this.config.maxTradeUSD;
    const expectedProfitBps = state.expectedProfitPercent * 100; // Convert percent to BPS

    // CRITICAL SAFETY: Verify AMM price from multiple endpoints before trading
    const priceCheck = await this.verifyAmmPrice(state.pair.ammPoolSymbol);
    if (!priceCheck.verified) {
      const errorMsg = `SAFETY HALT: Price verification failed - ${priceCheck.error}`;
      logger.error(errorMsg);
      await telegramNotifier.notify(`🚨 ${errorMsg}`, 'high');
      throw new Error(errorMsg);
    }

    // Check verified price matches what we expect (within 1%)
    const priceDiff = Math.abs(priceCheck.price - state.ammPrice) / state.ammPrice;
    if (priceDiff > 0.01) {
      const errorMsg = `SAFETY HALT: AMM price mismatch - Expected $${state.ammPrice.toFixed(6)}, Verified $${priceCheck.price.toFixed(6)} (${(priceDiff * 100).toFixed(2)}% diff)`;
      logger.error(errorMsg);
      await telegramNotifier.notify(`🚨 ${errorMsg}`, 'high');
      throw new Error(errorMsg);
    }

    logger.info(`✅ Price verified: $${priceCheck.price.toFixed(6)} from multiple RPCs`);

    // Start tracking this trade
    const tradeId = profitabilityTracker.startTrade(
      'triangle-arbitrage',
      `${state.pair.name}:${state.bestPath}`,
      expectedProfitBps,
      state.expectedProfit,
      actualTradeSize
    );

    try {
      const startBalances = await this.getBalances();

      if (state.bestPath === 'AMM_TO_DEX') {
        await this.executeAmmToDex(state, tradeSize);
      } else if (state.bestPath === 'DEX_TO_AMM') {
        await this.executeDexToAmm(state, tradeSize);
      }

      // Get end balances to calculate actual P&L
      const endBalances = await this.getBalances();
      const actualInputUsd = actualTradeSize;
      const actualOutputUsd = endBalances.xusdc - startBalances.xusdc + actualTradeSize; // Net change in XUSDC

      // Complete the trade tracking
      profitabilityTracker.completeTrade(
        tradeId,
        actualInputUsd,
        actualOutputUsd,
        [] // Transaction IDs are logged separately
      );

    } catch (error: any) {
      logger.error('Triangle execution failed:', error);
      profitabilityTracker.failTrade(tradeId, error.message);
      await telegramNotifier.notify(`❌ Triangle arb failed: ${error.message}`, 'high');
      throw error; // Re-throw for caller to handle recovery
    }
  }

  /**
   * Re-validate prices haven't moved against us
   * Returns true if opportunity is still valid
   */
  private async revalidatePrices(pair: PairConfig, expectedPath: 'AMM_TO_DEX' | 'DEX_TO_AMM'): Promise<boolean> {
    try {
      const newState = await this.getTriangleState(pair);

      // Check if opportunity is still profitable in the same direction
      if (!newState.profitable || newState.bestPath !== expectedPath) {
        logger.info(`Price moved: opportunity no longer valid (was ${expectedPath}, now ${newState.bestPath || 'none'})`);
        return false;
      }

      // Check if profit is still above minimum threshold
      if (newState.expectedProfitPercent < (this.config.minProfitBPS / 100) - this.TOTAL_FEES * 100) {
        logger.info(`Profit shrunk: ${newState.expectedProfitPercent.toFixed(3)}% < minimum`);
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error(`Price revalidation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * PATH: XUSDC -> TOKEN (AMM) -> XMD (DEX) -> XUSDC (Treasury)
   * When DEX price > AMM price
   */
  private async executeAmmToDex(state: TriangleState, tradeSize?: number): Promise<void> {
    const tradeUsd = tradeSize || this.config.maxTradeUSD;
    const pair = state.pair;

    // Pre-flight balance check
    const balances = await this.getBalances();
    if (balances.xusdc < tradeUsd) {
      throw new Error(`Pre-flight check failed: XUSDC ${balances.xusdc.toFixed(2)} < ${tradeUsd}`);
    }

    // Step 1: Buy TOKEN from AMM with XUSDC
    const tokenToBuy = tradeUsd / state.ammPrice;
    const xusdcToSpend = tradeUsd;
    const precision = pair.basePrecision;
    const multiplier = Math.pow(10, precision);

    logger.info(`Step 1: Swap ${xusdcToSpend.toFixed(6)} XUSDC -> ~${tokenToBuy.toFixed(precision)} ${pair.baseToken} via AMM`);

    // Calculate minimum token output based on PROFITABILITY, not arbitrary slippage
    // We need enough tokens that when sold on DEX at current bid, we still profit
    // Formula: minTokenOut = xusdcSpent / (dexBidPrice * (1 - DEX_FEE - minProfitBPS/10000))
    // This ensures we only accept AMM fills that will be profitable
    const dexBidPrice = state.dexPrice; // This is the bid we're targeting
    const requiredRate = dexBidPrice * (1 - this.DEX_FEE - this.config.minProfitBPS / 10000);
    const minTokenOutForProfit = xusdcToSpend / requiredRate;

    // Also apply a hard cap of 1% max slippage for safety
    const minTokenOutMaxSlip = tokenToBuy * 0.99;

    // Use the MORE RESTRICTIVE of the two (higher minimum)
    const minTokenOut = Math.max(minTokenOutForProfit, minTokenOutMaxSlip);

    // Calculate effective max slippage we're allowing
    const effectiveSlippage = ((tokenToBuy - minTokenOut) / tokenToBuy) * 100;
    logger.info(`Slippage protection: need >${minTokenOut.toFixed(precision)} ${pair.baseToken} (${effectiveSlippage.toFixed(2)}% max slip) to guarantee profit`);

    // Get token balance BEFORE AMM swap to track actual received
    const tokenBalanceBefore = await this.getTokenBalance(pair.baseToken, pair.baseContract);
    logger.info(`${pair.baseToken} balance before AMM swap: ${tokenBalanceBefore.toFixed(precision)}`);

    const swapActions = [{
      account: 'xtokens',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'proton.swaps',
        quantity: `${xusdcToSpend.toFixed(6)} XUSDC`,
        memo: `${pair.ammPoolSymbol},${minTokenOut.toFixed(precision)} ${pair.baseToken}`
      }
    }];

    const swapResult = await this.api.transact({ actions: swapActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });

    logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

    // Wait for blockchain state to update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get token balance AFTER AMM swap to calculate ACTUAL received
    const tokenBalanceAfter = await this.getTokenBalance(pair.baseToken, pair.baseContract);
    const actualTokenReceived = tokenBalanceAfter - tokenBalanceBefore;
    logger.info(`${pair.baseToken} received from AMM: ${actualTokenReceived.toFixed(precision)} (was: ${tokenBalanceBefore.toFixed(precision)}, now: ${tokenBalanceAfter.toFixed(precision)})`);

    if (actualTokenReceived < minTokenOut * 0.99) {
      throw new Error(`AMM swap failed - received ${actualTokenReceived.toFixed(precision)} ${pair.baseToken}, expected at least ${minTokenOut.toFixed(precision)}`);
    }

    // Step 2: Sell TOKEN on DEX for XMD - CRITICAL: Use ACTUAL received, not expected!
    const tokenToSell = Math.floor(actualTokenReceived * 0.999 * multiplier); // Sell exactly what we received minus tiny buffer

    logger.info(`Step 2: Sell ${tokenToSell/multiplier} ${pair.baseToken} on DEX @ $${state.dexPrice.toFixed(6)}`);

    // Use aggressive limit order with fill_type: 0 (normal) for better fill rate
    // Price 5% below market to sweep available bids
    const aggressivePrice = state.dexPrice * 0.95; // 5% below market
    const aggressivePriceRaw = Math.floor(aggressivePrice * 1000000);

    logger.info(`Aggressive LIMIT SELL ${(tokenToSell/multiplier).toFixed(precision)} ${pair.baseToken} @ $${aggressivePrice.toFixed(6)} (5% below market)`);

    // Track token balance BEFORE DEX sell to calculate actual fill
    const tokenBalanceBeforeDex = await this.getTokenBalance(pair.baseToken, pair.baseContract);

    const dexActions = [
      {
        account: pair.baseContract,
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${(tokenToSell/multiplier).toFixed(precision)} ${pair.baseToken}`,
          memo: ''
        }
      },
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: pair.dexMarketId,
          account: this.username,
          order_type: 1, // Limit order
          order_side: 2, // Sell
          quantity: tokenToSell,
          price: aggressivePriceRaw,
          bid_symbol: { sym: `${precision},${pair.baseToken}`, contract: pair.baseContract },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0, // Normal - stays on book, can fill across multiple orders
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

    // Step 3: Check fill and calculate actual execution price
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check both XMD and remaining token balance
    const [xmdBalanceRes, tokenBalanceRes] = await Promise.all([
      this.rpc.get_table_rows({
        code: 'xmd.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      }),
      this.rpc.get_table_rows({
        code: pair.baseContract,
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      })
    ]);

    let xmdBalance = 0;
    for (const row of xmdBalanceRes.rows) {
      if (row.balance?.includes('XMD')) {
        xmdBalance = parseFloat(row.balance);
      }
    }

    let remainingToken = 0;
    for (const row of tokenBalanceRes.rows) {
      if (row.balance?.includes(pair.baseToken)) {
        remainingToken = parseFloat(row.balance);
      }
    }

    // Calculate actual fill: balance before DEX minus balance after = tokens sold
    const tokensSent = tokenToSell / multiplier;
    const tokensFilled = tokenBalanceBeforeDex - remainingToken;
    const fillRatio = tokensFilled > 0 ? tokensFilled / tokensSent : (xmdBalance > 0 ? 1 : 0);

    // Calculate actual execution price
    const actualExecPrice = tokensFilled > 0 ? xmdBalance / tokensFilled : 0;
    const priceSlippage = actualExecPrice > 0 ? ((actualExecPrice - state.dexPrice) / state.dexPrice * 100) : 0;

    logger.info(`DEX MARKET SELL result:`);
    logger.info(`  Tokens sold: ${tokensFilled.toFixed(4)} ${pair.baseToken} (${(fillRatio * 100).toFixed(1)}% filled)`);
    logger.info(`  XMD received: ${xmdBalance.toFixed(6)}`);
    logger.info(`  Actual price: $${actualExecPrice.toFixed(6)} (expected: $${state.dexPrice.toFixed(6)})`);
    logger.info(`  Slippage: ${priceSlippage.toFixed(2)}%`);

    // Calculate expected XMD from full fill for comparison
    const expectedXmd = tokensSent * state.dexPrice * 0.999;
    const unfilledTokens = tokensSent * (1 - fillRatio);

    // If partial fill (less than 90% filled), swap remaining via AMM
    if (fillRatio < 0.9 && unfilledTokens > 100) {
      logger.info(`Partial fill detected - swapping ${unfilledTokens.toFixed(4)} ${pair.baseToken} via AMM`);

      const minXusdcOut = unfilledTokens * state.ammPrice * 0.97; // 3% slippage buffer

      const ammFallbackSwap = [{
        account: pair.baseContract,
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'proton.swaps',
          quantity: `${unfilledTokens.toFixed(precision)} ${pair.baseToken}`,
          memo: `${pair.ammPoolSymbol},${minXusdcOut.toFixed(6)} XUSDC`
        }
      }];

      try {
        const ammResult = await this.api.transact({ actions: ammFallbackSwap }, {
          blocksBehind: 3,
          expireSeconds: 120
        });
        logger.info('AMM fallback swap completed: ' + (ammResult as any).transaction_id);
      } catch (ammError: any) {
        logger.error('AMM fallback failed: ' + ammError.message);
      }
    }

    // Redeem whatever XMD we got from DEX
    if (xmdBalance > 1) {
      logger.info(`Step 3: Convert ${xmdBalance.toFixed(6)} XMD -> XUSDC via Treasury`);

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

      const treasuryResult = await this.api.transact({ actions: treasuryActions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });

      logger.info('Treasury conversion executed: ' + (treasuryResult as any).transaction_id);
    }

    const fillStatus = fillRatio >= 0.9 ? 'Full' : `Partial (${(fillRatio * 100).toFixed(0)}%)`;
    await telegramNotifier.notify(
      `✅ *Triangle Arb Complete: ${pair.name}*\n\nPath: AMM→DEX\nFill: ${fillStatus}\nExpected profit: ~$${state.expectedProfit.toFixed(2)}`,
      'high'
    );
  }

  /**
   * PATH: XUSDC -> XMD (Treasury) -> XPR (DEX) -> XUSDC (AMM)
   * When DEX price < AMM price
   */
  private async executeDexToAmm(state: TriangleState, tradeSize?: number): Promise<void> {
    const tradeUsd = tradeSize || this.config.maxTradeUSD;

    // Pre-flight balance check
    const balances = await this.getBalances();
    if (balances.xusdc < tradeUsd) {
      throw new Error(`Pre-flight check failed: XUSDC ${balances.xusdc.toFixed(2)} < ${tradeUsd}`);
    }

    // Step 1: Convert XUSDC to XMD via Treasury
    logger.info(`Step 1: Convert ${tradeUsd.toFixed(6)} XUSDC -> XMD via Treasury`);

    const mintActions = [{
      account: 'xtokens',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'xmd.treasury',
        quantity: `${tradeUsd.toFixed(6)} XUSDC`,
        memo: 'mint'
      }
    }];

    const mintResult = await this.api.transact({ actions: mintActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });

    logger.info('Treasury mint executed: ' + (mintResult as any).transaction_id);

    // Wait for chain state to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Buy XPR on DEX with XMD
    // Check actual XMD balance after mint (don't assume 1:1)
    const xmdBalanceRes = await this.rpc.get_table_rows({
      code: 'xmd.token',
      scope: this.username,
      table: 'accounts',
      limit: 10,
      json: true
    });
    let actualXmd = 0;
    for (const row of xmdBalanceRes.rows) {
      if (row.balance?.includes('XMD')) actualXmd = parseFloat(row.balance);
    }

    if (actualXmd < 1) {
      throw new Error(`Treasury mint failed - no XMD received`);
    }

    const xmdToSpend = actualXmd * 0.99; // Use 99% of actual balance for safety
    logger.info(`Actual XMD balance after mint: ${actualXmd.toFixed(6)}, using ${xmdToSpend.toFixed(6)}`);

    // Get XPR balance BEFORE DEX buy to track actual received
    const xprBalanceBefore = await this.getTokenBalance('XPR', 'eosio.token');
    logger.info(`XPR balance before DEX buy: ${xprBalanceBefore.toFixed(4)}`);

    // Use aggressive limit order with fill_type: 0 (normal) for better fill rate
    // Price 5% above market to sweep available asks
    const aggressivePrice = state.dexPrice * 1.05; // 5% above market
    const aggressivePriceRaw = Math.floor(aggressivePrice * 1000000);

    // For BUY orders on this DEX, quantity = XMD amount to spend (in raw 6-decimal format)
    // NOT the XPR amount to receive!
    const xmdToSpendRaw = Math.floor(xmdToSpend * 1e6);
    const expectedXpr = xmdToSpend / aggressivePrice;

    logger.info(`Step 2: Aggressive LIMIT BUY ~${expectedXpr.toFixed(4)} XPR @ $${aggressivePrice.toFixed(6)} (5% above market), spending: ${xmdToSpend.toFixed(2)} XMD`);

    const dexActions = [
      {
        account: 'xmd.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${xmdToSpend.toFixed(6)} XMD`,
          memo: ''
        }
      },
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: 1,
          account: this.username,
          order_type: 1, // Limit order
          order_side: 1, // Buy
          quantity: xmdToSpendRaw,  // XMD amount in raw (6 decimals)
          price: aggressivePriceRaw,
          bid_symbol: { sym: '4,XPR', contract: 'eosio.token' },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0, // Normal - stays on book, can fill across multiple orders
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

    // Brief wait for chain state
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check balances after DEX buy
    const [xprBalanceRes, xmdRemainRes] = await Promise.all([
      this.rpc.get_table_rows({
        code: 'eosio.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      }),
      this.rpc.get_table_rows({
        code: 'xmd.token',
        scope: this.username,
        table: 'accounts',
        limit: 10,
        json: true
      })
    ]);

    let xprBalance = 0;
    for (const row of xprBalanceRes.rows) {
      if (row.balance?.includes('XPR')) {
        xprBalance = parseFloat(row.balance);
        break;
      }
    }

    let remainingXmd = 0;
    for (const row of xmdRemainRes.rows) {
      if (row.balance?.includes('XMD')) {
        remainingXmd = parseFloat(row.balance);
      }
    }

    // Calculate actual fill and execution price
    const xmdSpent = xmdToSpend - remainingXmd;
    const xprReceived = xprBalance - xprBalanceBefore; // CRITICAL: Use actual received, not total balance!
    logger.info(`XPR received from DEX: ${xprReceived.toFixed(4)} (was: ${xprBalanceBefore.toFixed(4)}, now: ${xprBalance.toFixed(4)})`);
    const fillRatio = xmdSpent > 0 ? xmdSpent / xmdToSpend : 0;

    // Calculate actual execution price (XMD per XPR)
    const actualExecPrice = xprReceived > 100 ? xmdSpent / xprReceived : 0;
    const priceSlippage = actualExecPrice > 0 ? ((actualExecPrice - state.dexPrice) / state.dexPrice * 100) : 0;

    logger.info(`DEX MARKET BUY result:`);
    logger.info(`  XMD spent: ${xmdSpent.toFixed(6)} (${(fillRatio * 100).toFixed(1)}% of order)`);
    logger.info(`  XPR received: ${xprReceived.toFixed(4)}`);
    logger.info(`  Actual price: $${actualExecPrice.toFixed(6)} (expected: $${state.dexPrice.toFixed(6)})`);
    logger.info(`  Slippage: ${priceSlippage.toFixed(2)}%`);

    // If partial fill, redeem remaining XMD back to XUSDC
    if (remainingXmd > 1) {
      logger.info(`Partial fill - redeeming ${remainingXmd.toFixed(2)} XMD back to XUSDC`);

      const redeemActions = [{
        account: 'xmd.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'xmd.treasury',
          quantity: `${remainingXmd.toFixed(6)} XMD`,
          memo: 'redeem,XUSDC'
        }
      }];

      try {
        await this.api.transact({ actions: redeemActions }, {
          blocksBehind: 3,
          expireSeconds: 120
        });
        logger.info('Remaining XMD redeemed to XUSDC');
      } catch (redeemError: any) {
        logger.error('Failed to redeem remaining XMD: ' + redeemError.message);
      }
    }

    // Step 3: Sell XPR to AMM for XUSDC
    // CRITICAL: Sell exactly what we received from DEX, not entire balance!
    const xprToSell = xprReceived * 0.999; // Sell exactly what we received minus tiny buffer

    if (xprToSell < 100) {
      logger.info('Not enough XPR received to swap via AMM');
      await telegramNotifier.notify(
        `⚠️ *Triangle Arb Failed (DEX→AMM)*\n\nDEX buy did not fill, XMD recovered`,
        'high'
      );
      return;
    }

    const minXusdcOut = xprToSell * state.ammPrice * 0.97; // 3% slippage buffer

    logger.info(`Step 3: Swap ${xprToSell.toFixed(4)} XPR -> ~${minXusdcOut.toFixed(6)} XUSDC via AMM`);

    const swapActions = [{
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: this.username, permission: 'active' }],
      data: {
        from: this.username,
        to: 'proton.swaps',
        quantity: `${xprToSell.toFixed(4)} XPR`,
        memo: `XPRUSDC,${minXusdcOut.toFixed(6)} XUSDC`
      }
    }];

    const swapResult = await this.api.transact({ actions: swapActions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });

    logger.info('AMM swap executed: ' + (swapResult as any).transaction_id);

    const fillStatus = fillRatio >= 0.9 ? 'Full' : `Partial (${(fillRatio * 100).toFixed(0)}%)`;
    await telegramNotifier.notify(
      `✅ *Triangle Arb Complete (DEX→AMM)*\n\nFill: ${fillStatus}\nExpected profit: ~$${state.expectedProfit.toFixed(2)}`,
      'high'
    );
  }

  /**
   * Check and cancel any stale open orders
   */
  async cancelStaleOrders(): Promise<void> {
    try {
      const res = await fetch(
        `https://dex.api.mainnet.metalx.com/dex/v1/orders/open?account=${this.username}`
      );
      const data = await res.json() as { data: any[] };

      if (!data.data || data.data.length === 0) {
        return;
      }

      logger.info(`Found ${data.data.length} open orders, cancelling...`);

      for (const order of data.data) {
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

          logger.info(`Cancelled order ${order.order_id}`);
        } catch (e: any) {
          logger.error(`Failed to cancel order ${order.order_id}:`, e.message);
        }
      }

      // Withdraw any stuck funds
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

      logger.info('Withdrew all funds from DEX');
    } catch (error: any) {
      logger.error('Failed to cancel stale orders:', error.message);
    }
  }

  /**
   * Direct AMM swap: XPR -> XUSDC (no DEX involved)
   * Used when stuck with XPR and need to rebalance
   */
  async directAmmSwap(fromToken: 'XPR' | 'XUSDC', amount: number): Promise<string | null> {
    try {
      const ammPrice = await this.getAmmPrice();

      let actions: any[];

      if (fromToken === 'XPR') {
        // Swap XPR -> XUSDC
        const minXusdc = (amount * ammPrice * 0.97).toFixed(6);
        actions = [{
          account: 'eosio.token',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'proton.swaps',
            quantity: `${amount.toFixed(4)} XPR`,
            memo: `XPRUSDC,${minXusdc} XUSDC`
          }
        }];
      } else {
        // Swap XUSDC -> XPR
        const minXpr = (amount / ammPrice * 0.97).toFixed(4);
        actions = [{
          account: 'xtokens',
          name: 'transfer',
          authorization: [{ actor: this.username, permission: 'active' }],
          data: {
            from: this.username,
            to: 'proton.swaps',
            quantity: `${amount.toFixed(6)} XUSDC`,
            memo: `XPRUSDC,${minXpr} XPR`
          }
        }];
      }

      const result = await this.api.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 120
      });

      const txId = (result as any).transaction_id;
      logger.info(`Direct AMM swap: ${amount} ${fromToken} -> TX: ${txId}`);
      return txId;
    } catch (error: any) {
      logger.error(`Direct AMM swap failed:`, error.message);
      return null;
    }
  }

  /**
   * Get current status for display
   */
  async getStatus(): Promise<{
    balances: Balances;
    ammPrice: number;
    portfolioValue: number;
    lastTradeTime: Date;
    consecutiveErrors: number;
  }> {
    const balances = await this.getBalances();
    const ammPrice = await this.getAmmPrice();
    const portfolioValue = balances.xusdc + balances.xpr * ammPrice + balances.xmd;

    return {
      balances,
      ammPrice,
      portfolioValue,
      lastTradeTime: new Date(this.lastTradeTime),
      consecutiveErrors: this.consecutiveErrors
    };
  }
}

export const triangleArbitrage = new TriangleArbitrage();
