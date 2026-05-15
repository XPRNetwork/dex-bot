import { getConfig, getLogger } from './utils';

const logger = getLogger();

export type Venue = 'proton' | 'solana';

export interface TradePayload {
  instanceId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  fee?: number;
  mode: 'live' | 'paper';
  mockId?: string;
  data?: Record<string, unknown>;

  venue: Venue;
  dex?: string;
  txId?: string;
  timestamp?: string;

  sentAmount?: number;
  sentCurrency?: string;
  sentContract?: string;
  receivedAmount?: number;
  receivedCurrency?: string;
  receivedContract?: string;
  feeCurrency?: string;
  usdValue?: number;
}

interface DashboardConfig {
  url: string;
  apiKey: string;
  instanceId: string;
  enabled: boolean;
}

class TradesEmitter {
  private config: DashboardConfig | null = null;

  initialize(): void {
    try {
      const dash = getConfig().dashboard;
      if (!dash?.url || !dash?.apiKey || !dash?.instanceId) {
        logger.info('Dashboard trades emitter disabled: missing configuration');
        this.config = null;
        return;
      }
      this.config = {
        url: dash.url,
        apiKey: dash.apiKey,
        instanceId: dash.instanceId,
        enabled: dash.enabled !== false,
      };
    } catch (err) {
      logger.warn('Failed to initialize trades emitter:', err);
      this.config = null;
    }
  }

  async emit(payload: TradePayload, maxRetries = 3): Promise<boolean> {
    if (!this.config?.enabled) return false;
    const url = `${this.config.url}/api/trades`;
    let lastErr: string | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) return true;
        lastErr = `HTTP ${res.status}: ${await res.text().catch(() => '<no body>')}`;
        logger.warn(`[trades] attempt ${attempt}/${maxRetries} failed: ${lastErr}`);
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        logger.warn(`[trades] attempt ${attempt}/${maxRetries} threw: ${lastErr}`);
      }
    }
    logger.error(`[trades] dropping trade after ${maxRetries} attempts: ${lastErr}`);
    return false;
  }
}

export const tradesEmitter = new TradesEmitter();
