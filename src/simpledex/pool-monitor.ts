/**
 * SimpleDEX Pool Monitor
 *
 * Reads SimpleDEX pool reserves from on-chain `simpledex` contract `pools` table.
 * Provides BigInt constant product calculations matching on-chain math exactly.
 *
 * SimpleDEX contract: simpledex (dex.protonnz.com)
 * Swap memo format: "swap:POOL_ID:MIN_OUT:IS_TOKEN_A_IN"
 *   - IS_TOKEN_A_IN: 1 if sending tokenA, 0 if sending tokenB
 */

import { JsonRpc } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';

const logger = getLogger();

const SIMPLEDEX_CONTRACT = 'simpledex';
const POOLS_TABLE = 'pools';

export interface SimpleDexPool {
  id: number;
  tokenAContract: string;
  tokenASymbol: string;      // e.g. "XPR"
  tokenAPrecision: number;
  tokenBContract: string;
  tokenBSymbol: string;      // e.g. "LOAN"
  tokenBPrecision: number;
  reserveA: bigint;          // Raw integer reserves (scaled by precision)
  reserveB: bigint;
  feeRate: number;           // e.g. 30 = 0.3%
  paused: boolean;
}

// No hardcoded pool list — load all pools for auto-discovery

export class SimpleDexPoolMonitor {
  private rpc: JsonRpc;
  private pools: Map<number, SimpleDexPool> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    const config = getConfig();
    this.rpc = new JsonRpc(config.rpc.endpoints);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('Initializing SimpleDEX Pool Monitor...');
    await this.refreshPools();
    this.isInitialized = true;
    logger.info(`SimpleDEX Pool Monitor initialized with ${this.pools.size} pools`);
  }

  /**
   * Refresh all monitored pool states from on-chain
   */
  async refreshPools(): Promise<void> {
    try {
      const result = await this.rpc.get_table_rows({
        json: true,
        code: SIMPLEDEX_CONTRACT,
        scope: SIMPLEDEX_CONTRACT,
        table: POOLS_TABLE,
        limit: 200
      });

      for (const row of result.rows) {
        const pool = this.parsePoolRow(row);
        if (pool && !pool.paused) {
          this.pools.set(pool.id, pool);
        }
      }
    } catch (error: any) {
      logger.error('Failed to fetch SimpleDEX pools:', error.message);
      throw error;
    }
  }

  /**
   * Parse on-chain pool row into our structure
   *
   * Actual on-chain format (camelCase, reserves are raw integers):
   * {
   *   id: 1,
   *   tokenAContract: "eosio.token",
   *   tokenASymbol: "4,XPR",
   *   tokenBContract: "xmd.token",
   *   tokenBSymbol: "6,XMD",
   *   reserveA: 301983994,           // raw integer (may be string for large values)
   *   reserveB: 71649282,
   *   feeRate: 30,
   *   paused: 0
   * }
   */
  private parsePoolRow(row: any): SimpleDexPool | null {
    try {
      // Parse token symbol format: "4,XPR" → precision=4, symbol="XPR"
      const tokenA = this.parseSymbolString(row.tokenASymbol);
      const tokenB = this.parseSymbolString(row.tokenBSymbol);
      if (!tokenA || !tokenB) return null;

      // Reserves are already raw integers (may come as number or string for large values)
      const reserveA = BigInt(row.reserveA);
      const reserveB = BigInt(row.reserveB);

      return {
        id: row.id,
        tokenAContract: row.tokenAContract,
        tokenASymbol: tokenA.symbol,
        tokenAPrecision: tokenA.precision,
        tokenBContract: row.tokenBContract,
        tokenBSymbol: tokenB.symbol,
        tokenBPrecision: tokenB.precision,
        reserveA,
        reserveB,
        feeRate: row.feeRate || 30,
        paused: row.paused === 1
      };
    } catch (error) {
      logger.debug('Failed to parse SimpleDEX pool row:', row, error);
      return null;
    }
  }

  /**
   * Parse symbol string "4,XPR" → { precision: 4, symbol: "XPR" }
   */
  private parseSymbolString(symStr: string): { precision: number; symbol: string } | null {
    if (!symStr) return null;
    try {
      const parts = symStr.split(',');
      return { precision: parseInt(parts[0]), symbol: parts[1] };
    } catch {
      return null;
    }
  }

  /**
   * Get a pool by ID
   */
  getPool(id: number): SimpleDexPool | undefined {
    return this.pools.get(id);
  }

  /**
   * Calculate swap output using BigInt integer math matching on-chain exactly
   *
   * SimpleDEX constant product with fee:
   *   fee = input_raw * fee_rate / 10000
   *   net_input = input_raw - fee
   *   output = net_input * reserve_out / (reserve_in + net_input)
   *
   * All division is floor division (BigInt default).
   *
   * @param poolId - Pool ID
   * @param inputRaw - Input amount as BigInt (raw integer, scaled by precision)
   * @param isTokenAIn - true if sending tokenA, false if sending tokenB
   * @returns Output amount as BigInt (raw integer), or null if pool not found
   */
  calculateSwapOutput(poolId: number, inputRaw: bigint, isTokenAIn: boolean): bigint | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    const reserveIn = isTokenAIn ? pool.reserveA : pool.reserveB;
    const reserveOut = isTokenAIn ? pool.reserveB : pool.reserveA;

    if (reserveIn === 0n || reserveOut === 0n) return null;

    const fee = inputRaw * BigInt(pool.feeRate) / 10000n;
    const netInput = inputRaw - fee;
    const output = netInput * reserveOut / (reserveIn + netInput);

    // SimpleDEX contract enforces max swap of 50% of output reserve (5000 bps)
    if (output > reserveOut / 2n) return null;

    return output;
  }

  /**
   * Calculate swap output as floating point (convenience wrapper)
   */
  calculateSwapOutputFloat(poolId: number, inputAmount: number, isTokenAIn: boolean): number | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    const inputPrecision = isTokenAIn ? pool.tokenAPrecision : pool.tokenBPrecision;
    const outputPrecision = isTokenAIn ? pool.tokenBPrecision : pool.tokenAPrecision;

    const inputRaw = BigInt(Math.floor(inputAmount * (10 ** inputPrecision)));
    const outputRaw = this.calculateSwapOutput(poolId, inputRaw, isTokenAIn);
    if (outputRaw === null) return null;

    return Number(outputRaw) / (10 ** outputPrecision);
  }

  /**
   * Get spot price for a pool (tokenB per tokenA)
   */
  getSpotPrice(poolId: number): number | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;
    if (pool.reserveA === 0n) return null;

    const aFloat = Number(pool.reserveA) / (10 ** pool.tokenAPrecision);
    const bFloat = Number(pool.reserveB) / (10 ** pool.tokenBPrecision);
    return bFloat / aFloat;
  }

  /**
   * Convert a floating point amount to raw BigInt for a given pool/token side
   */
  toRaw(poolId: number, amount: number, isTokenA: boolean): bigint | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;
    const precision = isTokenA ? pool.tokenAPrecision : pool.tokenBPrecision;
    return BigInt(Math.floor(amount * (10 ** precision)));
  }

  /**
   * Convert a raw BigInt to floating point for a given pool/token side
   */
  fromRaw(poolId: number, raw: bigint, isTokenA: boolean): number | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;
    const precision = isTokenA ? pool.tokenAPrecision : pool.tokenBPrecision;
    return Number(raw) / (10 ** precision);
  }

  /**
   * Format a raw BigInt amount as an asset string (e.g. "1234.5678 XPR")
   */
  formatAsset(poolId: number, raw: bigint, isTokenA: boolean): string | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;
    const precision = isTokenA ? pool.tokenAPrecision : pool.tokenBPrecision;
    const symbol = isTokenA ? pool.tokenASymbol : pool.tokenBSymbol;
    const amount = Number(raw) / (10 ** precision);
    return `${amount.toFixed(precision)} ${symbol}`;
  }

  /**
   * Get token contract for a pool/side
   */
  getTokenContract(poolId: number, isTokenA: boolean): string | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;
    return isTokenA ? pool.tokenAContract : pool.tokenBContract;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getAllPools(): SimpleDexPool[] {
    return Array.from(this.pools.values());
  }
}

// Singleton instance
export const simpleDexPoolMonitor = new SimpleDexPoolMonitor();
