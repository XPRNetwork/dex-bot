import { JsonRpc } from '@proton/js';
import { getConfig, getLogger } from '../utils.js';
import { arbitrageRepository } from '../persistence/index.js';
import Decimal from 'decimal.js';

const logger = getLogger();

export interface PoolToken {
  contract: string;
  symbol: string;
  precision: number;
  amount: number;
}

export interface Pool {
  id: number;
  symbol: string;
  token1: PoolToken;
  token2: PoolToken;
  fee: number;          // Fee in basis points (e.g., 20 = 0.2%)
  k: string;            // Constant product (x * y = k)
  price: number;        // token2 per token1
  liquidityUSD: number;
  lastUpdated: Date;
}

export interface PoolReserves {
  reserve1: number;
  reserve2: number;
  token1Symbol: string;
  token2Symbol: string;
}

// proton.swaps contract configuration
const PROTON_SWAPS_CONTRACT = 'proton.swaps';
const POOLS_TABLE = 'pools';
const PROTOCOL_FEE_BPS = 20; // 0.2% fee

// Pool symbol to ID mapping for known pools
const KNOWN_POOLS: Record<string, { id: number; token1: string; token2: string }> = {
  'XPRUSDC': { id: 1, token1: 'XPR', token2: 'XUSDC' },
  'BTCUSDC': { id: 2, token1: 'XBTC', token2: 'XUSDC' },
  'ETHUSDC': { id: 3, token1: 'XETH', token2: 'XUSDC' },
  'XMTUSDC': { id: 4, token1: 'XMT', token2: 'XUSDC' },
  'XPRXMT': { id: 5, token1: 'XPR', token2: 'XMT' },
  'METALUSDC': { id: 6, token1: 'METAL', token2: 'XUSDC' }
};

/**
 * AMM Pool Monitor for proton.swaps
 */
export class AMMPoolMonitor {
  private rpc: JsonRpc;
  private pools: Map<string, Pool> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    const config = getConfig();
    this.rpc = new JsonRpc(config.rpc.endpoints);
  }

  /**
   * Initialize the pool monitor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('Initializing AMM Pool Monitor...');

    try {
      await this.fetchAllPools();
      this.isInitialized = true;
      logger.info(`AMM Pool Monitor initialized with ${this.pools.size} pools`);
    } catch (error) {
      logger.error('Failed to initialize AMM Pool Monitor:', error);
      throw error;
    }
  }

  /**
   * Fetch all pools from proton.swaps contract
   */
  async fetchAllPools(): Promise<Pool[]> {
    try {
      const result = await this.rpc.get_table_rows({
        json: true,
        code: PROTON_SWAPS_CONTRACT,
        scope: PROTON_SWAPS_CONTRACT,
        table: POOLS_TABLE,
        limit: 100
      });

      const pools: Pool[] = [];

      for (const row of result.rows) {
        const pool = this.parsePoolRow(row);
        if (pool) {
          this.pools.set(pool.symbol, pool);
          pools.push(pool);
        }
      }

      return pools;
    } catch (error) {
      logger.error('Failed to fetch pools:', error);
      throw error;
    }
  }

  /**
   * Parse a pool row from the table
   */
  private parsePoolRow(row: any): Pool | null {
    try {
      // Parse pool1 and pool2 asset strings (e.g., "7403425.0000 XPR")
      const pool1Parts = this.parseAsset(row.pool1);
      const pool2Parts = this.parseAsset(row.pool2);

      if (!pool1Parts || !pool2Parts) {
        return null;
      }

      const symbol = `${pool1Parts.symbol}${pool2Parts.symbol}`;
      const price = pool1Parts.amount > 0 ? pool2Parts.amount / pool1Parts.amount : 0;

      // Estimate liquidity in USD (assuming pool2 is a stablecoin)
      const liquidityUSD = pool2Parts.symbol.includes('USD') ?
        pool2Parts.amount * 2 :
        pool1Parts.amount * price * 2;

      return {
        id: row.id || 0,
        symbol,
        token1: {
          contract: row.pool1_contract || 'eosio.token',
          symbol: pool1Parts.symbol,
          precision: pool1Parts.precision,
          amount: pool1Parts.amount
        },
        token2: {
          contract: row.pool2_contract || 'xtokens',
          symbol: pool2Parts.symbol,
          precision: pool2Parts.precision,
          amount: pool2Parts.amount
        },
        fee: PROTOCOL_FEE_BPS,
        k: new Decimal(pool1Parts.amount).times(pool2Parts.amount).toString(),
        price,
        liquidityUSD,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.debug('Failed to parse pool row:', row, error);
      return null;
    }
  }

  /**
   * Parse an asset string (e.g., "1000.0000 XPR")
   */
  private parseAsset(assetString: string): { amount: number; symbol: string; precision: number } | null {
    if (!assetString) return null;

    const parts = assetString.trim().split(' ');
    if (parts.length !== 2) return null;

    const amount = parseFloat(parts[0]);
    const symbol = parts[1];
    const decimalParts = parts[0].split('.');
    const precision = decimalParts.length > 1 ? decimalParts[1].length : 0;

    return { amount, symbol, precision };
  }

  /**
   * Get a specific pool by symbol
   */
  async getPool(poolSymbol: string): Promise<Pool | null> {
    // Try cached first
    if (this.pools.has(poolSymbol)) {
      return this.pools.get(poolSymbol)!;
    }

    // Refresh pools
    await this.fetchAllPools();
    return this.pools.get(poolSymbol) || null;
  }

  /**
   * Get pool by token symbols
   */
  async getPoolByTokens(token1: string, token2: string): Promise<Pool | null> {
    const symbol = `${token1}${token2}`;
    return this.getPool(symbol) || this.getPool(`${token2}${token1}`);
  }

  /**
   * Refresh a specific pool
   */
  async refreshPool(poolSymbol: string): Promise<Pool | null> {
    const knownPool = KNOWN_POOLS[poolSymbol];
    if (!knownPool) {
      return this.getPool(poolSymbol);
    }

    try {
      const result = await this.rpc.get_table_rows({
        json: true,
        code: PROTON_SWAPS_CONTRACT,
        scope: PROTON_SWAPS_CONTRACT,
        table: POOLS_TABLE,
        lower_bound: knownPool.id,
        upper_bound: knownPool.id,
        limit: 1
      });

      if (result.rows.length > 0) {
        const pool = this.parsePoolRow(result.rows[0]);
        if (pool) {
          this.pools.set(poolSymbol, pool);

          // Save snapshot
          try {
            arbitrageRepository.createPoolSnapshot({
              pool_symbol: poolSymbol,
              reserve1: pool.token1.amount,
              reserve2: pool.token2.amount,
              token1_symbol: pool.token1.symbol,
              token2_symbol: pool.token2.symbol,
              liquidity_usd: pool.liquidityUSD,
              price: pool.price
            });
          } catch (e) {
            // Ignore snapshot errors
          }

          return pool;
        }
      }
    } catch (error) {
      logger.error(`Failed to refresh pool ${poolSymbol}:`, error);
    }

    return null;
  }

  /**
   * Get reserves for a pool
   */
  async getReserves(poolSymbol: string): Promise<PoolReserves | null> {
    const pool = await this.getPool(poolSymbol);
    if (!pool) return null;

    return {
      reserve1: pool.token1.amount,
      reserve2: pool.token2.amount,
      token1Symbol: pool.token1.symbol,
      token2Symbol: pool.token2.symbol
    };
  }

  /**
   * Get all pools
   */
  getAllPools(): Pool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Get pools by token
   */
  getPoolsByToken(tokenSymbol: string): Pool[] {
    const matching: Pool[] = [];
    for (const pool of this.pools.values()) {
      if (pool.token1.symbol === tokenSymbol || pool.token2.symbol === tokenSymbol) {
        matching.push(pool);
      }
    }
    return matching;
  }

  /**
   * Get pool fee in basis points
   */
  getPoolFee(): number {
    return PROTOCOL_FEE_BPS;
  }

  /**
   * Subscribe to pool updates (polling-based)
   */
  startPolling(intervalMs: number = 5000, poolSymbols?: string[]): NodeJS.Timeout {
    logger.info(`Starting pool polling with ${intervalMs}ms interval`);

    const poll = async () => {
      try {
        if (poolSymbols) {
          for (const symbol of poolSymbols) {
            await this.refreshPool(symbol);
          }
        } else {
          await this.fetchAllPools();
        }
      } catch (error) {
        logger.error('Pool polling error:', error);
      }
    };

    return setInterval(poll, intervalMs);
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clear cached pools
   */
  clearCache(): void {
    this.pools.clear();
  }
}

// Singleton instance
export const ammPoolMonitor = new AMMPoolMonitor();
