import {
  ORDER_SIDE,
  ORDER_TYPE,
  type OrderData,
  type MarketInfo,
  type MappedTrade,
  type OrderMappingResult,
  type ValidationResult,
  type DebugInfo,
  type FeeAnalysis,
} from './types';

const MIN_FILL_AMOUNT = 0.000001;
const MAX_AMOUNT = 999_999_999_999;
// PRICE_VALIDATION_TOLERANCE = 5.0 used with `* 100` below acts as a 500% cap —
// effectively disabled. Upstream protonext-tax mapper does the same (intentional);
// MetalX stores price in inconsistent conventions across markets, so the validation
// is unreliable. Kept for parity. See order-mapping-mapper-v2.ts:61-68 in protonext-tax.
const PRICE_VALIDATION_TOLERANCE = 5.0;
const FEE_MATCH_TOLERANCE = 0.01;

export function mapOrderToTrade(order: OrderData, market: MarketInfo | null): OrderMappingResult {
  const price = order.price;
  const quantityInit = order.quantityInit;
  const quantityFilled = order.quantityFilled;
  const filledTotal = order.filledTotal;
  const filledAmount = order.filledAmount;
  const filledFee = order.filledFee;

  const isSell = order.orderSide === ORDER_SIDE.SELL;
  const isBuy = order.orderSide === ORDER_SIDE.BUY;

  const debug: DebugInfo = {
    orderSide: isBuy ? 'BUY' : 'SELL',
    orderType: order.orderType === ORDER_TYPE.LIMIT ? 'LIMIT' : 'MARKET',
    finalStatus: order.finalStatus,
    rawPrice: price,
    rawQuantityInit: quantityInit,
    rawQuantityFilled: quantityFilled,
    rawFilledTotal: filledTotal,
    rawFilledAmount: filledAmount,
    rawFilledFee: filledFee,
    fillPercentage: quantityInit > 0 ? (quantityFilled / quantityInit) * 100 : 0,
    calculationMethod: 'API_DIRECT',
    feeAnalysis: null,
  };

  const validation: ValidationResult = {
    isValid: true,
    expectedQuoteAmount: null,
    actualQuoteAmount: null,
    percentageDifference: null,
    issues: [],
  };

  if (!market) {
    validation.issues.push(`Market ${order.marketId} not found in database`);
  }

  // IMPORTANT: For canceled orders, quantityFilled can be misleading.
  // The TRUE indicator of fills is filledTotal and filledAmount.
  const hasActualFill = (filledTotal ?? 0) > MIN_FILL_AMOUNT || (filledAmount ?? 0) > MIN_FILL_AMOUNT;
  const isCanceledOrDeleted = ['delete', 'cancel'].includes(order.finalStatus);

  if (!hasActualFill) {
    return {
      shouldCreate: false,
      skipReason: isCanceledOrDeleted
        ? 'Order canceled/deleted with no fills'
        : 'Order pending - no fill yet',
      transaction: null,
      validation,
      debug,
    };
  }

  // NOTE: this `transfer && !hasActualFill` guard is unreachable because the
  // `!hasActualFill` early-return above already handles it. Kept verbatim from
  // the upstream protonext-tax mapper for parity. If upstream extracts the
  // no-fill check differently in the future, this block becomes reachable.
  if (order.finalStatus === 'transfer' && !hasActualFill) {
    return {
      shouldCreate: false,
      skipReason: 'Order transferred to another user (no fill data)',
      transaction: null,
      validation,
      debug,
    };
  }

  const baseToken = market?.baseToken || 'UNKNOWN_BASE';
  const quoteToken = market?.quoteToken || 'UNKNOWN_QUOTE';

  let buyAmount: number = 0;
  let buyCurrency: string;
  let sellAmount: number = 0;
  let sellCurrency: string;
  let feeAmount: number | null = filledFee;
  let feeCurrency: string | null = null;

  if (isBuy) {
    /**
     * BUY ORDER (order_side = 1)
     * - quantity/quantityFilled = QUOTE amount SENT (e.g., 73.69541 XMD)
     * - filledTotal = BASE amount RECEIVED gross (e.g., 20069.5561 XPR)
     * - filledAmount = BASE amount RECEIVED net (after fee, e.g., 20053.5005 XPR)
     * - filledFee = fee in BASE (e.g., 16.0556 XPR) - TAKEN FROM RECEIVED
     */
    sellAmount = quantityFilled;
    sellCurrency = quoteToken;
    buyCurrency = baseToken;
    feeCurrency = baseToken;

    if (filledAmount !== null && filledAmount > MIN_FILL_AMOUNT) {
      buyAmount = filledAmount;
      debug.calculationMethod = 'API_DIRECT';
    } else if (filledTotal !== null && filledFee !== null) {
      buyAmount = filledTotal - filledFee;
      debug.calculationMethod = 'API_DIRECT';
    } else if (filledTotal !== null && filledTotal > MIN_FILL_AMOUNT) {
      buyAmount = filledTotal;
      debug.calculationMethod = 'API_DIRECT';
      validation.issues.push('No fee data, using filledTotal as buyAmount (gross)');
    } else if (quantityFilled > 0 && price > 0) {
      buyAmount = quantityFilled / price;
      debug.calculationMethod = 'PRICE_CALCULATED';
      validation.issues.push('Calculated buyAmount from quantityFilled/price');
    }

    if (filledFee !== null && filledFee > MIN_FILL_AMOUNT) {
      feeAmount = filledFee;
      feeCurrency = baseToken;
    }

    validation.expectedQuoteAmount = quantityFilled;
    validation.actualQuoteAmount = filledTotal !== null ? (filledTotal * price) : (buyAmount * price);

  } else if (isSell) {
    /**
     * SELL ORDER (order_side = 2)
     * - quantity/quantityFilled = BASE amount SENT (e.g., 6040.877 XPR)
     * - filledTotal = QUOTE amount RECEIVED gross (e.g., 22.315 XMD)
     * - filledAmount = QUOTE amount RECEIVED net (after fee, e.g., 22.297148 XMD)
     * - filledFee = fee in QUOTE (e.g., 0.017852 XMD) - TAKEN FROM RECEIVED
     */
    sellAmount = quantityFilled;
    sellCurrency = baseToken;
    buyCurrency = quoteToken;
    feeCurrency = quoteToken;

    if (filledAmount !== null && filledAmount > MIN_FILL_AMOUNT) {
      buyAmount = filledAmount;
      debug.calculationMethod = 'API_DIRECT';
    } else if (filledTotal !== null && filledFee !== null) {
      buyAmount = filledTotal - filledFee;
      debug.calculationMethod = 'API_DIRECT';
    } else if (filledTotal !== null && filledTotal > MIN_FILL_AMOUNT) {
      buyAmount = filledTotal;
      debug.calculationMethod = 'API_DIRECT';
      validation.issues.push('No fee data, using filledTotal as buyAmount (gross)');
    } else if (quantityFilled > 0 && price > 0) {
      buyAmount = quantityFilled * price;
      debug.calculationMethod = 'PRICE_CALCULATED';
      validation.issues.push('Calculated buyAmount from quantityFilled*price');
    }

    if (filledFee !== null && filledFee > MIN_FILL_AMOUNT) {
      feeAmount = filledFee;
      feeCurrency = quoteToken;
    }

    validation.expectedQuoteAmount = quantityFilled * price;
    validation.actualQuoteAmount = filledTotal;

  } else {
    return {
      shouldCreate: false,
      skipReason: `Unknown order side: ${order.orderSide}`,
      transaction: null,
      validation: { ...validation, isValid: false, issues: [`Unknown order side: ${order.orderSide}`] },
      debug,
    };
  }

  // Validate amounts against price.
  // NOTE: MetalX uses inconsistent price conventions across markets.
  // Some markets store price as quote-per-base, others as base-per-quote.
  // We check BOTH interpretations and accept if either matches.
  if (validation.expectedQuoteAmount !== null && validation.actualQuoteAmount !== null && price > 0) {
    const expectedStandard = quantityFilled * price;
    const diffStandard = Math.abs(expectedStandard - validation.actualQuoteAmount);
    const pctDiffStandard = expectedStandard > 0 ? (diffStandard / expectedStandard) * 100 : 0;

    const expectedInverted = quantityFilled / price;
    const diffInverted = Math.abs(expectedInverted - validation.actualQuoteAmount);
    const pctDiffInverted = expectedInverted > 0 ? (diffInverted / expectedInverted) * 100 : 0;

    if (pctDiffStandard <= pctDiffInverted) {
      validation.expectedQuoteAmount = expectedStandard;
      validation.percentageDifference = pctDiffStandard;
    } else {
      validation.expectedQuoteAmount = expectedInverted;
      validation.percentageDifference = pctDiffInverted;
    }

    const bestMatch = Math.min(pctDiffStandard, pctDiffInverted);
    if (bestMatch > PRICE_VALIDATION_TOLERANCE * 100) {
      validation.issues.push(
        `Price validation: neither interpretation matches - ` +
        `standard: ${pctDiffStandard.toFixed(1)}% diff, inverted: ${pctDiffInverted.toFixed(1)}% diff`,
      );
    }
  }

  // Cap amounts to prevent overflow
  buyAmount = Math.min(buyAmount, MAX_AMOUNT);
  sellAmount = Math.min(sellAmount, MAX_AMOUNT);
  if (feeAmount !== null) {
    feeAmount = Math.min(feeAmount, MAX_AMOUNT);
  }

  // Fee analysis: infer maker vs taker from observed fee ratio
  if (filledFee !== null && filledFee > MIN_FILL_AMOUNT && market) {
    const grossReceivedAmount = filledTotal ?? (buyAmount + filledFee);
    const actualFeePercent = grossReceivedAmount > 0 ? (filledFee / grossReceivedAmount) * 100 : null;
    const marketMakerFeePercent = market.makerFee * 100;
    const marketTakerFeePercent = market.takerFee * 100;

    let inferredFeeType: 'MAKER' | 'TAKER' | 'UNKNOWN' | null = null;
    let diffFromMaker: number | null = null;
    let diffFromTaker: number | null = null;

    if (actualFeePercent !== null) {
      diffFromMaker = Math.abs(actualFeePercent - marketMakerFeePercent);
      diffFromTaker = Math.abs(actualFeePercent - marketTakerFeePercent);

      if (diffFromMaker <= FEE_MATCH_TOLERANCE) {
        inferredFeeType = 'MAKER';
      } else if (diffFromTaker <= FEE_MATCH_TOLERANCE) {
        inferredFeeType = 'TAKER';
      } else if (diffFromMaker < diffFromTaker) {
        inferredFeeType = 'MAKER';
      } else if (diffFromTaker < diffFromMaker) {
        inferredFeeType = 'TAKER';
      } else {
        inferredFeeType = 'UNKNOWN';
      }
    }

    debug.feeAnalysis = {
      actualFeePercent,
      marketMakerFeePercent,
      marketTakerFeePercent,
      inferredFeeType,
      diffFromMaker,
      diffFromTaker,
    } satisfies FeeAnalysis;
  }

  const needsReview =
    validation.issues.length > 0 ||
    !market ||
    (debug.calculationMethod === 'PRICE_CALCULATED' && price === 0) ||
    debug.fillPercentage < 50;

  let reviewNote: string | null = null;
  if (needsReview) {
    const notes: string[] = [];
    if (debug.fillPercentage < 50) {
      notes.push(`Partial fill (${debug.fillPercentage.toFixed(2)}%)`);
    }
    if (debug.calculationMethod === 'PRICE_CALCULATED' && price === 0) {
      notes.push('Amounts estimated from price but price is zero/missing');
    }
    if (!market) {
      notes.push('Market data not found');
    }
    notes.push(...validation.issues);
    reviewNote = notes.length > 0 ? notes.join('; ') : null;
  }

  const fillStatus = debug.fillPercentage >= 99.99 ? 'filled' : `${debug.fillPercentage.toFixed(1)}% filled`;
  const description = `DEX ${debug.orderSide} Order #${order.orderId} (${debug.orderType}, ${fillStatus})`;

  validation.isValid = validation.issues.length === 0;

  const transaction: MappedTrade = {
    type: 'TRADE',
    timestamp: order.orderCompletedAt ?? order.orderCreatedAt,
    buyAmount,
    buyCurrency,
    sellAmount,
    sellCurrency,
    feeAmount,
    feeCurrency,
    description,
    needsReview,
    reviewNote,
    externalId: `metalx-order-${order.orderId}`,
  };

  return { shouldCreate: true, skipReason: null, transaction, validation, debug };
}
