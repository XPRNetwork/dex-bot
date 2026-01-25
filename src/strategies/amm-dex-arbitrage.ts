import { TradingStrategyBase, MarketDetails } from './base.js';
import { TradeOrder } from '../interfaces/index.js';
import { ORDERSIDES } from '../core/constants.js';
import { ammPoolMonitor, ammPriceCalculator, swapExecutor, Pool, ArbitrageOpportunity } from '../amm/index.js';
import { riskManager } from '../risk/index.js';
import { arbitrageRepository, tradeRepository } from '../persistence/index.js';
import { getLogger } from '../utils.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface ArbConfig {
  pools: ArbPoolConfig[];
  minProfitBPS: number;         // Minimum profit in basis points (e.g., 10 = 0.1%)
  maxTradeSizeUSD: number;      // Maximum trade size per opportunity
  checkIntervalMS: number;      // How often to check for opportunities
  dryRun: boolean;              // If true, log but don't execute
  enabled: boolean;
}

export interface ArbPoolConfig {
  poolSymbol: string;           // e.g., "XPRUSDC"
  dexMarketSymbol: string;      // e.g., "XPR_XUSDC"
  baseToken: string;            // e.g., "XPR"
  quoteToken: string;           // e.g., "XUSDC"
  enabled: boolean;
}

interface ArbOpportunity extends ArbitrageOpportunity {
  dexMarketSymbol: string;
  baseToken: string;
  quoteToken: string;
  timestamp: Date;
}

const DEFAULT_CONFIG: ArbConfig = {
  pools: [
    {
      poolSymbol: 'XPRUSDC',
      dexMarketSymbol: 'XPR_XUSDC',
      baseToken: 'XPR',
      quoteToken: 'XUSDC',
      enabled: true
    },
    {
      poolSymbol: 'XMTUSDC',
      dexMarketSymbol: 'XMT_XUSDC',
      baseToken: 'XMT',
      quoteToken: 'XUSDC',
      enabled: true
    }
  ],
  minProfitBPS: 10,
  maxTradeSizeUSD: 1000,
  checkIntervalMS: 5000,
  dryRun: false,
  enabled: true
};

/**
 * AMM-DEX Arbitrage Strategy
 *
 * Exploits price discrepancies between proton.swaps AMM pools and the MetalX DEX orderbook.
 *
 * Arbitrage Directions:
 * 1. AMM_TO_DEX: When AMM price < DEX bid → Buy on AMM, sell on DEX
 * 2. DEX_TO_AMM: When AMM price > DEX ask → Buy on DEX, sell on AMM
 */
export class AMMDEXArbitrageStrategy extends TradingStrategyBase {
  private config: ArbConfig = DEFAULT_CONFIG;
  private isRunning: boolean = false;
  private opportunities: ArbOpportunity[] = [];
  private stats = {
    opportunitiesDetected: 0,
    opportunitiesExecuted: 0,
    totalProfit: 0,
    lastCheck: new Date()
  };

  /**
   * Initialize the arbitrage strategy
   */
  async initialize(options?: Partial<ArbConfig>): Promise<void> {
    if (options) {
      this.config = { ...this.config, ...options };
    }

    logger.info('Initializing AMM-DEX Arbitrage Strategy...');
    logger.info(`Config: minProfitBPS=${this.config.minProfitBPS}, maxTradeSizeUSD=${this.config.maxTradeSizeUSD}`);

    // Initialize AMM pool monitor
    await ammPoolMonitor.initialize();

    // Initialize risk manager
    riskManager.initializeStrategy('amm-dex-arbitrage');

    // Log enabled pools
    const enabledPools = this.config.pools.filter(p => p.enabled);
    logger.info(`Monitoring ${enabledPools.length} pools: ${enabledPools.map(p => p.poolSymbol).join(', ')}`);

    this.isRunning = true;
  }

  /**
   * Main trade loop - scan for and execute arbitrage opportunities
   */
  async trade(): Promise<void> {
    if (!this.config.enabled || !this.isRunning) {
      logger.debug('Arbitrage strategy is disabled or not running');
      return;
    }

    // Check risk status
    const riskStatus = riskManager.getRiskStatus('amm-dex-arbitrage');
    if (!riskStatus.canTrade) {
      logger.warn('Trading halted by risk manager');
      return;
    }

    try {
      // Scan all enabled pools for opportunities
      const opportunities = await this.scanForOpportunities();

      if (opportunities.length > 0) {
        logger.info(`Found ${opportunities.length} arbitrage opportunities`);

        // Sort by expected profit (highest first)
        opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);

        // Execute the most profitable opportunity
        for (const opp of opportunities) {
          if (opp.profitable) {
            await this.executeArbitrage(opp);
            break; // Only execute one per cycle to manage risk
          }
        }
      }

      this.stats.lastCheck = new Date();

    } catch (error) {
      logger.error('Error in arbitrage trade cycle:', error);
    }
  }

  /**
   * Scan all pools for arbitrage opportunities
   */
  private async scanForOpportunities(): Promise<ArbOpportunity[]> {
    const opportunities: ArbOpportunity[] = [];

    for (const poolConfig of this.config.pools) {
      if (!poolConfig.enabled) continue;

      try {
        const opp = await this.checkPoolOpportunity(poolConfig);
        if (opp) {
          opportunities.push(opp);
        }
      } catch (error) {
        logger.error(`Error checking pool ${poolConfig.poolSymbol}:`, error);
      }
    }

    return opportunities;
  }

  /**
   * Check a single pool for arbitrage opportunity
   */
  private async checkPoolOpportunity(poolConfig: ArbPoolConfig): Promise<ArbOpportunity | null> {
    // Refresh pool data
    const pool = await ammPoolMonitor.refreshPool(poolConfig.poolSymbol);
    if (!pool) {
      logger.warn(`Could not fetch pool ${poolConfig.poolSymbol}`);
      return null;
    }

    // Get DEX orderbook
    const marketDetails = await this.getMarketDetails(poolConfig.dexMarketSymbol);

    // Find arbitrage opportunity
    const arbOpp = ammPriceCalculator.findArbitrageOpportunity(
      pool,
      marketDetails.highestBid,
      marketDetails.lowestAsk,
      this.config.minProfitBPS
    );

    if (arbOpp.profitable) {
      this.stats.opportunitiesDetected++;

      const opportunity: ArbOpportunity = {
        ...arbOpp,
        dexMarketSymbol: poolConfig.dexMarketSymbol,
        baseToken: poolConfig.baseToken,
        quoteToken: poolConfig.quoteToken,
        timestamp: new Date()
      };

      // Log opportunity
      logger.info(`Arbitrage opportunity found in ${poolConfig.poolSymbol}:`);
      logger.info(`  Direction: ${arbOpp.direction}`);
      logger.info(`  AMM Price: ${arbOpp.ammPrice.toFixed(8)}`);
      logger.info(`  DEX Price: ${arbOpp.dexPrice.toFixed(8)}`);
      logger.info(`  Spread: ${arbOpp.spreadBps.toFixed(2)} bps`);
      logger.info(`  Expected Profit: $${arbOpp.expectedProfit.toFixed(4)}`);

      // Record in database
      try {
        arbitrageRepository.createOpportunity({
          pool_symbol: poolConfig.poolSymbol,
          amm_price: arbOpp.ammPrice,
          dex_bid: marketDetails.highestBid,
          dex_ask: marketDetails.lowestAsk,
          spread_bps: arbOpp.spreadBps,
          direction: arbOpp.direction,
          potential_profit: arbOpp.expectedProfit,
          trade_size: arbOpp.optimalSize
        });
      } catch (e) {
        // Ignore database errors
      }

      return opportunity;
    }

    return null;
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeArbitrage(opp: ArbOpportunity): Promise<void> {
    if (this.config.dryRun) {
      logger.info(`[DRY RUN] Would execute arbitrage: ${opp.direction} in ${opp.poolSymbol}`);
      return;
    }

    // Calculate trade size (respect max limit)
    const tradeSize = Math.min(opp.optimalSize, this.config.maxTradeSizeUSD / opp.ammPrice);

    // Risk check
    const riskCheck = riskManager.checkOrder({
      strategy: 'amm-dex-arbitrage',
      marketSymbol: opp.dexMarketSymbol,
      side: opp.direction === 'AMM_TO_DEX' ? 'BUY' : 'SELL',
      quantity: tradeSize,
      price: opp.ammPrice
    });

    if (!riskCheck.allowed) {
      logger.warn(`Risk check failed: ${riskCheck.reason}`);
      return;
    }

    const adjustedSize = riskCheck.adjustedSize ?? tradeSize;

    try {
      logger.info(`Executing ${opp.direction} arbitrage...`);
      logger.info(`  Trade size: ${adjustedSize.toFixed(4)} ${opp.baseToken}`);

      if (opp.direction === 'AMM_TO_DEX') {
        await this.executeAmmToDex(opp, adjustedSize);
      } else {
        await this.executeDexToAmm(opp, adjustedSize);
      }

      this.stats.opportunitiesExecuted++;

    } catch (error) {
      logger.error(`Failed to execute arbitrage:`, error);
    }
  }

  /**
   * Execute AMM to DEX arbitrage: Buy on AMM, sell on DEX
   */
  private async executeAmmToDex(opp: ArbOpportunity, size: number): Promise<void> {
    // Step 1: Buy on AMM (swap quote token for base token)
    const quoteAmount = size * opp.ammPrice;

    logger.info(`Step 1: Swapping ${quoteAmount.toFixed(4)} ${opp.quoteToken} for ${opp.baseToken} on AMM`);

    const swapResult = await swapExecutor.executeSwap({
      poolSymbol: opp.poolSymbol,
      inputToken: opp.quoteToken,
      inputAmount: quoteAmount,
      minOutputAmount: size * 0.995 // 0.5% slippage tolerance
    });

    if (!swapResult.success) {
      logger.error(`AMM swap failed: ${swapResult.error}`);
      return;
    }

    logger.info(`AMM swap successful: received ${swapResult.outputAmount} ${opp.baseToken}`);

    // Step 2: Sell on DEX
    logger.info(`Step 2: Selling ${swapResult.outputAmount} ${opp.baseToken} on DEX at ${opp.dexPrice}`);

    const sellOrder: TradeOrder = {
      marketSymbol: opp.dexMarketSymbol,
      orderSide: ORDERSIDES.SELL,
      quantity: swapResult.outputAmount,
      price: opp.dexPrice * 0.999 // Slightly below bid for immediate fill
    };

    await this.placeOrders([sellOrder]);

    // Calculate profit
    const revenue = swapResult.outputAmount * opp.dexPrice;
    const cost = quoteAmount;
    const profit = revenue - cost;

    logger.info(`Arbitrage complete! Profit: $${profit.toFixed(4)}`);

    // Record trade
    this.recordArbitrageTrade(opp, size, profit);
    this.stats.totalProfit += profit;
  }

  /**
   * Execute DEX to AMM arbitrage: Buy on DEX, sell on AMM
   */
  private async executeDexToAmm(opp: ArbOpportunity, size: number): Promise<void> {
    // Step 1: Buy on DEX
    logger.info(`Step 1: Buying ${size} ${opp.baseToken} on DEX at ${opp.dexPrice}`);

    const buyOrder: TradeOrder = {
      marketSymbol: opp.dexMarketSymbol,
      orderSide: ORDERSIDES.BUY,
      quantity: size,
      price: opp.dexPrice * 1.001 // Slightly above ask for immediate fill
    };

    await this.placeOrders([buyOrder]);

    // Wait for order to fill (simplified - in production would track order status)
    await this.delay(2000);

    // Step 2: Sell on AMM (swap base token for quote token)
    logger.info(`Step 2: Swapping ${size} ${opp.baseToken} for ${opp.quoteToken} on AMM`);

    const expectedQuote = size * opp.ammPrice;
    const swapResult = await swapExecutor.executeSwap({
      poolSymbol: opp.poolSymbol,
      inputToken: opp.baseToken,
      inputAmount: size,
      minOutputAmount: expectedQuote * 0.995
    });

    if (!swapResult.success) {
      logger.error(`AMM swap failed: ${swapResult.error}`);
      // Position is now exposed - would need handling in production
      return;
    }

    // Calculate profit
    const cost = size * opp.dexPrice;
    const revenue = swapResult.outputAmount;
    const profit = revenue - cost;

    logger.info(`Arbitrage complete! Profit: $${profit.toFixed(4)}`);

    // Record trade
    this.recordArbitrageTrade(opp, size, profit);
    this.stats.totalProfit += profit;
  }

  /**
   * Record arbitrage trade in database
   */
  private recordArbitrageTrade(opp: ArbOpportunity, size: number, profit: number): void {
    try {
      // Record as a trade
      tradeRepository.createTrade({
        strategy: 'amm-dex-arbitrage',
        market_symbol: opp.dexMarketSymbol,
        trade_side: opp.direction === 'AMM_TO_DEX' ? 'SELL' : 'BUY',
        price: opp.dexPrice,
        quantity: size,
        realized_pnl: profit
      });

      // Update risk manager
      riskManager.recordTrade(
        'amm-dex-arbitrage',
        opp.dexMarketSymbol,
        opp.direction === 'AMM_TO_DEX' ? 'SELL' : 'BUY',
        size,
        opp.dexPrice,
        profit
      );

    } catch (error) {
      logger.error('Failed to record arbitrage trade:', error);
    }
  }

  /**
   * Get strategy statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Stop the strategy
   */
  stop(): void {
    this.isRunning = false;
    logger.info('AMM-DEX Arbitrage Strategy stopped');
  }

  /**
   * Check if strategy is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ArbConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Arbitrage config updated');
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for strategy factory
export default AMMDEXArbitrageStrategy;
