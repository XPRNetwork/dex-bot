/**
 * Telegram Notification Service
 *
 * Sends trading alerts and summaries to Telegram.
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Get chat ID via @userinfobot
 * 3. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars
 *    or configure in config.json
 */

import { getConfig, getLogger } from '../utils.js';

const logger = getLogger();

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  alertOn: {
    tradeExecuted: boolean;
    orderPlaced: boolean;
    orderCancelled: boolean;
    profitThresholdUSD: number;
    circuitBreakerTriggered: boolean;
    riskWarning: boolean;
    dailySummary: boolean;
    errorAlert: boolean;
  };
  // Rate limiting
  maxMessagesPerMinute: number;
  // Quiet hours (no notifications)
  quietHoursStart?: number;  // 0-23
  quietHoursEnd?: number;    // 0-23
}

const DEFAULT_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  alertOn: {
    tradeExecuted: true,
    orderPlaced: false,
    orderCancelled: false,
    profitThresholdUSD: 10,
    circuitBreakerTriggered: true,
    riskWarning: true,
    dailySummary: true,
    errorAlert: true
  },
  maxMessagesPerMinute: 20
};

interface MessageQueue {
  message: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high';
}

interface InlineButton {
  text: string;
  callback_data: string;
}

type CallbackHandler = (data: string, callbackQueryId: string) => void;

/**
 * Telegram notification service
 */
export class TelegramNotifier {
  private config: TelegramConfig;
  private messageQueue: MessageQueue[] = [];
  private sentMessages: Date[] = [];
  private isInitialized = false;
  private callbackHandlers: CallbackHandler[] = [];
  private callbackPollTimer: NodeJS.Timeout | null = null;
  private callbackOffset: number = 0;
  private processedCallbackIds: Set<string> = new Set();

  constructor(config?: Partial<TelegramConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the notifier
   */
  initialize(config?: Partial<TelegramConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Check for env vars
    if (!this.config.botToken) {
      this.config.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    }
    if (!this.config.chatId) {
      this.config.chatId = process.env.TELEGRAM_CHAT_ID || '';
    }

    if (this.config.enabled && this.config.botToken && this.config.chatId) {
      this.isInitialized = true;
      logger.info('Telegram notifier initialized');

      // Startup message disabled during development
      // this.sendMessage('🤖 *DEX Bot Started*\n\nBot is now online and trading.', 'high');
    } else if (this.config.enabled) {
      logger.warn('Telegram enabled but missing botToken or chatId');
    }
  }

  /**
   * Check if notifier is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.config.enabled;
  }

  /**
   * Check if we're in quiet hours
   */
  private isQuietHours(): boolean {
    if (this.config.quietHoursStart === undefined || this.config.quietHoursEnd === undefined) {
      return false;
    }

    const hour = new Date().getHours();
    const start = this.config.quietHoursStart;
    const end = this.config.quietHoursEnd;

    if (start <= end) {
      return hour >= start && hour < end;
    } else {
      // Wraps around midnight
      return hour >= start || hour < end;
    }
  }

  /**
   * Check rate limit
   */
  private isRateLimited(): boolean {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Clean old entries
    this.sentMessages = this.sentMessages.filter(t => t > oneMinuteAgo);

    return this.sentMessages.length >= this.config.maxMessagesPerMinute;
  }

  /**
   * Send a message via Telegram API
   */
  async sendMessage(text: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    // Skip low priority during quiet hours
    if (this.isQuietHours() && priority === 'low') {
      return false;
    }

    // Rate limit check (allow high priority to bypass)
    if (this.isRateLimited() && priority !== 'high') {
      this.messageQueue.push({ message: text, timestamp: new Date(), priority });
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

      // Convert Markdown to HTML for more reliable parsing
      const htmlText = text
        .replace(/\*([^*]+)\*/g, '<b>$1</b>')  // *bold* -> <b>bold</b>
        .replace(/_([^_]+)_/g, '<i>$1</i>')    // _italic_ -> <i>italic</i>
        .replace(/`([^`]+)`/g, '<code>$1</code>'); // `code` -> <code>code</code>

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Telegram API error (${response.status}): ${errorText}`);
        return false;
      }

      this.sentMessages.push(new Date());
      return true;

    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
      return false;
    }
  }

  /**
   * Process queued messages
   */
  async processQueue(): Promise<void> {
    if (this.messageQueue.length === 0 || this.isRateLimited()) {
      return;
    }

    // Sort by priority and timestamp
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    const message = this.messageQueue.shift();
    if (message) {
      await this.sendMessage(message.message, message.priority);
    }
  }

  // ==================== Inline Keyboard & Callbacks ====================

  /**
   * Send a message with inline keyboard buttons.
   * Returns the message_id of the sent message, or 0 on failure.
   */
  async sendMessageWithButtons(
    text: string,
    buttons: InlineButton[][],
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<number> {
    if (!this.isReady()) return 0;

    if (this.isQuietHours() && priority === 'low') return 0;
    if (this.isRateLimited() && priority !== 'high') return 0;

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

      const htmlText = text
        .replace(/\*([^*]+)\*/g, '<b>$1</b>')
        .replace(/_([^_]+)_/g, '<i>$1</i>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: buttons
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Telegram API error (${response.status}): ${errorText}`);
        return 0;
      }

      const result = await response.json() as any;
      this.sentMessages.push(new Date());
      return result.result?.message_id ?? 0;

    } catch (error) {
      logger.error('Failed to send Telegram message with buttons:', error);
      return 0;
    }
  }

  /**
   * Register a callback query handler.
   */
  onCallback(handler: CallbackHandler): void {
    this.callbackHandlers.push(handler);
  }

  /**
   * Start polling for callback queries every 2 seconds.
   */
  startCallbackPolling(): void {
    if (!this.isReady()) {
      logger.debug('Telegram not ready, skipping callback polling');
      return;
    }

    if (this.callbackPollTimer) return; // already running

    logger.info('Telegram callback polling started');
    this.callbackPollTimer = setInterval(() => this.pollCallbacks(), 2000);
  }

  /**
   * Stop callback polling.
   */
  stopCallbackPolling(): void {
    if (this.callbackPollTimer) {
      clearInterval(this.callbackPollTimer);
      this.callbackPollTimer = null;
      logger.info('Telegram callback polling stopped');
    }
  }

  private async pollCallbacks(): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: this.callbackOffset,
          timeout: 0,
          allowed_updates: ['callback_query']
        })
      });

      if (!response.ok) return;

      const data = await response.json() as any;
      const updates: any[] = data.result || [];

      for (const update of updates) {
        this.callbackOffset = update.update_id + 1;

        if (!update.callback_query) continue;

        const cbData = update.callback_query.data as string;
        const cbId = update.callback_query.id as string;

        // Deduplicate — skip if we already processed this callback
        if (this.processedCallbackIds.has(cbId)) continue;
        this.processedCallbackIds.add(cbId);

        logger.info(`Telegram callback received: ${cbData} (id: ${cbId})`);

        // Answer the callback to dismiss the spinner
        await this.answerCallbackQuery(cbId);

        // Dispatch to handlers
        for (const handler of this.callbackHandlers) {
          try {
            handler(cbData, cbId);
          } catch (err) {
            logger.error('Callback handler error:', err);
          }
        }
      }
      // Keep dedup set from growing forever
      if (this.processedCallbackIds.size > 1000) {
        this.processedCallbackIds.clear();
      }
    } catch (error) {
      logger.debug('Callback poll error:', error);
    }
  }

  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/answerCallbackQuery`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId })
      });
    } catch {
      // best-effort
    }
  }

  // ==================== Alert Methods ====================

  /**
   * Alert: Trade executed
   */
  async alertTradeExecuted(trade: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    pnl?: number;
  }): Promise<void> {
    if (!this.config.alertOn.tradeExecuted) return;

    const emoji = trade.side === 'BUY' ? '🟢' : '🔴';
    const pnlText = trade.pnl !== undefined
      ? `\nP&L: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`
      : '';

    // Only alert if profit exceeds threshold
    if (trade.pnl !== undefined && Math.abs(trade.pnl) < this.config.alertOn.profitThresholdUSD) {
      return;
    }

    const message = `${emoji} *Trade Executed*

Symbol: \`${trade.symbol}\`
Side: ${trade.side}
Quantity: ${trade.quantity}
Price: ${trade.price}${pnlText}`;

    await this.sendMessage(message, 'normal');
  }

  /**
   * Alert: Order placed
   */
  async alertOrderPlaced(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    orderId?: string;
  }): Promise<void> {
    if (!this.config.alertOn.orderPlaced) return;

    const emoji = order.side === 'BUY' ? '📗' : '📕';

    const message = `${emoji} *Order Placed*

Symbol: \`${order.symbol}\`
Side: ${order.side}
Quantity: ${order.quantity}
Price: ${order.price}`;

    await this.sendMessage(message, 'low');
  }

  /**
   * Alert: Circuit breaker triggered
   */
  async alertCircuitBreaker(reason: string, strategy: string): Promise<void> {
    if (!this.config.alertOn.circuitBreakerTriggered) return;

    const message = `🚨 *CIRCUIT BREAKER TRIGGERED*

Strategy: \`${strategy}\`
Reason: ${reason}

Trading has been halted. Manual review required.`;

    await this.sendMessage(message, 'high');
  }

  /**
   * Alert: Risk warning
   */
  async alertRiskWarning(warnings: string[], strategy: string): Promise<void> {
    if (!this.config.alertOn.riskWarning) return;

    const message = `⚠️ *Risk Warning*

Strategy: \`${strategy}\`
Warnings:
${warnings.map(w => `• ${w}`).join('\n')}`;

    await this.sendMessage(message, 'normal');
  }

  /**
   * Alert: Error
   */
  async alertError(error: string, context?: string): Promise<void> {
    if (!this.config.alertOn.errorAlert) return;

    const message = `❌ *Error*

${context ? `Context: ${context}\n` : ''}Error: ${error}`;

    await this.sendMessage(message, 'high');
  }

  /**
   * Alert: Daily summary
   */
  async alertDailySummary(summary: {
    date: string;
    realizedPnL: number;
    unrealizedPnL: number;
    tradesCount: number;
    volumeUSD: number;
    winRate: number;
    strategies: { name: string; pnl: number; trades: number }[];
  }): Promise<void> {
    if (!this.config.alertOn.dailySummary) return;

    const totalPnL = summary.realizedPnL + summary.unrealizedPnL;
    const pnlEmoji = totalPnL >= 0 ? '📈' : '📉';

    const strategyLines = summary.strategies
      .map(s => `• ${s.name}: ${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(2)} (${s.trades} trades)`)
      .join('\n');

    const message = `${pnlEmoji} *Daily Summary - ${summary.date}*

💰 *P&L*
Realized: ${summary.realizedPnL >= 0 ? '+' : ''}$${summary.realizedPnL.toFixed(2)}
Unrealized: ${summary.unrealizedPnL >= 0 ? '+' : ''}$${summary.unrealizedPnL.toFixed(2)}
*Total: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}*

📊 *Stats*
Trades: ${summary.tradesCount}
Volume: $${summary.volumeUSD.toFixed(2)}
Win Rate: ${(summary.winRate * 100).toFixed(1)}%

📋 *By Strategy*
${strategyLines}`;

    await this.sendMessage(message, 'normal');
  }

  /**
   * Alert: Arbitrage opportunity found
   */
  async alertArbitrageOpportunity(opportunity: {
    poolSymbol: string;
    direction: 'AMM_TO_DEX' | 'DEX_TO_AMM';
    profitBPS: number;
    profitUSD: number;
    executed: boolean;
  }): Promise<void> {
    if (opportunity.profitUSD < this.config.alertOn.profitThresholdUSD) return;

    const emoji = opportunity.executed ? '✅' : '👀';
    const directionText = opportunity.direction === 'AMM_TO_DEX'
      ? 'Buy AMM → Sell DEX'
      : 'Buy DEX → Sell AMM';

    const message = `${emoji} *Arbitrage ${opportunity.executed ? 'Executed' : 'Detected'}*

Pool: \`${opportunity.poolSymbol}\`
Direction: ${directionText}
Profit: ${opportunity.profitBPS} BPS (~$${opportunity.profitUSD.toFixed(2)})`;

    await this.sendMessage(message, opportunity.executed ? 'normal' : 'low');
  }

  /**
   * Alert: Balance change
   */
  async alertBalanceChange(changes: {
    token: string;
    before: number;
    after: number;
    reason: string;
  }[]): Promise<void> {
    const significantChanges = changes.filter(c => Math.abs(c.after - c.before) > 0.01);
    if (significantChanges.length === 0) return;

    const lines = significantChanges.map(c => {
      const diff = c.after - c.before;
      const emoji = diff >= 0 ? '⬆️' : '⬇️';
      return `${emoji} ${c.token}: ${c.before.toFixed(4)} → ${c.after.toFixed(4)} (${c.reason})`;
    });

    const message = `💼 *Balance Update*

${lines.join('\n')}`;

    await this.sendMessage(message, 'low');
  }

  /**
   * Send custom message
   */
  async notify(message: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<void> {
    await this.sendMessage(message, priority);
  }

  /**
   * Send status report with balances and bot health
   */
  async sendStatusReport(status: {
    balances: { token: string; amount: number; valueUSD: number; price?: number }[];
    totalValueUSD: number;
    startingValueUSD?: number;
    pnlUSD?: number;
    pnlPercent?: number;
    activePairs: string[];
    lastTradeTime?: Date;
    tradesLast24h?: number;
    profitLast24h?: number;
    uptime?: string;
    health: 'healthy' | 'warning' | 'error';
    healthMessage?: string;
  }): Promise<void> {
    const healthEmoji = status.health === 'healthy' ? '🟢' : status.health === 'warning' ? '🟡' : '🔴';
    const pnlEmoji = (status.pnlUSD ?? 0) >= 0 ? '📈' : '📉';

    const balanceLines = status.balances
      .filter(b => b.amount > 0.001 || b.valueUSD > 0.01)
      .map(b => {
        const priceStr = b.price !== undefined && b.price !== 1.0
          ? ` @$${b.price < 0.01 ? b.price.toFixed(6) : b.price.toFixed(4)}`
          : '';
        const decimals = b.token === 'XUSDC' || b.token === 'XMD' ? 2 : (b.token === 'LOAN' ? 0 : 4);
        return `• ${b.token}: ${b.amount.toFixed(decimals)}${priceStr} ($${b.valueUSD.toFixed(2)})`;
      })
      .join('\n');

    const pnlSection = status.pnlUSD !== undefined && status.startingValueUSD !== undefined
      ? `\n${pnlEmoji} *P&L*
Start: $${status.startingValueUSD.toFixed(2)}
Current: $${status.totalValueUSD.toFixed(2)}
Change: ${status.pnlUSD >= 0 ? '+' : ''}$${status.pnlUSD.toFixed(2)} (${status.pnlPercent?.toFixed(2) ?? 0}%)`
      : '';

    const statsSection = status.tradesLast24h !== undefined
      ? `\n\n📊 *24h Stats*
Trades: ${status.tradesLast24h}
Profit: ${(status.profitLast24h ?? 0) >= 0 ? '+' : ''}$${(status.profitLast24h ?? 0).toFixed(2)}`
      : '';

    const lastTradeText = status.lastTradeTime
      ? `\nLast trade: ${this.formatTimeAgo(status.lastTradeTime)}`
      : '';

    const message = `${healthEmoji} *Bot Status Report*

💰 *Balances*
${balanceLines}
*Total: $${status.totalValueUSD.toFixed(2)}*${pnlSection}${statsSection}

⚙️ *Config*
Pairs: ${status.activePairs.join(', ') || 'None'}${lastTradeText}
${status.uptime ? `Uptime: ${status.uptime}` : ''}
${status.healthMessage ? `\n${status.healthMessage}` : ''}`;

    await this.sendMessage(message, 'normal');
  }

  /**
   * Format time ago string
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Send hourly summary
   */
  async sendHourlySummary(stats: {
    totalValueUSD: number;
    hourlyPnL: number;
    tradesThisHour: number;
    opportunities: number;
    bestOpportunity?: { pair: string; profitBPS: number };
  }): Promise<void> {
    const emoji = stats.hourlyPnL >= 0 ? '📈' : '📉';

    const message = `⏰ *Hourly Update*

Portfolio: $${stats.totalValueUSD.toFixed(2)}
Hour P&L: ${stats.hourlyPnL >= 0 ? '+' : ''}$${stats.hourlyPnL.toFixed(2)}
Trades: ${stats.tradesThisHour}
Opportunities: ${stats.opportunities}${stats.bestOpportunity ? `\nBest: ${stats.bestOpportunity.pair} (${stats.bestOpportunity.profitBPS} BPS)` : ''}`;

    await this.sendMessage(message, 'low');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.alertOn) {
      this.config.alertOn = { ...DEFAULT_CONFIG.alertOn, ...config.alertOn };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TelegramConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const telegramNotifier = new TelegramNotifier();
