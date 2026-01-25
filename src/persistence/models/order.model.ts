import { getDatabase, getCurrentTimestamp } from '../database.js';

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'FAILED';

export interface Order {
  id: number;
  strategy: string;
  market_symbol: string;
  order_side: OrderSide;
  price: number;
  quantity: number;
  total: number;
  status: OrderStatus;
  dex_order_id: string | null;
  created_at: string;
  updated_at: string;
  filled_at: string | null;
  filled_quantity: number;
  average_fill_price: number | null;
  fee: number;
  error_message: string | null;
}

export interface CreateOrderParams {
  strategy: string;
  market_symbol: string;
  order_side: OrderSide;
  price: number;
  quantity: number;
  total?: number;
  status?: OrderStatus;
  dex_order_id?: string;
}

export interface UpdateOrderParams {
  status?: OrderStatus;
  dex_order_id?: string;
  filled_quantity?: number;
  average_fill_price?: number;
  fee?: number;
  error_message?: string;
}

/**
 * Order repository for database operations
 */
export class OrderRepository {
  /**
   * Create a new order record
   */
  createOrder(params: CreateOrderParams): Order {
    const db = getDatabase();
    const total = params.total ?? params.price * params.quantity;
    const timestamp = getCurrentTimestamp();

    const stmt = db.prepare(`
      INSERT INTO orders (strategy, market_symbol, order_side, price, quantity, total, status, dex_order_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      params.strategy,
      params.market_symbol,
      params.order_side,
      params.price,
      params.quantity,
      total,
      params.status ?? 'PENDING',
      params.dex_order_id ?? null,
      timestamp,
      timestamp
    );

    return this.getOrderById(result.lastInsertRowid as number)!;
  }

  /**
   * Get an order by its database ID
   */
  getOrderById(id: number): Order | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
    return stmt.get(id) as Order | null;
  }

  /**
   * Get an order by its DEX order ID
   */
  getOrderByDexId(dexOrderId: string): Order | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM orders WHERE dex_order_id = ?');
    return stmt.get(dexOrderId) as Order | null;
  }

  /**
   * Update an order
   */
  updateOrder(id: number, params: UpdateOrderParams): Order | null {
    const db = getDatabase();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [getCurrentTimestamp()];

    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
      if (params.status === 'FILLED') {
        updates.push('filled_at = ?');
        values.push(getCurrentTimestamp());
      }
    }
    if (params.dex_order_id !== undefined) {
      updates.push('dex_order_id = ?');
      values.push(params.dex_order_id);
    }
    if (params.filled_quantity !== undefined) {
      updates.push('filled_quantity = ?');
      values.push(params.filled_quantity);
    }
    if (params.average_fill_price !== undefined) {
      updates.push('average_fill_price = ?');
      values.push(params.average_fill_price);
    }
    if (params.fee !== undefined) {
      updates.push('fee = ?');
      values.push(params.fee);
    }
    if (params.error_message !== undefined) {
      updates.push('error_message = ?');
      values.push(params.error_message);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getOrderById(id);
  }

  /**
   * Mark order as filled
   */
  markOrderFilled(id: number, filledQuantity: number, avgFillPrice: number, fee: number = 0): Order | null {
    return this.updateOrder(id, {
      status: 'FILLED',
      filled_quantity: filledQuantity,
      average_fill_price: avgFillPrice,
      fee
    });
  }

  /**
   * Mark order as cancelled
   */
  markOrderCancelled(id: number): Order | null {
    return this.updateOrder(id, { status: 'CANCELLED' });
  }

  /**
   * Mark order as failed with error message
   */
  markOrderFailed(id: number, errorMessage: string): Order | null {
    return this.updateOrder(id, { status: 'FAILED', error_message: errorMessage });
  }

  /**
   * Get all orders for a strategy
   */
  getOrdersByStrategy(strategy: string, limit: number = 100): Order[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE strategy = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(strategy, limit) as Order[];
  }

  /**
   * Get all open orders for a strategy
   */
  getOpenOrdersByStrategy(strategy: string): Order[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE strategy = ? AND status IN ('PENDING', 'OPEN', 'PARTIALLY_FILLED')
      ORDER BY created_at DESC
    `);
    return stmt.all(strategy) as Order[];
  }

  /**
   * Get all orders for a market symbol
   */
  getOrdersByMarket(marketSymbol: string, limit: number = 100): Order[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE market_symbol = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(marketSymbol, limit) as Order[];
  }

  /**
   * Get orders created in a date range
   */
  getOrdersByDateRange(startDate: string, endDate: string): Order[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM orders
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `);
    return stmt.all(startDate, endDate) as Order[];
  }

  /**
   * Get order statistics for a strategy
   */
  getOrderStats(strategy: string): {
    total: number;
    filled: number;
    cancelled: number;
    failed: number;
    totalVolume: number;
    totalFees: number;
  } {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END) as filled,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'FILLED' THEN total ELSE 0 END) as totalVolume,
        SUM(fee) as totalFees
      FROM orders
      WHERE strategy = ?
    `);
    const result = stmt.get(strategy) as any;
    return {
      total: result.total || 0,
      filled: result.filled || 0,
      cancelled: result.cancelled || 0,
      failed: result.failed || 0,
      totalVolume: result.totalVolume || 0,
      totalFees: result.totalFees || 0
    };
  }

  /**
   * Delete old orders (for cleanup)
   */
  deleteOldOrders(daysOld: number): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM orders
      WHERE created_at < datetime('now', '-' || ? || ' days')
      AND status IN ('FILLED', 'CANCELLED', 'FAILED')
    `);
    const result = stmt.run(daysOld);
    return result.changes;
  }
}

// Singleton instance
export const orderRepository = new OrderRepository();
