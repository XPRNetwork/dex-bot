import { TradingStrategyBase, MarketDetails } from './base.js';
import { TradeOrder } from '../interfaces/index.js';
import { ORDERSIDES } from '../core/constants.js';
import {
  marketAnalyzer,
  MarketAnalysis,
  SpreadRecommendation,
  InventoryRecommendation
} from '../ai/index.js';
import { riskManager } from '../risk/index.js';
import { orderRepository, tradeRepository } from '../persistence/index.js';
import { getLogger } from '../utils.js';
import * as dexapi from '../dexapi.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface AdaptiveMMConfig {
  pairs: AdaptiveMMPair[];
  analysisIntervalMS: number;      // How often to run AI analysis
  orderRefreshMS: number;          // How often to refresh orders
  baseSpreadBps: number;           // Default spread in basis points
  targetInventoryRatio: number;    // Target base/quote ratio (0.5 = 50/50)
  maxPositionUSD: number;          // Max position per pair
  gridLevels: number;              // Number of order levels on each side
  enabled: boolean;
  claudeApiKey?: string;
}

export interface AdaptiveMMPair {
  symbol: string;
  bidAmountPerLevel: number;
  baseSpreadBps?: number;
  maxPositionUSD?: number;
  enabled: boolean;
}

interface PairState {
  symbol: string;
  lastAnalysis: MarketAnalysis | null;
  lastSpreadRec: SpreadRecommendation | null;
  lastInventoryRec: InventoryRecommendation | null;
  currentSpreadBps: number;
  inventorySkew: number;
  openOrders: number;
  lastOrderTime: Date | null;
  lastAnalysisTime: Date | null;
}

const DEFAULT_CONFIG: AdaptiveMMConfig = {
  pairs: [],
  analysisIntervalMS: 60000,       // 1 minute
  orderRefreshMS: 30000,           // 30 seconds
  baseSpreadBps: 50,               // 0.5%
  targetInventoryRatio: 0.5,
  maxPositionUSD: 10000,
  gridLevels: 3,
  enabled: true
};

/**
 * Claude AI-Powered Adaptive Market Maker
 *
 * Uses Claude to analyze market conditions and dynamically adjust:
 * - Bid-ask spread based on volatility and sentiment
 * - Order sizes based on inventory and market depth
 * - Order skew based on trend and position
 *
 * Features:
 * - Real-time market analysis via Claude API
 * - Sentiment-aware spread adjustment
 * - Orderbook imbalance detection
 * - Dynamic inventory skewing
 * - Trade reasoning logs
 */
export class ClaudeAdaptiveMMStrategy extends TradingStrategyBase {
  private config: AdaptiveMMConfig = DEFAULT_CONFIG;
  private pairStates: Map<string, PairState> = new Map();
  private isRunning: boolean = false;
  private stats = {
    tradesPlaced: 0,
    analysisRuns: 0,
    totalVolume: 0,
    lastTradeTime: null as Date | null
  };

  /**
   * Initialize the strategy
   */
  async initialize(options?: Partial<AdaptiveMMConfig>): Promise<void> {
    if (options) {
      this.config = { ...this.config, ...options };
    }

    logger.info('Initializing Claude Adaptive Market Maker...');

    // Initialize AI analyzer
    if (this.config.claudeApiKey) {
      marketAnalyzer.initialize(this.config.claudeApiKey);
    } else if (process.env.CLAUDE_API_KEY) {
      marketAnalyzer.initialize(process.env.CLAUDE_API_KEY);
    }

    // Initialize risk manager
    riskManager.initializeStrategy('claude-adaptive-mm');

    // Initialize pair states
    for (const pair of this.config.pairs) {
      if (pair.enabled) {
        this.pairStates.set(pair.symbol, {
          symbol: pair.symbol,
          lastAnalysis: null,
          lastSpreadRec: null,
          lastInventoryRec: null,
          currentSpreadBps: pair.baseSpreadBps || this.config.baseSpreadBps,
          inventorySkew: 0,
          openOrders: 0,
          lastOrderTime: null,
          lastAnalysisTime: null
        });
      }
    }

    logger.info(`Configured ${this.pairStates.size} pairs for adaptive market making`);
    this.isRunning = true;
  }

  /**
   * Main trade loop
   */
  async trade(): Promise<void> {
    if (!this.config.enabled || !this.isRunning) {
      return;
    }

    // Check risk status
    const riskStatus = riskManager.getRiskStatus('claude-adaptive-mm');
    if (!riskStatus.canTrade) {
      logger.warn('Trading halted by risk manager');
      return;
    }

    try {
      for (const [symbol, state] of this.pairStates) {
        await this.tradePair(symbol, state);
      }
    } catch (error) {
      logger.error('Error in adaptive MM trade cycle:', error);
    }
  }

  /**
   * Trade a single pair
   */
  private async tradePair(symbol: string, state: PairState): Promise<void> {
    const pairConfig = this.config.pairs.find(p => p.symbol === symbol);
    if (!pairConfig || !pairConfig.enabled) return;

    try {
      // Get current market state
      const marketDetails = await this.getMarketDetails(symbol);
      const openOrders = await this.getOpenOrders(symbol);
      state.openOrders = openOrders.length;

      // Run AI analysis if needed
      if (this.shouldRunAnalysis(state)) {
        await this.runAnalysis(symbol, state, marketDetails);
      }

      // Calculate spread and skew based on analysis
      const { bidSpread, askSpread, orderSize } = this.calculateOrderParams(
        state,
        pairConfig,
        marketDetails
      );

      // Generate orders
      const orders = this.generateOrders(
        symbol,
        marketDetails,
        bidSpread,
        askSpread,
        orderSize,
        state
      );

      // Risk check orders
      const approvedOrders = await this.riskCheckOrders(orders, symbol);

      // Place orders
      if (approvedOrders.length > 0) {
        logger.info(`Placing ${approvedOrders.length} orders for ${symbol}`);

        // Log trade reasoning
        for (const order of approvedOrders) {
          await this.logTradeReasoning(order, state);
        }

        await this.placeOrders(approvedOrders);
        state.lastOrderTime = new Date();
        this.stats.tradesPlaced += approvedOrders.length;
        this.stats.lastTradeTime = new Date();

        // Record orders
        this.recordOrders(approvedOrders, state);
      }

    } catch (error) {
      logger.error(`Error trading pair ${symbol}:`, error);
    }
  }

  /**
   * Check if we should run AI analysis
   */
  private shouldRunAnalysis(state: PairState): boolean {
    if (!state.lastAnalysisTime) return true;

    const elapsed = Date.now() - state.lastAnalysisTime.getTime();
    return elapsed >= this.config.analysisIntervalMS;
  }

  /**
   * Run AI analysis for a pair
   */
  private async runAnalysis(
    symbol: string,
    state: PairState,
    marketDetails: MarketDetails
  ): Promise<void> {
    try {
      this.stats.analysisRuns++;

      // Get market analysis
      const analysis = await marketAnalyzer.analyzeMarket(symbol);
      state.lastAnalysis = analysis;

      // Calculate inventory state
      const balances = await dexapi.fetchBalances(this.username);
      const inventoryState = this.calculateInventoryState(symbol, balances, marketDetails);

      // Get spread recommendation
      const spreadRec = await marketAnalyzer.optimizeSpread({
        symbol,
        currentSpreadBps: state.currentSpreadBps,
        volatilityHourly: this.estimateVolatility(analysis),
        volatilityDaily: this.estimateVolatility(analysis) * 2,
        averageTradeSize: 100, // Would calculate from trade history
        bidAskImbalance: analysis.orderbookImbalance,
        positionSize: inventoryState.baseBalance,
        positionSide: inventoryState.side,
        targetProfitBps: this.config.baseSpreadBps / 2
      });
      state.lastSpreadRec = spreadRec;

      // Get inventory recommendation
      const inventoryRec = await marketAnalyzer.analyzeInventory({
        symbol,
        baseBalance: inventoryState.baseBalance,
        quoteBalance: inventoryState.quoteBalance,
        baseValueUSD: inventoryState.baseValueUSD,
        quoteValueUSD: inventoryState.quoteValueUSD,
        totalValueUSD: inventoryState.totalValueUSD,
        targetAllocation: this.config.targetInventoryRatio,
        currentAllocation: inventoryState.allocation,
        unrealizedPnL: 0, // Would track
        recentPriceChange: 0, // Would calculate
        marketTrend: this.getTrendFromAnalysis(analysis)
      });
      state.lastInventoryRec = inventoryRec;

      // Update state
      state.currentSpreadBps = spreadRec.recommendedSpreadBps;
      state.inventorySkew = this.calculateSkew(inventoryRec, analysis);
      state.lastAnalysisTime = new Date();

      logger.info(`Analysis for ${symbol}:`);
      logger.info(`  Condition: ${analysis.marketCondition}, Sentiment: ${analysis.sentiment}`);
      logger.info(`  Recommended spread: ${spreadRec.recommendedSpreadBps} bps`);
      logger.info(`  Inventory action: ${inventoryRec.action}`);

    } catch (error) {
      logger.error(`Analysis failed for ${symbol}:`, error);
    }
  }

  /**
   * Calculate order parameters based on analysis
   */
  private calculateOrderParams(
    state: PairState,
    pairConfig: AdaptiveMMPair,
    marketDetails: MarketDetails
  ): { bidSpread: number; askSpread: number; orderSize: number } {
    const baseSpread = state.currentSpreadBps / 10000;
    const skew = state.inventorySkew;

    // Apply skew: positive skew = want to sell more (widen ask, tighten bid)
    const bidSpread = baseSpread * (1 - skew * 0.3);
    const askSpread = baseSpread * (1 + skew * 0.3);

    // Calculate order size
    let orderSize = pairConfig.bidAmountPerLevel;

    // Adjust size based on spread recommendation
    if (state.lastSpreadRec) {
      orderSize *= state.lastSpreadRec.orderSizeMultiplier;
    }

    // Reduce size in volatile conditions
    if (state.lastAnalysis?.volatilityLevel === 'HIGH') {
      orderSize *= 0.7;
    }

    return {
      bidSpread: Math.max(0.0001, bidSpread),
      askSpread: Math.max(0.0001, askSpread),
      orderSize
    };
  }

  /**
   * Generate buy and sell orders
   */
  private generateOrders(
    symbol: string,
    marketDetails: MarketDetails,
    bidSpread: number,
    askSpread: number,
    orderSize: number,
    state: PairState
  ): TradeOrder[] {
    const orders: TradeOrder[] = [];
    const midPrice = (marketDetails.highestBid + marketDetails.lowestAsk) / 2;

    // Apply skew to determine which side gets more orders
    const bidLevels = state.inventorySkew > 0 ?
      Math.floor(this.config.gridLevels * 0.7) :
      this.config.gridLevels;
    const askLevels = state.inventorySkew < 0 ?
      Math.floor(this.config.gridLevels * 0.7) :
      this.config.gridLevels;

    // Generate bid orders
    for (let i = 0; i < bidLevels; i++) {
      const spreadMultiplier = 1 + (i * 0.3); // Each level 30% further from mid
      const price = midPrice * (1 - bidSpread * spreadMultiplier);

      // Adjust size: larger at better prices
      const sizeMultiplier = 1 + (i * 0.2);

      orders.push({
        marketSymbol: symbol,
        orderSide: ORDERSIDES.BUY,
        price: Number(price.toFixed(8)),
        quantity: orderSize * sizeMultiplier
      });
    }

    // Generate ask orders
    for (let i = 0; i < askLevels; i++) {
      const spreadMultiplier = 1 + (i * 0.3);
      const price = midPrice * (1 + askSpread * spreadMultiplier);

      const sizeMultiplier = 1 + (i * 0.2);

      orders.push({
        marketSymbol: symbol,
        orderSide: ORDERSIDES.SELL,
        price: Number(price.toFixed(8)),
        quantity: orderSize * sizeMultiplier
      });
    }

    return orders;
  }

  /**
   * Risk check orders before placement
   */
  private async riskCheckOrders(orders: TradeOrder[], symbol: string): Promise<TradeOrder[]> {
    const approved: TradeOrder[] = [];

    for (const order of orders) {
      const riskCheck = riskManager.checkOrder({
        strategy: 'claude-adaptive-mm',
        marketSymbol: symbol,
        side: order.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL',
        quantity: order.quantity,
        price: order.price
      });

      if (riskCheck.allowed) {
        if (riskCheck.adjustedSize) {
          order.quantity = riskCheck.adjustedSize;
        }
        approved.push(order);
      } else {
        logger.debug(`Order rejected: ${riskCheck.reason}`);
      }
    }

    return approved;
  }

  /**
   * Log trade reasoning using AI
   */
  private async logTradeReasoning(order: TradeOrder, state: PairState): Promise<void> {
    if (!marketAnalyzer.isReady()) return;

    try {
      const reasoning = await marketAnalyzer.generateTradeReasoning({
        symbol: order.marketSymbol,
        side: order.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL',
        size: order.quantity,
        price: order.price,
        marketCondition: state.lastAnalysis?.marketCondition || 'UNKNOWN',
        spreadBps: state.currentSpreadBps,
        inventorySkew: state.inventorySkew,
        sentiment: state.lastAnalysis?.sentiment || 'NEUTRAL'
      });

      logger.info(`Trade reasoning: ${reasoning}`);

    } catch (error) {
      // Non-critical, just log
      logger.debug('Could not generate trade reasoning');
    }
  }

  /**
   * Record orders in database
   */
  private recordOrders(orders: TradeOrder[], state: PairState): void {
    try {
      for (const order of orders) {
        orderRepository.createOrder({
          strategy: 'claude-adaptive-mm',
          market_symbol: order.marketSymbol,
          order_side: order.orderSide === ORDERSIDES.BUY ? 'BUY' : 'SELL',
          price: order.price,
          quantity: order.quantity,
          status: 'PENDING'
        });
      }
    } catch (error) {
      logger.error('Failed to record orders:', error);
    }
  }

  /**
   * Calculate inventory state
   */
  private calculateInventoryState(
    symbol: string,
    balances: any[],
    marketDetails: MarketDetails
  ): {
    baseBalance: number;
    quoteBalance: number;
    baseValueUSD: number;
    quoteValueUSD: number;
    totalValueUSD: number;
    allocation: number;
    side: 'LONG' | 'SHORT' | 'NEUTRAL';
  } {
    const [baseToken, quoteToken] = symbol.split('_');

    // Find balances
    const baseBalanceRaw = balances.find(b => b.currency === baseToken);
    const quoteBalanceRaw = balances.find(b => b.currency === quoteToken);

    const baseBalance = baseBalanceRaw ? parseFloat(baseBalanceRaw.amount) : 0;
    const quoteBalance = quoteBalanceRaw ? parseFloat(quoteBalanceRaw.amount) : 0;

    const baseValueUSD = baseBalance * marketDetails.price;
    const quoteValueUSD = quoteBalance; // Assuming quote is USD-like
    const totalValueUSD = baseValueUSD + quoteValueUSD;

    const allocation = totalValueUSD > 0 ? baseValueUSD / totalValueUSD : 0.5;

    let side: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    if (allocation > 0.6) side = 'LONG';
    else if (allocation < 0.4) side = 'SHORT';

    return {
      baseBalance,
      quoteBalance,
      baseValueUSD,
      quoteValueUSD,
      totalValueUSD,
      allocation,
      side
    };
  }

  /**
   * Estimate volatility from analysis
   */
  private estimateVolatility(analysis: MarketAnalysis): number {
    switch (analysis.volatilityLevel) {
      case 'LOW': return 0.01;
      case 'MEDIUM': return 0.03;
      case 'HIGH': return 0.06;
      default: return 0.03;
    }
  }

  /**
   * Get trend direction from analysis
   */
  private getTrendFromAnalysis(analysis: MarketAnalysis): 'UP' | 'DOWN' | 'SIDEWAYS' {
    switch (analysis.marketCondition) {
      case 'TRENDING_UP': return 'UP';
      case 'TRENDING_DOWN': return 'DOWN';
      default: return 'SIDEWAYS';
    }
  }

  /**
   * Calculate inventory skew (-1 to 1)
   */
  private calculateSkew(
    inventoryRec: InventoryRecommendation | null,
    analysis: MarketAnalysis | null
  ): number {
    let skew = 0;

    // Inventory-based skew
    if (inventoryRec) {
      switch (inventoryRec.skewDirection) {
        case 'FAVOR_BIDS': skew -= 0.3; break;
        case 'FAVOR_ASKS': skew += 0.3; break;
      }
    }

    // Sentiment-based skew
    if (analysis) {
      skew += analysis.sentimentScore * 0.2;
    }

    return Math.max(-1, Math.min(1, skew));
  }

  /**
   * Get strategy statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get pair states
   */
  getPairStates(): Map<string, PairState> {
    return new Map(this.pairStates);
  }

  /**
   * Stop the strategy
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Claude Adaptive MM Strategy stopped');
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
  updateConfig(config: Partial<AdaptiveMMConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Adaptive MM config updated');
  }
}

// Export for strategy factory
export default ClaudeAdaptiveMMStrategy;
