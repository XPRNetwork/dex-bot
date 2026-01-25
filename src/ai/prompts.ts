/**
 * AI Prompt Templates for Market Analysis
 *
 * These prompts are designed to get structured, actionable insights from Claude
 * for the adaptive market maker strategy.
 */

export const SYSTEM_PROMPTS = {
  /**
   * System prompt for market analysis
   */
  MARKET_ANALYZER: `You are an expert quantitative trader and market analyst for cryptocurrency markets.
You analyze orderbook data, price movements, and market conditions to provide actionable trading insights.

Your analysis should be:
- Objective and data-driven
- Focused on short-term (minutes to hours) market dynamics
- Practical for market making strategies
- Risk-aware

Always provide your response in the exact JSON format requested.`,

  /**
   * System prompt for spread optimization
   */
  SPREAD_OPTIMIZER: `You are a market making specialist focused on spread optimization.
You analyze market microstructure to recommend optimal bid-ask spreads that balance profitability with fill probability.

Consider:
- Current market volatility
- Orderbook depth and imbalance
- Recent price momentum
- Liquidity conditions

Always provide your response in the exact JSON format requested.`,

  /**
   * System prompt for inventory management
   */
  INVENTORY_MANAGER: `You are an inventory risk manager for a market making operation.
You analyze position exposure and market conditions to recommend inventory adjustments.

Focus on:
- Position size relative to market depth
- Directional risk
- Rebalancing opportunities
- Risk mitigation strategies

Always provide your response in the exact JSON format requested.`
};

/**
 * Build a market analysis prompt
 */
export function buildMarketAnalysisPrompt(data: {
  symbol: string;
  currentPrice: number;
  highestBid: number;
  lowestAsk: number;
  spread: number;
  spreadBps: number;
  bidDepth: number;
  askDepth: number;
  recentTrades: { price: number; quantity: number; side: string }[];
  priceChange24h?: number;
  volume24h?: number;
}): string {
  const recentTradesStr = data.recentTrades
    .slice(0, 10)
    .map(t => `  - ${t.side.toUpperCase()} ${t.quantity} @ ${t.price}`)
    .join('\n');

  return `Analyze the following market data for ${data.symbol} and provide trading insights:

## Current Market State
- Current Price: ${data.currentPrice}
- Highest Bid: ${data.highestBid}
- Lowest Ask: ${data.lowestAsk}
- Spread: ${data.spread} (${data.spreadBps.toFixed(2)} bps)
- Bid Depth (top 5): ${data.bidDepth}
- Ask Depth (top 5): ${data.askDepth}
${data.priceChange24h !== undefined ? `- 24h Price Change: ${data.priceChange24h.toFixed(2)}%` : ''}
${data.volume24h !== undefined ? `- 24h Volume: ${data.volume24h}` : ''}

## Recent Trades
${recentTradesStr}

## Analysis Required
Provide your analysis in the following JSON format:
{
  "marketCondition": "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "VOLATILE" | "CALM",
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "sentimentScore": <-1 to 1, where -1 is very bearish and 1 is very bullish>,
  "volatilityLevel": "LOW" | "MEDIUM" | "HIGH",
  "orderbookImbalance": <-1 to 1, where negative means more sell pressure>,
  "recommendedAction": "WIDEN_SPREAD" | "TIGHTEN_SPREAD" | "SKEW_BIDS" | "SKEW_ASKS" | "HOLD" | "REDUCE_EXPOSURE",
  "spreadAdjustmentBps": <suggested spread adjustment in basis points, positive to widen, negative to tighten>,
  "confidenceScore": <0 to 1>,
  "reasoning": "<brief explanation of your analysis>"
}`;
}

/**
 * Build a spread optimization prompt
 */
export function buildSpreadOptimizationPrompt(data: {
  symbol: string;
  currentSpreadBps: number;
  volatilityHourly: number;
  volatilityDaily: number;
  averageTradeSize: number;
  bidAskImbalance: number;
  positionSize: number;
  positionSide: 'LONG' | 'SHORT' | 'NEUTRAL';
  targetProfitBps: number;
}): string {
  return `Optimize the market making spread for ${data.symbol}:

## Current Settings
- Current Spread: ${data.currentSpreadBps} bps
- Target Profit per Trade: ${data.targetProfitBps} bps

## Market Metrics
- Hourly Volatility: ${(data.volatilityHourly * 100).toFixed(2)}%
- Daily Volatility: ${(data.volatilityDaily * 100).toFixed(2)}%
- Average Trade Size: ${data.averageTradeSize}
- Bid/Ask Imbalance: ${data.bidAskImbalance.toFixed(3)} (positive = more bids)

## Current Position
- Position Size: ${data.positionSize}
- Position Side: ${data.positionSide}

## Optimization Required
Provide your recommendation in the following JSON format:
{
  "recommendedSpreadBps": <optimal spread in basis points>,
  "minSpreadBps": <minimum acceptable spread>,
  "maxSpreadBps": <maximum spread before becoming uncompetitive>,
  "bidSkewBps": <additional spread to add to bid side, positive to widen>,
  "askSkewBps": <additional spread to add to ask side, positive to widen>,
  "orderSizeMultiplier": <1.0 = normal, <1.0 = smaller orders, >1.0 = larger orders>,
  "refreshIntervalMs": <suggested order refresh interval>,
  "reasoning": "<brief explanation of your recommendation>"
}`;
}

/**
 * Build an inventory management prompt
 */
export function buildInventoryPrompt(data: {
  symbol: string;
  baseBalance: number;
  quoteBalance: number;
  baseValueUSD: number;
  quoteValueUSD: number;
  totalValueUSD: number;
  targetAllocation: number; // 0.5 = 50% base, 50% quote
  currentAllocation: number;
  unrealizedPnL: number;
  recentPriceChange: number;
  marketTrend: 'UP' | 'DOWN' | 'SIDEWAYS';
}): string {
  return `Analyze inventory and provide rebalancing recommendations for ${data.symbol}:

## Current Inventory
- Base Token Balance: ${data.baseBalance} (~$${data.baseValueUSD.toFixed(2)})
- Quote Token Balance: ${data.quoteBalance} (~$${data.quoteValueUSD.toFixed(2)})
- Total Portfolio Value: $${data.totalValueUSD.toFixed(2)}
- Current Base Allocation: ${(data.currentAllocation * 100).toFixed(1)}%
- Target Base Allocation: ${(data.targetAllocation * 100).toFixed(1)}%

## Performance
- Unrealized P&L: $${data.unrealizedPnL.toFixed(2)}
- Recent Price Change: ${data.recentPriceChange.toFixed(2)}%
- Market Trend: ${data.marketTrend}

## Recommendation Required
Provide your recommendation in the following JSON format:
{
  "action": "REBALANCE" | "HOLD" | "REDUCE_BASE" | "INCREASE_BASE",
  "urgency": "LOW" | "MEDIUM" | "HIGH",
  "targetBaseAllocation": <recommended base allocation 0-1>,
  "rebalanceAmount": <amount of base token to buy (positive) or sell (negative)>,
  "maxSlippageBps": <maximum acceptable slippage for rebalance>,
  "skewDirection": "FAVOR_BIDS" | "FAVOR_ASKS" | "NEUTRAL",
  "reasoning": "<brief explanation of your recommendation>"
}`;
}

/**
 * Build a trade decision prompt
 */
export function buildTradeDecisionPrompt(data: {
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
}): string {
  return `Evaluate this potential trade for ${data.symbol}:

## Proposed Trade
- Side: ${data.orderSide}
- Size: ${data.orderSize}
- Price: ${data.orderPrice}
- Current Market Price: ${data.currentPrice}

## Market Context
- Spread: ${data.spreadBps} bps
- Market Condition: ${data.marketCondition}
- Risk Level: ${data.riskLevel}

## Current Position
- Position Size: ${data.positionSize}
- Position P&L: $${data.positionPnL.toFixed(2)}

## Decision Required
Should this trade be executed? Provide your decision in the following JSON format:
{
  "decision": "APPROVE" | "REJECT" | "MODIFY",
  "confidence": <0 to 1>,
  "suggestedPrice": <if MODIFY, suggested price>,
  "suggestedSize": <if MODIFY, suggested size>,
  "riskWarnings": [<array of any risk concerns>],
  "reasoning": "<brief explanation of your decision>"
}`;
}

/**
 * Build a reasoning log for a trade
 */
export function buildTradeReasoningPrompt(trade: {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  marketCondition: string;
  spreadBps: number;
  inventorySkew: number;
  sentiment: string;
}): string {
  return `Generate a human-readable explanation for this market making trade:

## Trade Details
- Symbol: ${trade.symbol}
- Side: ${trade.side}
- Size: ${trade.size}
- Price: ${trade.price}

## Market Context
- Market Condition: ${trade.marketCondition}
- Current Spread: ${trade.spreadBps} bps
- Inventory Skew: ${trade.inventorySkew.toFixed(2)} (positive = long bias)
- Market Sentiment: ${trade.sentiment}

Generate a brief (1-2 sentences) explanation of why this trade was placed, suitable for a trading log. Focus on the key factors that influenced the decision.`;
}
