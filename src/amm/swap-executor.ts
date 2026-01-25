import { JsonRpc, Api, JsSignatureProvider, Serialize } from '@proton/js';
import { getConfig, getLogger, getUsername } from '../utils.js';
import { ammPoolMonitor, Pool } from './pool-monitor.js';
import { ammPriceCalculator, SwapQuote } from './price-calculator.js';
import Decimal from 'decimal.js';

const logger = getLogger();

type SwapAction = Serialize.Action;

// Contract addresses
const PROTON_SWAPS_CONTRACT = 'proton.swaps';

// Token contracts (common ones)
const TOKEN_CONTRACTS: Record<string, string> = {
  'XPR': 'eosio.token',
  'XMT': 'xmt.token',
  'XUSDC': 'xtokens',
  'XBTC': 'xtokens',
  'XETH': 'xtokens',
  'METAL': 'xtokens'
};

export interface SwapParams {
  poolSymbol: string;
  inputToken: string;
  inputAmount: number;
  minOutputAmount: number;
  slippageBps?: number;
}

export interface SwapResult {
  success: boolean;
  inputAmount: number;
  outputAmount: number;
  inputToken: string;
  outputToken: string;
  txId?: string;
  error?: string;
}

/**
 * AMM Swap Executor for proton.swaps
 */
export class SwapExecutor {
  private rpc: JsonRpc;
  private api: Api;
  private username: string;
  private authorization: { actor: string; permission: string }[];

  constructor() {
    const config = getConfig();
    const { endpoints, privateKey, privateKeyPermission } = config.rpc;

    this.rpc = new JsonRpc(endpoints);

    const signatureProvider = process.env.npm_lifecycle_event === 'test'
      ? undefined
      : new JsSignatureProvider([privateKey]);

    this.api = new Api({
      rpc: this.rpc,
      signatureProvider: signatureProvider as any
    });

    this.username = getUsername();
    this.authorization = [{
      actor: this.username,
      permission: privateKeyPermission
    }];
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const { poolSymbol, inputToken, inputAmount, minOutputAmount, slippageBps = 50 } = params;

    try {
      // Get pool info
      const pool = await ammPoolMonitor.getPool(poolSymbol);
      if (!pool) {
        return {
          success: false,
          inputAmount,
          outputAmount: 0,
          inputToken,
          outputToken: '',
          error: `Pool ${poolSymbol} not found`
        };
      }

      // Get quote
      const quote = ammPriceCalculator.getSwapQuote(pool, inputToken, inputAmount, slippageBps);
      if (!quote) {
        return {
          success: false,
          inputAmount,
          outputAmount: 0,
          inputToken,
          outputToken: '',
          error: `Failed to get swap quote`
        };
      }

      // Check minimum output
      if (quote.outputAmount < minOutputAmount) {
        return {
          success: false,
          inputAmount,
          outputAmount: quote.outputAmount,
          inputToken,
          outputToken: quote.outputToken,
          error: `Output ${quote.outputAmount} below minimum ${minOutputAmount}`
        };
      }

      // Build and execute swap action
      const actions = this.buildSwapActions(pool, inputToken, inputAmount, quote.outputToken);
      const result = await this.transact(actions);

      return {
        success: true,
        inputAmount,
        outputAmount: quote.outputAmount,
        inputToken,
        outputToken: quote.outputToken,
        txId: result?.transaction_id
      };

    } catch (error: any) {
      logger.error(`Swap execution failed:`, error);
      return {
        success: false,
        inputAmount,
        outputAmount: 0,
        inputToken,
        outputToken: '',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Build swap actions
   *
   * proton.swaps works by transferring tokens to the contract with a memo
   * specifying the output token symbol
   */
  private buildSwapActions(
    pool: Pool,
    inputToken: string,
    inputAmount: number,
    outputToken: string
  ): SwapAction[] {
    const isToken1Input = pool.token1.symbol === inputToken;
    const inputTokenInfo = isToken1Input ? pool.token1 : pool.token2;
    const outputTokenInfo = isToken1Input ? pool.token2 : pool.token1;

    // Format quantity with correct precision
    const quantityStr = new Decimal(inputAmount)
      .toFixed(inputTokenInfo.precision) + ` ${inputToken}`;

    // Get token contract
    const tokenContract = inputTokenInfo.contract || TOKEN_CONTRACTS[inputToken] || 'eosio.token';

    // The memo specifies what token we want to receive
    const memo = outputTokenInfo.symbol;

    return [
      {
        account: tokenContract,
        name: 'transfer',
        data: {
          from: this.username,
          to: PROTON_SWAPS_CONTRACT,
          quantity: quantityStr,
          memo: memo
        },
        authorization: this.authorization
      }
    ];
  }

  /**
   * Execute a transaction with retry logic
   */
  private async transact(actions: SwapAction[], maxRetries: number = 3): Promise<any> {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const result = await this.api.transact(
          { actions },
          {
            blocksBehind: 300,
            expireSeconds: 3000
          }
        );
        return result;
      } catch (error: any) {
        attempts++;
        if (attempts >= maxRetries) {
          logger.error(`Swap failed after ${maxRetries} attempts:`, error);
          throw error;
        }
        logger.warn(`Swap attempt ${attempts} failed, retrying...`);
        await this.delay(1000 * attempts); // Exponential backoff
      }
    }
  }

  /**
   * Get a swap quote without executing
   */
  async getQuote(params: Omit<SwapParams, 'minOutputAmount'>): Promise<SwapQuote | null> {
    const pool = await ammPoolMonitor.getPool(params.poolSymbol);
    if (!pool) return null;

    return ammPriceCalculator.getSwapQuote(
      pool,
      params.inputToken,
      params.inputAmount,
      params.slippageBps
    );
  }

  /**
   * Execute an atomic arbitrage (swap + DEX order in single transaction)
   * Note: This requires custom smart contract support for true atomicity
   * For now, this executes sequentially
   */
  async executeArbitrage(
    poolSymbol: string,
    direction: 'AMM_TO_DEX' | 'DEX_TO_AMM',
    inputToken: string,
    inputAmount: number,
    minProfit: number
  ): Promise<{
    success: boolean;
    ammSwap?: SwapResult;
    profit?: number;
    error?: string;
  }> {
    try {
      // Get pool and quote
      const pool = await ammPoolMonitor.getPool(poolSymbol);
      if (!pool) {
        return { success: false, error: `Pool ${poolSymbol} not found` };
      }

      const quote = ammPriceCalculator.getSwapQuote(pool, inputToken, inputAmount);
      if (!quote) {
        return { success: false, error: 'Failed to get swap quote' };
      }

      // Execute based on direction
      if (direction === 'AMM_TO_DEX') {
        // Buy on AMM, sell on DEX
        const swapResult = await this.executeSwap({
          poolSymbol,
          inputToken,
          inputAmount,
          minOutputAmount: quote.minimumOutput
        });

        if (!swapResult.success) {
          return { success: false, ammSwap: swapResult, error: swapResult.error };
        }

        // DEX order would be placed separately via dexrpc
        // For now, return the swap result
        return {
          success: true,
          ammSwap: swapResult,
          profit: 0 // Calculated after DEX execution
        };

      } else {
        // DEX_TO_AMM: Buy on DEX first, then sell on AMM
        // DEX order would be placed first via dexrpc
        // Then swap on AMM
        const swapResult = await this.executeSwap({
          poolSymbol,
          inputToken,
          inputAmount,
          minOutputAmount: quote.minimumOutput
        });

        return {
          success: swapResult.success,
          ammSwap: swapResult,
          profit: 0,
          error: swapResult.error
        };
      }

    } catch (error: any) {
      logger.error('Arbitrage execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if we have sufficient balance for a swap
   */
  async checkBalance(token: string, requiredAmount: number): Promise<boolean> {
    try {
      const contract = TOKEN_CONTRACTS[token] || 'eosio.token';
      const result = await this.rpc.get_currency_balance(contract, this.username, token);

      if (result.length === 0) return false;

      const balance = parseFloat(result[0].split(' ')[0]);
      return balance >= requiredAmount;

    } catch (error) {
      logger.error(`Failed to check balance for ${token}:`, error);
      return false;
    }
  }

  /**
   * Get token balance
   */
  async getBalance(token: string): Promise<number> {
    try {
      const contract = TOKEN_CONTRACTS[token] || 'eosio.token';
      const result = await this.rpc.get_currency_balance(contract, this.username, token);

      if (result.length === 0) return 0;

      return parseFloat(result[0].split(' ')[0]);
    } catch (error) {
      logger.error(`Failed to get balance for ${token}:`, error);
      return 0;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const swapExecutor = new SwapExecutor();
