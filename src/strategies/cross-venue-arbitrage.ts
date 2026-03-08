/**
 * Cross-Venue Arbitrage Strategy
 *
 * Exploits price discrepancies between:
 * - proton.swaps AMM (XPR/XUSDC, XMT/XUSDC, etc.)
 * - MetalX DEX orderbook (XPR/XMD, XMT/XMD, etc.)
 * - xmd.treasury (XMD ↔ XUSDC 1:1 conversion)
 *
 * Arbitrage Paths:
 *
 * PATH A: AMM cheaper than DEX
 * 1. Start with XUSDC
 * 2. Buy token from AMM with XUSDC
 * 3. Sell token on DEX for XMD
 * 4. Redeem XMD to XUSDC via treasury
 * 5. Profit = XUSDC received - XUSDC spent
 *
 * PATH B: DEX cheaper than AMM
 * 1. Start with XUSDC
 * 2. Mint XMD from XUSDC via treasury
 * 3. Buy token on DEX with XMD
 * 4. Sell token to AMM for XUSDC
 * 5. Profit = XUSDC received - XUSDC spent
 *
 * Works on both testnet and mainnet (same contract names).
 */

import { TradingStrategy } from '../interfaces/index.js';
import { getConfig, getLogger, getUsername } from '../utils.js';
import * as dexapi from '../dexapi.js';
import * as dexrpc from '../dexrpc.js';
import { telegramNotifier } from '../notifications/telegram.js';
import { circuitBreaker } from '../risk/circuit-breaker.js';

const logger = getLogger();

// Contract addresses (same on testnet and mainnet)
const CONTRACTS = {
  AMM: 'proton.swaps',
  DEX: 'dex',
  XMD_TREASURY: 'xmd.treasury',
  XMD_TOKEN: 'xmd.token',
  XTOKENS: 'xtokens',
  EOSIO_TOKEN: 'eosio.token'
};

// Token precision
const PRECISION = {
  XPR: 4,
  XMD: 6,
  XUSDC: 6,
  XBTC: 8,
  XETH: 8,
  XMT: 8
};

export interface ArbitragePair {
  // Base token (e.g., XPR)
  baseToken: string;
  baseContract: string;
  basePrecision: number;

  // AMM pool info
  ammPoolSymbol: string;  // e.g., "XPRUSDC"

  // DEX market info
  dexMarketSymbol: string;  // e.g., "XPR_XMD"
  dexMarketId: number;

  // Enabled
  enabled: boolean;

  // Min/max trade sizes
  minTradeSize: number;
  maxTradeSize: number;
}

export interface CrossVenueConfig {
  enabled: boolean;
  pairs: ArbitragePair[];
  minProfitBPS: number;        // Minimum profit in basis points
  maxTradeUSD: number;         // Maximum trade size in USD
  checkIntervalMS: number;     // How often to check for opportunities
  dryRun: boolean;             // If true, log but don't execute
  maxSlippageBPS: number;      // Max acceptable slippage
  cooldownMS: number;          // Cooldown between trades on same pair
}

interface AMMPool {
  symbol: string;
  pool1: { quantity: string; contract: string };
  pool2: { quantity: string; contract: string };
  fee: number;  // In basis points (20 = 0.2%)
}

interface DEXOrder {
  orderId: number;
  price: number;      // Normalized price
  quantity: number;   // Normalized quantity
  side: 'BUY' | 'SELL';
  account: string;
}

interface ArbitrageOpportunity {
  pair: ArbitragePair;
  direction: 'AMM_TO_DEX' | 'DEX_TO_AMM';
  ammPrice: number;
  dexPrice: number;
  profitBPS: number;
  profitUSD: number;
  optimalSize: number;
  maxSize: number;
  timestamp: Date;
}

const DEFAULT_CONFIG: CrossVenueConfig = {
  enabled: true,
  pairs: [
    {
      baseToken: 'XPR',
      baseContract: 'eosio.token',
      basePrecision: 4,
      ammPoolSymbol: 'XPRUSDC',
      dexMarketSymbol: 'XPR_XMD',
      dexMarketId: 3,
      enabled: true,
      minTradeSize: 100,
      maxTradeSize: 100000
    }
  ],
  minProfitBPS: 20,        // 0.2% minimum profit
  maxTradeUSD: 1000,
  checkIntervalMS: 5000,
  dryRun: false,
  maxSlippageBPS: 50,      // 0.5% max slippage
  cooldownMS: 30000        // 30 second cooldown
};

/**
 * Cross-Venue Arbitrage Strategy
 */
export class CrossVenueArbitrageStrategy implements TradingStrategy {
  private config: CrossVenueConfig;
  private rpcConfig: any;
  private username: string;
  private lastTradeTime: Map<string, Date> = new Map();
  private isRunning = false;
  private rpc: any;

  constructor() {
    const botConfig = getConfig();
    this.rpcConfig = botConfig.rpc;
    this.username = getUsername();
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Initialize the strategy
   */
  async initialize(options?: Partial<CrossVenueConfig>): Promise<void> {
    if (options) {
      this.config = { ...this.config, ...options };
      if (options.pairs) {
        this.config.pairs = options.pairs;
      }
    }

    // Initialize RPC
    const { JsonRpc } = await import('@proton/js');
    this.rpc = new JsonRpc(this.rpcConfig.endpoints);

    // Initialize circuit breaker for this strategy
    circuitBreaker.initializeStrategy('cross-venue-arbitrage');

    logger.info('Cross-venue arbitrage strategy initialized');
    logger.info(`Monitoring ${this.config.pairs.filter(p => p.enabled).length} pairs`);
    logger.info(`Min profit: ${this.config.minProfitBPS} BPS, Max trade: $${this.config.maxTradeUSD}`);

    this.isRunning = true;
  }

  /**
   * Main trade function - called by the bot loop
   */
  async trade(): Promise<void> {
    if (!this.isRunning || !this.config.enabled) return;

    // Check circuit breaker
    if (circuitBreaker.isTriggered('cross-venue-arbitrage')) {
      logger.warn('Cross-venue arbitrage halted by circuit breaker');
      return;
    }

    for (const pair of this.config.pairs) {
      if (!pair.enabled) continue;

      try {
        // Check cooldown
        const lastTrade = this.lastTradeTime.get(pair.baseToken);
        if (lastTrade && (Date.now() - lastTrade.getTime()) < this.config.cooldownMS) {
          continue;
        }

        // Find arbitrage opportunity
        const opportunity = await this.findOpportunity(pair);

        if (opportunity && opportunity.profitBPS >= this.config.minProfitBPS) {
          logger.info(`Arbitrage opportunity found: ${pair.baseToken}`);
          logger.info(`  Direction: ${opportunity.direction}`);
          logger.info(`  AMM price: ${opportunity.ammPrice.toFixed(6)}`);
          logger.info(`  DEX price: ${opportunity.dexPrice.toFixed(6)}`);
          logger.info(`  Profit: ${opportunity.profitBPS} BPS (~$${opportunity.profitUSD.toFixed(2)})`);

          if (!this.config.dryRun) {
            await this.executeArbitrage(opportunity);
          } else {
            logger.info('DRY RUN - would execute arbitrage');
          }
        }

      } catch (error) {
        logger.error(`Error checking arbitrage for ${pair.baseToken}:`, error);
      }
    }
  }

  /**
   * Find arbitrage opportunity for a pair
   */
  private async findOpportunity(pair: ArbitragePair): Promise<ArbitrageOpportunity | null> {
    try {
      // 1. Get AMM price
      const ammPool = await this.getAMMPool(pair.ammPoolSymbol);
      if (!ammPool) {
        logger.debug(`AMM pool ${pair.ammPoolSymbol} not found`);
        return null;
      }

      const ammPrice = this.calculateAMMPrice(ammPool, pair.baseToken);
      const ammFee = ammPool.fee / 10000;  // Convert BPS to decimal

      // 2. Get DEX orderbook
      const dexOrders = await this.getDEXOrderbook(pair.dexMarketId, pair.basePrecision);

      if (dexOrders.asks.length === 0 && dexOrders.bids.length === 0) {
        logger.debug(`No orders on DEX for ${pair.dexMarketSymbol}`);
        return null;
      }

      // 3. Calculate arbitrage in both directions

      // PATH A: Buy from AMM, sell on DEX
      // Cost: AMM price * (1 + fee)
      // Revenue: DEX bid price (what we can sell for)
      const ammBuyPrice = ammPrice * (1 + ammFee);
      const dexBidPrice = dexOrders.bids.length > 0 ? dexOrders.bids[0].price : 0;

      // PATH B: Buy from DEX, sell to AMM
      // Cost: DEX ask price (what we pay to buy)
      // Revenue: AMM price * (1 - fee)
      const dexAskPrice = dexOrders.asks.length > 0 ? dexOrders.asks[0].price : Infinity;
      const ammSellPrice = ammPrice * (1 - ammFee);

      // Check PATH A (AMM → DEX)
      if (dexBidPrice > ammBuyPrice) {
        const profitBPS = ((dexBidPrice - ammBuyPrice) / ammBuyPrice) * 10000;
        const maxSize = Math.min(
          dexOrders.bids[0].quantity,
          pair.maxTradeSize,
          this.config.maxTradeUSD / ammBuyPrice
        );
        const profitUSD = (dexBidPrice - ammBuyPrice) * maxSize;

        return {
          pair,
          direction: 'AMM_TO_DEX',
          ammPrice: ammBuyPrice,
          dexPrice: dexBidPrice,
          profitBPS: Math.round(profitBPS),
          profitUSD,
          optimalSize: maxSize,
          maxSize,
          timestamp: new Date()
        };
      }

      // Check PATH B (DEX → AMM)
      if (ammSellPrice > dexAskPrice) {
        const profitBPS = ((ammSellPrice - dexAskPrice) / dexAskPrice) * 10000;
        const maxSize = Math.min(
          dexOrders.asks[0].quantity,
          pair.maxTradeSize,
          this.config.maxTradeUSD / dexAskPrice
        );
        const profitUSD = (ammSellPrice - dexAskPrice) * maxSize;

        return {
          pair,
          direction: 'DEX_TO_AMM',
          ammPrice: ammSellPrice,
          dexPrice: dexAskPrice,
          profitBPS: Math.round(profitBPS),
          profitUSD,
          optimalSize: maxSize,
          maxSize,
          timestamp: new Date()
        };
      }

      return null;

    } catch (error) {
      logger.error('Error finding opportunity:', error);
      return null;
    }
  }

  /**
   * Execute arbitrage trade
   */
  private async executeArbitrage(opp: ArbitrageOpportunity): Promise<void> {
    const { pair, direction, optimalSize } = opp;

    logger.info(`Executing ${direction} arbitrage for ${optimalSize} ${pair.baseToken}`);

    try {
      if (direction === 'DEX_TO_AMM') {
        // PATH B: Buy from DEX (with XMD), sell to AMM (for XUSDC)
        await this.executeDEXToAMM(opp);
      } else {
        // PATH A: Buy from AMM (with XUSDC), sell on DEX (for XMD)
        await this.executeAMMToDEX(opp);
      }

      // Update last trade time
      this.lastTradeTime.set(pair.baseToken, new Date());

      // Record profit (positive PnL)
      circuitBreaker.recordTradeResult('cross-venue-arbitrage', opp.profitUSD);

      // Send notification
      if (telegramNotifier.isReady()) {
        await telegramNotifier.alertArbitrageOpportunity({
          poolSymbol: pair.ammPoolSymbol,
          direction,
          profitBPS: opp.profitBPS,
          profitUSD: opp.profitUSD,
          executed: true
        });
      }

      logger.info(`Arbitrage executed successfully. Estimated profit: $${opp.profitUSD.toFixed(2)}`);

    } catch (error) {
      logger.error('Arbitrage execution failed:', error);

      // Record failure as small loss (triggers consecutive loss tracking)
      circuitBreaker.recordTradeResult('cross-venue-arbitrage', -1);

      if (telegramNotifier.isReady()) {
        await telegramNotifier.alertError(
          `Arbitrage execution failed: ${error}`,
          `${pair.baseToken} ${direction}`
        );
      }
    }
  }

  /**
   * Execute DEX → AMM arbitrage
   * 1. Mint XMD from XUSDC
   * 2. Buy token on DEX with XMD
   * 3. Sell token to AMM for XUSDC
   */
  private async executeDEXToAMM(opp: ArbitrageOpportunity): Promise<void> {
    const { pair, dexPrice, optimalSize } = opp;

    // Small delay helper to avoid RPC rate limits
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Calculate required XMD (which equals XUSDC via treasury)
    const xmdNeeded = optimalSize * dexPrice;
    const xmdQuantity = xmdNeeded.toFixed(PRECISION.XMD);

    logger.info(`Step 1: Mint ${xmdQuantity} XMD from XUSDC`);

    // Step 1: Mint XMD from XUSDC
    await dexrpc.transferToken(
      CONTRACTS.XTOKENS,
      CONTRACTS.XMD_TREASURY,
      `${xmdQuantity} XUSDC`,
      'mint'
    );

    // Wait for transaction to propagate
    await delay(2000);

    logger.info(`Step 2: Buy ${optimalSize} ${pair.baseToken} on DEX at ${dexPrice} XMD`);

    // Step 2: Buy token on DEX
    // This involves placing a market buy order
    await this.placeDEXBuyOrder(pair, optimalSize, dexPrice);

    // Wait longer for order to process and RPC to recover
    logger.info('Waiting for DEX order to settle...');
    await delay(5000);

    logger.info(`Step 3: Sell ${optimalSize} ${pair.baseToken} to AMM for XUSDC`);

    // Step 3: Sell token to AMM
    await this.executeAMMSwap(
      pair.baseToken,
      pair.baseContract,
      pair.basePrecision,
      optimalSize,
      'XUSDC',
      pair.ammPoolSymbol
    );
  }

  /**
   * Execute AMM → DEX arbitrage
   * 1. Buy token from AMM with XUSDC
   * 2. Sell token on DEX for XMD
   * 3. Redeem XMD to XUSDC
   */
  private async executeAMMToDEX(opp: ArbitrageOpportunity): Promise<void> {
    const { pair, ammPrice, dexPrice, optimalSize } = opp;

    // Small delay helper to avoid RPC rate limits
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Calculate XUSDC needed for AMM purchase
    const xusdcNeeded = optimalSize * ammPrice;

    logger.info(`Step 1: Buy ${optimalSize} ${pair.baseToken} from AMM for ${xusdcNeeded.toFixed(6)} XUSDC`);

    // Step 1: Buy token from AMM
    await this.executeAMMSwap(
      'XUSDC',
      CONTRACTS.XTOKENS,
      PRECISION.XUSDC,
      xusdcNeeded,
      pair.baseToken,
      pair.ammPoolSymbol
    );

    await delay(2000);

    logger.info(`Step 2: Sell ${optimalSize} ${pair.baseToken} on DEX at ${dexPrice} XMD`);

    // Step 2: Sell token on DEX for XMD
    await this.placeDEXSellOrder(pair, optimalSize, dexPrice);

    await delay(2000);

    // Calculate expected XMD received
    const xmdReceived = optimalSize * dexPrice;

    logger.info(`Step 3: Redeem ${xmdReceived.toFixed(6)} XMD to XUSDC`);

    // Step 3: Redeem XMD to XUSDC
    await dexrpc.transferToken(
      CONTRACTS.XMD_TOKEN,
      CONTRACTS.XMD_TREASURY,
      `${xmdReceived.toFixed(PRECISION.XMD)} XMD`,
      'redeem,XUSDC'
    );
  }

  /**
   * Get AMM pool state
   */
  private async getAMMPool(poolSymbol: string): Promise<AMMPool | null> {
    try {
      const result = await this.rpc.get_table_rows({
        code: CONTRACTS.AMM,
        scope: CONTRACTS.AMM,
        table: 'pools',
        limit: 100,
        json: true
      });

      for (const row of result.rows) {
        // Pool symbol is stored as "8,XPRUSDC" format
        const symbol = row.lt_symbol.split(',')[1];
        if (symbol === poolSymbol) {
          return {
            symbol,
            pool1: row.pool1,
            pool2: row.pool2,
            fee: row.fee.exchange_fee  // In basis points
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error fetching AMM pool:', error);
      return null;
    }
  }

  /**
   * Calculate AMM price for a token in XUSDC
   */
  private calculateAMMPrice(pool: AMMPool, baseToken: string): number {
    // Parse pool quantities
    const pool1Parts = pool.pool1.quantity.split(' ');
    const pool2Parts = pool.pool2.quantity.split(' ');

    const pool1Amount = parseFloat(pool1Parts[0]);
    const pool1Token = pool1Parts[1];
    const pool2Amount = parseFloat(pool2Parts[0]);
    const pool2Token = pool2Parts[1];

    // Determine which pool is which
    if (pool1Token === baseToken) {
      // pool1 is base token, pool2 is XUSDC
      return pool2Amount / pool1Amount;
    } else if (pool2Token === baseToken) {
      // pool2 is base token, pool1 is XUSDC
      return pool1Amount / pool2Amount;
    }

    throw new Error(`Token ${baseToken} not found in pool`);
  }

  /**
   * Get DEX orderbook for a market
   */
  private async getDEXOrderbook(
    marketId: number,
    basePrecision: number
  ): Promise<{ bids: DEXOrder[]; asks: DEXOrder[] }> {
    try {
      const result = await this.rpc.get_table_rows({
        code: CONTRACTS.DEX,
        scope: CONTRACTS.DEX,
        table: 'orderbook',
        limit: 500,
        json: true
      });

      const marketOrders = result.rows.filter((o: any) => o.market_id === marketId);

      const bids: DEXOrder[] = [];
      const asks: DEXOrder[] = [];

      for (const order of marketOrders) {
        const dexOrder: DEXOrder = {
          orderId: order.order_id,
          price: order.price / 1000000,  // XMD has 6 decimals
          quantity: order.quantity / Math.pow(10, basePrecision),
          side: order.order_side === 1 ? 'BUY' : 'SELL',
          account: order.account_name
        };

        if (dexOrder.side === 'BUY') {
          bids.push(dexOrder);
        } else {
          asks.push(dexOrder);
        }
      }

      // Sort: bids highest first, asks lowest first
      bids.sort((a, b) => b.price - a.price);
      asks.sort((a, b) => a.price - b.price);

      return { bids, asks };

    } catch (error) {
      logger.error('Error fetching DEX orderbook:', error);
      return { bids: [], asks: [] };
    }
  }

  /**
   * Execute AMM swap
   * Memo format: "{pool_symbol},{min_output} {output_token}"
   * e.g., "XPRUSDC,1.000000 XUSDC"
   */
  private async executeAMMSwap(
    inputToken: string,
    inputContract: string,
    inputPrecision: number,
    inputAmount: number,
    outputToken: string,
    poolSymbol: string
  ): Promise<void> {
    const quantity = `${inputAmount.toFixed(inputPrecision)} ${inputToken}`;

    // Get output precision
    const outputPrecision = PRECISION[outputToken as keyof typeof PRECISION] || 6;

    // Get AMM pool to calculate expected output
    const pool = await this.getAMMPool(poolSymbol);
    if (!pool) {
      throw new Error(`AMM pool ${poolSymbol} not found`);
    }

    // Calculate expected output using AMM constant product formula
    // output = (input * poolOut) / (poolIn + input) * (1 - fee)
    const pool1Parts = pool.pool1.quantity.split(' ');
    const pool2Parts = pool.pool2.quantity.split(' ');
    const pool1Amount = parseFloat(pool1Parts[0]);
    const pool1Token = pool1Parts[1];
    const pool2Amount = parseFloat(pool2Parts[0]);
    const pool2Token = pool2Parts[1];

    let expectedOutput: number;
    if (pool1Token === inputToken) {
      // Input is pool1, output is pool2
      expectedOutput = (inputAmount * pool2Amount) / (pool1Amount + inputAmount);
    } else if (pool2Token === inputToken) {
      // Input is pool2, output is pool1
      expectedOutput = (inputAmount * pool1Amount) / (pool2Amount + inputAmount);
    } else {
      throw new Error(`Input token ${inputToken} not found in pool ${poolSymbol}`);
    }

    // Apply AMM fee (typically 0.2% = 20 BPS)
    const feeMultiplier = 1 - (pool.fee / 10000);
    expectedOutput = expectedOutput * feeMultiplier;

    // Apply slippage tolerance (5%) - use 95% of expected as minimum
    const slippageTolerance = 0.05;
    const minOutputAmount = expectedOutput * (1 - slippageTolerance);

    // Format the minimum output with proper precision
    const minOutput = `${minOutputAmount.toFixed(outputPrecision)} ${outputToken}`;

    const memo = `${poolSymbol},${minOutput}`;

    logger.info(`AMM Swap: ${quantity} → ${outputToken} (pool: ${poolSymbol})`);
    logger.info(`  Expected output: ~${expectedOutput.toFixed(outputPrecision)} ${outputToken}`);
    logger.info(`  Min output (5% slippage): ${minOutput}`);

    await dexrpc.transferToken(
      inputContract,
      CONTRACTS.AMM,
      quantity,
      memo
    );
  }

  /**
   * Place DEX buy order (market taker)
   */
  private async placeDEXBuyOrder(
    pair: ArbitragePair,
    quantity: number,
    price: number
  ): Promise<void> {
    // For arbitrage, we want to take existing liquidity (market order behavior)
    // We'll place a limit order at or above the ask price
    const slippageMultiplier = 1 + (this.config.maxSlippageBPS / 10000);
    const orderPrice = price * slippageMultiplier;

    // Calculate XMD quantity needed
    const xmdQuantity = quantity * orderPrice;

    logger.info(`DEX Buy: ${quantity} ${pair.baseToken} @ ${orderPrice.toFixed(6)} XMD (${xmdQuantity.toFixed(6)} XMD total)`);

    // Transfer XMD to DEX and place order
    // The DEX requires depositing funds first, then placing order
    await this.placeDEXOrder(pair, 'BUY', quantity, orderPrice, xmdQuantity);
  }

  /**
   * Place DEX sell order (market taker)
   */
  private async placeDEXSellOrder(
    pair: ArbitragePair,
    quantity: number,
    price: number
  ): Promise<void> {
    // For arbitrage, place at or below the bid price
    const slippageMultiplier = 1 - (this.config.maxSlippageBPS / 10000);
    const orderPrice = price * slippageMultiplier;

    logger.info(`DEX Sell: ${quantity} ${pair.baseToken} @ ${orderPrice.toFixed(6)} XMD`);

    await this.placeDEXOrder(pair, 'SELL', quantity, orderPrice, quantity);
  }

  /**
   * Place order on DEX
   */
  private async placeDEXOrder(
    pair: ArbitragePair,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    depositAmount: number
  ): Promise<void> {
    const market = dexapi.getMarketBySymbol(pair.dexMarketSymbol);
    if (!market) {
      throw new Error(`Market ${pair.dexMarketSymbol} not found`);
    }

    // Use the existing prepareLimitOrder function
    const orderSide = side === 'BUY' ? 1 : 2;  // 1 = BUY, 2 = SELL

    if (side === 'BUY') {
      // For buy orders, quantity is in quote token (XMD)
      await dexrpc.prepareLimitOrder(pair.dexMarketSymbol, orderSide, depositAmount, price);
    } else {
      // For sell orders, quantity is in base token
      await dexrpc.prepareLimitOrder(pair.dexMarketSymbol, orderSide, quantity, price);
    }

    await dexrpc.submitOrders();
  }

  /**
   * Stop the strategy
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Cross-venue arbitrage strategy stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CrossVenueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CrossVenueConfig {
    return { ...this.config };
  }

  /**
   * Get strategy stats
   */
  getStats(): any {
    return {
      isRunning: this.isRunning,
      pairs: this.config.pairs.map(p => ({
        token: p.baseToken,
        enabled: p.enabled,
        lastTrade: this.lastTradeTime.get(p.baseToken)
      }))
    };
  }
}

// Export singleton
export const crossVenueArbitrage = new CrossVenueArbitrageStrategy();
