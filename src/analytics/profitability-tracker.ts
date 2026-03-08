/**
 * Profitability Tracker
 *
 * Compares expected vs actual P&L for each trade to measure:
 * - Execution quality (slippage)
 * - Strategy accuracy (predicted vs realized profit)
 * - Cumulative performance over time
 */

import { JsonRpc } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';

const logger = getLogger();

// Delay for post-trade analysis (60 seconds)
const POST_TRADE_ANALYSIS_DELAY_MS = 60000;

interface BalanceSnapshot {
  XPR: number;
  XUSDC: number;
  XMD: number;
  LOAN: number;
  METAL: number;
}

interface TradeRecord {
  id: string;
  timestamp: Date;
  strategy: string;
  path: string;

  // Pre-trade expectations
  expectedProfitBps: number;
  expectedProfitUsd: number;
  expectedInputUsd: number;
  expectedOutputUsd: number;

  // Actual results (immediate)
  actualInputUsd: number;
  actualOutputUsd: number;
  actualProfitUsd: number;
  actualProfitBps: number;

  // Execution metrics
  slippageBps: number;
  executionQuality: number; // actual/expected ratio

  // Transaction IDs
  txIds: string[];

  // Status
  status: 'pending' | 'completed' | 'failed' | 'analyzed';
  error?: string;

  // Post-trade analysis (60s later)
  preTradeBalances?: BalanceSnapshot;
  postTradeBalances?: BalanceSnapshot;
  verifiedProfitUsd?: number;
  verifiedProfitBps?: number;
  balanceChanges?: {
    XPR: number;
    XUSDC: number;
    XMD: number;
    LOAN: number;
    METAL: number;
  };
  analysisTimestamp?: Date;
}

interface PortfolioSnapshot {
  timestamp: Date;
  balances: {
    XPR: number;
    XUSDC: number;
    XMD: number;
    LOAN: number;
    METAL: number;
  };
  totalValueUsd: number;
  prices: {
    XPR: number;
    LOAN: number;
    METAL: number;
  };
}

interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  winRate: number;

  totalExpectedProfitUsd: number;
  totalActualProfitUsd: number;
  profitAccuracy: number; // actual/expected ratio

  avgSlippageBps: number;
  maxSlippageBps: number;

  avgExecutionQuality: number;

  // Time-based metrics
  profitPerHour: number;
  tradesPerHour: number;

  // By strategy
  byStrategy: Map<string, {
    trades: number;
    profitUsd: number;
    avgSlippageBps: number;
  }>;
}

class ProfitabilityTracker {
  private rpc: JsonRpc;
  private username: string;
  private trades: TradeRecord[] = [];
  private snapshots: PortfolioSnapshot[] = [];
  private startTime: Date;
  private currentTradeId: number = 0;

  constructor() {
    const config = getConfig() as any;
    this.rpc = new JsonRpc(config.rpc?.endpoints || ['https://proton.eosusa.io']);
    this.username = process.env.PROTON_USERNAME || '';
    this.startTime = new Date();

    // Take initial snapshot
    this.takeSnapshot();

    // Take snapshots every 5 minutes
    setInterval(() => this.takeSnapshot(), 5 * 60 * 1000);

    logger.info('Profitability tracker initialized');
  }

  /**
   * Record expected trade before execution
   * Captures pre-trade balances for later verification
   */
  async startTrade(
    strategy: string,
    path: string,
    expectedProfitBps: number,
    expectedProfitUsd: number,
    expectedInputUsd: number
  ): Promise<string> {
    const id = `trade_${++this.currentTradeId}_${Date.now()}`;

    // Capture pre-trade balances
    const preTradeBalances = await this.fetchBalances();

    const trade: TradeRecord = {
      id,
      timestamp: new Date(),
      strategy,
      path,
      expectedProfitBps,
      expectedProfitUsd,
      expectedInputUsd,
      expectedOutputUsd: expectedInputUsd + expectedProfitUsd,
      actualInputUsd: 0,
      actualOutputUsd: 0,
      actualProfitUsd: 0,
      actualProfitBps: 0,
      slippageBps: 0,
      executionQuality: 0,
      txIds: [],
      status: 'pending',
      preTradeBalances
    };

    this.trades.push(trade);

    logger.info(`📊 [TRACKER] Trade started: ${id}`);
    logger.info(`   Strategy: ${strategy} | Path: ${path}`);
    logger.info(`   Expected: ${expectedProfitBps.toFixed(1)} BPS ($${expectedProfitUsd.toFixed(4)})`);
    logger.info(`   Pre-trade: XPR=${preTradeBalances.XPR.toFixed(2)} XUSDC=${preTradeBalances.XUSDC.toFixed(2)} XMD=${preTradeBalances.XMD.toFixed(2)}`);

    return id;
  }

  /**
   * Fetch current balances from chain
   */
  private async fetchBalances(): Promise<BalanceSnapshot> {
    try {
      const [xprBal, xtokensBal, loanBal, xmdBal] = await Promise.all([
        this.rpc.get_table_rows({ code: 'eosio.token', scope: this.username, table: 'accounts', json: true }),
        this.rpc.get_table_rows({ code: 'xtokens', scope: this.username, table: 'accounts', json: true }),
        this.rpc.get_table_rows({ code: 'loan.token', scope: this.username, table: 'accounts', json: true }),
        this.rpc.get_table_rows({ code: 'xmd.token', scope: this.username, table: 'accounts', json: true })
      ]);

      let xpr = 0, xusdc = 0, xmd = 0, loan = 0, metal = 0;

      for (const row of xprBal.rows) {
        if (row.balance?.includes('XPR')) xpr = parseFloat(row.balance);
      }
      for (const row of xtokensBal.rows) {
        if (row.balance?.includes('XUSDC')) xusdc = parseFloat(row.balance);
        if (row.balance?.includes('METAL')) metal = parseFloat(row.balance);
      }
      for (const row of loanBal.rows) {
        if (row.balance?.includes('LOAN')) loan = parseFloat(row.balance);
      }
      for (const row of xmdBal.rows) {
        if (row.balance?.includes('XMD')) xmd = parseFloat(row.balance);
      }

      return { XPR: xpr, XUSDC: xusdc, XMD: xmd, LOAN: loan, METAL: metal };
    } catch (error: any) {
      logger.error(`Failed to fetch balances: ${error.message}`);
      return { XPR: 0, XUSDC: 0, XMD: 0, LOAN: 0, METAL: 0 };
    }
  }

  /**
   * Record actual results after execution
   * Schedules post-trade analysis for 60 seconds later
   */
  completeTrade(
    tradeId: string,
    actualInputUsd: number,
    actualOutputUsd: number,
    txIds: string[]
  ): void {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) {
      logger.warn(`Trade ${tradeId} not found`);
      return;
    }

    trade.actualInputUsd = actualInputUsd;
    trade.actualOutputUsd = actualOutputUsd;
    trade.actualProfitUsd = actualOutputUsd - actualInputUsd;
    trade.actualProfitBps = (trade.actualProfitUsd / actualInputUsd) * 10000;
    trade.slippageBps = trade.expectedProfitBps - trade.actualProfitBps;
    trade.executionQuality = trade.expectedProfitUsd !== 0
      ? trade.actualProfitUsd / trade.expectedProfitUsd
      : 0;
    trade.txIds = txIds;
    trade.status = 'completed';

    const emoji = trade.actualProfitUsd >= 0 ? '✅' : '❌';
    logger.info(`${emoji} [TRACKER] Trade completed: ${tradeId}`);
    logger.info(`   Expected: ${trade.expectedProfitBps.toFixed(1)} BPS ($${trade.expectedProfitUsd.toFixed(4)})`);
    logger.info(`   Actual:   ${trade.actualProfitBps.toFixed(1)} BPS ($${trade.actualProfitUsd.toFixed(4)})`);
    logger.info(`   Slippage: ${trade.slippageBps.toFixed(1)} BPS | Execution: ${(trade.executionQuality * 100).toFixed(0)}%`);

    // Schedule post-trade analysis for 60 seconds later
    logger.info(`   ⏱️ Post-trade analysis scheduled in ${POST_TRADE_ANALYSIS_DELAY_MS / 1000}s`);
    setTimeout(() => this.runPostTradeAnalysis(tradeId), POST_TRADE_ANALYSIS_DELAY_MS);
  }

  /**
   * Run post-trade analysis after delay
   * Compares pre-trade vs current balances to verify actual profit
   */
  private async runPostTradeAnalysis(tradeId: string): Promise<void> {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) {
      logger.warn(`Trade ${tradeId} not found for post-trade analysis`);
      return;
    }

    if (!trade.preTradeBalances) {
      logger.warn(`Trade ${tradeId} missing pre-trade balances`);
      return;
    }

    try {
      logger.info(`📊 [ANALYSIS] Running post-trade analysis for ${tradeId}...`);

      // Fetch current balances
      const postTradeBalances = await this.fetchBalances();
      trade.postTradeBalances = postTradeBalances;
      trade.analysisTimestamp = new Date();

      // Calculate balance changes
      const pre = trade.preTradeBalances;
      const post = postTradeBalances;

      trade.balanceChanges = {
        XPR: post.XPR - pre.XPR,
        XUSDC: post.XUSDC - pre.XUSDC,
        XMD: post.XMD - pre.XMD,
        LOAN: post.LOAN - pre.LOAN,
        METAL: post.METAL - pre.METAL
      };

      // Get current prices for USD conversion
      const prices = await this.fetchPrices();

      // Calculate verified profit in USD
      const changes = trade.balanceChanges;
      trade.verifiedProfitUsd =
        changes.XPR * prices.XPR +
        changes.XUSDC * 1.0 +
        changes.XMD * 1.0 +
        changes.LOAN * prices.LOAN +
        changes.METAL * prices.METAL;

      trade.verifiedProfitBps = trade.actualInputUsd > 0
        ? (trade.verifiedProfitUsd / trade.actualInputUsd) * 10000
        : 0;

      trade.status = 'analyzed';

      // Log results
      const emoji = trade.verifiedProfitUsd >= 0 ? '✅' : '❌';
      logger.info(`${emoji} [ANALYSIS] Post-trade analysis complete: ${tradeId}`);
      logger.info(`   Expected:  ${trade.expectedProfitBps.toFixed(1)} BPS ($${trade.expectedProfitUsd.toFixed(4)})`);
      logger.info(`   Immediate: ${trade.actualProfitBps.toFixed(1)} BPS ($${trade.actualProfitUsd.toFixed(4)})`);
      logger.info(`   Verified:  ${trade.verifiedProfitBps.toFixed(1)} BPS ($${trade.verifiedProfitUsd.toFixed(4)})`);
      logger.info(`   Balance changes: XPR=${changes.XPR.toFixed(4)} XUSDC=${changes.XUSDC.toFixed(4)} XMD=${changes.XMD.toFixed(4)}`);

      // Send Telegram notification
      await this.sendAnalysisNotification(trade, prices);

      // Save to database
      await this.saveTradeToDatabase(trade);

    } catch (error: any) {
      logger.error(`Post-trade analysis failed for ${tradeId}: ${error.message}`);
    }
  }

  /**
   * Fetch current prices from AMM pools
   */
  private async fetchPrices(): Promise<{ XPR: number; LOAN: number; METAL: number }> {
    try {
      const poolsRes = await this.rpc.get_table_rows({
        code: 'proton.swaps',
        scope: 'proton.swaps',
        table: 'pools',
        limit: 100,
        json: true
      });

      let xprPrice = 0.00251;
      let metalPrice = 0.118;
      let loanPrice = 0.00040;

      for (const pool of poolsRes.rows) {
        if (pool.lt_symbol?.includes('XPRUSDC')) {
          const xprAmt = parseFloat(pool.pool1.quantity);
          const usdcAmt = parseFloat(pool.pool2.quantity);
          xprPrice = usdcAmt / xprAmt;
        }
        if (pool.lt_symbol?.includes('METAXPR')) {
          const metalAmt = parseFloat(pool.pool1.quantity);
          const xprAmt = parseFloat(pool.pool2.quantity);
          metalPrice = (xprAmt / metalAmt) * xprPrice;
        }
        if (pool.lt_symbol?.includes('XPRLOAN')) {
          const xprAmt = parseFloat(pool.pool1.quantity);
          const loanAmt = parseFloat(pool.pool2.quantity);
          loanPrice = (xprAmt / loanAmt) * xprPrice;
        }
      }

      return { XPR: xprPrice, LOAN: loanPrice, METAL: metalPrice };
    } catch (error) {
      return { XPR: 0.00251, LOAN: 0.00040, METAL: 0.118 };
    }
  }

  /**
   * Send Telegram notification with post-trade analysis
   */
  private async sendAnalysisNotification(trade: TradeRecord, prices: { XPR: number; LOAN: number; METAL: number }): Promise<void> {
    const changes = trade.balanceChanges!;
    const emoji = trade.verifiedProfitUsd! >= 0 ? '✅' : '❌';

    // Format balance changes, only show non-zero
    const balanceLines: string[] = [];
    if (Math.abs(changes.XPR) > 0.01) {
      const sign = changes.XPR >= 0 ? '+' : '';
      balanceLines.push(`  XPR: ${sign}${changes.XPR.toFixed(2)} ($${(changes.XPR * prices.XPR).toFixed(4)})`);
    }
    if (Math.abs(changes.XUSDC) > 0.0001) {
      const sign = changes.XUSDC >= 0 ? '+' : '';
      balanceLines.push(`  XUSDC: ${sign}${changes.XUSDC.toFixed(4)}`);
    }
    if (Math.abs(changes.XMD) > 0.0001) {
      const sign = changes.XMD >= 0 ? '+' : '';
      balanceLines.push(`  XMD: ${sign}${changes.XMD.toFixed(4)}`);
    }
    if (Math.abs(changes.LOAN) > 0.01) {
      const sign = changes.LOAN >= 0 ? '+' : '';
      balanceLines.push(`  LOAN: ${sign}${changes.LOAN.toFixed(2)}`);
    }
    if (Math.abs(changes.METAL) > 0.00001) {
      const sign = changes.METAL >= 0 ? '+' : '';
      balanceLines.push(`  METAL: ${sign}${changes.METAL.toFixed(6)}`);
    }

    const executionPct = trade.expectedProfitUsd !== 0
      ? ((trade.verifiedProfitUsd! / trade.expectedProfitUsd) * 100).toFixed(0)
      : '0';

    const message = `📊 *TRADE ANALYSIS* (60s later)

${emoji} \`${trade.path}\`
Trade ID: \`${trade.id.split('_').slice(-1)[0]}\`

*Profit Comparison:*
  Expected:  +${trade.expectedProfitBps.toFixed(1)} BPS ($${trade.expectedProfitUsd.toFixed(4)})
  Immediate: +${trade.actualProfitBps.toFixed(1)} BPS ($${trade.actualProfitUsd.toFixed(4)})
  Verified:  ${trade.verifiedProfitBps!.toFixed(1)} BPS ($${trade.verifiedProfitUsd!.toFixed(4)})

*Execution:* ${executionPct}% of expected

*Balance Changes:*
${balanceLines.join('\n')}

*Net Profit:* $${trade.verifiedProfitUsd!.toFixed(4)}`;

    await telegramNotifier.notify(message, trade.verifiedProfitUsd! >= 0 ? 'normal' : 'high');
  }

  /**
   * Save trade record to database
   */
  private async saveTradeToDatabase(trade: TradeRecord): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { getDatabase } = await import('../persistence/database.js');
      const db = getDatabase();

      // Create table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS trade_analysis (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          strategy TEXT NOT NULL,
          path TEXT NOT NULL,
          expected_profit_bps REAL,
          expected_profit_usd REAL,
          actual_profit_bps REAL,
          actual_profit_usd REAL,
          verified_profit_bps REAL,
          verified_profit_usd REAL,
          slippage_bps REAL,
          execution_quality REAL,
          pre_xpr REAL,
          pre_xusdc REAL,
          pre_xmd REAL,
          post_xpr REAL,
          post_xusdc REAL,
          post_xmd REAL,
          change_xpr REAL,
          change_xusdc REAL,
          change_xmd REAL,
          tx_ids TEXT,
          analysis_timestamp TEXT,
          status TEXT
        )
      `);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO trade_analysis (
          id, timestamp, strategy, path,
          expected_profit_bps, expected_profit_usd,
          actual_profit_bps, actual_profit_usd,
          verified_profit_bps, verified_profit_usd,
          slippage_bps, execution_quality,
          pre_xpr, pre_xusdc, pre_xmd,
          post_xpr, post_xusdc, post_xmd,
          change_xpr, change_xusdc, change_xmd,
          tx_ids, analysis_timestamp, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        trade.id,
        trade.timestamp.toISOString(),
        trade.strategy,
        trade.path,
        trade.expectedProfitBps,
        trade.expectedProfitUsd,
        trade.actualProfitBps,
        trade.actualProfitUsd,
        trade.verifiedProfitBps || 0,
        trade.verifiedProfitUsd || 0,
        trade.slippageBps,
        trade.executionQuality,
        trade.preTradeBalances?.XPR || 0,
        trade.preTradeBalances?.XUSDC || 0,
        trade.preTradeBalances?.XMD || 0,
        trade.postTradeBalances?.XPR || 0,
        trade.postTradeBalances?.XUSDC || 0,
        trade.postTradeBalances?.XMD || 0,
        trade.balanceChanges?.XPR || 0,
        trade.balanceChanges?.XUSDC || 0,
        trade.balanceChanges?.XMD || 0,
        trade.txIds.join(','),
        trade.analysisTimestamp?.toISOString() || '',
        trade.status
      );

      logger.info(`💾 Trade analysis saved to database: ${trade.id}`);
    } catch (error: any) {
      logger.error(`Failed to save trade to database: ${error.message}`);
    }
  }

  /**
   * Record failed trade
   */
  failTrade(tradeId: string, error: string): void {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) return;

    trade.status = 'failed';
    trade.error = error;

    logger.info(`❌ [TRACKER] Trade failed: ${tradeId}`);
    logger.info(`   Error: ${error}`);
  }

  /**
   * Take a portfolio snapshot
   */
  async takeSnapshot(): Promise<PortfolioSnapshot> {
    try {
      // Fetch all balances
      const [xprBal, xtokensBal, loanBal, xmdBal] = await Promise.all([
        this.rpc.get_table_rows({ code: 'eosio.token', scope: this.username, table: 'accounts', json: true }),
        this.rpc.get_table_rows({ code: 'xtokens', scope: this.username, table: 'accounts', json: true }),
        this.rpc.get_table_rows({ code: 'loan.token', scope: this.username, table: 'accounts', json: true }),
        this.rpc.get_table_rows({ code: 'xmd.token', scope: this.username, table: 'accounts', json: true })
      ]);

      // Parse balances
      let xpr = 0, xusdc = 0, xmd = 0, loan = 0, metal = 0;

      for (const row of xprBal.rows) {
        if (row.balance?.includes('XPR')) xpr = parseFloat(row.balance);
      }
      for (const row of xtokensBal.rows) {
        if (row.balance?.includes('XUSDC')) xusdc = parseFloat(row.balance);
        if (row.balance?.includes('METAL')) metal = parseFloat(row.balance);
      }
      for (const row of loanBal.rows) {
        if (row.balance?.includes('LOAN')) loan = parseFloat(row.balance);
      }
      for (const row of xmdBal.rows) {
        if (row.balance?.includes('XMD')) xmd = parseFloat(row.balance);
      }

      // Get prices from AMM
      const poolsRes = await this.rpc.get_table_rows({
        code: 'proton.swaps',
        scope: 'proton.swaps',
        table: 'pools',
        limit: 100,
        json: true
      });

      let xprPrice = 0.00291; // Default
      let metalPrice = 0.144;
      let loanPrice = 0.00043;

      for (const pool of poolsRes.rows) {
        if (pool.lt_symbol?.includes('XPRUSDC')) {
          const xprAmt = parseFloat(pool.pool1.quantity);
          const usdcAmt = parseFloat(pool.pool2.quantity);
          xprPrice = usdcAmt / xprAmt;
        }
        if (pool.lt_symbol?.includes('METAXPR')) {
          const metalAmt = parseFloat(pool.pool1.quantity);
          const xprAmt = parseFloat(pool.pool2.quantity);
          metalPrice = (xprAmt / metalAmt) * xprPrice;
        }
      }

      // Calculate total value
      const totalValueUsd =
        xpr * xprPrice +
        xusdc +
        xmd +
        loan * loanPrice +
        metal * metalPrice;

      const snapshot: PortfolioSnapshot = {
        timestamp: new Date(),
        balances: { XPR: xpr, XUSDC: xusdc, XMD: xmd, LOAN: loan, METAL: metal },
        totalValueUsd,
        prices: { XPR: xprPrice, LOAN: loanPrice, METAL: metalPrice }
      };

      this.snapshots.push(snapshot);

      // Keep only last 24 hours of snapshots
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.snapshots = this.snapshots.filter(s => s.timestamp.getTime() > oneDayAgo);

      return snapshot;
    } catch (error: any) {
      logger.error('Failed to take snapshot:', error.message);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const completedTrades = this.trades.filter(t => t.status === 'completed');
    const failedTrades = this.trades.filter(t => t.status === 'failed');

    const totalExpectedProfitUsd = completedTrades.reduce((sum, t) => sum + t.expectedProfitUsd, 0);
    const totalActualProfitUsd = completedTrades.reduce((sum, t) => sum + t.actualProfitUsd, 0);

    const avgSlippageBps = completedTrades.length > 0
      ? completedTrades.reduce((sum, t) => sum + t.slippageBps, 0) / completedTrades.length
      : 0;

    const maxSlippageBps = completedTrades.length > 0
      ? Math.max(...completedTrades.map(t => t.slippageBps))
      : 0;

    const avgExecutionQuality = completedTrades.length > 0
      ? completedTrades.reduce((sum, t) => sum + t.executionQuality, 0) / completedTrades.length
      : 0;

    const hoursRunning = (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60);

    // Group by strategy
    const byStrategy = new Map<string, { trades: number; profitUsd: number; avgSlippageBps: number }>();
    for (const trade of completedTrades) {
      const key = `${trade.strategy}:${trade.path}`;
      const existing = byStrategy.get(key) || { trades: 0, profitUsd: 0, avgSlippageBps: 0 };
      existing.trades++;
      existing.profitUsd += trade.actualProfitUsd;
      existing.avgSlippageBps = (existing.avgSlippageBps * (existing.trades - 1) + trade.slippageBps) / existing.trades;
      byStrategy.set(key, existing);
    }

    return {
      totalTrades: this.trades.length,
      successfulTrades: completedTrades.length,
      failedTrades: failedTrades.length,
      winRate: completedTrades.length > 0
        ? completedTrades.filter(t => t.actualProfitUsd > 0).length / completedTrades.length
        : 0,

      totalExpectedProfitUsd,
      totalActualProfitUsd,
      profitAccuracy: totalExpectedProfitUsd !== 0 ? totalActualProfitUsd / totalExpectedProfitUsd : 0,

      avgSlippageBps,
      maxSlippageBps,
      avgExecutionQuality,

      profitPerHour: hoursRunning > 0 ? totalActualProfitUsd / hoursRunning : 0,
      tradesPerHour: hoursRunning > 0 ? completedTrades.length / hoursRunning : 0,

      byStrategy
    };
  }

  /**
   * Get portfolio P&L since start
   */
  getPortfolioPnL(): { startValue: number; currentValue: number; pnlUsd: number; pnlPercent: number } {
    if (this.snapshots.length < 2) {
      return { startValue: 0, currentValue: 0, pnlUsd: 0, pnlPercent: 0 };
    }

    const startValue = this.snapshots[0].totalValueUsd;
    const currentValue = this.snapshots[this.snapshots.length - 1].totalValueUsd;
    const pnlUsd = currentValue - startValue;
    const pnlPercent = startValue !== 0 ? (pnlUsd / startValue) * 100 : 0;

    return { startValue, currentValue, pnlUsd, pnlPercent };
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const metrics = this.getMetrics();
    const pnl = this.getPortfolioPnL();

    console.log('\n' + '='.repeat(60));
    console.log('📊 PROFITABILITY REPORT');
    console.log('='.repeat(60));

    console.log('\n📈 PORTFOLIO P&L');
    console.log(`   Start Value:   $${pnl.startValue.toFixed(2)}`);
    console.log(`   Current Value: $${pnl.currentValue.toFixed(2)}`);
    console.log(`   P&L:           $${pnl.pnlUsd.toFixed(2)} (${pnl.pnlPercent.toFixed(2)}%)`);

    console.log('\n🎯 TRADE METRICS');
    console.log(`   Total Trades:    ${metrics.totalTrades}`);
    console.log(`   Successful:      ${metrics.successfulTrades}`);
    console.log(`   Failed:          ${metrics.failedTrades}`);
    console.log(`   Win Rate:        ${(metrics.winRate * 100).toFixed(1)}%`);

    console.log('\n💰 PROFIT ANALYSIS');
    console.log(`   Expected Total:  $${metrics.totalExpectedProfitUsd.toFixed(4)}`);
    console.log(`   Actual Total:    $${metrics.totalActualProfitUsd.toFixed(4)}`);
    console.log(`   Accuracy:        ${(metrics.profitAccuracy * 100).toFixed(0)}%`);

    console.log('\n⚡ EXECUTION QUALITY');
    console.log(`   Avg Slippage:    ${metrics.avgSlippageBps.toFixed(1)} BPS`);
    console.log(`   Max Slippage:    ${metrics.maxSlippageBps.toFixed(1)} BPS`);
    console.log(`   Avg Execution:   ${(metrics.avgExecutionQuality * 100).toFixed(0)}%`);

    console.log('\n⏱️  PERFORMANCE');
    console.log(`   Profit/Hour:     $${metrics.profitPerHour.toFixed(4)}`);
    console.log(`   Trades/Hour:     ${metrics.tradesPerHour.toFixed(2)}`);

    if (metrics.byStrategy.size > 0) {
      console.log('\n📋 BY STRATEGY');
      for (const [strategy, data] of metrics.byStrategy) {
        console.log(`   ${strategy}:`);
        console.log(`      Trades: ${data.trades} | Profit: $${data.profitUsd.toFixed(4)} | Slippage: ${data.avgSlippageBps.toFixed(1)} BPS`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Get recent trades
   */
  getRecentTrades(limit: number = 10): TradeRecord[] {
    return this.trades.slice(-limit);
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): PortfolioSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }
}

// Singleton instance
export const profitabilityTracker = new ProfitabilityTracker();
