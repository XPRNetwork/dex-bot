import { getDatabase, getCurrentTimestamp } from '../database.js';

export type ArbitrageDirection = 'AMM_TO_DEX' | 'DEX_TO_AMM';

export interface ArbitrageOpportunity {
  id: number;
  pool_symbol: string;
  amm_price: number;
  dex_bid: number;
  dex_ask: number;
  spread_bps: number;
  direction: ArbitrageDirection;
  potential_profit: number;
  trade_size: number | null;
  executed: number;
  execution_profit: number | null;
  detected_at: string;
  executed_at: string | null;
}

export interface CreateArbitrageParams {
  pool_symbol: string;
  amm_price: number;
  dex_bid: number;
  dex_ask: number;
  spread_bps: number;
  direction: ArbitrageDirection;
  potential_profit: number;
  trade_size?: number;
}

export interface AMMPoolSnapshot {
  id: number;
  pool_symbol: string;
  reserve1: number;
  reserve2: number;
  token1_symbol: string;
  token2_symbol: string;
  liquidity_usd: number | null;
  price: number;
  captured_at: string;
}

export interface CreatePoolSnapshotParams {
  pool_symbol: string;
  reserve1: number;
  reserve2: number;
  token1_symbol: string;
  token2_symbol: string;
  liquidity_usd?: number;
  price: number;
}

/**
 * Arbitrage repository for database operations
 */
export class ArbitrageRepository {
  /**
   * Record an arbitrage opportunity
   */
  createOpportunity(params: CreateArbitrageParams): ArbitrageOpportunity {
    const db = getDatabase();
    const timestamp = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO arbitrage_opportunities (pool_symbol, amm_price, dex_bid, dex_ask, spread_bps, direction, potential_profit, trade_size, detected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      params.pool_symbol,
      params.amm_price,
      params.dex_bid,
      params.dex_ask,
      params.spread_bps,
      params.direction,
      params.potential_profit,
      params.trade_size ?? null,
      timestamp
    );

    return this.getOpportunityById(result.lastInsertRowid as number)!;
  }

  /**
   * Get an opportunity by ID
   */
  getOpportunityById(id: number): ArbitrageOpportunity | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM arbitrage_opportunities WHERE id = ?');
    return stmt.get(id) as ArbitrageOpportunity | null;
  }

  /**
   * Mark opportunity as executed
   */
  markExecuted(id: number, profit: number): ArbitrageOpportunity | null {
    const db = getDatabase();
    const timestamp = getCurrentTimestamp();

    const stmt = db.prepare(`
      UPDATE arbitrage_opportunities
      SET executed = 1, execution_profit = ?, executed_at = ?
      WHERE id = ?
    `);
    stmt.run(profit, timestamp, id);

    return this.getOpportunityById(id);
  }

  /**
   * Get recent opportunities
   */
  getRecentOpportunities(limit: number = 100): ArbitrageOpportunity[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM arbitrage_opportunities
      ORDER BY detected_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as ArbitrageOpportunity[];
  }

  /**
   * Get opportunities by pool
   */
  getOpportunitiesByPool(poolSymbol: string, limit: number = 100): ArbitrageOpportunity[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM arbitrage_opportunities
      WHERE pool_symbol = ?
      ORDER BY detected_at DESC
      LIMIT ?
    `);
    return stmt.all(poolSymbol, limit) as ArbitrageOpportunity[];
  }

  /**
   * Get executed opportunities
   */
  getExecutedOpportunities(limit: number = 100): ArbitrageOpportunity[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM arbitrage_opportunities
      WHERE executed = 1
      ORDER BY executed_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as ArbitrageOpportunity[];
  }

  /**
   * Get arbitrage statistics
   */
  getArbitrageStats(): {
    totalDetected: number;
    totalExecuted: number;
    totalProfit: number;
    avgSpreadBps: number;
    avgProfit: number;
    successRate: number;
  } {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as totalDetected,
        SUM(CASE WHEN executed = 1 THEN 1 ELSE 0 END) as totalExecuted,
        SUM(COALESCE(execution_profit, 0)) as totalProfit,
        AVG(spread_bps) as avgSpreadBps,
        AVG(CASE WHEN executed = 1 THEN execution_profit ELSE NULL END) as avgProfit
      FROM arbitrage_opportunities
    `);
    const result = stmt.get() as any;
    return {
      totalDetected: result.totalDetected || 0,
      totalExecuted: result.totalExecuted || 0,
      totalProfit: result.totalProfit || 0,
      avgSpreadBps: result.avgSpreadBps || 0,
      avgProfit: result.avgProfit || 0,
      successRate: result.totalDetected > 0 ? (result.totalExecuted / result.totalDetected) * 100 : 0
    };
  }

  /**
   * Get daily arbitrage summary
   */
  getDailySummary(date: string): {
    detected: number;
    executed: number;
    profit: number;
    avgSpread: number;
  } {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as detected,
        SUM(CASE WHEN executed = 1 THEN 1 ELSE 0 END) as executed,
        SUM(COALESCE(execution_profit, 0)) as profit,
        AVG(spread_bps) as avgSpread
      FROM arbitrage_opportunities
      WHERE DATE(detected_at) = ?
    `);
    const result = stmt.get(date) as any;
    return {
      detected: result.detected || 0,
      executed: result.executed || 0,
      profit: result.profit || 0,
      avgSpread: result.avgSpread || 0
    };
  }

  /**
   * Record an AMM pool snapshot
   */
  createPoolSnapshot(params: CreatePoolSnapshotParams): AMMPoolSnapshot {
    const db = getDatabase();
    const timestamp = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO amm_pool_snapshots (pool_symbol, reserve1, reserve2, token1_symbol, token2_symbol, liquidity_usd, price, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      params.pool_symbol,
      params.reserve1,
      params.reserve2,
      params.token1_symbol,
      params.token2_symbol,
      params.liquidity_usd ?? null,
      params.price,
      timestamp
    );

    return this.getPoolSnapshotById(result.lastInsertRowid as number)!;
  }

  /**
   * Get pool snapshot by ID
   */
  getPoolSnapshotById(id: number): AMMPoolSnapshot | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM amm_pool_snapshots WHERE id = ?');
    return stmt.get(id) as AMMPoolSnapshot | null;
  }

  /**
   * Get latest pool snapshot
   */
  getLatestPoolSnapshot(poolSymbol: string): AMMPoolSnapshot | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM amm_pool_snapshots
      WHERE pool_symbol = ?
      ORDER BY captured_at DESC
      LIMIT 1
    `);
    return stmt.get(poolSymbol) as AMMPoolSnapshot | null;
  }

  /**
   * Get pool price history
   */
  getPoolPriceHistory(poolSymbol: string, limit: number = 100): { price: number; captured_at: string }[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT price, captured_at FROM amm_pool_snapshots
      WHERE pool_symbol = ?
      ORDER BY captured_at DESC
      LIMIT ?
    `);
    return stmt.all(poolSymbol, limit) as { price: number; captured_at: string }[];
  }

  /**
   * Delete old snapshots (for cleanup)
   */
  deleteOldSnapshots(daysOld: number): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM amm_pool_snapshots
      WHERE captured_at < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(daysOld);
    return result.changes;
  }
}

// Singleton instance
export const arbitrageRepository = new ArbitrageRepository();
