import { getDatabase, getCurrentTimestamp } from '../database.js';

export type TradeSide = 'BUY' | 'SELL';

export interface Trade {
  id: number;
  order_id: number | null;
  strategy: string;
  market_symbol: string;
  trade_side: TradeSide;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  fee_token: string | null;
  realized_pnl: number | null;
  executed_at: string;
}

export interface CreateTradeParams {
  order_id?: number;
  strategy: string;
  market_symbol: string;
  trade_side: TradeSide;
  price: number;
  quantity: number;
  total?: number;
  fee?: number;
  fee_token?: string;
  realized_pnl?: number;
}

/**
 * Trade repository for database operations
 */
export class TradeRepository {
  /**
   * Record a new trade
   */
  createTrade(params: CreateTradeParams): Trade {
    const db = getDatabase();
    const total = params.total ?? params.price * params.quantity;
    const timestamp = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO trades (order_id, strategy, market_symbol, trade_side, price, quantity, total, fee, fee_token, realized_pnl, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      params.order_id ?? null,
      params.strategy,
      params.market_symbol,
      params.trade_side,
      params.price,
      params.quantity,
      total,
      params.fee ?? 0,
      params.fee_token ?? null,
      params.realized_pnl ?? null,
      timestamp
    );

    return this.getTradeById(result.lastInsertRowid as number)!;
  }

  /**
   * Get a trade by its ID
   */
  getTradeById(id: number): Trade | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM trades WHERE id = ?');
    return stmt.get(id) as Trade | null;
  }

  /**
   * Get all trades for an order
   */
  getTradesByOrderId(orderId: number): Trade[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM trades WHERE order_id = ? ORDER BY executed_at ASC');
    return stmt.all(orderId) as Trade[];
  }

  /**
   * Get all trades for a strategy
   */
  getTradesByStrategy(strategy: string, limit: number = 100): Trade[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM trades
      WHERE strategy = ?
      ORDER BY executed_at DESC
      LIMIT ?
    `);
    return stmt.all(strategy, limit) as Trade[];
  }

  /**
   * Get all trades for a market
   */
  getTradesByMarket(marketSymbol: string, limit: number = 100): Trade[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM trades
      WHERE market_symbol = ?
      ORDER BY executed_at DESC
      LIMIT ?
    `);
    return stmt.all(marketSymbol, limit) as Trade[];
  }

  /**
   * Get trades in a date range
   */
  getTradesByDateRange(startDate: string, endDate: string): Trade[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM trades
      WHERE executed_at >= ? AND executed_at <= ?
      ORDER BY executed_at DESC
    `);
    return stmt.all(startDate, endDate) as Trade[];
  }

  /**
   * Get today's trades for a strategy
   */
  getTodaysTrades(strategy: string): Trade[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM trades
      WHERE strategy = ? AND DATE(executed_at) = DATE('now')
      ORDER BY executed_at DESC
    `);
    return stmt.all(strategy) as Trade[];
  }

  /**
   * Get trade statistics for a strategy
   */
  getTradeStats(strategy: string): {
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    totalVolume: number;
    totalFees: number;
    totalRealizedPnl: number;
    winningTrades: number;
    losingTrades: number;
    avgTradeSize: number;
  } {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as totalTrades,
        SUM(CASE WHEN trade_side = 'BUY' THEN 1 ELSE 0 END) as buyTrades,
        SUM(CASE WHEN trade_side = 'SELL' THEN 1 ELSE 0 END) as sellTrades,
        SUM(total) as totalVolume,
        SUM(fee) as totalFees,
        SUM(COALESCE(realized_pnl, 0)) as totalRealizedPnl,
        SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winningTrades,
        SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END) as losingTrades,
        AVG(total) as avgTradeSize
      FROM trades
      WHERE strategy = ?
    `);
    const result = stmt.get(strategy) as any;
    return {
      totalTrades: result.totalTrades || 0,
      buyTrades: result.buyTrades || 0,
      sellTrades: result.sellTrades || 0,
      totalVolume: result.totalVolume || 0,
      totalFees: result.totalFees || 0,
      totalRealizedPnl: result.totalRealizedPnl || 0,
      winningTrades: result.winningTrades || 0,
      losingTrades: result.losingTrades || 0,
      avgTradeSize: result.avgTradeSize || 0
    };
  }

  /**
   * Get daily trade summary
   */
  getDailySummary(strategy: string, date: string): {
    trades: number;
    volume: number;
    fees: number;
    realizedPnl: number;
    buys: number;
    sells: number;
  } {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as trades,
        SUM(total) as volume,
        SUM(fee) as fees,
        SUM(COALESCE(realized_pnl, 0)) as realizedPnl,
        SUM(CASE WHEN trade_side = 'BUY' THEN 1 ELSE 0 END) as buys,
        SUM(CASE WHEN trade_side = 'SELL' THEN 1 ELSE 0 END) as sells
      FROM trades
      WHERE strategy = ? AND DATE(executed_at) = ?
    `);
    const result = stmt.get(strategy, date) as any;
    return {
      trades: result.trades || 0,
      volume: result.volume || 0,
      fees: result.fees || 0,
      realizedPnl: result.realizedPnl || 0,
      buys: result.buys || 0,
      sells: result.sells || 0
    };
  }

  /**
   * Get recent trades with running P&L
   */
  getRecentTradesWithPnl(strategy: string, limit: number = 50): (Trade & { runningPnl: number })[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        t.*,
        SUM(COALESCE(t2.realized_pnl, 0)) as runningPnl
      FROM trades t
      LEFT JOIN trades t2 ON t2.strategy = t.strategy AND t2.executed_at <= t.executed_at
      WHERE t.strategy = ?
      GROUP BY t.id
      ORDER BY t.executed_at DESC
      LIMIT ?
    `);
    return stmt.all(strategy, limit) as (Trade & { runningPnl: number })[];
  }

  /**
   * Calculate average price for position
   */
  getAverageEntryPrice(strategy: string, marketSymbol: string): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        SUM(CASE WHEN trade_side = 'BUY' THEN quantity ELSE -quantity END) as netQuantity,
        SUM(CASE WHEN trade_side = 'BUY' THEN total ELSE -total END) as netCost
      FROM trades
      WHERE strategy = ? AND market_symbol = ?
    `);
    const result = stmt.get(strategy, marketSymbol) as any;

    if (!result || result.netQuantity === 0) {
      return 0;
    }

    return Math.abs(result.netCost / result.netQuantity);
  }

  /**
   * Get net position size
   */
  getNetPosition(strategy: string, marketSymbol: string): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        SUM(CASE WHEN trade_side = 'BUY' THEN quantity ELSE -quantity END) as netQuantity
      FROM trades
      WHERE strategy = ? AND market_symbol = ?
    `);
    const result = stmt.get(strategy, marketSymbol) as any;
    return result?.netQuantity || 0;
  }

  /**
   * Delete old trades (for cleanup)
   */
  deleteOldTrades(daysOld: number): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM trades
      WHERE executed_at < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(daysOld);
    return result.changes;
  }
}

// Singleton instance
export const tradeRepository = new TradeRepository();
