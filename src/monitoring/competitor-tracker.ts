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

interface DexExecution {
  timestamp: string;
  tradeId: string;
  marketId: number;
  token: string;
  price: number;
  bidUser: string;
  askUser: string;
  baseAmount: number;  // Token amount
  quoteAmount: number; // XMD amount
  isBuy: boolean;      // true if bidUser is the taker (buying)
}

// Market ID to token mapping with price divisor for proper scaling
const MARKET_TOKENS: Record<number, { symbol: string; precision: number; priceDivisor: number }> = {
  1:  { symbol: 'XPR',   precision: 4, priceDivisor: 1000000 },    // XPR_XMD
  2:  { symbol: 'XBTC',  precision: 8, priceDivisor: 1000000 },    // XBTC_XMD
  3:  { symbol: 'XETH',  precision: 8, priceDivisor: 1000000 },    // XETH_XMD
  7:  { symbol: 'XMT',   precision: 8, priceDivisor: 1000000 },    // XMT_XMD
  9:  { symbol: 'LOAN',  precision: 4, priceDivisor: 1000000 },    // LOAN_XMD
  10: { symbol: 'METAL', precision: 8, priceDivisor: 1000000 },    // METAL_XMD
  12: { symbol: 'XDOGE', precision: 6, priceDivisor: 1000000 },    // XDOGE_XMD
  13: { symbol: 'XADA',  precision: 6, priceDivisor: 1000000 },    // XADA_XMD (old)
  14: { symbol: 'XLTC',  precision: 8, priceDivisor: 1000000 },    // XLTC_XMD
  15: { symbol: 'XXRP',  precision: 6, priceDivisor: 1000000 },    // XXRP_XMD
  16: { symbol: 'XBNB',  precision: 8, priceDivisor: 1000000 },    // XBNB_XMD
  17: { symbol: 'XSOL',  precision: 6, priceDivisor: 1000 },       // XSOL_XMD (different scaling)
  18: { symbol: 'XADA',  precision: 6, priceDivisor: 1000000 },    // XADA_XMD (new)
  19: { symbol: 'XXRP',  precision: 6, priceDivisor: 1000000 },    // XXRP_XMD (alt)
};

// AMM Pool names
const VALID_POOLS = new Set([
  'XPRUSDC', 'XPRLOAN', 'METAXPR', 'METAXMD', 'XMTUSDC',
  'BTCUSDC', 'ETHUSDC', 'DOGEUSD', 'SOLUSDC', 'BNBUSDC'
]);

interface PotentialArb {
  account: string;
  trxId: string;  // Group by transaction ID to avoid mixing concurrent arbs
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
  // Enhanced details
  dexPrice?: number;
  ammPool?: string;
  ammPrice?: number;
  tradeValueUsd?: number;
  verifiedProfit?: boolean;  // true if profit came from actual data, false if estimated
}

export class CompetitorTracker {
  private rpc: JsonRpc;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckedTime: string;
  private pendingArbs: Map<string, PotentialArb> = new Map();
  private seenTrxIds: Set<string> = new Set();
  private ourAccount: string;

  // Accounts to ignore (our own, known contracts, known non-arbers)
  private ignoredAccounts: Set<string> = new Set([
    // System contracts
    'proton.swaps',
    'dex',
    'simpledex',
    'xmd.treasury',
    'eosio.token',
    'xtokens',
    'xmd.token',
    'loan.token',
    'simpletoken',
    'fees.swaps',
    // Known non-arb accounts (LP providers, regular traders, etc.)
    'supermann1',    // Uses LOAN protocol, not arbitrage
    'sweeney45',     // LP management, not arbitrage
    'metalmarkets',  // Market maker, not arb
    'snipsniper11',  // Regular trader
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

    // Check every 60 seconds (reduced from 10s to minimize impact on trading)
    this.checkInterval = setInterval(() => this.checkForArbitrages(), 60000);

    // Initial check after a delay to not interfere with startup
    setTimeout(() => this.checkForArbitrages(), 5000);
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

      // Fetch waxptreasury transfers (quantatrader logs profit in memo)
      const waxpOps = await this.fetchWaxpTreasuryOps();

      // Fetch mmmaster transfers (wwworker logs profit in memo)
      const mmmasterOps = await this.fetchMmmasterOps();

      // Fetch SimpleDEX swaps
      const sdexSwaps = await this.fetchSimpleDexSwaps();

      // Combine and process
      const allActions = [...ammSwaps, ...dexTrades, ...treasuryOps, ...waxpOps, ...mmmasterOps, ...sdexSwaps];

      // Log only occasionally to reduce noise
      // (competitor data is saved to database for later analysis)

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
      // Fetch logexec actions - these have the actual trade execution details
      const execResponse = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=dex&filter=dex:logexec&limit=50&sort=desc`
      );
      const execData: any = await execResponse.json();

      const results: TradeAction[] = [];

      // Process logexec to get actual trade details
      for (const a of (execData.actions || [])) {
        if (this.seenTrxIds.has(a.trx_id)) continue;
        this.seenTrxIds.add(a.trx_id);

        const data = a.act?.data;
        if (!data) continue;

        const marketId = data.market_id;
        const marketInfo = MARKET_TOKENS[marketId];
        const token = marketInfo?.symbol || `MKT${marketId}`;
        const precision = marketInfo?.precision || 8;
        const priceDivisor = marketInfo?.priceDivisor || 1000000;

        // Parse the execution details
        const baseAmount = parseInt(data.bid_total || '0') / Math.pow(10, precision);
        const quoteAmount = parseInt(data.ask_amount || '0') / Math.pow(10, 6); // XMD has 6 decimals
        const price = parseInt(data.price || '0') / priceDivisor;

        // bid_user is the buyer, ask_user is the seller
        const bidUser = data.bid_user;
        const askUser = data.ask_user;

        // Add both users as potential arbers
        for (const user of [bidUser, askUser]) {
          if (!user || this.ignoredAccounts.has(user)) continue;

          results.push({
            timestamp: a.timestamp,
            account: user,
            action: 'dex_exec',
            contract: 'dex',
            data: {
              ...data,
              token,
              baseAmount,
              quoteAmount,
              price,
              isSeller: user === askUser,
              isBuyer: user === bidUser,
              marketId
            },
            trxId: a.trx_id
          });
        }
      }

      // Also fetch placeorder for order tracking
      const orderResponse = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=dex&filter=dex:placeorder&limit=50&sort=desc`
      );
      const orderData: any = await orderResponse.json();

      for (const a of (orderData.actions || [])) {
        if (this.seenTrxIds.has(a.trx_id)) continue;
        this.seenTrxIds.add(a.trx_id);

        const account = a.act?.data?.account;
        if (!account || this.ignoredAccounts.has(account)) continue;

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

  private async fetchWaxpTreasuryOps(): Promise<TradeAction[]> {
    try {
      // Fetch transfers TO waxptreasury - competitors log actual profit in memo
      // Memo format: "3.3952 XPR|61|XPR/METAL/XMD|xpr->xpr->dex"
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=waxptreasury&filter=*:transfer&limit=30&sort=desc`
      );
      const data: any = await response.json();

      if (!data.actions) return [];

      return data.actions
        .filter((a: any) => {
          const isToWaxp = a.act?.data?.to === 'waxptreasury';
          const isNew = !this.seenTrxIds.has(a.trx_id);
          const memo = a.act?.data?.memo || '';
          // Only track transfers with profit info in memo (format: "X.XX TOKEN|...")
          return isToWaxp && isNew && memo.includes('|');
        })
        .map((a: any) => {
          this.seenTrxIds.add(a.trx_id);
          const memo = a.act?.data?.memo || '';
          // Parse profit from memo: "3.3952 XPR|61|XPR/METAL/XMD|xpr->xpr->dex"
          const parts = memo.split('|');
          const profitPart = parts[0] || '';
          const profitMatch = profitPart.match(/^([\d.]+)\s+(\w+)/);
          const profitAmount = profitMatch ? parseFloat(profitMatch[1]) : 0;
          const profitToken = profitMatch ? profitMatch[2] : '';
          const path = parts[2] || ''; // e.g., "XPR/METAL/XMD"

          // Silently capture - no logging to reduce noise
          return {
            timestamp: a.timestamp,
            account: a.act?.data?.from,
            action: 'waxp_profit',
            contract: 'waxptreasury',
            data: {
              ...a.act?.data,
              profitAmount,
              profitToken,
              path
            },
            trxId: a.trx_id
          };
        });
    } catch (error) {
      return [];
    }
  }

  private async fetchMmmasterOps(): Promise<TradeAction[]> {
    try {
      // Fetch transfers TO mmmaster - wwworker logs profit in memo
      // Memo format: "yyyminer2|17.772302 XUSDC|17.799344 XUSDC" (input|output)
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=mmmaster&filter=*:transfer&limit=30&sort=desc`
      );
      const data: any = await response.json();

      if (!data.actions) return [];

      return data.actions
        .filter((a: any) => {
          const isToMmmaster = a.act?.data?.to === 'mmmaster';
          const isNew = !this.seenTrxIds.has(a.trx_id);
          const memo = a.act?.data?.memo || '';
          // Only track transfers with profit info in memo (format: "xxx|input|output")
          return isToMmmaster && isNew && memo.includes('|');
        })
        .map((a: any) => {
          this.seenTrxIds.add(a.trx_id);
          const memo = a.act?.data?.memo || '';
          // Parse profit from memo: "yyyminer2|17.772302 XUSDC|17.799344 XUSDC"
          const parts = memo.split('|');
          let profitAmount = 0;
          let profitToken = 'XUSDC';
          let memoPrefix = '';

          if (parts.length >= 3) {
            memoPrefix = parts[0] || ''; // e.g., "yyyminer2" or "xxxminer3"
            const inputMatch = parts[1].match(/^([\d.]+)\s*(\w+)?/);
            const outputMatch = parts[2].match(/^([\d.]+)\s*(\w+)?/);
            if (inputMatch && outputMatch) {
              const inputAmt = parseFloat(inputMatch[1]) || 0;
              const outputAmt = parseFloat(outputMatch[1]) || 0;
              profitAmount = outputAmt - inputAmt;
              profitToken = outputMatch[2] || inputMatch[2] || 'XUSDC';
            }
          }

          // Silently capture - no logging to reduce noise
          return {
            timestamp: a.timestamp,
            account: a.act?.data?.from,
            action: 'mmmaster_profit',
            contract: 'mmmaster',
            data: {
              ...a.act?.data,
              profitAmount,
              profitToken,
              memoPrefix
            },
            trxId: a.trx_id
          };
        });
    } catch (error) {
      return [];
    }
  }

  private async fetchSimpleDexSwaps(): Promise<TradeAction[]> {
    try {
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_actions?account=simpledex&filter=*:transfer&limit=50&sort=desc`
      );
      const data: any = await response.json();

      if (!data.actions) return [];

      return data.actions
        .filter((a: any) => {
          const isSwap = a.act?.data?.to === 'simpledex' &&
                         a.act?.data?.memo?.startsWith('swap:');
          const isNew = !this.seenTrxIds.has(a.trx_id);
          return isSwap && isNew;
        })
        .map((a: any) => {
          this.seenTrxIds.add(a.trx_id);
          const memo = a.act?.data?.memo || '';
          // Parse memo: "swap:POOL_ID:MIN_OUT:IS_TOKEN_A_IN"
          const memoParts = memo.split(':');
          const poolId = parseInt(memoParts[1]) || 0;
          const qty = a.act?.data?.quantity || '';
          const symbol = qty.split(' ')[1] || '';

          return {
            timestamp: a.timestamp,
            account: a.act?.data?.from,
            action: 'sdex_swap',
            contract: 'simpledex',
            data: {
              ...a.act?.data,
              poolId,
              symbol,
              amount: parseFloat(qty) || 0
            },
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
      if (!action.trxId) continue;

      // For profit tracking actions (waxp_profit, mmmaster_profit), group by account + time window
      // because these are separate transactions from the actual arb
      const isProfitAction = action.action === 'waxp_profit' || action.action === 'mmmaster_profit';

      if (isProfitAction) {
        // Find a recent pending arb from the same account (within 10 seconds)
        // and attach this profit info to it, OR create a new entry
        let foundPending = false;
        for (const [key, pending] of this.pendingArbs.entries()) {
          if (pending.account === action.account) {
            const ageMs = Date.now() - pending.firstSeen;
            if (ageMs < 10000) {
              // Attach profit action to this pending arb
              pending.actions.push(action);
              foundPending = true;
              break;
            }
          }
        }

        if (!foundPending) {
          // Create new entry keyed by account-time (for profit-only signals)
          const key = `${action.account}-profit-${Date.now()}`;
          this.pendingArbs.set(key, {
            account: action.account,
            trxId: action.trxId,
            actions: [action],
            firstSeen: Date.now()
          });
        }
      } else {
        // Group by transaction ID to avoid mixing concurrent arbs from same account
        const key = action.trxId;
        let pending = this.pendingArbs.get(key);
        if (!pending) {
          pending = {
            account: action.account,
            trxId: action.trxId,
            actions: [],
            firstSeen: Date.now()
          };
          this.pendingArbs.set(key, pending);
        }
        pending.actions.push(action);
      }
    }
  }

  private async detectCompletedArbitrages(): Promise<void> {
    const now = Date.now();

    for (const [key, pending] of this.pendingArbs.entries()) {
      const account = pending.account;

      // Look for AMM + DEX combo (including dex_exec)
      const hasAmm = pending.actions.some(a => a.action === 'amm_swap');
      const hasDex = pending.actions.some(a => a.action === 'dex_order' || a.action === 'dex_exec');
      const hasTreasury = pending.actions.some(a =>
        a.action === 'treasury_mint' || a.action === 'treasury_redeem'
      );
      const hasWaxpProfit = pending.actions.some(a => a.action === 'waxp_profit');
      const hasMmmasterProfit = pending.actions.some(a => a.action === 'mmmaster_profit');
      const hasActualProfit = hasWaxpProfit || hasMmmasterProfit;

      // SimpleDEX arbs: 2+ sdex_swap actions in one transaction = triangle arb
      const sdexSwaps = pending.actions.filter(a => a.action === 'sdex_swap');
      if (sdexSwaps.length >= 2) {
        // Fetch full tx to calculate net XPR profit
        const sdexArb = await this.analyzeSimpleDexArb(account, pending.trxId, sdexSwaps);
        if (sdexArb) {
          // Save to DB silently (no Telegram alerts for SimpleDEX competitors)
          this.saveToDatabase(sdexArb);
          logger.debug(`SimpleDEX competitor: ${account} ${sdexArb.token} ${sdexArb.profitUsd > 0 ? '+' : ''}$${sdexArb.profitUsd.toFixed(4)}`);
        }
        this.pendingArbs.delete(key);
        continue;
      }

      // DETECTION SIGNALS (AMM+DEX arbs):
      // 1. Has profit logging contract (waxp/mmmaster) = definitely an arber (even with 1 action)
      // 2. Has ALL THREE components (AMM + DEX + Treasury) within 5 seconds = likely arber
      // 3. Has 2+ actions with both AMM and either DEX or Treasury

      let shouldProcess = false;
      let highConfidence = hasActualProfit;

      if (hasActualProfit) {
        // Accounts using profit logging contracts are definitely arbing
        shouldProcess = true;
      } else if (pending.actions.length >= 2) {
        if (hasAmm && hasDex && hasTreasury) {
          // All three components present - check timing
          const timestamps = pending.actions.map(a => new Date(a.timestamp).getTime());
          const minTime = Math.min(...timestamps);
          const maxTime = Math.max(...timestamps);
          const timeSpanMs = maxTime - minTime;

          // Only process if all actions within 5 seconds (real arbs are fast)
          if (timeSpanMs <= 5000) {
            shouldProcess = true;
          }
        }
      }

      if (shouldProcess) {
        // Wait up to 3 seconds for additional profit data to arrive
        const ageMs = now - pending.firstSeen;
        if (!hasActualProfit && ageMs < 3000) {
          continue; // Wait for more actions
        }

        const arb = await this.analyzeArbitrage(account, pending.actions, highConfidence);

        // Alert if we have verified profit > $0.001
        if (arb && arb.verifiedProfit && arb.profitUsd > 0.001) {
          await this.alertArbitrage(arb);
        } else if (arb && !arb.verifiedProfit && arb.profitUsd > 0.01) {
          // Profit was estimated - skip to avoid false positives
          logger.info(`Skipping unverified arb (likely false positive): ${account} est=${arb.profitPercent.toFixed(2)}%`);
        }
        // Clear this entry
        this.pendingArbs.delete(key);
      } else {
        // Clean up old entries that never matched criteria (after 30 seconds)
        const ageMs = now - pending.firstSeen;
        if (ageMs > 30000) {
          this.pendingArbs.delete(key);
        }
      }
    }
  }

  /**
   * Analyze a SimpleDEX triangle arb by fetching the full transaction
   * and computing net token flows. Profit = net XPR gained.
   */
  private async analyzeSimpleDexArb(account: string, trxId: string, sdexSwaps: TradeAction[]): Promise<DetectedArb | null> {
    try {
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_transaction?id=${trxId}`
      );
      const data: any = await response.json();
      if (!data.actions) return null;

      // Track net flows for this account
      const netFlows: Record<string, number> = {};
      for (const action of data.actions) {
        if (action.act?.name !== 'transfer') continue;
        const from = action.act.data?.from;
        const to = action.act.data?.to;
        const qty = action.act.data?.quantity || '';
        const amount = parseFloat(qty) || 0;
        const symbol = qty.split(' ')[1] || '';
        if (!symbol) continue;
        if (!netFlows[symbol]) netFlows[symbol] = 0;
        if (to === account) netFlows[symbol] += amount;
        if (from === account) netFlows[symbol] -= amount;
      }

      // Profit is net XPR gained (triangle arbs start and end with XPR)
      const xprProfit = netFlows['XPR'] || 0;
      const xprPrice = 0.00213; // approximate
      const profitUsd = xprProfit * xprPrice;

      // Identify intermediate token (the non-XPR, non-EXIT token)
      const poolIds = sdexSwaps.map(s => s.data?.poolId).filter(Boolean);
      let token = 'SDEX';
      for (const swap of sdexSwaps) {
        const sym = swap.data?.symbol;
        if (sym && sym !== 'XPR' && sym !== 'EXIT') {
          token = sym;
          break;
        }
      }

      // Estimate trade size from the first XPR sent
      const firstXprSwap = sdexSwaps.find(s => s.data?.symbol === 'XPR');
      const tradeSizeXpr = firstXprSwap?.data?.amount || 0;
      const tradeSizeUsd = tradeSizeXpr * xprPrice;
      const profitBps = tradeSizeXpr > 0 ? (xprProfit / tradeSizeXpr) * 10000 : 0;

      return {
        account,
        type: 'TRIANGLE',
        token,
        inputAmount: tradeSizeUsd,
        outputAmount: tradeSizeUsd + profitUsd,
        profitUsd,
        profitPercent: tradeSizeUsd > 0 ? (profitUsd / tradeSizeUsd) * 100 : 0,
        timestamp: sdexSwaps[0].timestamp,
        trxIds: [trxId],
        tradeValueUsd: tradeSizeUsd,
        verifiedProfit: true
      };
    } catch (error) {
      return null;
    }
  }

  private async analyzeArbitrage(account: string, actions: TradeAction[], highConfidence: boolean = false): Promise<DetectedArb | null> {
    try {
      // Sort by timestamp
      actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let token = 'UNKNOWN';
      let type: 'AMM_TO_DEX' | 'DEX_TO_AMM' | 'TRIANGLE' = 'TRIANGLE';
      let dexPrice: number | undefined;
      let ammPool: string | undefined;
      let tradeValueUsd = 0;

      // Analyze actions to determine token and type
      for (const action of actions) {
        if (action.action === 'amm_swap') {
          const qty = action.data?.quantity || '';
          const amount = parseFloat(qty) || 0;
          const symbol = qty.split(' ')[1] || '';
          const memo = action.data?.memo || '';

          // Extract pool from memo (format: "POOLNAME,amount" or "POOL1>POOL2,amount")
          const poolMatch = memo.match(/^([A-Z]+)[>,]/);
          if (poolMatch && VALID_POOLS.has(poolMatch[1])) {
            ammPool = poolMatch[1];
          }

          // Identify the token being arbitraged
          if (symbol !== 'XUSDC' && symbol !== 'XMD') {
            token = symbol;
            // Estimate USD value
            const prices: Record<string, number> = {
              'XPR': 0.00248, 'METAL': 0.117, 'LOAN': 0.0004,
              'XBTC': 98000, 'XETH': 3200, 'XSOL': 103,
              'XDOGE': 0.26, 'XMT': 1.10, 'XXRP': 2.45,
            };
            tradeValueUsd = Math.max(tradeValueUsd, amount * (prices[symbol] || 0));
          } else {
            tradeValueUsd = Math.max(tradeValueUsd, amount);
          }
        } else if (action.action === 'dex_exec') {
          const data = action.data;
          const execToken = data.token;

          // Only update token if not already set or if this is more specific
          if (execToken && execToken !== 'UNKNOWN' && (token === 'UNKNOWN' || token === execToken)) {
            token = execToken;
            // Only use price if it matches the token we're tracking
            if (data.price) {
              dexPrice = data.price;
            }
          }

          // Use quote amount as trade value
          const quoteAmt = data.quoteAmount || 0;
          tradeValueUsd = Math.max(tradeValueUsd, quoteAmt);

          // Determine direction
          if (data.isSeller) {
            type = 'AMM_TO_DEX';
          } else if (data.isBuyer) {
            type = 'DEX_TO_AMM';
          }
        } else if (action.action === 'dex_order') {
          const orderSide = action.data?.order_side;
          if (orderSide === 2) {
            type = 'AMM_TO_DEX';
          } else {
            type = 'DEX_TO_AMM';
          }
        } else if (action.action === 'treasury_redeem' || action.action === 'treasury_mint') {
          const qty = action.data?.quantity || '';
          const amount = parseFloat(qty) || 0;
          tradeValueUsd = Math.max(tradeValueUsd, amount);
        }
      }

      // Try to get actual profit from waxptreasury memo
      let profitUsd = 0;
      let profitPercent = 0;
      let actualProfitFound = false;

      const waxpAction = actions.find(a => a.action === 'waxp_profit');
      if (waxpAction) {
        const profitAmount = waxpAction.data?.profitAmount || 0;
        const profitToken = waxpAction.data?.profitToken || '';
        const path = waxpAction.data?.path || '';

        // Convert profit to USD
        const prices: Record<string, number> = {
          'XPR': 0.00251, 'METAL': 0.118, 'LOAN': 0.0004,
          'XBTC': 98000, 'XETH': 3200, 'XSOL': 103,
          'XDOGE': 0.26, 'XMT': 1.10, 'XXRP': 2.45,
          'XUSDC': 1.0, 'XMD': 1.0,
        };
        profitUsd = profitAmount * (prices[profitToken] || 0);
        actualProfitFound = profitUsd > 0;

        // Extract token from path if not set (e.g., "XPR/METAL/XMD" -> first token)
        if (token === 'UNKNOWN' && path) {
          const pathTokens = path.split('/');
          if (pathTokens[0] && pathTokens[0] !== 'XMD' && pathTokens[0] !== 'XUSDC') {
            token = pathTokens[0];
          }
        }
      }

      // Also check mmmaster profit (wwworker uses this)
      if (!actualProfitFound) {
        const mmmasterAction = actions.find(a => a.action === 'mmmaster_profit');
        if (mmmasterAction) {
          const profitAmount = mmmasterAction.data?.profitAmount || 0;
          const profitToken = mmmasterAction.data?.profitToken || 'XUSDC';
          const memoPrefix = mmmasterAction.data?.memoPrefix || '';

          // Convert profit to USD
          const prices: Record<string, number> = {
            'XPR': 0.00251, 'METAL': 0.118, 'LOAN': 0.0004,
            'XBTC': 98000, 'XETH': 3200, 'XSOL': 103,
            'XDOGE': 0.26, 'XMT': 1.10, 'XXRP': 2.45,
            'XUSDC': 1.0, 'XMD': 1.0,
          };
          profitUsd = profitAmount * (prices[profitToken] || 1.0);
          actualProfitFound = profitUsd > 0;

          // Identify token from memo prefix (wwworker convention)
          // xxxminer = XMD-based arbs (usually METAL)
          // yyyminer = XUSDC-based arbs (usually XPR)
          // zzzminer = mixed, could be XPR or METAL (check AMM swap)
          if (token === 'UNKNOWN' && memoPrefix) {
            if (memoPrefix.startsWith('xxx')) {
              token = 'METAL'; // XMD-based, typically METAL arbs
            } else if (memoPrefix.startsWith('yyy')) {
              token = 'XPR'; // XUSDC-based, typically XPR arbs
            } else if (memoPrefix.startsWith('zzz')) {
              token = 'XPR/METAL'; // Mixed bot, will refine from AMM swap if possible
            }
          }
        }
      }

      // Fall back to calculating profit from transaction flows
      if (!actualProfitFound && actions.length > 0) {
        // Try all unique transaction IDs until we find profit
        const uniqueTrxIds = [...new Set(actions.map(a => a.trxId).filter(Boolean))];
        for (const trxId of uniqueTrxIds) {
          const calculatedProfit = await this.calculateProfitFromTransaction(trxId, account);
          if (calculatedProfit !== null && calculatedProfit > 0.001) {
            profitUsd = calculatedProfit;
            actualProfitFound = true;
            break;
          }
        }
      }

      // Last resort: small estimate (but mark as estimated)
      if (!actualProfitFound) {
        profitUsd = tradeValueUsd * 0.001; // 0.1% conservative estimate
      }

      // If we have verified profit but no trade value, estimate trade value from profit
      // Assume typical 0.2% profit margin: tradeValue = profit / 0.002
      if (actualProfitFound && tradeValueUsd < 1 && profitUsd > 0) {
        tradeValueUsd = profitUsd / 0.002; // Estimate trade size from profit
      }

      // Calculate profit percent
      profitPercent = tradeValueUsd > 0 ? (profitUsd / tradeValueUsd) * 100 : 0;

      // Skip tiny trades unless we have verified profit
      if (tradeValueUsd < 1 && !actualProfitFound) return null;

      // Extract token from pool name if still unknown
      if (token === 'UNKNOWN' && ammPool) {
        const poolTokenMap: Record<string, string> = {
          'XPRUSDC': 'XPR',
          'METAXPR': 'METAL',
          'METAXMD': 'METAL',
          'XPRLOAN': 'XPR',
          'XMTUSDC': 'XMT',
          'BTCUSDC': 'XBTC',
          'ETHUSDC': 'XETH',
          'DOGEUSD': 'XDOGE',
          'SOLUSDC': 'XSOL',
          'ADAUSDC': 'XADA',
        };
        token = poolTokenMap[ammPool] || token;
      }

      // Try to extract token from AMM swap memos in the actions
      // Also refine 'XPR/METAL' from wwworker's zzzminer bot
      if (token === 'UNKNOWN' || token === 'XPR/METAL') {
        for (const action of actions) {
          if (action.action === 'amm_swap') {
            const memo = action.data?.memo || '';
            // Memo format: "POOLNAME,1" or "POOL1>POOL2,1"
            const poolMatch = memo.match(/^([A-Z]+)[>,]/);
            if (poolMatch) {
              const pool = poolMatch[1];
              const poolTokenMap: Record<string, string> = {
                'XPRUSDC': 'XPR',
                'METAXPR': 'METAL',
                'METAXMD': 'METAL',
                'XPRLOAN': 'LOAN',
                'XMTUSDC': 'XMT',
                'BTCUSDC': 'XBTC',
                'ETHUSDC': 'XETH',
                'DOGEUSD': 'XDOGE',
                'SOLUSDC': 'XSOL',
              };
              if (poolTokenMap[pool]) {
                token = poolTokenMap[pool];
                break;
              }
            }
          }
        }
      }

      return {
        account,
        type,
        token,
        inputAmount: tradeValueUsd,
        outputAmount: tradeValueUsd + profitUsd,
        profitUsd,
        profitPercent,
        timestamp: actions[0].timestamp,
        trxIds: actions.map(a => a.trxId),
        dexPrice,
        ammPool,
        tradeValueUsd,
        verifiedProfit: actualProfitFound  // Track whether profit was verified or estimated
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate actual profit by fetching full transaction and summing net flows
   * Returns profit in USD (net change in XMD/XUSDC)
   */
  private async calculateProfitFromTransaction(trxId: string, account: string): Promise<number | null> {
    try {
      const response = await fetch(
        `https://proton.eosusa.io/v2/history/get_transaction?id=${trxId}`
      );
      const data: any = await response.json();

      if (!data.actions) return null;

      // Token prices for conversion
      const prices: Record<string, number> = {
        'XUSDC': 1.0, 'XMD': 1.0,
        'XPR': 0.00251, 'METAL': 0.118, 'LOAN': 0.0004,
        'XBTC': 98000, 'XETH': 3200, 'XSOL': 103,
        'XDOGE': 0.26, 'XMT': 1.10, 'XXRP': 2.45,
      };

      // Track net flows for ALL tokens
      const netFlows: Record<string, number> = {};

      for (const action of data.actions) {
        if (action.act?.name !== 'transfer') continue;

        const from = action.act.data?.from;
        const to = action.act.data?.to;
        const qty = action.act.data?.quantity || '';
        const amount = parseFloat(qty) || 0;
        const symbol = qty.split(' ')[1] || '';

        if (!symbol) continue;
        if (!netFlows[symbol]) netFlows[symbol] = 0;

        // Track all token flows to/from this account
        if (to === account) netFlows[symbol] += amount;
        if (from === account) netFlows[symbol] -= amount;
      }

      // Check if this is a complete arb cycle (non-stable tokens should net to ~0)
      // If someone has net gain in XETH, XSOL, etc., it's NOT a complete arb
      let hasUnbalancedNonStable = false;
      for (const [symbol, netAmount] of Object.entries(netFlows)) {
        if (symbol !== 'XMD' && symbol !== 'XUSDC') {
          // Non-stable token should net to approximately 0 in a complete arb
          const valueUsd = Math.abs(netAmount) * (prices[symbol] || 0);
          if (valueUsd > 1.0) { // More than $1 of non-stable = not a complete arb
            hasUnbalancedNonStable = true;
            break;
          }
        }
      }

      // Only calculate profit for complete arb cycles
      if (hasUnbalancedNonStable) {
        return null; // Not a complete arb, can't calculate profit
      }

      // Profit is net change in stable tokens (XMD + XUSDC)
      const profitUsd = (netFlows['XMD'] || 0) + (netFlows['XUSDC'] || 0);

      // Only return if positive and reasonable (< 5% of trade)
      if (profitUsd > 0.001 && profitUsd < 50) {
        return profitUsd;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private estimateProfit(actions: TradeAction[]): number {
    // For competitor arbs, we can't reliably track profit without full tx analysis
    // The arb profit is typically very small (0.1-0.5% of trade size)
    //
    // Instead of trying to calculate exact profit, estimate based on trade size
    // Competitors typically make 10-50 BPS on each trade

    let tradeValueUsd = 0;

    // Token prices (approximate)
    const prices: Record<string, number> = {
      'XUSDC': 1.0,
      'XMD': 1.0,
      'XPR': 0.00248,
      'METAL': 0.117,
      'LOAN': 0.0004,
      'XBTC': 98000,
      'XETH': 3200,
      'XSOL': 103,
      'XDOGE': 0.26,
      'XMT': 1.10,
      'XXRP': 2.45,
    };

    for (const action of actions) {
      const qty = action.data?.quantity || '';
      const amount = parseFloat(qty) || 0;
      const symbol = qty.split(' ')[1] || '';

      if (action.action === 'amm_swap') {
        // Track trade size from AMM swaps
        const price = prices[symbol] || 0;
        if (price > 0) {
          tradeValueUsd = Math.max(tradeValueUsd, amount * price);
        }
      } else if (action.action === 'dex_exec') {
        // DEX execution - use the quote amount (XMD) as trade value
        const quoteAmount = action.data?.quoteAmount || 0;
        tradeValueUsd = Math.max(tradeValueUsd, quoteAmount);
      } else if (action.action === 'treasury_mint' || action.action === 'treasury_redeem') {
        if (symbol === 'XUSDC' || symbol === 'XMD') {
          tradeValueUsd = Math.max(tradeValueUsd, amount);
        }
      }
    }

    // Estimate profit as ~20 BPS of trade value (typical arb margin)
    // This is an estimate - actual profit varies
    if (tradeValueUsd > 0) {
      return tradeValueUsd * 0.002; // 0.2% estimated profit
    }

    return 0.02; // Default small amount
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

    // Show actual profit - verified from actual data
    const profitStr = arb.profitUsd >= 0.01
      ? `+$${arb.profitUsd.toFixed(4)}`
      : `+$${arb.profitUsd.toFixed(6)}`;

    const tradeSize = arb.tradeValueUsd
      ? `$${arb.tradeValueUsd.toFixed(2)}`
      : arb.inputAmount > 0
        ? `$${arb.inputAmount.toFixed(2)}`
        : '?';

    // Build detailed message with proper price formatting
    let details = '';
    if (arb.dexPrice && arb.dexPrice > 0) {
      // Format price based on magnitude
      const priceStr = arb.dexPrice >= 1
        ? arb.dexPrice.toFixed(2)
        : arb.dexPrice >= 0.01
          ? arb.dexPrice.toFixed(4)
          : arb.dexPrice.toFixed(6);
      details += `DEX: ${priceStr} XMD`;
    }
    if (arb.ammPool) {
      details += details ? ` | Pool: ${arb.ammPool}` : `Pool: ${arb.ammPool}`;
    }

    // Indicate verified profit
    const verifiedTag = arb.verifiedProfit ? '✓' : '~';

    const message = `🔍 *COMPETITOR ARB*

\`${arb.account}\` | ${arb.type}
Token: *${arb.token}* | Size: ${tradeSize}
Profit: ${profitStr} (${arb.profitPercent.toFixed(2)}%) ${verifiedTag}${details ? '\n' + details : ''}
Time: ${new Date(arb.timestamp).toLocaleTimeString()}`;

    logger.debug(`Competitor arb: ${arb.account} ${arb.token} ${arb.type} ${profitStr} (size: ${tradeSize})`);

    // Only send Telegram for significant competitor profits (>$5) to reduce noise
    if (arb.profitUsd >= 5.0) {
      await telegramNotifier.notify(message, 'low');
    }

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

      logger.debug(`Saved competitor arb to database: ${arb.account}`);
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

    for (const [trxId, pending] of this.pendingArbs.entries()) {
      if (now - pending.firstSeen > maxAge) {
        this.pendingArbs.delete(trxId);
      }
    }
  }
}

// Singleton instance
export const competitorTracker = new CompetitorTracker();
