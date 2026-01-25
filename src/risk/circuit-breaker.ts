import { getDatabase, getCurrentTimestamp } from '../persistence/database.js';
import { getLogger } from '../utils.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface CircuitBreakerConfig {
  enabled: boolean;
  maxDrawdownPercent: number;      // Max drawdown before triggering (e.g., 5 = 5%)
  dailyLossLimitUSD: number;       // Max daily loss in USD
  consecutiveLossLimit: number;    // Max consecutive losing trades
  cooldownMinutes: number;         // Time to wait before auto-reset
  autoReset: boolean;              // Auto-reset after cooldown
}

export interface CircuitBreakerState {
  strategy: string;
  isTriggered: boolean;
  triggeredAt: string | null;
  triggerReason: string | null;
  resetAt: string | null;
  consecutiveLosses: number;
  drawdownPercent: number;
  peakEquity: number;
  currentEquity: number;
  dailyLoss: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  maxDrawdownPercent: 5,
  dailyLossLimitUSD: 1000,
  consecutiveLossLimit: 10,
  cooldownMinutes: 60,
  autoReset: false
};

/**
 * Circuit breaker for halting trading on excessive losses
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private states: Map<string, CircuitBreakerState> = new Map();
  private dailyLosses: Map<string, { date: string; loss: number }> = new Map();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize state for a strategy
   */
  initializeStrategy(strategy: string, initialEquity: number = 0): void {
    const existing = this.states.get(strategy);
    if (existing && existing.isTriggered) {
      logger.warn(`Strategy ${strategy} circuit breaker is already triggered`);
      return;
    }

    this.states.set(strategy, {
      strategy,
      isTriggered: false,
      triggeredAt: null,
      triggerReason: null,
      resetAt: null,
      consecutiveLosses: 0,
      drawdownPercent: 0,
      peakEquity: initialEquity,
      currentEquity: initialEquity,
      dailyLoss: 0
    });

    this.loadStateFromDatabase(strategy);
    logger.info(`Circuit breaker initialized for strategy ${strategy}`);
  }

  /**
   * Load state from database
   */
  private loadStateFromDatabase(strategy: string): void {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT * FROM circuit_breaker_state WHERE strategy = ?
      `);
      const row = stmt.get(strategy) as any;

      if (row) {
        const state = this.states.get(strategy)!;
        state.isTriggered = row.is_triggered === 1;
        state.triggeredAt = row.triggered_at;
        state.triggerReason = row.trigger_reason;
        state.resetAt = row.reset_at;
        state.consecutiveLosses = row.consecutive_losses || 0;
        state.drawdownPercent = row.drawdown_percent || 0;
      }
    } catch (error) {
      logger.debug('Could not load circuit breaker state from database');
    }
  }

  /**
   * Save state to database
   */
  private saveStateToDatabase(strategy: string): void {
    try {
      const db = getDatabase();
      const state = this.states.get(strategy);
      if (!state) return;

      const stmt = db.prepare(`
        INSERT INTO circuit_breaker_state (strategy, is_triggered, triggered_at, trigger_reason, reset_at, consecutive_losses, drawdown_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(strategy) DO UPDATE SET
          is_triggered = excluded.is_triggered,
          triggered_at = excluded.triggered_at,
          trigger_reason = excluded.trigger_reason,
          reset_at = excluded.reset_at,
          consecutive_losses = excluded.consecutive_losses,
          drawdown_percent = excluded.drawdown_percent
      `);

      stmt.run(
        state.strategy,
        state.isTriggered ? 1 : 0,
        state.triggeredAt,
        state.triggerReason,
        state.resetAt,
        state.consecutiveLosses,
        state.drawdownPercent
      );
    } catch (error) {
      logger.error('Failed to save circuit breaker state:', error);
    }
  }

  /**
   * Log a risk event to database
   */
  private logRiskEvent(
    eventType: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    strategy: string,
    message: string,
    thresholdValue?: number,
    actualValue?: number,
    actionTaken?: string
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
   * Check if trading is allowed for a strategy
   */
  canTrade(strategy: string): boolean {
    if (!this.config.enabled) return true;

    const state = this.states.get(strategy);
    if (!state) {
      this.initializeStrategy(strategy);
      return true;
    }

    if (state.isTriggered) {
      // Check for auto-reset
      if (this.config.autoReset && state.triggeredAt) {
        const triggerTime = new Date(state.triggeredAt).getTime();
        const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
        if (Date.now() - triggerTime >= cooldownMs) {
          this.reset(strategy, 'Auto-reset after cooldown');
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Update equity and check drawdown
   */
  updateEquity(strategy: string, currentEquity: number): boolean {
    const state = this.states.get(strategy);
    if (!state) {
      this.initializeStrategy(strategy, currentEquity);
      return true;
    }

    state.currentEquity = currentEquity;

    // Update peak equity
    if (currentEquity > state.peakEquity) {
      state.peakEquity = currentEquity;
    }

    // Calculate drawdown
    if (state.peakEquity > 0) {
      const drawdown = new Decimal(state.peakEquity)
        .minus(currentEquity)
        .div(state.peakEquity)
        .times(100);
      state.drawdownPercent = drawdown.toNumber();

      // Check if drawdown exceeds limit
      if (state.drawdownPercent >= this.config.maxDrawdownPercent) {
        this.trigger(strategy, 'DRAWDOWN_ALERT',
          `Drawdown ${state.drawdownPercent.toFixed(2)}% exceeds limit ${this.config.maxDrawdownPercent}%`);
        return false;
      }
    }

    return true;
  }

  /**
   * Record a trade result
   */
  recordTradeResult(strategy: string, pnl: number): boolean {
    const state = this.states.get(strategy);
    if (!state) {
      this.initializeStrategy(strategy);
      return true;
    }

    // Update consecutive losses
    if (pnl < 0) {
      state.consecutiveLosses++;

      // Check consecutive loss limit
      if (state.consecutiveLosses >= this.config.consecutiveLossLimit) {
        this.trigger(strategy, 'CIRCUIT_BREAKER',
          `${state.consecutiveLosses} consecutive losses exceeds limit ${this.config.consecutiveLossLimit}`);
        return false;
      }
    } else {
      state.consecutiveLosses = 0;
    }

    // Update daily loss
    const today = new Date().toISOString().split('T')[0];
    const dailyData = this.dailyLosses.get(strategy);

    if (!dailyData || dailyData.date !== today) {
      this.dailyLosses.set(strategy, { date: today, loss: pnl < 0 ? Math.abs(pnl) : 0 });
    } else if (pnl < 0) {
      dailyData.loss += Math.abs(pnl);
      state.dailyLoss = dailyData.loss;

      // Check daily loss limit
      if (dailyData.loss >= this.config.dailyLossLimitUSD) {
        this.trigger(strategy, 'DAILY_LOSS_LIMIT',
          `Daily loss $${dailyData.loss.toFixed(2)} exceeds limit $${this.config.dailyLossLimitUSD}`);
        return false;
      }
    }

    this.saveStateToDatabase(strategy);
    return true;
  }

  /**
   * Trigger the circuit breaker
   */
  trigger(strategy: string, eventType: string, reason: string): void {
    const state = this.states.get(strategy);
    if (!state || state.isTriggered) return;

    state.isTriggered = true;
    state.triggeredAt = getCurrentTimestamp();
    state.triggerReason = reason;

    logger.error(`CIRCUIT BREAKER TRIGGERED for ${strategy}: ${reason}`);

    this.logRiskEvent(
      eventType,
      'CRITICAL',
      strategy,
      reason,
      undefined,
      undefined,
      'Trading halted'
    );

    this.saveStateToDatabase(strategy);
  }

  /**
   * Manually trigger kill switch
   */
  killSwitch(strategy: string, reason: string = 'Manual kill switch'): void {
    this.trigger(strategy, 'KILL_SWITCH', reason);
    logger.error(`KILL SWITCH activated for ${strategy}: ${reason}`);
  }

  /**
   * Reset the circuit breaker
   */
  reset(strategy: string, reason: string = 'Manual reset'): void {
    const state = this.states.get(strategy);
    if (!state) return;

    state.isTriggered = false;
    state.triggeredAt = null;
    state.triggerReason = null;
    state.resetAt = getCurrentTimestamp();
    state.consecutiveLosses = 0;
    state.dailyLoss = 0;

    // Reset daily losses
    this.dailyLosses.delete(strategy);

    logger.info(`Circuit breaker reset for ${strategy}: ${reason}`);

    this.logRiskEvent(
      'CIRCUIT_BREAKER',
      'INFO',
      strategy,
      `Circuit breaker reset: ${reason}`,
      undefined,
      undefined,
      'Trading resumed'
    );

    this.saveStateToDatabase(strategy);
  }

  /**
   * Get circuit breaker state
   */
  getState(strategy: string): CircuitBreakerState | null {
    return this.states.get(strategy) || null;
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Circuit breaker config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Check if any circuit breaker is triggered
   */
  isAnyTriggered(): boolean {
    for (const state of this.states.values()) {
      if (state.isTriggered) return true;
    }
    return false;
  }

  /**
   * Get triggered strategies
   */
  getTriggeredStrategies(): string[] {
    const triggered: string[] = [];
    for (const state of this.states.values()) {
      if (state.isTriggered) {
        triggered.push(state.strategy);
      }
    }
    return triggered;
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();
