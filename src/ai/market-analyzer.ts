import { claudeClient, AnalysisResponse } from './claude-client.js';
import {
  SYSTEM_PROMPTS,
  buildMarketAnalysisPrompt,
  buildSpreadOptimizationPrompt,
  buildInventoryPrompt,
  buildTradeDecisionPrompt,
  buildTradeReasoningPrompt
} from './prompts.js';
import { getLogger } from '../utils.js';
import * as dexapi from '../dexapi.js';

const logger = getLogger();

export interface MarketAnalysis {
  marketCondition: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'CALM';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentScore: number;
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  orderbookImbalance: number;
  recommendedAction: 'WIDEN_SPREAD' | 'TIGHTEN_SPREAD' | 'SKEW_BIDS' | 'SKEW_ASKS' | 'HOLD' | 'REDUCE_EXPOSURE';
  spreadAdjustmentBps: number;
  confidenceScore: number;
  reasoning: string;
  timestamp: Date;
}

export interface SpreadRecommendation {
  recommendedSpreadBps: number;
  minSpreadBps: number;
  maxSpreadBps: number;
  bidSkewBps: number;
  askSkewBps: number;
  orderSizeMultiplier: number;
  refreshIntervalMs: number;
  reasoning: string;
}

export interface InventoryRecommendation {
  action: 'REBALANCE' | 'HOLD' | 'REDUCE_BASE' | 'INCREASE_BASE';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  targetBaseAllocation: number;
  rebalanceAmount: number;
  maxSlippageBps: number;
  skewDirection: 'FAVOR_BIDS' | 'FAVOR_ASKS' | 'NEUTRAL';
  reasoning: string;
}

export interface TradeDecision {
  decision: 'APPROVE' | 'REJECT' | 'MODIFY';
  confidence: number;
  suggestedPrice?: number;
  suggestedSize?: number;
  riskWarnings: string[];
  reasoning: string;
}

export interface AnalyzerConfig {
  enabled: boolean;
  analysisIntervalMs: number;
  cacheExpiryMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: AnalyzerConfig = {
  enabled: true,
  analysisIntervalMs: 60000, // 1 minute
  cacheExpiryMs: 30000,      // 30 seconds
  maxRetries: 2
};

/**
 * AI-powered market analyzer using Claude
 */
export class MarketAnalyzer {
  private config: AnalyzerConfig;
  private analysisCache: Map<string, { analysis: MarketAnalysis; timestamp: Date }> = new Map();
  private lastAnalysisTime: Map<string, Date> = new Map();

  constructor(config?: Partial<AnalyzerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the analyzer
   */
  initialize(apiKey?: string): void {
    if (this.config.enabled) {
      claudeClient.initialize(apiKey);
      logger.info('Market Analyzer initialized');
    }
  }

  /**
   * Check if the analyzer is ready
   */
  isReady(): boolean {
    return this.config.enabled && claudeClient.isReady();
  }

  /**
   * Analyze market conditions for a symbol
   */
  async analyzeMarket(symbol: string): Promise<MarketAnalysis> {
    if (!this.isReady()) {
      return this.getDefaultAnalysis();
    }

    // Check cache
    const cached = this.analysisCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.config.cacheExpiryMs) {
      return cached.analysis;
    }

    try {
      // Gather market data
      const market = dexapi.getMarketBySymbol(symbol);
      const orderbook = await dexapi.fetchOrderBook(symbol, 10);
      const trades = await dexapi.fetchTrades(symbol, 20);
      const price = await dexapi.fetchLatestPrice(symbol);

      const highestBid = orderbook.bids.length > 0 ? orderbook.bids[0].level : price;
      const lowestAsk = orderbook.asks.length > 0 ? orderbook.asks[0].level : price;
      const spread = lowestAsk - highestBid;
      const spreadBps = price > 0 ? (spread / price) * 10000 : 0;

      // Calculate depths (using count as proxy for quantity at level)
      const bidDepth = orderbook.bids.slice(0, 5).reduce((sum, b) => sum + b.count, 0);
      const askDepth = orderbook.asks.slice(0, 5).reduce((sum, a) => sum + a.count, 0);

      // Format recent trades
      const recentTrades = trades.slice(0, 10).map(t => ({
        price: t.price,
        quantity: t.bid_amount || t.ask_amount || 0,
        side: t.order_side === 0 ? 'BUY' : 'SELL'
      }));

      // Build prompt
      const prompt = buildMarketAnalysisPrompt({
        symbol,
        currentPrice: price,
        highestBid,
        lowestAsk,
        spread,
        spreadBps,
        bidDepth,
        askDepth,
        recentTrades
      });

      // Get Claude analysis
      const analysis = await claudeClient.analyzeJSON<MarketAnalysis>(
        prompt,
        SYSTEM_PROMPTS.MARKET_ANALYZER
      );

      const result: MarketAnalysis = {
        ...analysis,
        timestamp: new Date()
      };

      // Cache result
      this.analysisCache.set(symbol, { analysis: result, timestamp: new Date() });
      this.lastAnalysisTime.set(symbol, new Date());

      logger.info(`Market analysis for ${symbol}: ${result.marketCondition}, sentiment: ${result.sentiment}`);

      return result;

    } catch (error) {
      logger.error(`Market analysis failed for ${symbol}:`, error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Get spread optimization recommendation
   */
  async optimizeSpread(params: {
    symbol: string;
    currentSpreadBps: number;
    volatilityHourly: number;
    volatilityDaily: number;
    averageTradeSize: number;
    bidAskImbalance: number;
    positionSize: number;
    positionSide: 'LONG' | 'SHORT' | 'NEUTRAL';
    targetProfitBps: number;
  }): Promise<SpreadRecommendation> {
    if (!this.isReady()) {
      return this.getDefaultSpreadRecommendation(params.currentSpreadBps);
    }

    try {
      const prompt = buildSpreadOptimizationPrompt(params);
      const recommendation = await claudeClient.analyzeJSON<SpreadRecommendation>(
        prompt,
        SYSTEM_PROMPTS.SPREAD_OPTIMIZER
      );

      logger.info(`Spread recommendation for ${params.symbol}: ${recommendation.recommendedSpreadBps} bps`);

      return recommendation;

    } catch (error) {
      logger.error('Spread optimization failed:', error);
      return this.getDefaultSpreadRecommendation(params.currentSpreadBps);
    }
  }

  /**
   * Get inventory management recommendation
   */
  async analyzeInventory(params: {
    symbol: string;
    baseBalance: number;
    quoteBalance: number;
    baseValueUSD: number;
    quoteValueUSD: number;
    totalValueUSD: number;
    targetAllocation: number;
    currentAllocation: number;
    unrealizedPnL: number;
    recentPriceChange: number;
    marketTrend: 'UP' | 'DOWN' | 'SIDEWAYS';
  }): Promise<InventoryRecommendation> {
    if (!this.isReady()) {
      return this.getDefaultInventoryRecommendation();
    }

    try {
      const prompt = buildInventoryPrompt(params);
      const recommendation = await claudeClient.analyzeJSON<InventoryRecommendation>(
        prompt,
        SYSTEM_PROMPTS.INVENTORY_MANAGER
      );

      logger.info(`Inventory recommendation for ${params.symbol}: ${recommendation.action}`);

      return recommendation;

    } catch (error) {
      logger.error('Inventory analysis failed:', error);
      return this.getDefaultInventoryRecommendation();
    }
  }

  /**
   * Evaluate a proposed trade
   */
  async evaluateTrade(params: {
    symbol: string;
    orderSide: 'BUY' | 'SELL';
    orderSize: number;
    orderPrice: number;
    currentPrice: number;
    spreadBps: number;
    positionSize: number;
    positionPnL: number;
    marketCondition: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<TradeDecision> {
    if (!this.isReady()) {
      return { decision: 'APPROVE', confidence: 0.5, riskWarnings: [], reasoning: 'AI unavailable' };
    }

    try {
      const prompt = buildTradeDecisionPrompt(params);
      const decision = await claudeClient.analyzeJSON<TradeDecision>(
        prompt,
        SYSTEM_PROMPTS.MARKET_ANALYZER
      );

      return decision;

    } catch (error) {
      logger.error('Trade evaluation failed:', error);
      return { decision: 'APPROVE', confidence: 0.5, riskWarnings: [], reasoning: 'AI evaluation failed' };
    }
  }

  /**
   * Generate human-readable reasoning for a trade
   */
  async generateTradeReasoning(trade: {
    symbol: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    marketCondition: string;
    spreadBps: number;
    inventorySkew: number;
    sentiment: string;
  }): Promise<string> {
    if (!this.isReady()) {
      return `${trade.side} ${trade.size} ${trade.symbol} @ ${trade.price} - Market making order`;
    }

    try {
      const prompt = buildTradeReasoningPrompt(trade);
      const response = await claudeClient.analyze(prompt, SYSTEM_PROMPTS.MARKET_ANALYZER);
      return response.content.trim();

    } catch (error) {
      logger.error('Trade reasoning generation failed:', error);
      return `${trade.side} ${trade.size} ${trade.symbol} @ ${trade.price}`;
    }
  }

  /**
   * Get cached analysis for a symbol
   */
  getCachedAnalysis(symbol: string): MarketAnalysis | null {
    const cached = this.analysisCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.config.cacheExpiryMs) {
      return cached.analysis;
    }
    return null;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.lastAnalysisTime.clear();
  }

  /**
   * Get default analysis when AI is unavailable
   */
  private getDefaultAnalysis(): MarketAnalysis {
    return {
      marketCondition: 'CALM',
      sentiment: 'NEUTRAL',
      sentimentScore: 0,
      volatilityLevel: 'MEDIUM',
      orderbookImbalance: 0,
      recommendedAction: 'HOLD',
      spreadAdjustmentBps: 0,
      confidenceScore: 0.5,
      reasoning: 'Default analysis - AI unavailable',
      timestamp: new Date()
    };
  }

  /**
   * Get default spread recommendation
   */
  private getDefaultSpreadRecommendation(currentSpread: number): SpreadRecommendation {
    return {
      recommendedSpreadBps: currentSpread,
      minSpreadBps: currentSpread * 0.5,
      maxSpreadBps: currentSpread * 2,
      bidSkewBps: 0,
      askSkewBps: 0,
      orderSizeMultiplier: 1.0,
      refreshIntervalMs: 30000,
      reasoning: 'Default recommendation - AI unavailable'
    };
  }

  /**
   * Get default inventory recommendation
   */
  private getDefaultInventoryRecommendation(): InventoryRecommendation {
    return {
      action: 'HOLD',
      urgency: 'LOW',
      targetBaseAllocation: 0.5,
      rebalanceAmount: 0,
      maxSlippageBps: 50,
      skewDirection: 'NEUTRAL',
      reasoning: 'Default recommendation - AI unavailable'
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const marketAnalyzer = new MarketAnalyzer();
