/**
 * Claude-Powered Market Scanner
 *
 * Scans all markets for arbitrage opportunities including:
 * - Simple two-venue arbitrage (DEX ↔ AMM)
 * - Triangular arbitrage (A → B → C → A)
 * - Multi-hop opportunities
 *
 * Uses Claude to analyze and explain opportunities concisely.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';

const logger = getLogger();

interface PoolState {
  symbol: string;
  token1: { symbol: string; amount: number; contract: string };
  token2: { symbol: string; amount: number; contract: string };
  price: number;  // token2 per token1 (reserve ratio)
  fee: number;    // in BPS
  amplifier: number;  // StableSwap amplifier (0 = constant product)
}

interface DEXOrder {
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
}

interface MarketState {
  pools: PoolState[];
  dexOrderbooks: Map<string, { bids: DEXOrder[]; asks: DEXOrder[] }>;
  treasuryRate: number;  // XMD:XUSDC rate (should be 1:1)
  timestamp: Date;
}

interface ArbitrageOpportunity {
  type: 'simple' | 'triangular' | 'multi-hop';
  path: string[];
  profitBPS: number;
  profitUSD: number;
  optimalSize: number;
  explanation: string;
  risk: 'low' | 'medium' | 'high';
}

interface MarketSummary {
  timestamp: Date;
  xprPrice: number;
  topOpportunities: ArbitrageOpportunity[];
  marketConditions: string;
  recommendation: string;
}

// AMM pools to monitor - HIGH LIQUIDITY ONLY (>$10k USD)
const POOLS_TO_MONITOR = [
  // Tier 1: >$1M liquidity
  'XPRUSDC',   // 509M XPR + $1.57M XUSDC = ~$3.1M
  'METAXMD',   // 4.58M METAL + $720k XMD = ~$1.4M
  'METAXPR',   // 7.56M METAL + 385M XPR = ~$1.2M

  // Tier 2: >$50k liquidity
  'XPRXMT',    // 8.87M XPR + 74k XMT = ~$55k
  'SNIPSXP',   // 57M XPR side = ~$175k
  'XPRLOAN',   // 447M XPR side = ~$1.4M (but LOAN liquidity unclear)

  // Tier 3: $10k-50k liquidity (still tradeable)
  'XPRDOGE',   // 1.4M XPR = ~$4.5k
  'BTCUSDC',   // $1.3k + BTC = ~$2.6k
  'ETHUSDC',   // $1.4k + ETH = ~$2.8k
  'XMTUSDC',   // XMT + $500 = ~$1k
  'USDTUSD',   // Stablecoin pool - check for depeg arb!
];

// DEX markets to monitor
const DEX_MARKETS = [
  { symbol: 'XPR_XMD', marketId: 1 },
  { symbol: 'XBTC_XMD', marketId: 2 },
  { symbol: 'XETH_XMD', marketId: 3 },
  { symbol: 'XMT_XMD', marketId: 7 },
  { symbol: 'METAL_XMD', marketId: 10 },
];

// Triangular paths to check - HIGH LIQUIDITY PATHS ONLY
const TRIANGULAR_PATHS = [
  // HIGH LIQUIDITY XPR triangles (all pools >$50k)
  ['XPR', 'XUSDC', 'XMT', 'XPR'],      // XPRUSDC($3M) → XMTUSDC → XPRXMT($55k)
  ['XPR', 'XMT', 'XUSDC', 'XPR'],      // Reverse direction
  ['XPR', 'METAL', 'XMD', 'XPR'],      // METAXPR($1.2M) → METAXMD($1.4M) → DEX

  // METAL triangles (all high liquidity)
  ['METAL', 'XPR', 'XUSDC', 'METAL'],  // via METAXPR → XPRUSDC
  ['METAL', 'XMD', 'XPR', 'METAL'],    // via METAXMD → DEX → METAXPR

  // XPR ↔ SNIPS ↔ ? (high XPR liquidity)
  ['XPR', 'SNIPS', 'XPR'],             // Check for pool imbalance

  // Treasury-based triangles (XMD ↔ XUSDC 1:1)
  ['XPR', 'XMD', 'XUSDC', 'XPR'],      // DEX XPR_XMD → Treasury → XPRUSDC AMM
  ['XPR', 'XUSDC', 'XMD', 'XPR'],      // Reverse: AMM → Treasury → DEX
];

export class MarketScanner {
  private anthropic: Anthropic | null = null;
  private rpc: any;
  private lastSummary: MarketSummary | null = null;
  private scanInterval: NodeJS.Timeout | null = null;
  private summaryInterval: NodeJS.Timeout | null = null;

  constructor() {
    const config = getConfig();

    // Initialize Claude if API key available
    const apiKey = process.env.ANTHROPIC_API_KEY || (config as any).claude?.apiKey;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      logger.info('Claude AI market analyzer initialized');
    } else {
      logger.warn('No Claude API key - running without AI analysis');
    }
  }

  async initialize(): Promise<void> {
    const { JsonRpc } = await import('@proton/js');
    const config = getConfig();
    this.rpc = new JsonRpc(config.rpc.endpoints);
    logger.info('Market scanner initialized');
  }

  /**
   * Start continuous scanning
   */
  startScanning(scanIntervalMs: number = 30000, summaryIntervalMs: number = 300000): void {
    // Scan for opportunities
    this.scanInterval = setInterval(() => this.scan(), scanIntervalMs);

    // Send periodic summaries
    this.summaryInterval = setInterval(() => this.sendSummary(), summaryIntervalMs);

    // Initial scan
    this.scan();

    logger.info(`Market scanner started: scanning every ${scanIntervalMs/1000}s, summaries every ${summaryIntervalMs/1000}s`);
  }

  stopScanning(): void {
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.summaryInterval) clearInterval(this.summaryInterval);
    logger.info('Market scanner stopped');
  }

  /**
   * Main scan function
   */
  async scan(): Promise<ArbitrageOpportunity[]> {
    try {
      // 1. Fetch all market data
      const marketState = await this.fetchMarketState();

      // 2. Find all opportunities
      const opportunities: ArbitrageOpportunity[] = [];

      // Simple DEX ↔ AMM arbitrage
      const simpleOpps = this.findSimpleArbitrage(marketState);
      opportunities.push(...simpleOpps);

      // Triangular arbitrage
      const triangularOpps = this.findTriangularArbitrage(marketState);
      opportunities.push(...triangularOpps);

      // Sort by profit
      opportunities.sort((a, b) => b.profitBPS - a.profitBPS);

      // If any opportunity found, alert immediately (no gas = every BPS counts!)
      const significantOpps = opportunities.filter(o => o.profitBPS >= 5);
      if (significantOpps.length > 0) {
        await this.alertOpportunity(significantOpps[0], marketState);
      }

      // Store for summary
      this.updateSummary(marketState, opportunities);

      return opportunities;

    } catch (error) {
      logger.error('Scan error:', error);
      return [];
    }
  }

  /**
   * Fetch current market state
   */
  private async fetchMarketState(): Promise<MarketState> {
    // Fetch AMM pools
    const poolsResult = await this.rpc.get_table_rows({
      code: 'proton.swaps',
      scope: 'proton.swaps',
      table: 'pools',
      limit: 100,
      json: true
    });

    const pools: PoolState[] = [];
    for (const row of poolsResult.rows) {
      const symbol = row.lt_symbol.split(',')[1];
      if (!POOLS_TO_MONITOR.includes(symbol)) continue;

      const p1Parts = row.pool1.quantity.split(' ');
      const p2Parts = row.pool2.quantity.split(' ');

      const amount1 = parseFloat(p1Parts[0]);
      const amount2 = parseFloat(p2Parts[0]);

      if (amount1 === 0 || amount2 === 0) continue;

      pools.push({
        symbol,
        token1: { symbol: p1Parts[1], amount: amount1, contract: row.pool1.contract },
        token2: { symbol: p2Parts[1], amount: amount2, contract: row.pool2.contract },
        price: amount2 / amount1,
        fee: row.fee?.exchange_fee || 20,  // Default 0.2%
        amplifier: row.amplifier || 0  // 0 = constant product, >0 = StableSwap
      });
    }

    // Fetch DEX orderbooks
    const dexOrderbooks = new Map<string, { bids: DEXOrder[]; asks: DEXOrder[] }>();

    const orderbookResult = await this.rpc.get_table_rows({
      code: 'dex',
      scope: 'dex',
      table: 'orderbook',
      limit: 500,
      json: true
    });

    for (const market of DEX_MARKETS) {
      const marketOrders = orderbookResult.rows.filter((o: any) => o.market_id === market.marketId);

      const bids: DEXOrder[] = [];
      const asks: DEXOrder[] = [];

      for (const order of marketOrders) {
        const dexOrder: DEXOrder = {
          price: order.price / 1000000,
          quantity: order.quantity / 10000,
          side: order.order_side === 1 ? 'BUY' : 'SELL'
        };

        if (dexOrder.side === 'BUY') bids.push(dexOrder);
        else asks.push(dexOrder);
      }

      bids.sort((a, b) => b.price - a.price);
      asks.sort((a, b) => a.price - b.price);

      dexOrderbooks.set(market.symbol, { bids, asks });
    }

    return {
      pools,
      dexOrderbooks,
      treasuryRate: 1.0,  // XMD:XUSDC is always 1:1
      timestamp: new Date()
    };
  }

  /**
   * Find simple two-venue arbitrage
   */
  private findSimpleArbitrage(state: MarketState): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // XPR: DEX (XPR_XMD) vs AMM (XPRUSDC)
    const xprPool = state.pools.find(p => p.symbol === 'XPRUSDC');
    const xprDex = state.dexOrderbooks.get('XPR_XMD');

    if (xprPool && xprDex) {
      const ammPrice = xprPool.price;  // XUSDC per XPR
      const ammFee = xprPool.fee / 10000;

      // DEX → AMM: Buy on DEX, sell to AMM
      if (xprDex.asks.length > 0) {
        const dexAsk = xprDex.asks[0].price;  // XMD per XPR (≈ XUSDC via treasury)
        const ammSellPrice = ammPrice * (1 - ammFee);

        if (ammSellPrice > dexAsk) {
          const profitBPS = ((ammSellPrice - dexAsk) / dexAsk) * 10000;
          opportunities.push({
            type: 'simple',
            path: ['XUSDC', 'XMD', 'XPR', 'XUSDC'],
            profitBPS: Math.round(profitBPS),
            profitUSD: (ammSellPrice - dexAsk) * Math.min(xprDex.asks[0].quantity, 10000),
            optimalSize: Math.min(xprDex.asks[0].quantity, 10000),
            explanation: `Buy XPR on DEX @ ${dexAsk.toFixed(6)}, sell to AMM @ ${ammSellPrice.toFixed(6)}`,
            risk: 'low'
          });
        }
      }

      // AMM → DEX: Buy from AMM, sell on DEX
      if (xprDex.bids.length > 0) {
        const dexBid = xprDex.bids[0].price;
        const ammBuyPrice = ammPrice * (1 + ammFee);

        if (dexBid > ammBuyPrice) {
          const profitBPS = ((dexBid - ammBuyPrice) / ammBuyPrice) * 10000;
          opportunities.push({
            type: 'simple',
            path: ['XUSDC', 'XPR', 'XMD', 'XUSDC'],
            profitBPS: Math.round(profitBPS),
            profitUSD: (dexBid - ammBuyPrice) * Math.min(xprDex.bids[0].quantity, 10000),
            optimalSize: Math.min(xprDex.bids[0].quantity, 10000),
            explanation: `Buy XPR from AMM @ ${ammBuyPrice.toFixed(6)}, sell on DEX @ ${dexBid.toFixed(6)}`,
            risk: 'low'
          });
        }
      }
    }

    // STABLECOIN ARB: XUSDT/XUSDC pool
    const stablePool = state.pools.find(p => p.symbol === 'USDTUSD');
    if (stablePool) {
      // Check if this is a StableSwap pool (amplifier > 0)
      if (stablePool.amplifier > 0) {
        // StableSwap: Effective swap rate stays ~1:1 regardless of reserve ratio
        // The amplifier (A=5000) flattens the curve near peg
        // Only flag if ACTUAL effective rate deviates, not just reserve ratio
        // For high A, effective rate ≈ 1 - (dx / (2 * min(x,y) * A))
        // This means even with 5:1 reserve ratio, swap rate is ~0.9999:1

        // Skip false positives - StableSwap pools maintain parity by design
        // Real arbitrage would require external price reference showing actual depeg
        logger.debug?.(`USDTUSD is StableSwap (A=${stablePool.amplifier}) - reserve ratio ${stablePool.price.toFixed(4)} does NOT indicate arb opportunity`);
      } else {
        // Constant product pool: reserve ratio = effective price
        const usdtPrice = stablePool.price;  // XUSDC per XUSDT
        const deviation = Math.abs(1 - usdtPrice);

        if (deviation > 0.001) {  // > 0.1% from peg
          const profitBPS = deviation * 10000;
          const direction = usdtPrice > 1 ? 'Sell XUSDT for XUSDC' : 'Buy XUSDT with XUSDC';

          opportunities.push({
            type: 'simple',
            path: usdtPrice > 1 ? ['XUSDT', 'XUSDC'] : ['XUSDC', 'XUSDT'],
            profitBPS: Math.round(profitBPS),
            profitUSD: deviation * 100,  // Per $100
            optimalSize: Math.min(stablePool.token1.amount, stablePool.token2.amount) * 0.1,
            explanation: `Stablecoin depeg: XUSDT @ ${usdtPrice.toFixed(4)} XUSDC. ${direction}`,
            risk: 'low'
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Find triangular arbitrage opportunities
   */
  private findTriangularArbitrage(state: MarketState): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // Helper to get pool price
    const getPoolPrice = (from: string, to: string): number | null => {
      for (const pool of state.pools) {
        if (pool.token1.symbol === from && pool.token2.symbol === to) {
          return pool.price * (1 - pool.fee / 10000);  // Subtract fee
        }
        if (pool.token2.symbol === from && pool.token1.symbol === to) {
          return (1 / pool.price) * (1 - pool.fee / 10000);
        }
      }
      return null;
    };

    // Check XPR → XUSDC → XMT → XPR triangle
    const xprToUsdc = getPoolPrice('XPR', 'XUSDC');
    const usdcToXmt = getPoolPrice('XUSDC', 'XMT');
    const xmtToXpr = getPoolPrice('XMT', 'XPR');

    if (xprToUsdc && usdcToXmt && xmtToXpr) {
      // Start with 1 XPR, end with ? XPR
      const endAmount = 1 * xprToUsdc * usdcToXmt * xmtToXpr;
      const profitBPS = (endAmount - 1) * 10000;

      if (profitBPS > 1) {  // At least 0.01% profit - ultra thin margins, no gas!
        opportunities.push({
          type: 'triangular',
          path: ['XPR', 'XUSDC', 'XMT', 'XPR'],
          profitBPS: Math.round(profitBPS),
          profitUSD: profitBPS / 100 * 0.00309 * 10000,  // Assuming $0.00309/XPR, 10k XPR
          optimalSize: 10000,
          explanation: `XPR→XUSDC→XMT→XPR: 1 XPR becomes ${endAmount.toFixed(6)} XPR`,
          risk: 'medium'
        });
      }
    }

    // Check XPR → XBTC → XUSDC → XPR triangle
    const xprToBtc = getPoolPrice('XPR', 'XBTC');
    const btcToUsdc = getPoolPrice('XBTC', 'XUSDC');
    const usdcToXpr = getPoolPrice('XUSDC', 'XPR');

    if (xprToBtc && btcToUsdc && usdcToXpr) {
      const endAmount = 1 * xprToBtc * btcToUsdc * usdcToXpr;
      const profitBPS = (endAmount - 1) * 10000;

      if (profitBPS > 1) {
        opportunities.push({
          type: 'triangular',
          path: ['XPR', 'XBTC', 'XUSDC', 'XPR'],
          profitBPS: Math.round(profitBPS),
          profitUSD: profitBPS / 100 * 0.00309 * 10000,
          optimalSize: 10000,
          explanation: `XPR→XBTC→XUSDC→XPR: 1 XPR becomes ${endAmount.toFixed(6)} XPR`,
          risk: 'medium'
        });
      }
    }

    // Check reverse directions too
    if (xprToUsdc && usdcToXmt && xmtToXpr) {
      const reverseXprToXmt = getPoolPrice('XPR', 'XMT');
      const reverseXmtToUsdc = getPoolPrice('XMT', 'XUSDC');
      const reverseUsdcToXpr = getPoolPrice('XUSDC', 'XPR');

      if (reverseXprToXmt && reverseXmtToUsdc && reverseUsdcToXpr) {
        const endAmount = 1 * reverseXprToXmt * reverseXmtToUsdc * reverseUsdcToXpr;
        const profitBPS = (endAmount - 1) * 10000;

        if (profitBPS > 1) {
          opportunities.push({
            type: 'triangular',
            path: ['XPR', 'XMT', 'XUSDC', 'XPR'],
            profitBPS: Math.round(profitBPS),
            profitUSD: profitBPS / 100 * 0.00309 * 10000,
            optimalSize: 10000,
            explanation: `XPR→XMT→XUSDC→XPR: 1 XPR becomes ${endAmount.toFixed(6)} XPR (reverse)`,
            risk: 'medium'
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Alert about significant opportunity
   */
  private async alertOpportunity(opp: ArbitrageOpportunity, state: MarketState): Promise<void> {
    let analysis = '';

    // Use Claude for analysis if available
    if (this.anthropic) {
      try {
        analysis = await this.getClaudeAnalysis(opp, state);
      } catch (e) {
        logger.error('Claude analysis failed:', e);
        analysis = opp.explanation;
      }
    } else {
      analysis = opp.explanation;
    }

    const emoji = opp.profitBPS >= 100 ? '🚨' : opp.profitBPS >= 50 ? '⚡' : '📊';

    const message = `${emoji} *Arbitrage Found*

Type: ${opp.type}
Path: ${opp.path.join(' → ')}
Profit: ${opp.profitBPS} BPS (~$${opp.profitUSD.toFixed(2)})
Risk: ${opp.risk}

${analysis}`;

    await telegramNotifier.notify(message, 'high');
  }

  /**
   * Get Claude's analysis of an opportunity
   */
  private async getClaudeAnalysis(opp: ArbitrageOpportunity, state: MarketState): Promise<string> {
    if (!this.anthropic) return opp.explanation;

    const poolData = state.pools.map(p => {
      const poolType = p.amplifier > 0 ? `StableSwap A=${p.amplifier}` : 'ConstantProduct';
      return `${p.symbol}: ${p.token1.amount.toFixed(2)} ${p.token1.symbol} / ${p.token2.amount.toFixed(2)} ${p.token2.symbol} (ratio: ${p.price.toFixed(8)}, type: ${poolType})`;
    }).join('\n');

    const prompt = `You are a DeFi arbitrage analyst. Analyze this opportunity concisely (max 100 words):

Opportunity:
- Type: ${opp.type}
- Path: ${opp.path.join(' → ')}
- Profit: ${opp.profitBPS} basis points
- Explanation: ${opp.explanation}

Current pool states:
${poolData}

NOTE: For StableSwap pools (A>0), the reserve ratio does NOT equal swap rate. High amplifiers keep effective rates near 1:1 regardless of reserve imbalance.

Provide:
1. Quick assessment (1 sentence)
2. Key risk (1 sentence)
3. Recommendation: Execute/Wait/Skip`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    return (response.content[0] as any).text;
  }

  /**
   * Update running summary
   */
  private updateSummary(state: MarketState, opportunities: ArbitrageOpportunity[]): void {
    const xprPool = state.pools.find(p => p.symbol === 'XPRUSDC');

    this.lastSummary = {
      timestamp: new Date(),
      xprPrice: xprPool?.price || 0,
      topOpportunities: opportunities.slice(0, 5),
      marketConditions: opportunities.length > 0 ? 'Active' : 'Quiet',
      recommendation: opportunities.some(o => o.profitBPS >= 50) ? 'Execute' : 'Monitor'
    };
  }

  /**
   * Send periodic summary via Telegram
   */
  async sendSummary(): Promise<void> {
    if (!this.lastSummary) return;

    const summary = this.lastSummary;
    let summaryText = `📊 *Market Summary*

🕐 ${summary.timestamp.toLocaleTimeString()}
💰 XPR: $${summary.xprPrice.toFixed(6)}
📈 Conditions: ${summary.marketConditions}
🎯 Recommendation: ${summary.recommendation}

*Active Routes Monitored:*
• Triangle: XPR↔XMD↔XUSDC (AMM/DEX/Treasury)
• METAL Bridge: XPR→METAL→XMD→XUSDC→XPR
• LOAN Bridge: XPR→LOAN→XMD→XUSDC→XPR
• METAL Direct: METAXPR(AMM) vs METAL_XMD(DEX)

*Top Opportunities:*`;

    if (summary.topOpportunities.length === 0) {
      summaryText += '\nNo significant opportunities found.';
    } else {
      for (const opp of summary.topOpportunities.slice(0, 3)) {
        summaryText += `\n• ${opp.path.join('→')}: ${opp.profitBPS} BPS`;
      }
    }

    // Get Claude's market overview if available
    if (this.anthropic && summary.topOpportunities.length > 0) {
      try {
        const overview = await this.getMarketOverview(summary);
        summaryText += `\n\n*AI Analysis:*\n${overview}`;
      } catch (e) {
        // Skip AI analysis on error
      }
    }

    await telegramNotifier.notify(summaryText, 'normal');
  }

  /**
   * Get Claude's market overview
   */
  private async getMarketOverview(summary: MarketSummary): Promise<string> {
    if (!this.anthropic) return '';

    const prompt = `As a DeFi analyst, give a 50-word market overview:

XPR Price: $${summary.xprPrice.toFixed(6)}
Top opportunities: ${summary.topOpportunities.map(o => `${o.path.join('→')} (${o.profitBPS}bps)`).join(', ') || 'None'}

Be concise. Focus on: market efficiency, opportunity quality, recommended action.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    });

    return (response.content[0] as any).text;
  }
}

// Singleton export
export const marketScanner = new MarketScanner();
