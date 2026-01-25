import { getDatabase, getCurrentTimestamp } from '../persistence/database.js';
import { getLogger } from '../utils.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface Position {
  strategy: string;
  marketSymbol: string;
  side: 'LONG' | 'SHORT' | 'NEUTRAL';
  size: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  valueUSD: number;
  lastUpdated: string;
}

export interface Exposure {
  strategy: string;
  totalExposureUSD: number;
  longExposureUSD: number;
  shortExposureUSD: number;
  maxSinglePositionUSD: number;
  positionCount: number;
}

/**
 * Position tracker for monitoring and managing trading positions
 */
export class PositionTracker {
  private positions: Map<string, Position> = new Map();
  private priceCache: Map<string, number> = new Map();

  /**
   * Generate a unique key for a position
   */
  private getPositionKey(strategy: string, marketSymbol: string): string {
    return `${strategy}:${marketSymbol}`;
  }

  /**
   * Update price cache
   */
  updatePrice(marketSymbol: string, price: number): void {
    this.priceCache.set(marketSymbol, price);
  }

  /**
   * Get current price for a market
   */
  getPrice(marketSymbol: string): number {
    return this.priceCache.get(marketSymbol) || 0;
  }

  /**
   * Update or create a position
   */
  updatePosition(
    strategy: string,
    marketSymbol: string,
    size: number,
    averageEntryPrice: number,
    currentPrice?: number
  ): Position {
    const key = this.getPositionKey(strategy, marketSymbol);
    const price = currentPrice ?? this.getPrice(marketSymbol) ?? averageEntryPrice;

    // Calculate unrealized P&L
    const sizeDecimal = new Decimal(size);
    const entryDecimal = new Decimal(averageEntryPrice);
    const priceDecimal = new Decimal(price);

    const unrealizedPnl = sizeDecimal.times(priceDecimal.minus(entryDecimal)).toNumber();
    const valueUSD = Math.abs(sizeDecimal.times(priceDecimal).toNumber());

    const side = size > 0 ? 'LONG' : size < 0 ? 'SHORT' : 'NEUTRAL';

    const position: Position = {
      strategy,
      marketSymbol,
      side,
      size,
      averageEntryPrice,
      currentPrice: price,
      unrealizedPnl,
      valueUSD,
      lastUpdated: getCurrentTimestamp()
    };

    this.positions.set(key, position);
    this.updatePrice(marketSymbol, price);

    return position;
  }

  /**
   * Add to position (for new trades)
   */
  addToPosition(
    strategy: string,
    marketSymbol: string,
    tradeSide: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Position {
    const key = this.getPositionKey(strategy, marketSymbol);
    const existing = this.positions.get(key);

    let newSize: number;
    let newAvgPrice: number;

    if (!existing || existing.size === 0) {
      // New position
      newSize = tradeSide === 'BUY' ? quantity : -quantity;
      newAvgPrice = price;
    } else {
      const existingSize = new Decimal(existing.size);
      const existingAvgPrice = new Decimal(existing.averageEntryPrice);
      const tradeSize = tradeSide === 'BUY' ? quantity : -quantity;

      // Calculate new size
      newSize = existingSize.plus(tradeSize).toNumber();

      if (Math.sign(newSize) === Math.sign(existing.size)) {
        // Adding to position - weight average
        if (tradeSide === 'BUY' && existing.side === 'LONG' ||
            tradeSide === 'SELL' && existing.side === 'SHORT') {
          const totalCost = existingSize.abs().times(existingAvgPrice)
            .plus(new Decimal(quantity).times(price));
          const totalSize = existingSize.abs().plus(quantity);
          newAvgPrice = totalCost.div(totalSize).toNumber();
        } else {
          // Reducing position - keep average
          newAvgPrice = existing.averageEntryPrice;
        }
      } else {
        // Flipping position direction
        newAvgPrice = price;
      }
    }

    return this.updatePosition(strategy, marketSymbol, newSize, newAvgPrice, price);
  }

  /**
   * Get a specific position
   */
  getPosition(strategy: string, marketSymbol: string): Position | null {
    const key = this.getPositionKey(strategy, marketSymbol);
    return this.positions.get(key) || null;
  }

  /**
   * Get all positions for a strategy
   */
  getPositionsByStrategy(strategy: string): Position[] {
    const positions: Position[] = [];
    for (const [key, position] of this.positions) {
      if (key.startsWith(`${strategy}:`)) {
        positions.push(position);
      }
    }
    return positions;
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Calculate exposure for a strategy
   */
  getExposure(strategy: string): Exposure {
    const positions = this.getPositionsByStrategy(strategy);

    let longExposure = new Decimal(0);
    let shortExposure = new Decimal(0);
    let maxSingle = new Decimal(0);

    for (const pos of positions) {
      const value = new Decimal(pos.valueUSD);
      if (pos.side === 'LONG') {
        longExposure = longExposure.plus(value);
      } else if (pos.side === 'SHORT') {
        shortExposure = shortExposure.plus(value);
      }
      if (value.greaterThan(maxSingle)) {
        maxSingle = value;
      }
    }

    return {
      strategy,
      totalExposureUSD: longExposure.plus(shortExposure).toNumber(),
      longExposureUSD: longExposure.toNumber(),
      shortExposureUSD: shortExposure.toNumber(),
      maxSinglePositionUSD: maxSingle.toNumber(),
      positionCount: positions.length
    };
  }

  /**
   * Get total exposure across all strategies
   */
  getTotalExposure(): Exposure {
    const positions = this.getAllPositions();

    let longExposure = new Decimal(0);
    let shortExposure = new Decimal(0);
    let maxSingle = new Decimal(0);

    for (const pos of positions) {
      const value = new Decimal(pos.valueUSD);
      if (pos.side === 'LONG') {
        longExposure = longExposure.plus(value);
      } else if (pos.side === 'SHORT') {
        shortExposure = shortExposure.plus(value);
      }
      if (value.greaterThan(maxSingle)) {
        maxSingle = value;
      }
    }

    return {
      strategy: 'ALL',
      totalExposureUSD: longExposure.plus(shortExposure).toNumber(),
      longExposureUSD: longExposure.toNumber(),
      shortExposureUSD: shortExposure.toNumber(),
      maxSinglePositionUSD: maxSingle.toNumber(),
      positionCount: positions.length
    };
  }

  /**
   * Get total unrealized P&L
   */
  getTotalUnrealizedPnl(strategy?: string): number {
    const positions = strategy ? this.getPositionsByStrategy(strategy) : this.getAllPositions();
    return positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  }

  /**
   * Close a position (mark as neutral)
   */
  closePosition(strategy: string, marketSymbol: string): void {
    const key = this.getPositionKey(strategy, marketSymbol);
    const existing = this.positions.get(key);
    if (existing) {
      this.updatePosition(strategy, marketSymbol, 0, 0, existing.currentPrice);
    }
  }

  /**
   * Save position snapshot to database
   */
  saveSnapshot(strategy: string): void {
    try {
      const db = getDatabase();
      const positions = this.getPositionsByStrategy(strategy);
      const timestamp = getCurrentTimestamp();

      const stmt = db.prepare(`
        INSERT INTO position_snapshots (strategy, market_symbol, position_size, average_entry_price, current_price, unrealized_pnl, position_value_usd, captured_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pos of positions) {
        stmt.run(
          pos.strategy,
          pos.marketSymbol,
          pos.size,
          pos.averageEntryPrice,
          pos.currentPrice,
          pos.unrealizedPnl,
          pos.valueUSD,
          timestamp
        );
      }

      logger.debug(`Saved ${positions.length} position snapshots for strategy ${strategy}`);
    } catch (error) {
      logger.error('Failed to save position snapshot:', error);
    }
  }

  /**
   * Save exposure history to database
   */
  saveExposureHistory(strategy: string): void {
    try {
      const db = getDatabase();
      const exposure = this.getExposure(strategy);
      const timestamp = getCurrentTimestamp();

      const stmt = db.prepare(`
        INSERT INTO exposure_history (strategy, total_exposure_usd, long_exposure_usd, short_exposure_usd, max_single_position_usd, captured_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        exposure.strategy,
        exposure.totalExposureUSD,
        exposure.longExposureUSD,
        exposure.shortExposureUSD,
        exposure.maxSinglePositionUSD,
        timestamp
      );

      logger.debug(`Saved exposure history for strategy ${strategy}`);
    } catch (error) {
      logger.error('Failed to save exposure history:', error);
    }
  }

  /**
   * Clear all positions (for reset/shutdown)
   */
  clearAllPositions(): void {
    this.positions.clear();
    logger.info('All positions cleared');
  }
}

// Singleton instance
export const positionTracker = new PositionTracker();
