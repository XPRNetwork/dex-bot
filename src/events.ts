import { getConfig, getLogger } from './utils';

const logger = getLogger();

export type EventCategory = 'trade' | 'order' | 'balance' | 'error' | 'system' | 'alert';
export type EventSeverity = 'info' | 'warning' | 'error' | 'success';
export type EventType =
  | 'order_placed'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_held'
  | 'order_failed'
  | 'bot_started'
  | 'bot_stopped'
  | 'bot_error'
  | 'balance_low'
  | 'balance_updated'
  | 'trade_executed'
  | 'grid_placed'
  | 'grid_adjusted'
  | 'swap_executed'
  | 'config_loaded'
  | 'market_data_error'
  | 'rpc_error'
  | 'health_restart';

export interface DashboardConfig {
  url: string;
  apiKey: string;
  instanceId: string;
  enabled: boolean;
}

interface EventPayload {
  instanceId: string;
  category: EventCategory;
  type: EventType;
  severity: EventSeverity;
  message: string;
  data?: Record<string, unknown>;
}

class EventEmitter {
  private config: DashboardConfig | null = null;
  private queue: EventPayload[] = [];
  private isProcessing = false;
  private retryCount = 0;
  private maxRetries = 3;
  private batchSize = 10;
  private flushInterval: NodeJS.Timeout | null = null;

  initialize(): void {
    try {
      const botConfig = getConfig();
      const dashboard = botConfig.dashboard;

      if (!dashboard?.url || !dashboard?.apiKey || !dashboard?.instanceId) {
        logger.info('Dashboard events disabled: missing configuration');
        this.config = null;
        return;
      }

      this.config = {
        url: dashboard.url,
        apiKey: dashboard.apiKey,
        instanceId: dashboard.instanceId,
        enabled: dashboard.enabled !== false,
      };

      if (this.config.enabled) {
        // Start flush interval to batch events
        this.flushInterval = setInterval(() => this.flush(), 5000);
        logger.info(`Dashboard events enabled: ${this.config.url}`);
      }
    } catch (error) {
      logger.warn('Failed to initialize dashboard events:', error);
      this.config = null;
    }
  }

  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flush();
  }

  private async sendEvent(payload: EventPayload): Promise<boolean> {
    if (!this.config?.enabled) return false;

    try {
      const response = await fetch(`${this.config.url}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.warn(`Failed to send event: ${response.status} - ${error}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Failed to send event to dashboard:', error);
      return false;
    }
  }

  private async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !this.config?.enabled) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process events in batches
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);

        for (const event of batch) {
          const success = await this.sendEvent(event);
          if (!success) {
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
              // Re-queue failed event
              this.queue.unshift(event);
            } else {
              logger.warn('Max retries exceeded, dropping event');
              this.retryCount = 0;
            }
          } else {
            this.retryCount = 0;
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private emit(
    category: EventCategory,
    type: EventType,
    severity: EventSeverity,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.config?.enabled) return;

    const payload: EventPayload = {
      instanceId: this.config.instanceId,
      category,
      type,
      severity,
      message,
      data,
    };

    this.queue.push(payload);

    // Immediately flush high-priority events
    if (severity === 'error' || type === 'bot_started' || type === 'bot_stopped' || type === 'health_restart') {
      this.flush();
    }
  }

  // System events
  botStarted(message = 'Bot started'): void {
    this.emit('system', 'bot_started', 'success', message);
  }

  botStopped(message = 'Bot stopped'): void {
    this.emit('system', 'bot_stopped', 'info', message);
  }

  botError(message: string, data?: Record<string, unknown>): void {
    this.emit('error', 'bot_error', 'error', message, data);
  }

  configLoaded(message: string, data?: Record<string, unknown>): void {
    this.emit('system', 'config_loaded', 'info', message, data);
  }

  // Order events
  orderPlaced(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'order_placed', 'success', message, data);
  }

  orderFilled(message: string, data?: Record<string, unknown>): void {
    this.emit('trade', 'order_filled', 'success', message, data);
  }

  orderCancelled(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'order_cancelled', 'info', message, data);
  }

  orderHeld(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'order_held', 'info', message, data);
  }

  orderFailed(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'order_failed', 'error', message, data);
  }

  // Trade events
  tradeExecuted(message: string, data?: Record<string, unknown>): void {
    this.emit('trade', 'trade_executed', 'success', message, data);
  }

  swapExecuted(message: string, data?: Record<string, unknown>): void {
    this.emit('trade', 'swap_executed', 'success', message, data);
  }

  // Grid events
  gridPlaced(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'grid_placed', 'success', message, data);
  }

  gridAdjusted(message: string, data?: Record<string, unknown>): void {
    this.emit('order', 'grid_adjusted', 'info', message, data);
  }

  // Balance events
  balanceLow(message: string, data?: Record<string, unknown>): void {
    this.emit('balance', 'balance_low', 'warning', message, data);
  }

  balanceUpdated(message: string, data?: Record<string, unknown>): void {
    this.emit('balance', 'balance_updated', 'info', message, data);
  }

  // Error events
  marketDataError(message: string, data?: Record<string, unknown>): void {
    this.emit('error', 'market_data_error', 'error', message, data);
  }

  rpcError(message: string, data?: Record<string, unknown>): void {
    this.emit('error', 'rpc_error', 'error', message, data);
  }

  healthRestart(message: string, data?: Record<string, unknown>): void {
    this.emit('system', 'health_restart', 'error', message, data);
  }

  // Generic event
  custom(
    category: EventCategory,
    type: EventType,
    severity: EventSeverity,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.emit(category, type, severity, message, data);
  }
}

// Singleton instance
export const events = new EventEmitter();
