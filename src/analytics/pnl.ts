import { getDatabase, getCurrentDate, getCurrentTimestamp } from '../persistence/database.js';
import { tradeRepository } from '../persistence/models/trade.model.js';
import { getLogger } from '../utils.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface DailyPnL {
  date: string;
  strategy: string;
  realizedPnl: number;
  unrealizedPnl: number;
  feesPaid: number;
  tradesCount: number;
  volume: number;
  winCount: number;
  lossCount: number;
  maxDrawdown: number;
}

export interface StrategyMetrics {
  strategy: string;
  period: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME';
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  totalVolume: number;
  totalFees: number;
  avgTradeSize: number;
  largestWin: number;
  largestLoss: number;
}

export interface PositionPnL {
  strategy: string;
  marketSymbol: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

/**
 * P&L Calculator for tracking trading performance
 */
export class PnLCalculator {
  private equityHistory: Map<string, number[]> = new Map();
  private peakEquity: Map<string, number> = new Map();

  /**
   * Calculate realized P&L for a strategy over a time period
   */
  calculateRealizedPnL(strategy: string, startDate?: string, endDate?: string): number {
    const trades = startDate && endDate
      ? tradeRepository.getTradesByDateRange(startDate, endDate).filter(t => t.strategy === strategy)
      : tradeRepository.getTradesByStrategy(strategy);

    return trades.reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0);
  }

  /**
   * Calculate unrealized P&L for open positions
   */
  calculateUnrealizedPnL(positions: PositionPnL[]): number {
    return positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  }

  /**
   * Calculate total P&L (realized + unrealized)
   */
  calculateTotalPnL(strategy: string, positions: PositionPnL[]): number {
    const realized = this.calculateRealizedPnL(strategy);
    const unrealized = this.calculateUnrealizedPnL(positions);
    return realized + unrealized;
  }

  /**
   * Calculate strategy metrics
   */
  calculateMetrics(strategy: string, period: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME' = 'ALL_TIME'): StrategyMetrics {
    const trades = tradeRepository.getTradesByStrategy(strategy, 10000);

    // Filter by period
    const now = new Date();
    const filteredTrades = trades.filter(t => {
      const tradeDate = new Date(t.executed_at);
      switch (period) {
        case 'HOURLY':
          return (now.getTime() - tradeDate.getTime()) < 3600000;
        case 'DAILY':
          return (now.getTime() - tradeDate.getTime()) < 86400000;
        case 'WEEKLY':
          return (now.getTime() - tradeDate.getTime()) < 604800000;
        case 'MONTHLY':
          return (now.getTime() - tradeDate.getTime()) < 2592000000;
        case 'ALL_TIME':
        default:
          return true;
      }
    });

    // Calculate metrics
    const wins = filteredTrades.filter(t => (t.realized_pnl || 0) > 0);
    const losses = filteredTrades.filter(t => (t.realized_pnl || 0) < 0);

    const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    const totalVolume = filteredTrades.reduce((sum, t) => sum + t.total, 0);
    const totalFees = filteredTrades.reduce((sum, t) => sum + t.fee, 0);

    const totalWins = wins.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.realized_pnl || 0), 0));

    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;

    const winRate = filteredTrades.length > 0 ? wins.length / filteredTrades.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Find largest win/loss
    const largestWin = wins.length > 0
      ? Math.max(...wins.map(t => t.realized_pnl || 0))
      : 0;
    const largestLoss = losses.length > 0
      ? Math.min(...losses.map(t => t.realized_pnl || 0))
      : 0;

    // Calculate Sharpe ratio (simplified)
    const returns = filteredTrades.map(t => t.realized_pnl || 0);
    const sharpeRatio = this.calculateSharpeRatio(returns);

    // Calculate max drawdown
    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(strategy, filteredTrades);

    return {
      strategy,
      period,
      totalPnl,
      realizedPnl: totalPnl,
      unrealizedPnl: 0, // Would need position data
      totalTrades: filteredTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      totalVolume,
      totalFees,
      avgTradeSize: filteredTrades.length > 0 ? totalVolume / filteredTrades.length : 0,
      largestWin,
      largestLoss
    };
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return mean > 0 ? Infinity : mean < 0 ? -Infinity : 0;

    // Annualized Sharpe (assuming daily returns)
    return (mean / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(strategy: string, trades: any[]): { maxDrawdown: number; maxDrawdownPercent: number } {
    if (trades.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

    let peak = 0;
    let equity = 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const trade of trades) {
      equity += trade.realized_pnl || 0;

      if (equity > peak) {
        peak = equity;
      }

      const drawdown = peak - equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  /**
   * Record daily P&L snapshot
   */
  saveDailyPnL(strategy: string, unrealizedPnl: number = 0): void {
    try {
      const db = getDatabase();
      const date = getCurrentDate();

      // Get today's trade stats
      const todaysStats = tradeRepository.getDailySummary(strategy, date);

      const stmt = db.prepare(`
        INSERT INTO daily_pnl (date, strategy, realized_pnl, unrealized_pnl, fees_paid, trades_count, volume, win_count, loss_count, max_drawdown)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, strategy) DO UPDATE SET
          realized_pnl = excluded.realized_pnl,
          unrealized_pnl = excluded.unrealized_pnl,
          fees_paid = excluded.fees_paid,
          trades_count = excluded.trades_count,
          volume = excluded.volume,
          win_count = excluded.win_count,
          loss_count = excluded.loss_count,
          max_drawdown = excluded.max_drawdown
      `);

      // Calculate win/loss counts
      const todaysTrades = tradeRepository.getTodaysTrades(strategy);
      const winCount = todaysTrades.filter(t => (t.realized_pnl || 0) > 0).length;
      const lossCount = todaysTrades.filter(t => (t.realized_pnl || 0) < 0).length;

      stmt.run(
        date,
        strategy,
        todaysStats.realizedPnl,
        unrealizedPnl,
        todaysStats.fees,
        todaysStats.trades,
        todaysStats.volume,
        winCount,
        lossCount,
        0 // Max drawdown calculated separately
      );

      logger.debug(`Saved daily P&L snapshot for ${strategy}`);

    } catch (error) {
      logger.error('Failed to save daily P&L:', error);
    }
  }

  /**
   * Get daily P&L history
   */
  getDailyPnLHistory(strategy: string, days: number = 30): DailyPnL[] {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT * FROM daily_pnl
        WHERE strategy = ?
        ORDER BY date DESC
        LIMIT ?
      `);
      const rows = stmt.all(strategy, days) as any[];

      return rows.map(row => ({
        date: row.date,
        strategy: row.strategy,
        realizedPnl: row.realized_pnl,
        unrealizedPnl: row.unrealized_pnl,
        feesPaid: row.fees_paid,
        tradesCount: row.trades_count,
        volume: row.volume,
        winCount: row.win_count,
        lossCount: row.loss_count,
        maxDrawdown: row.max_drawdown
      }));

    } catch (error) {
      logger.error('Failed to get daily P&L history:', error);
      return [];
    }
  }

  /**
   * Save strategy metrics
   */
  saveMetrics(metrics: StrategyMetrics): void {
    try {
      const db = getDatabase();
      const timestamp = getCurrentTimestamp();

      const metricsToSave = [
        { name: 'total_pnl', value: metrics.totalPnl },
        { name: 'win_rate', value: metrics.winRate },
        { name: 'sharpe_ratio', value: metrics.sharpeRatio },
        { name: 'max_drawdown', value: metrics.maxDrawdown },
        { name: 'profit_factor', value: metrics.profitFactor },
        { name: 'total_volume', value: metrics.totalVolume },
        { name: 'total_trades', value: metrics.totalTrades }
      ];

      const stmt = db.prepare(`
        INSERT INTO strategy_metrics (strategy, metric_name, metric_value, period, calculated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const m of metricsToSave) {
        if (isFinite(m.value)) {
          stmt.run(metrics.strategy, m.name, m.value, metrics.period, timestamp);
        }
      }

      logger.debug(`Saved ${metricsToSave.length} metrics for ${metrics.strategy}`);

    } catch (error) {
      logger.error('Failed to save metrics:', error);
    }
  }

  /**
   * Generate performance report
   */
  generateReport(strategy: string): string {
    const metrics = this.calculateMetrics(strategy, 'ALL_TIME');
    const dailyMetrics = this.calculateMetrics(strategy, 'DAILY');

    return `
=== Performance Report: ${strategy} ===

--- Today ---
Trades: ${dailyMetrics.totalTrades}
P&L: $${dailyMetrics.totalPnl.toFixed(2)}
Win Rate: ${(dailyMetrics.winRate * 100).toFixed(1)}%
Volume: $${dailyMetrics.totalVolume.toFixed(2)}

--- All Time ---
Total Trades: ${metrics.totalTrades}
Total P&L: $${metrics.totalPnl.toFixed(2)}
Win Rate: ${(metrics.winRate * 100).toFixed(1)}%
Avg Win: $${metrics.avgWin.toFixed(2)}
Avg Loss: $${metrics.avgLoss.toFixed(2)}
Profit Factor: ${metrics.profitFactor.toFixed(2)}
Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
Max Drawdown: $${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPercent.toFixed(1)}%)
Total Volume: $${metrics.totalVolume.toFixed(2)}
Total Fees: $${metrics.totalFees.toFixed(2)}
Largest Win: $${metrics.largestWin.toFixed(2)}
Largest Loss: $${metrics.largestLoss.toFixed(2)}

Generated: ${new Date().toISOString()}
`.trim();
  }

  /**
   * Update equity and track drawdown
   */
  updateEquity(strategy: string, equity: number): void {
    // Track history
    const history = this.equityHistory.get(strategy) || [];
    history.push(equity);
    if (history.length > 1000) history.shift(); // Keep last 1000 points
    this.equityHistory.set(strategy, history);

    // Update peak
    const currentPeak = this.peakEquity.get(strategy) || 0;
    if (equity > currentPeak) {
      this.peakEquity.set(strategy, equity);
    }
  }

  /**
   * Get current drawdown
   */
  getCurrentDrawdown(strategy: string, currentEquity: number): { drawdown: number; drawdownPercent: number } {
    const peak = this.peakEquity.get(strategy) || currentEquity;
    const drawdown = Math.max(0, peak - currentEquity);
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

    return { drawdown, drawdownPercent };
  }
}

// Singleton instance
export const pnlCalculator = new PnLCalculator();
