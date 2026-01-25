export {
  claudeClient,
  ClaudeClient,
  type ClaudeConfig,
  type AnalysisResponse
} from './claude-client.js';

export {
  marketAnalyzer,
  MarketAnalyzer,
  type MarketAnalysis,
  type SpreadRecommendation,
  type InventoryRecommendation,
  type TradeDecision,
  type AnalyzerConfig
} from './market-analyzer.js';

export {
  SYSTEM_PROMPTS,
  buildMarketAnalysisPrompt,
  buildSpreadOptimizationPrompt,
  buildInventoryPrompt,
  buildTradeDecisionPrompt,
  buildTradeReasoningPrompt
} from './prompts.js';
