/**
 * XMD Treasury Integration
 *
 * Handles minting and redeeming XMD (Metal Dollar) via xmd.treasury contract.
 *
 * Supported collateral tokens:
 * - XUSDC (xtokens) - 60% max treasury allocation
 * - XPAX (xtokens) - 15% max treasury allocation
 * - XPYUSD (xtokens) - 15% max treasury allocation
 * - MPD (mpd.token) - 2% max treasury allocation
 *
 * All operations currently have 0% fees.
 */

import { getConfig, getLogger } from '../utils.js';
import * as dexrpc from '../dexrpc.js';

const logger = getLogger();

// Contract constants
const XMD_TREASURY_CONTRACT = 'xmd.treasury';
const XMD_TOKEN_CONTRACT = 'xmd.token';
const XTOKENS_CONTRACT = 'xtokens';

// Token precision
const XMD_PRECISION = 6;
const XUSDC_PRECISION = 6;

export interface SupportedCollateral {
  symbol: string;
  contract: string;
  precision: number;
  isMintEnabled: boolean;
  isRedeemEnabled: boolean;
  mintFee: number;
  redemptionFee: number;
  maxTreasuryPercent: number;
}

export interface TreasuryConfig {
  isPaused: boolean;
  feeAccount: string;
  minOraclePrice: number;
  supportedTokens: SupportedCollateral[];
}

/**
 * Format amount with proper precision
 */
function formatAmount(amount: number, precision: number, symbol: string): string {
  return `${amount.toFixed(precision)} ${symbol}`;
}

/**
 * XMD Treasury class for minting and redeeming XMD
 */
export class XMDTreasury {
  private config: TreasuryConfig | null = null;
  private rpcConfig: any;

  constructor() {
    const botConfig = getConfig();
    this.rpcConfig = botConfig.rpc;
  }

  /**
   * Initialize treasury by fetching current config
   */
  async initialize(): Promise<void> {
    try {
      await this.refreshConfig();
      logger.info('XMD Treasury initialized');
    } catch (error) {
      logger.error('Failed to initialize XMD Treasury:', error);
      throw error;
    }
  }

  /**
   * Refresh treasury configuration from chain
   */
  async refreshConfig(): Promise<void> {
    const { JsonRpc } = await import('@proton/js');
    const rpc = new JsonRpc(this.rpcConfig.endpoints);

    // Fetch globals
    const globalsResult = await rpc.get_table_rows({
      code: XMD_TREASURY_CONTRACT,
      scope: XMD_TREASURY_CONTRACT,
      table: 'xmdglobals',
      limit: 1,
      json: true
    });

    const globals = globalsResult.rows[0] || {
      isPaused: false,
      feeAccount: 'fee.metal',
      minOraclePrice: 0.995
    };

    // Fetch supported tokens
    const tokensResult = await rpc.get_table_rows({
      code: XMD_TREASURY_CONTRACT,
      scope: XMD_TREASURY_CONTRACT,
      table: 'tokens',
      limit: 100,
      json: true
    });

    const supportedTokens: SupportedCollateral[] = tokensResult.rows.map((row: any) => {
      const [precision, symbol] = row.symbol.sym.split(',');
      return {
        symbol,
        contract: row.symbol.contract,
        precision: parseInt(precision),
        isMintEnabled: row.isMintEnabled === 1,
        isRedeemEnabled: row.isRedeemEnabled === 1,
        mintFee: parseFloat(row.mintFee),
        redemptionFee: parseFloat(row.redemptionFee),
        maxTreasuryPercent: parseFloat(row.maxTreasuryPercent)
      };
    });

    this.config = {
      isPaused: globals.isPaused === 1,
      feeAccount: globals.feeAccount,
      minOraclePrice: parseFloat(globals.minOraclePrice),
      supportedTokens
    };
  }

  /**
   * Check if treasury is available
   */
  isAvailable(): boolean {
    return this.config !== null && !this.config.isPaused;
  }

  /**
   * Get supported collateral tokens
   */
  getSupportedTokens(): SupportedCollateral[] {
    return this.config?.supportedTokens || [];
  }

  /**
   * Check if a token can be used to mint XMD
   */
  canMint(symbol: string): boolean {
    const token = this.config?.supportedTokens.find(t => t.symbol === symbol);
    return token?.isMintEnabled ?? false;
  }

  /**
   * Check if XMD can be redeemed for a token
   */
  canRedeem(symbol: string): boolean {
    const token = this.config?.supportedTokens.find(t => t.symbol === symbol);
    return token?.isRedeemEnabled ?? false;
  }

  /**
   * Get token info
   */
  getTokenInfo(symbol: string): SupportedCollateral | undefined {
    return this.config?.supportedTokens.find(t => t.symbol === symbol);
  }

  /**
   * Mint XMD by sending collateral to treasury
   *
   * @param collateralSymbol - Symbol of collateral token (e.g., 'XUSDC')
   * @param amount - Amount of collateral to convert
   * @returns Transaction result
   */
  async mintXMD(collateralSymbol: string, amount: number): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('XMD Treasury is not available');
    }

    const tokenInfo = this.getTokenInfo(collateralSymbol);
    if (!tokenInfo) {
      throw new Error(`Token ${collateralSymbol} is not supported by XMD Treasury`);
    }

    if (!tokenInfo.isMintEnabled) {
      throw new Error(`Minting XMD with ${collateralSymbol} is currently disabled`);
    }

    const quantity = formatAmount(amount, tokenInfo.precision, collateralSymbol);

    logger.info(`Minting XMD: sending ${quantity} to ${XMD_TREASURY_CONTRACT}`);

    // Transfer collateral to treasury with "mint" memo
    const result = await dexrpc.transferToken(
      tokenInfo.contract,
      XMD_TREASURY_CONTRACT,
      quantity,
      'mint'
    );

    logger.info(`XMD mint successful: ${quantity} → XMD`);
    return result;
  }

  /**
   * Redeem XMD for collateral
   *
   * @param collateralSymbol - Symbol of collateral to receive (e.g., 'XUSDC')
   * @param xmdAmount - Amount of XMD to redeem
   * @returns Transaction result
   */
  async redeemXMD(collateralSymbol: string, xmdAmount: number): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('XMD Treasury is not available');
    }

    const tokenInfo = this.getTokenInfo(collateralSymbol);
    if (!tokenInfo) {
      throw new Error(`Token ${collateralSymbol} is not supported by XMD Treasury`);
    }

    if (!tokenInfo.isRedeemEnabled) {
      throw new Error(`Redeeming XMD for ${collateralSymbol} is currently disabled`);
    }

    const quantity = formatAmount(xmdAmount, XMD_PRECISION, 'XMD');
    const memo = `redeem,${collateralSymbol}`;

    logger.info(`Redeeming XMD: sending ${quantity} to ${XMD_TREASURY_CONTRACT} for ${collateralSymbol}`);

    // Transfer XMD to treasury with "redeem,TOKEN" memo
    const result = await dexrpc.transferToken(
      XMD_TOKEN_CONTRACT,
      XMD_TREASURY_CONTRACT,
      quantity,
      memo
    );

    logger.info(`XMD redeem successful: ${quantity} → ${collateralSymbol}`);
    return result;
  }

  /**
   * Convert XUSDC to XMD (convenience method)
   */
  async xUSDCtoXMD(amount: number): Promise<any> {
    return this.mintXMD('XUSDC', amount);
  }

  /**
   * Convert XMD to XUSDC (convenience method)
   */
  async xMDtoXUSDC(amount: number): Promise<any> {
    return this.redeemXMD('XUSDC', amount);
  }

  /**
   * Get current fees for a collateral token
   */
  getFees(symbol: string): { mintFee: number; redemptionFee: number } | null {
    const tokenInfo = this.getTokenInfo(symbol);
    if (!tokenInfo) return null;

    return {
      mintFee: tokenInfo.mintFee,
      redemptionFee: tokenInfo.redemptionFee
    };
  }
}

// Singleton instance
export const xmdTreasury = new XMDTreasury();

// Export for testing
export { XMD_TREASURY_CONTRACT, XMD_TOKEN_CONTRACT, XTOKENS_CONTRACT };
