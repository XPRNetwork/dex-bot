/**
 * Atomic Executor - Integrates with atomarb smart contract
 *
 * Builds and executes atomic transactions that either fully succeed
 * or fully revert - no partial fills, no stuck tokens.
 *
 * Requires:
 * 1. atomarb contract deployed and initialized
 * 2. User granted eosio.code permission to atomarb
 * 3. User added to atomarb's authorized table
 */

import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { telegramNotifier } from '../notifications/telegram.js';

const logger = getLogger();

interface AtomicConfig {
  enabled: boolean;
  contractAccount: string;
  minProfitBps: number;
  maxTradeUsd: number;
  dryRun: boolean;
}

interface AtomicOpportunity {
  path: 'AMM_TO_DEX' | 'DEX_TO_AMM';
  ammPrice: number;
  dexPrice: number;
  profitBps: number;
  tradeSizeUsd: number;
  tradeSizeXpr: number;
  pair: {
    name: string;
    baseToken: string;
    baseContract: string;
    basePrecision: number;
    ammPoolSymbol: string;
    dexMarketSymbol: string;
    dexMarketId: number;
  };
}

interface ExecutionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  reverted?: boolean;
}

/**
 * Builds and executes atomic arbitrage transactions
 * Uses the atomarb smart contract for profit verification
 */
export class AtomicExecutor {
  private rpc: JsonRpc;
  private api: Api;
  private config: AtomicConfig;
  private username: string;

  constructor() {
    const config = getConfig() as any;

    this.config = {
      enabled: config.atomicArbitrage?.enabled ?? false,
      contractAccount: config.atomicArbitrage?.contractAccount ?? 'atomarb',
      minProfitBps: config.atomicArbitrage?.minProfitBps ?? 10,
      maxTradeUsd: config.atomicArbitrage?.maxTradeUsd ?? 50,
      dryRun: config.atomicArbitrage?.dryRun ?? true
    };

    this.username = process.env.PROTON_USERNAME || '';
    const privateKey = process.env.PROTON_PRIVATE_KEY || '';

    this.rpc = new JsonRpc(config.rpc.endpoints);
    this.api = new Api({
      rpc: this.rpc,
      signatureProvider: new JsSignatureProvider([privateKey])
    });
  }

  /**
   * Check if atomic execution is available
   * Verifies contract exists and user has permissions
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Check if contract account exists
      await this.rpc.get_account(this.config.contractAccount);

      // Check if user is authorized
      const authRes = await this.rpc.get_table_rows({
        code: this.config.contractAccount,
        scope: this.config.contractAccount,
        table: 'authorized',
        lower_bound: this.username,
        upper_bound: this.username,
        limit: 1,
        json: true
      });

      if (authRes.rows.length === 0) {
        logger.warn(`User ${this.username} not authorized on ${this.config.contractAccount}`);
        return false;
      }

      return true;
    } catch (error: any) {
      logger.warn(`Atomic executor not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute AMM_TO_DEX atomic arbitrage
   * Path: XUSDC → XPR (AMM) → XMD (DEX sell) → XUSDC (Treasury)
   *
   * All actions in ONE transaction - reverts if profit not met
   */
  async executeAmmToDex(opportunity: AtomicOpportunity): Promise<ExecutionResult> {
    const { pair, tradeSizeUsd, tradeSizeXpr, ammPrice, dexPrice, profitBps } = opportunity;

    logger.info(`🔷 ATOMIC AMM→DEX: ${tradeSizeXpr.toFixed(0)} ${pair.baseToken} ($${tradeSizeUsd.toFixed(2)})`);
    logger.info(`   AMM: $${ammPrice.toFixed(6)} → DEX: $${dexPrice.toFixed(6)} = +${profitBps.toFixed(1)} BPS`);

    if (this.config.dryRun) {
      logger.info('   [DRY RUN] Would execute atomic transaction');
      return { success: true, reverted: false };
    }

    const xusdcAmount = tradeSizeUsd.toFixed(6);
    const minProfitBps = Math.max(this.config.minProfitBps, 5);

    // Calculate expected outputs for slippage protection
    const expectedXpr = tradeSizeUsd / ammPrice;
    const minXprOut = (expectedXpr * 0.98).toFixed(4); // 2% slippage
    const expectedXmd = expectedXpr * dexPrice * 1.0; // 0% DEX fee - tradingbot has no fees!
    const expectedFinalXusdc = expectedXmd; // 1:1 treasury redeem

    // Calculate raw values for DEX
    const precision = pair.basePrecision;
    const multiplier = Math.pow(10, precision);
    const xprRaw = Math.floor(expectedXpr * 0.98 * multiplier);
    const aggressivePriceRaw = Math.floor(dexPrice * 0.95 * 1000000); // 5% below market

    // Build atomic transaction
    const actions = [
      // 1. Start arbitrage via atomarb (records starting balance + swaps XUSDC→XPR)
      {
        account: this.config.contractAccount,
        name: 'ammtodex',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          user: this.username,
          amount: `${xusdcAmount} XUSDC`,
          min_profit_bps: minProfitBps,
          min_xpr_out: `${minXprOut} XPR`  // Slippage protection
        }
      },

      // 2. Deposit XPR to DEX (after AMM swap delivers it)
      // Note: The ammtodex action already swaps XUSDC→XPR
      // We need to deposit the received XPR to DEX
      {
        account: pair.baseContract,
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${(expectedXpr * 0.98).toFixed(precision)} ${pair.baseToken}`,
          memo: ''
        }
      },

      // 3. Place aggressive sell order on DEX
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: pair.dexMarketId,
          account: this.username,
          order_type: 1, // Limit
          order_side: 2, // Sell
          quantity: xprRaw,
          price: aggressivePriceRaw,
          bid_symbol: { sym: `${precision},${pair.baseToken}`, contract: pair.baseContract },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0, // Normal limit (stays on book)
          referrer: ''
        }
      },

      // 4. Process DEX matching
      {
        account: 'dex',
        name: 'process',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { q_size: 10, show_error_msg: 0 }
      },

      // 5. Withdraw all from DEX
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { account: this.username }
      },

      // 6. Redeem XMD for XUSDC via atomarb helper
      {
        account: this.config.contractAccount,
        name: 'redeemxmd',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          user: this.username,
          xmd_amount: `${expectedXmd.toFixed(6)} XMD`
        }
      },

      // 7. CRITICAL: Verify profit - reverts entire tx if not profitable!
      {
        account: this.config.contractAccount,
        name: 'verify',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          user: this.username,
          final_balance: Math.floor(expectedFinalXusdc * 1000000) // Raw XUSDC (6 decimals)
        }
      }
    ];

    return this.executeAtomic(actions, opportunity);
  }

  /**
   * Execute DEX_TO_AMM atomic arbitrage
   * Path: XUSDC → XMD (Treasury) → XPR (DEX buy) → XUSDC (AMM)
   *
   * All actions in ONE transaction - reverts if profit not met
   */
  async executeDexToAmm(opportunity: AtomicOpportunity): Promise<ExecutionResult> {
    const { pair, tradeSizeUsd, tradeSizeXpr, ammPrice, dexPrice, profitBps } = opportunity;

    logger.info(`🔷 ATOMIC DEX→AMM: ${tradeSizeXpr.toFixed(0)} ${pair.baseToken} ($${tradeSizeUsd.toFixed(2)})`);
    logger.info(`   DEX: $${dexPrice.toFixed(6)} → AMM: $${ammPrice.toFixed(6)} = +${profitBps.toFixed(1)} BPS`);

    if (this.config.dryRun) {
      logger.info('   [DRY RUN] Would execute atomic transaction');
      return { success: true, reverted: false };
    }

    const xusdcAmount = tradeSizeUsd.toFixed(6);
    const minProfitBps = Math.max(this.config.minProfitBps, 5);

    // Calculate expected outputs
    const expectedXmd = tradeSizeUsd; // 1:1 mint
    const expectedXpr = expectedXmd / dexPrice * 1.0; // 0% DEX fee - tradingbot has no fees!
    const expectedFinalXusdc = expectedXpr * ammPrice * 0.99932; // After 66% discounted AMM fee (0.068%)

    // Calculate raw values for DEX
    const xmdRaw = Math.floor(expectedXmd * 0.99 * 1000000); // 99% of XMD
    const aggressivePriceRaw = Math.floor(dexPrice * 1.05 * 1000000); // 5% above market

    // Calculate min XPR output for AMM swap
    const minXusdcOut = (expectedFinalXusdc * 0.97).toFixed(6); // 3% slippage

    // Build atomic transaction
    const actions = [
      // 1. Start arbitrage via atomarb (mints XMD from XUSDC)
      {
        account: this.config.contractAccount,
        name: 'dextoamm',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          user: this.username,
          amount: `${xusdcAmount} XUSDC`,
          min_profit_bps: minProfitBps
        }
      },

      // 2. Deposit XMD to DEX
      {
        account: 'xmd.token',
        name: 'transfer',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          from: this.username,
          to: 'dex',
          quantity: `${(expectedXmd * 0.99).toFixed(6)} XMD`,
          memo: ''
        }
      },

      // 3. Place aggressive buy order on DEX
      {
        account: 'dex',
        name: 'placeorder',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          market_id: pair.dexMarketId,
          account: this.username,
          order_type: 1, // Limit
          order_side: 1, // Buy
          quantity: xmdRaw, // XMD amount to spend
          price: aggressivePriceRaw,
          bid_symbol: { sym: `${pair.basePrecision},${pair.baseToken}`, contract: pair.baseContract },
          ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
          trigger_price: 0,
          fill_type: 0, // Normal limit
          referrer: ''
        }
      },

      // 4. Process DEX matching
      {
        account: 'dex',
        name: 'process',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { q_size: 10, show_error_msg: 0 }
      },

      // 5. Withdraw all from DEX (get XPR)
      {
        account: 'dex',
        name: 'withdrawall',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: { account: this.username }
      },

      // 6. Swap XPR to XUSDC via atomarb helper (with slippage protection)
      {
        account: this.config.contractAccount,
        name: 'swapxpr',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          user: this.username,
          xpr_amount: `${expectedXpr.toFixed(4)} XPR`,
          min_xusdc_out: `${minXusdcOut} XUSDC`  // Slippage protection
        }
      },

      // 7. CRITICAL: Verify profit - reverts entire tx if not profitable!
      {
        account: this.config.contractAccount,
        name: 'verify',
        authorization: [{ actor: this.username, permission: 'active' }],
        data: {
          user: this.username,
          final_balance: Math.floor(expectedFinalXusdc * 1000000) // Raw XUSDC
        }
      }
    ];

    return this.executeAtomic(actions, opportunity);
  }

  /**
   * Execute atomic transaction and handle result
   */
  private async executeAtomic(actions: any[], opportunity: AtomicOpportunity): Promise<ExecutionResult> {
    try {
      logger.info(`Submitting atomic transaction with ${actions.length} actions...`);

      const result = await this.api.transact(
        { actions },
        { blocksBehind: 3, expireSeconds: 30 }
      );

      const txId = (result as any).transaction_id;
      logger.info(`✅ ATOMIC SUCCESS: ${txId}`);

      await telegramNotifier.notify(
        `✅ *ATOMIC ARB SUCCESS*\n\n` +
        `Path: ${opportunity.path}\n` +
        `Size: $${opportunity.tradeSizeUsd.toFixed(2)}\n` +
        `Profit: +${opportunity.profitBps.toFixed(1)} BPS\n` +
        `TX: \`${txId}\``,
        'high'
      );

      return { success: true, transactionId: txId };

    } catch (error: any) {
      const errorMsg = error.message || String(error);

      // Check if this was a profit verification failure (expected behavior)
      if (errorMsg.includes('Arbitrage not profitable') || errorMsg.includes('not profitable')) {
        logger.info(`⏸️ Atomic tx reverted (not profitable): ${errorMsg}`);
        return { success: false, reverted: true, error: 'Not profitable - reverted' };
      }

      // Check for assertion failures (also expected)
      if (errorMsg.includes('assertion failure') || errorMsg.includes('eosio_assert')) {
        logger.info(`⏸️ Atomic tx reverted (assertion): ${errorMsg}`);
        return { success: false, reverted: true, error: errorMsg };
      }

      // Unexpected error
      logger.error(`❌ Atomic execution failed: ${errorMsg}`);
      await telegramNotifier.notify(
        `❌ *ATOMIC ARB FAILED*\n\n` +
        `Path: ${opportunity.path}\n` +
        `Error: ${errorMsg.slice(0, 100)}`,
        'high'
      );

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Execute opportunity based on path
   */
  async execute(opportunity: AtomicOpportunity): Promise<ExecutionResult> {
    if (opportunity.path === 'AMM_TO_DEX') {
      return this.executeAmmToDex(opportunity);
    } else {
      return this.executeDexToAmm(opportunity);
    }
  }

  /**
   * Build atomic transaction for preview (without executing)
   * Useful for debugging and testing
   */
  buildTransaction(opportunity: AtomicOpportunity): any[] {
    // This would return the actions array without executing
    // Useful for testing the transaction structure
    logger.info('Building atomic transaction preview...');
    return []; // Implement if needed for debugging
  }
}

// Singleton instance
export const atomicExecutor = new AtomicExecutor();
