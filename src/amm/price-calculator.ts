import Decimal from 'decimal.js';
import { Pool, PoolReserves } from './pool-monitor.js';

// Set high precision for AMM calculations
Decimal.set({ precision: 28 });

export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  inputToken: string;
  outputToken: string;
  effectivePrice: number;
  priceImpact: number;
  fee: number;
  minimumOutput: number;
}

export interface ArbitrageOpportunity {
  poolSymbol: string;
  direction: 'AMM_TO_DEX' | 'DEX_TO_AMM';
  ammPrice: number;
  dexPrice: number;
  spreadBps: number;
  optimalSize: number;
  expectedProfit: number;
  profitable: boolean;
}

/**
 * AMM Price Calculator using constant product formula (x * y = k)
 */
export class AMMPriceCalculator {
  private defaultSlippageBps: number = 50; // 0.5% default slippage tolerance

  /**
   * Calculate output amount for a swap (constant product formula)
   *
   * Formula: output = (input * reserve_out) / (reserve_in + input)
   * After fee: output = output * (1 - fee_bps / 10000)
   */
  calculateSwapOutput(
    inputAmount: number,
    reserveIn: number,
    reserveOut: number,
    feeBps: number = 20
  ): number {
    if (inputAmount <= 0 || reserveIn <= 0 || reserveOut <= 0) {
      return 0;
    }

    const input = new Decimal(inputAmount);
    const resIn = new Decimal(reserveIn);
    const resOut = new Decimal(reserveOut);

    // Calculate output before fee
    const numerator = input.times(resOut);
    const denominator = resIn.plus(input);
    const outputBeforeFee = numerator.div(denominator);

    // Apply fee
    const feeMultiplier = new Decimal(10000).minus(feeBps).div(10000);
    const output = outputBeforeFee.times(feeMultiplier);

    return output.toNumber();
  }

  /**
   * Calculate input amount required for a desired output
   *
   * Formula: input = (reserve_in * output) / ((reserve_out - output) * (1 - fee))
   */
  calculateSwapInput(
    outputAmount: number,
    reserveIn: number,
    reserveOut: number,
    feeBps: number = 20
  ): number {
    if (outputAmount <= 0 || outputAmount >= reserveOut || reserveIn <= 0) {
      return Infinity;
    }

    const output = new Decimal(outputAmount);
    const resIn = new Decimal(reserveIn);
    const resOut = new Decimal(reserveOut);

    // Adjust for fee
    const feeMultiplier = new Decimal(10000).minus(feeBps).div(10000);
    const outputWithFee = output.div(feeMultiplier);

    // Calculate input
    const numerator = resIn.times(outputWithFee);
    const denominator = resOut.minus(outputWithFee);

    if (denominator.lessThanOrEqualTo(0)) {
      return Infinity;
    }

    return numerator.div(denominator).toNumber();
  }

  /**
   * Get current spot price from pool reserves
   */
  getSpotPrice(reserveBase: number, reserveQuote: number): number {
    if (reserveBase <= 0) return 0;
    return new Decimal(reserveQuote).div(reserveBase).toNumber();
  }

  /**
   * Calculate effective price for a swap
   */
  getEffectivePrice(
    inputAmount: number,
    outputAmount: number,
    isBuy: boolean
  ): number {
    if (inputAmount <= 0 || outputAmount <= 0) return 0;

    if (isBuy) {
      // Buying base token with quote token
      return new Decimal(inputAmount).div(outputAmount).toNumber();
    } else {
      // Selling base token for quote token
      return new Decimal(outputAmount).div(inputAmount).toNumber();
    }
  }

  /**
   * Calculate price impact of a swap
   */
  calculatePriceImpact(
    inputAmount: number,
    reserveIn: number,
    reserveOut: number,
    feeBps: number = 20
  ): number {
    // Get spot price before swap
    const spotPrice = this.getSpotPrice(reserveIn, reserveOut);

    // Calculate output
    const output = this.calculateSwapOutput(inputAmount, reserveIn, reserveOut, feeBps);

    // Get effective price after swap
    const effectivePrice = new Decimal(inputAmount).div(output).toNumber();

    // Calculate impact as percentage
    const impact = new Decimal(effectivePrice)
      .minus(spotPrice)
      .div(spotPrice)
      .abs()
      .times(100);

    return impact.toNumber();
  }

  /**
   * Generate a complete swap quote
   */
  getSwapQuote(
    pool: Pool,
    inputToken: string,
    inputAmount: number,
    slippageBps: number = this.defaultSlippageBps
  ): SwapQuote | null {
    const isToken1Input = pool.token1.symbol === inputToken;

    if (!isToken1Input && pool.token2.symbol !== inputToken) {
      return null; // Token not in pool
    }

    const reserveIn = isToken1Input ? pool.token1.amount : pool.token2.amount;
    const reserveOut = isToken1Input ? pool.token2.amount : pool.token1.amount;
    const outputToken = isToken1Input ? pool.token2.symbol : pool.token1.symbol;

    const outputAmount = this.calculateSwapOutput(inputAmount, reserveIn, reserveOut, pool.fee);
    const priceImpact = this.calculatePriceImpact(inputAmount, reserveIn, reserveOut, pool.fee);
    const effectivePrice = this.getEffectivePrice(inputAmount, outputAmount, isToken1Input);
    const fee = new Decimal(inputAmount).times(pool.fee).div(10000).toNumber();

    // Calculate minimum output with slippage
    const slippageMultiplier = new Decimal(10000).minus(slippageBps).div(10000);
    const minimumOutput = new Decimal(outputAmount).times(slippageMultiplier).toNumber();

    return {
      inputAmount,
      outputAmount,
      inputToken,
      outputToken,
      effectivePrice,
      priceImpact,
      fee,
      minimumOutput
    };
  }

  /**
   * Find arbitrage opportunity between AMM and DEX
   */
  findArbitrageOpportunity(
    pool: Pool,
    dexBid: number,
    dexAsk: number,
    minProfitBps: number = 10
  ): ArbitrageOpportunity {
    const ammPrice = pool.price;

    // Calculate spreads
    // If AMM price < DEX bid: Buy on AMM, sell on DEX
    // If AMM price > DEX ask: Buy on DEX, sell on AMM

    let direction: 'AMM_TO_DEX' | 'DEX_TO_AMM';
    let dexPrice: number;
    let spreadBps: number;

    if (ammPrice < dexBid) {
      // AMM is cheaper - buy on AMM, sell on DEX
      direction = 'AMM_TO_DEX';
      dexPrice = dexBid;
      spreadBps = new Decimal(dexBid)
        .minus(ammPrice)
        .div(ammPrice)
        .times(10000)
        .toNumber();
    } else if (ammPrice > dexAsk) {
      // DEX is cheaper - buy on DEX, sell on AMM
      direction = 'DEX_TO_AMM';
      dexPrice = dexAsk;
      spreadBps = new Decimal(ammPrice)
        .minus(dexAsk)
        .div(dexAsk)
        .times(10000)
        .toNumber();
    } else {
      // No arbitrage opportunity
      return {
        poolSymbol: pool.symbol,
        direction: 'AMM_TO_DEX',
        ammPrice,
        dexPrice: (dexBid + dexAsk) / 2,
        spreadBps: 0,
        optimalSize: 0,
        expectedProfit: 0,
        profitable: false
      };
    }

    // Account for AMM fee
    const netSpreadBps = spreadBps - pool.fee;
    const profitable = netSpreadBps >= minProfitBps;

    // Calculate optimal trade size (simplified - use smaller of reserves)
    // In practice, this should account for price impact
    const optimalSize = profitable ? this.calculateOptimalArbSize(pool, netSpreadBps) : 0;
    const expectedProfit = optimalSize * (netSpreadBps / 10000);

    return {
      poolSymbol: pool.symbol,
      direction,
      ammPrice,
      dexPrice,
      spreadBps: netSpreadBps,
      optimalSize,
      expectedProfit,
      profitable
    };
  }

  /**
   * Calculate optimal arbitrage size considering price impact
   */
  calculateOptimalArbSize(pool: Pool, netSpreadBps: number): number {
    // Simple heuristic: trade up to 1% of smaller reserve
    // In practice, would use calculus to find profit-maximizing size
    const smallerReserve = Math.min(pool.token1.amount, pool.token2.amount);
    const baseSize = smallerReserve * 0.01;

    // Reduce size if spread is small (higher price impact risk)
    const spreadFactor = Math.min(netSpreadBps / 100, 1);
    return baseSize * spreadFactor;
  }

  /**
   * Calculate reserves after a swap
   */
  getReservesAfterSwap(
    inputAmount: number,
    reserveIn: number,
    reserveOut: number,
    feeBps: number = 20
  ): PoolReserves & { outputAmount: number } {
    const output = this.calculateSwapOutput(inputAmount, reserveIn, reserveOut, feeBps);

    return {
      reserve1: reserveIn + inputAmount,
      reserve2: reserveOut - output,
      token1Symbol: '',
      token2Symbol: '',
      outputAmount: output
    };
  }

  /**
   * Check if a swap is within acceptable slippage
   */
  isWithinSlippage(
    expectedOutput: number,
    actualOutput: number,
    slippageBps: number
  ): boolean {
    const minOutput = new Decimal(expectedOutput)
      .times(new Decimal(10000).minus(slippageBps))
      .div(10000);

    return new Decimal(actualOutput).greaterThanOrEqualTo(minOutput);
  }

  /**
   * Calculate the k constant for a pool
   */
  calculateK(reserve1: number, reserve2: number): string {
    return new Decimal(reserve1).times(reserve2).toString();
  }

  /**
   * Validate k constant is maintained (for testing)
   */
  validateK(
    oldReserve1: number,
    oldReserve2: number,
    newReserve1: number,
    newReserve2: number,
    toleranceBps: number = 1
  ): boolean {
    const oldK = new Decimal(oldReserve1).times(oldReserve2);
    const newK = new Decimal(newReserve1).times(newReserve2);

    // New K should be >= old K (fees increase K)
    if (newK.lessThan(oldK)) {
      const diff = oldK.minus(newK).div(oldK).times(10000);
      return diff.lessThanOrEqualTo(toleranceBps);
    }

    return true;
  }

  /**
   * Set default slippage tolerance
   */
  setDefaultSlippage(bps: number): void {
    this.defaultSlippageBps = bps;
  }
}

// Singleton instance
export const ammPriceCalculator = new AMMPriceCalculator();
