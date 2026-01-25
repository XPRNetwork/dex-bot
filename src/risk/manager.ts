import { positionTracker, Position, Exposure } from './position-tracker.js';
import { circuitBreaker, CircuitBreakerConfig, CircuitBreakerState } from './circuit-breaker.js';
import { getDatabase, getCurrentTimestamp } from '../persistence/database.js';
import { getLogger } from '../utils.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface RiskConfig {
  maxPositionUSD: number;           // Max position size per pair
  maxTotalExposureUSD: number;      // Max total exposure
  maxPositionPercent: number;       // Max position as % of portfolio
  minOrderSizeUSD: number;          // Minimum order size
  maxOrdersPerMinute: number;       // Rate limiting
  circuitBreaker: Partial<CircuitBreakerConfig>;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason: string;
  adjustedSize?: number;
  warnings: string[];
}

export interface OrderRiskParams {
  strategy: string;
  marketSymbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

const DEFAULT_CONFIG: RiskConfig = {
  maxPositionUSD: 10000,
  maxTotalExposureUSD: 50000,
  maxPositionPercent: 20,
  minOrderSizeUSD: 1,
  maxOrdersPerMinute: 60,
  circuitBreaker: {}
};

/**
 * Risk manager for pre-trade and position risk checks
 */
export class RiskManager {
  private config: RiskConfig;
  private orderCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    circuitBreaker.updateConfig(this.config.circuitBreaker);
  }

  /**
   * Initialize risk manager for a strategy
   */
  initializeStrategy(strategy: string, initialEquity: number = 0): void {
    circuitBreaker.initializeStrategy(strategy, initialEquity);
    logger.info(`Risk manager initialized for strategy ${strategy}`);
  }

  /**
   * Pre-trade risk check
   */
  checkOrder(params: OrderRiskParams): RiskCheckResult {
    const warnings: string[] = [];
    const orderValue = new Decimal(params.quantity).times(params.price);

    // Check circuit breaker
    if (!circuitBreaker.canTrade(params.strategy)) {
      return {
        allowed: false,
        reason: `Circuit breaker is triggered for ${params.strategy}`,
        warnings
      };
    }

    // Check minimum order size
    if (orderValue.lessThan(this.config.minOrderSizeUSD)) {
      return {
        allowed: false,
        reason: `Order value $${orderValue.toFixed(2)} below minimum $${this.config.minOrderSizeUSD}`,
        warnings
      };
    }

    // Check rate limiting
    if (!this.checkRateLimit(params.strategy)) {
      return {
        allowed: false,
        reason: `Rate limit exceeded for ${params.strategy}`,
        warnings
      };
    }

    // Get current position
    const currentPosition = positionTracker.getPosition(params.strategy, params.marketSymbol);
    const currentSize = currentPosition?.valueUSD || 0;

    // Calculate new position size after order
    let newPositionValue: Decimal;
    if (params.side === 'BUY') {
      newPositionValue = new Decimal(currentSize).plus(orderValue);
    } else {
      newPositionValue = new Decimal(currentSize).minus(orderValue);
    }

    // Check max position per pair
    if (newPositionValue.abs().greaterThan(this.config.maxPositionUSD)) {
      const maxAllowedOrder = new Decimal(this.config.maxPositionUSD)
        .minus(Math.abs(currentSize));

      if (maxAllowedOrder.lessThanOrEqualTo(0)) {
        return {
          allowed: false,
          reason: `Position limit reached for ${params.marketSymbol}. Current: $${currentSize.toFixed(2)}, Max: $${this.config.maxPositionUSD}`,
          warnings
        };
      }

      warnings.push(`Order size reduced to stay within position limit`);
      return {
        allowed: true,
        reason: 'Order size adjusted to comply with position limit',
        adjustedSize: maxAllowedOrder.div(params.price).toNumber(),
        warnings
      };
    }

    // Check total exposure
    const currentExposure = positionTracker.getTotalExposure();
    const newTotalExposure = new Decimal(currentExposure.totalExposureUSD)
      .plus(orderValue);

    if (newTotalExposure.greaterThan(this.config.maxTotalExposureUSD)) {
      const availableExposure = new Decimal(this.config.maxTotalExposureUSD)
        .minus(currentExposure.totalExposureUSD);

      if (availableExposure.lessThanOrEqualTo(0)) {
        return {
          allowed: false,
          reason: `Total exposure limit reached. Current: $${currentExposure.totalExposureUSD.toFixed(2)}, Max: $${this.config.maxTotalExposureUSD}`,
          warnings
        };
      }

      warnings.push(`Order size reduced to stay within total exposure limit`);
      return {
        allowed: true,
        reason: 'Order size adjusted to comply with exposure limit',
        adjustedSize: availableExposure.div(params.price).toNumber(),
        warnings
      };
    }

    // All checks passed
    return {
      allowed: true,
      reason: 'Order approved',
      warnings
    };
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(strategy: string): boolean {
    const now = Date.now();
    const data = this.orderCounts.get(strategy);

    if (!data || now >= data.resetTime) {
      this.orderCounts.set(strategy, {
        count: 1,
        resetTime: now + 60000 // Reset after 1 minute
      });
      return true;
    }

    if (data.count >= this.config.maxOrdersPerMinute) {
      logger.warn(`Rate limit exceeded for ${strategy}: ${data.count}/${this.config.maxOrdersPerMinute} orders/min`);
      return false;
    }

    data.count++;
    return true;
  }

  /**
   * Record a completed trade for risk tracking
   */
  recordTrade(
    strategy: string,
    marketSymbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    pnl?: number
  ): void {
    // Update position
    positionTracker.addToPosition(strategy, marketSymbol, side, quantity, price);

    // Record trade result in circuit breaker
    if (pnl !== undefined) {
      circuitBreaker.recordTradeResult(strategy, pnl);
    }
  }

  /**
   * Update current price for position tracking
   */
  updatePrice(marketSymbol: string, price: number): void {
    positionTracker.updatePrice(marketSymbol, price);
  }

  /**
   * Update equity for drawdown calculation
   */
  updateEquity(strategy: string, equity: number): boolean {
    return circuitBreaker.updateEquity(strategy, equity);
  }

  /**
   * Get current risk status
   */
  getRiskStatus(strategy: string): {
    canTrade: boolean;
    exposure: Exposure;
    circuitBreaker: CircuitBreakerState | null;
    positions: Position[];
    warnings: string[];
  } {
    const exposure = positionTracker.getExposure(strategy);
    const cbState = circuitBreaker.getState(strategy);
    const positions = positionTracker.getPositionsByStrategy(strategy);
    const warnings: string[] = [];

    // Check for warnings
    if (exposure.totalExposureUSD > this.config.maxTotalExposureUSD * 0.8) {
      warnings.push(`Approaching total exposure limit (${(exposure.totalExposureUSD / this.config.maxTotalExposureUSD * 100).toFixed(1)}%)`);
    }

    if (cbState?.drawdownPercent && cbState.drawdownPercent > (this.config.circuitBreaker.maxDrawdownPercent || 5) * 0.7) {
      warnings.push(`Elevated drawdown: ${cbState.drawdownPercent.toFixed(2)}%`);
    }

    if (cbState?.consecutiveLosses && cbState.consecutiveLosses >= 5) {
      warnings.push(`${cbState.consecutiveLosses} consecutive losses`);
    }

    return {
      canTrade: circuitBreaker.canTrade(strategy),
      exposure,
      circuitBreaker: cbState,
      positions,
      warnings
    };
  }

  /**
   * Get all risk statuses
   */
  getAllRiskStatuses(): Map<string, ReturnType<typeof this.getRiskStatus>> {
    const statuses = new Map();
    const allStates = circuitBreaker.getAllStates();

    for (const state of allStates) {
      statuses.set(state.strategy, this.getRiskStatus(state.strategy));
    }

    return statuses;
  }

  /**
   * Kill switch - halt all trading and optionally flatten positions
   */
  async killSwitch(strategy: string, reason: string = 'Manual kill switch'): Promise<void> {
    circuitBreaker.killSwitch(strategy, reason);
    this.logRiskEvent('KILL_SWITCH', 'CRITICAL', strategy, reason, 'Trading halted');
    logger.error(`KILL SWITCH activated for ${strategy}: ${reason}`);
  }

  /**
   * Kill switch for all strategies
   */
  async globalKillSwitch(reason: string = 'Global kill switch'): Promise<void> {
    const allStates = circuitBreaker.getAllStates();
    for (const state of allStates) {
      await this.killSwitch(state.strategy, reason);
    }
    logger.error(`GLOBAL KILL SWITCH activated: ${reason}`);
  }

  /**
   * Reset circuit breaker for a strategy
   */
  resetCircuitBreaker(strategy: string, reason: string = 'Manual reset'): void {
    circuitBreaker.reset(strategy, reason);
  }

  /**
   * Log risk event
   */
  private logRiskEvent(
    eventType: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    strategy: string,
    message: string,
    actionTaken?: string,
    thresholdValue?: number,
    actualValue?: number
  ): void {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO risk_events (event_type, severity, strategy, threshold_value, actual_value, action_taken, message, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        eventType,
        severity,
        strategy,
        thresholdValue ?? null,
        actualValue ?? null,
        actionTaken ?? null,
        message,
        getCurrentTimestamp()
      );
    } catch (error) {
      logger.error('Failed to log risk event:', error);
    }
  }

  /**
   * Save position and exposure snapshots
   */
  saveSnapshots(strategy: string): void {
    positionTracker.saveSnapshot(strategy);
    positionTracker.saveExposureHistory(strategy);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.circuitBreaker) {
      circuitBreaker.updateConfig(config.circuitBreaker);
    }
    logger.info('Risk manager config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Get position tracker instance
   */
  getPositionTracker() {
    return positionTracker;
  }

  /**
   * Get circuit breaker instance
   */
  getCircuitBreaker() {
    return circuitBreaker;
  }
}

// Create singleton with default config
export const riskManager = new RiskManager();

// Re-export for convenience
export { positionTracker, circuitBreaker };
