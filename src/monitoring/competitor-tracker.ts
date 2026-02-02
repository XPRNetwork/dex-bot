/**
 * Competitor Tracker
 *
 * Monitors the blockchain for arbitrage trades by other accounts.
 * Detects AMM+DEX combo trades and calculates their profit.
 * Sends Telegram alerts when competitors make profitable trades.
 */

import { JsonRpc } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';
import { getDatabase } from '../persistence/database.js';

const logger = getLogger();

interface TradeAction {
  timestamp: string;
  account: string;
  action: string;
  contract: string;
  data: any;
  trxId: string;
}

interface PotentialArb {
  account: string;
  actions: TradeAction[];
  firstSeen: number;
}

interface DetectedArb {
  account: string;
  type: 'AMM_TO_DEX' | 'DEX_TO_AMM' | 'TRIANGLE';
  token: string;
  inputAmount: number;
  outputAmount: number;
  profitUsd: number;
  profitPercent: number;
  timestamp: string;
  trxIds: string[];
}

export class CompetitorTracker {
  private rpc: JsonRpc;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckedTime: string;
  private pendingArbs: Map<string, PotentialArb> = new Map();
  private seenTrxIds: Set<string> = new Set();
  private ourAccount: string;

  // Accounts to ignore (our own, known contracts, etc.)
  private ignoredAccounts: Set<string> = new Set([
    'proton.swaps',
    'dex',
    'xmd.treasury',
    'eosio.token',
    'xtokens',
    'xmd.token',
    'loan.token',
    'fees.swaps',
  ]);

  // Track recently alerted arbs to avoid duplicates
  private recentAlerts: Map<string, number> = new Map();

  constructor() {
    const config = getConfig() as any;
    const endpoints = config.bot?.rpc?.endpoints || ['https://proton.eosusa.io'];
    this.rpc = new JsonRpc(endpoints);
    this.ourAccount = process.env.PROTON_USERNAME || '';
    this.ignoredAccounts.add(this.ourAccount);

    // Start from 5 minutes ago
    const startTime = new Date(Date.now() - 5 * 60 * 1000);
    this.lastCheckedTime = startTime.toISOString();
  }

  async start(): Promise<void> {
    logger.info('Competitor tracker starting...');
    logger.info(`Ignoring accounts: ${this.ourAccount}, proton.swaps, dex, xmd.treasury`);

    // Check every 10 seconds
    this.checkInterval = setInterval(() => this.checkForArbitrages(), 10000);

    // Initial check
    await this.checkForArbitrages();
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Competitor tracker stopped');
  }

  private async checkForArbitrages(): Promise<void> {
    try {
      // Fetch recent AMM swaps
      const ammSwaps = await this.fetchRecentAmmSwaps();

      // Fetch recent DEX trades
      const dexTrades = await this.fetchRecentDexTrades();

      // Fetch recent treasury operations
      const treasuryOps = await this.fetchRecentTreasuryOps();

      // Combine and process
      const allActions = [...ammSwaps, ...dexTrades, ...treasuryOps];

      // Group by account
      this.processActions(allActions);

      // Check for completed arbitrages
      await this.detectCompletedArbitrages();

      // Update last checked time
      this.lastCheckedTime = new Date().toISOString();

      // Clean up old pending arbs (older than 2 minutes)
      this.cleanupOldPending();

      // Clean up old seen trxIds (keep last 1000)
      if (this.seenTrxIds.size > 1000) {
        const arr = Array.from(this.seenTrxIds);
        this.seenTrxIds = new Set(arr.slice(-500));
      }

    } catch (error: any) {
      logger.error(`Competitor tracker error: ${error.message}`);
    }
  }

  private async fetchRecentAmmSwaps(): Promise<TradeAction[]> {
    try {
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=proton.swaps&filter=*:transfer&limit=50&sort=desc`
      );
      const data: any = await response.json();

      if (!data.actions) return [];

      return data.actions
        .filter((a: any) => {
          // Filter for swap transfers (to proton.swaps with pool memo)
          const isSwap = a.act?.data?.to === 'proton.swaps' &&
                         a.act?.data?.memo?.includes(',');
          const isNew = !this.seenTrxIds.has(a.trx_id);
          return isSwap && isNew;
        })
        .map((a: any) => {
          this.seenTrxIds.add(a.trx_id);
          return {
            timestamp: a.timestamp,
            account: a.act?.data?.from,
            action: 'amm_swap',
            contract: 'proton.swaps',
            data: a.act?.data,
            trxId: a.trx_id
          };
        });
    } catch (error) {
      return [];
    }
  }

  private async fetchRecentDexTrades(): Promise<TradeAction[]> {
    try {
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=dex&filter=dex:process&limit=50&sort=desc`
      );
      const data: any = await response.json();

      if (!data.actions) return [];

      // Also fetch placeorder actions
      const orderResponse = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=dex&filter=dex:placeorder&limit=50&sort=desc`
      );
      const orderData: any = await orderResponse.json();

      const processActions = data.actions || [];
      const orderActions = orderData.actions || [];

      // Get the accounts that placed orders
      const results: TradeAction[] = [];

      for (const a of orderActions) {
        if (this.seenTrxIds.has(a.trx_id)) continue;
        this.seenTrxIds.add(a.trx_id);

        const account = a.act?.data?.account;
        if (!account) continue;

        results.push({
          timestamp: a.timestamp,
          account: account,
          action: 'dex_order',
          contract: 'dex',
          data: a.act?.data,
          trxId: a.trx_id
        });
      }

      return results;
    } catch (error) {
      return [];
    }
  }

  private async fetchRecentTreasuryOps(): Promise<TradeAction[]> {
    try {
      // Fetch transfers TO treasury (mint)
      const mintResponse = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=xmd.treasury&filter=*:transfer&limit=30&sort=desc`
      );
      const mintData: any = await mintResponse.json();

      if (!mintData.actions) return [];

      return mintData.actions
        .filter((a: any) => {
          const isToTreasury = a.act?.data?.to === 'xmd.treasury';
          const isFromTreasury = a.act?.data?.from === 'xmd.treasury';
          const isNew = !this.seenTrxIds.has(a.trx_id);
          return (isToTreasury || isFromTreasury) && isNew;
        })
        .map((a: any) => {
          this.seenTrxIds.add(a.trx_id);
          const isMint = a.act?.data?.to === 'xmd.treasury';
          return {
            timestamp: a.timestamp,
            account: isMint ? a.act?.data?.from : a.act?.data?.to,
            action: isMint ? 'treasury_mint' : 'treasury_redeem',
            contract: 'xmd.treasury',
            data: a.act?.data,
            trxId: a.trx_id
          };
        });
    } catch (error) {
      return [];
    }
  }

  private processActions(actions: TradeAction[]): void {
    for (const action of actions) {
      if (this.ignoredAccounts.has(action.account)) continue;

      // Get or create pending arb for this account
      let pending = this.pendingArbs.get(action.account);
      if (!pending) {
        pending = {
          account: action.account,
          actions: [],
          firstSeen: Date.now()
        };
        this.pendingArbs.set(action.account, pending);
      }

      pending.actions.push(action);
    }
  }

  private async detectCompletedArbitrages(): Promise<void> {
    for (const [account, pending] of this.pendingArbs.entries()) {
      // Need at least 2 actions for an arb
      if (pending.actions.length < 2) continue;

      // Look for AMM + DEX combo
      const hasAmm = pending.actions.some(a => a.action === 'amm_swap');
      const hasDex = pending.actions.some(a => a.action === 'dex_order');
      const hasTreasury = pending.actions.some(a =>
        a.action === 'treasury_mint' || a.action === 'treasury_redeem'
      );

      if (hasAmm && hasDex) {
        // Potential arbitrage detected!
        const arb = this.analyzeArbitrage(account, pending.actions);
        if (arb && arb.profitUsd > 0.01) {
          await this.alertArbitrage(arb);
        }
        // Clear this account's pending actions
        this.pendingArbs.delete(account);
      } else if (hasAmm && hasTreasury) {
        // AMM + Treasury arb
        const arb = this.analyzeArbitrage(account, pending.actions);
        if (arb && arb.profitUsd > 0.01) {
          await this.alertArbitrage(arb);
        }
        this.pendingArbs.delete(account);
      } else if (hasDex && hasTreasury) {
        // DEX + Treasury arb
        const arb = this.analyzeArbitrage(account, pending.actions);
        if (arb && arb.profitUsd > 0.01) {
          await this.alertArbitrage(arb);
        }
        this.pendingArbs.delete(account);
      }
    }
  }

  private analyzeArbitrage(account: string, actions: TradeAction[]): DetectedArb | null {
    try {
      // Sort by timestamp
      actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let inputAmount = 0;
      let outputAmount = 0;
      let token = 'UNKNOWN';
      let type: 'AMM_TO_DEX' | 'DEX_TO_AMM' | 'TRIANGLE' = 'TRIANGLE';

      // Analyze the flow
      for (const action of actions) {
        if (action.action === 'amm_swap') {
          const qty = action.data?.quantity || '';
          const amount = parseFloat(qty) || 0;
          const symbol = qty.split(' ')[1] || '';

          // Check memo for expected output
          const memo = action.data?.memo || '';

          if (symbol === 'XUSDC' || symbol === 'XMD') {
            inputAmount = amount;
            type = 'AMM_TO_DEX';
          } else {
            token = symbol;
          }
        } else if (action.action === 'dex_order') {
          // DEX order - check if buy or sell
          const orderSide = action.data?.order_side;
          const quantity = action.data?.quantity || 0;
          const price = action.data?.price || 0;

          // order_side: 1 = buy, 2 = sell
          if (orderSide === 2) {
            // Selling on DEX
            type = 'AMM_TO_DEX';
          } else {
            type = 'DEX_TO_AMM';
          }
        } else if (action.action === 'treasury_redeem') {
          const qty = action.data?.quantity || '';
          outputAmount = parseFloat(qty) || 0;
        } else if (action.action === 'treasury_mint') {
          const qty = action.data?.quantity || '';
          inputAmount = parseFloat(qty) || 0;
        }
      }

      // Try to estimate profit from the actions
      // This is a rough estimate - we'd need to track full tx flow for accuracy
      const profitUsd = this.estimateProfit(actions);
      const profitPercent = inputAmount > 0 ? (profitUsd / inputAmount) * 100 : 0;

      if (profitUsd <= 0) return null;

      return {
        account,
        type,
        token,
        inputAmount,
        outputAmount,
        profitUsd,
        profitPercent,
        timestamp: actions[0].timestamp,
        trxIds: actions.map(a => a.trxId)
      };
    } catch (error) {
      return null;
    }
  }

  private estimateProfit(actions: TradeAction[]): number {
    // Try to calculate profit by tracking token flows
    let usdIn = 0;
    let usdOut = 0;

    for (const action of actions) {
      const qty = action.data?.quantity || '';
      const amount = parseFloat(qty) || 0;
      const symbol = qty.split(' ')[1] || '';

      if (action.action === 'amm_swap') {
        // Swap input
        if (symbol === 'XUSDC' || symbol === 'XMD') {
          usdIn += amount;
        } else if (symbol === 'XPR') {
          usdIn += amount * 0.0024; // Approximate XPR price
        } else if (symbol === 'METAL') {
          usdIn += amount * 0.12; // Approximate METAL price
        }
      } else if (action.action === 'treasury_mint') {
        if (symbol === 'XUSDC') {
          usdIn += amount;
        }
      } else if (action.action === 'treasury_redeem') {
        if (symbol === 'XMD') {
          // This is input to treasury, output is XUSDC
          usdOut += amount; // XMD redeems 1:1 to XUSDC
        }
      }
    }

    // If we couldn't calculate, return small positive to trigger alert with "unknown" profit
    if (usdIn === 0 && usdOut === 0) {
      return 0.02; // Small amount to trigger alert
    }

    return usdOut - usdIn;
  }

  private async alertArbitrage(arb: DetectedArb): Promise<void> {
    // Check if we recently alerted for this account
    const alertKey = `${arb.account}-${arb.trxIds[0]}`;
    if (this.recentAlerts.has(alertKey)) return;

    this.recentAlerts.set(alertKey, Date.now());

    // Clean up old alerts (older than 5 minutes)
    const now = Date.now();
    for (const [key, time] of this.recentAlerts.entries()) {
      if (now - time > 5 * 60 * 1000) {
        this.recentAlerts.delete(key);
      }
    }

    const profitStr = arb.profitUsd > 0.1
      ? `+$${arb.profitUsd.toFixed(2)}`
      : '(small)';

    const message = `🔍 *COMPETITOR ARB DETECTED*

Account: \`${arb.account}\`
Type: ${arb.type}
Token: ${arb.token}
Profit: ${profitStr} (${arb.profitPercent.toFixed(2)}%)
Time: ${new Date(arb.timestamp).toLocaleTimeString()}

TxIDs: ${arb.trxIds.map(t => t.slice(0, 8)).join(', ')}...`;

    logger.info(`Competitor arb: ${arb.account} made ${profitStr} on ${arb.type}`);
    await telegramNotifier.notify(message, 'normal');

    // Save to database
    this.saveToDatabase(arb);
  }

  private saveToDatabase(arb: DetectedArb): void {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO competitor_arbs (account, arb_type, token, input_amount, output_amount, profit_usd, profit_percent, trx_ids, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        arb.account,
        arb.type,
        arb.token,
        arb.inputAmount,
        arb.outputAmount,
        arb.profitUsd,
        arb.profitPercent,
        arb.trxIds.join(','),
        arb.timestamp
      );

      logger.info(`Saved competitor arb to database: ${arb.account}`);
    } catch (error: any) {
      logger.error(`Failed to save competitor arb to database: ${error.message}`);
    }
  }

  /**
   * Get competitor statistics
   */
  getCompetitorStats(): { account: string; totalArbs: number; totalProfit: number; avgProfit: number; lastSeen: string }[] {
    try {
      const db = getDatabase();
      const stats = db.prepare(`
        SELECT
          account,
          COUNT(*) as total_arbs,
          SUM(profit_usd) as total_profit,
          AVG(profit_usd) as avg_profit,
          MAX(detected_at) as last_seen
        FROM competitor_arbs
        GROUP BY account
        ORDER BY total_profit DESC
        LIMIT 20
      `).all() as any[];

      return stats.map(s => ({
        account: s.account,
        totalArbs: s.total_arbs,
        totalProfit: s.total_profit || 0,
        avgProfit: s.avg_profit || 0,
        lastSeen: s.last_seen
      }));
    } catch (error: any) {
      logger.error(`Failed to get competitor stats: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent competitor arbs
   */
  getRecentArbs(limit: number = 20): DetectedArb[] {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT * FROM competitor_arbs
        ORDER BY detected_at DESC
        LIMIT ?
      `).all(limit) as any[];

      return rows.map(r => ({
        account: r.account,
        type: r.arb_type as 'AMM_TO_DEX' | 'DEX_TO_AMM' | 'TRIANGLE',
        token: r.token,
        inputAmount: r.input_amount,
        outputAmount: r.output_amount,
        profitUsd: r.profit_usd,
        profitPercent: r.profit_percent,
        timestamp: r.detected_at,
        trxIds: r.trx_ids ? r.trx_ids.split(',') : []
      }));
    } catch (error: any) {
      logger.error(`Failed to get recent arbs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get profit summary for a time period
   */
  getProfitSummary(hours: number = 24): { totalArbs: number; totalProfit: number; uniqueAccounts: number; topAccount: string | null } {
    try {
      const db = getDatabase();
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const summary = db.prepare(`
        SELECT
          COUNT(*) as total_arbs,
          SUM(profit_usd) as total_profit,
          COUNT(DISTINCT account) as unique_accounts
        FROM competitor_arbs
        WHERE detected_at >= ?
      `).get(since) as any;

      const topAccount = db.prepare(`
        SELECT account, SUM(profit_usd) as profit
        FROM competitor_arbs
        WHERE detected_at >= ?
        GROUP BY account
        ORDER BY profit DESC
        LIMIT 1
      `).get(since) as any;

      return {
        totalArbs: summary?.total_arbs || 0,
        totalProfit: summary?.total_profit || 0,
        uniqueAccounts: summary?.unique_accounts || 0,
        topAccount: topAccount?.account || null
      };
    } catch (error: any) {
      logger.error(`Failed to get profit summary: ${error.message}`);
      return { totalArbs: 0, totalProfit: 0, uniqueAccounts: 0, topAccount: null };
    }
  }

  private cleanupOldPending(): void {
    const now = Date.now();
    const maxAge = 2 * 60 * 1000; // 2 minutes

    for (const [account, pending] of this.pendingArbs.entries()) {
      if (now - pending.firstSeen > maxAge) {
        this.pendingArbs.delete(account);
      }
    }
  }
}

// Singleton instance
export const competitorTracker = new CompetitorTracker();
