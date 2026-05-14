export const ORDER_SIDE = { BUY: 1, SELL: 2 } as const;
export const ORDER_TYPE = { LIMIT: 0, MARKET: 1 } as const;

export interface OrderData {
  orderId: string;
  orderSide: number;
  orderType: number;
  marketId: number;
  accountName: string;
  price: number;
  quantityInit: number;
  quantityFilled: number;
  filledTotal: number | null;
  filledAmount: number | null;
  filledFee: number | null;
  finalStatus: string;
  isFullyFilled: boolean;
  orderCreatedAt: string;
  orderCompletedAt: string | null;
}

export interface MarketInfo {
  marketId: number;
  symbol: string;
  baseToken: string;
  quoteToken: string;
  makerFee: number;
  takerFee: number;
}

export interface MappedTrade {
  type: 'TRADE';
  timestamp: string;
  buyAmount: number;
  buyCurrency: string;
  sellAmount: number;
  sellCurrency: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  description: string;
  needsReview: boolean;
  reviewNote: string | null;
  externalId: string;
}

export interface ValidationResult {
  isValid: boolean;
  expectedQuoteAmount: number | null;
  actualQuoteAmount: number | null;
  percentageDifference: number | null;
  issues: string[];
}

export interface FeeAnalysis {
  actualFeePercent: number | null;
  marketMakerFeePercent: number | null;
  marketTakerFeePercent: number | null;
  inferredFeeType: 'MAKER' | 'TAKER' | 'UNKNOWN' | null;
  diffFromMaker: number | null;
  diffFromTaker: number | null;
}

export interface DebugInfo {
  orderSide: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET';
  finalStatus: string;
  rawPrice: number;
  rawQuantityInit: number;
  rawQuantityFilled: number;
  rawFilledTotal: number | null;
  rawFilledAmount: number | null;
  rawFilledFee: number | null;
  fillPercentage: number;
  calculationMethod: 'API_DIRECT' | 'PRICE_CALCULATED' | 'HYBRID';
  feeAnalysis: FeeAnalysis | null;
}

export interface OrderMappingResult {
  shouldCreate: boolean;
  skipReason: string | null;
  transaction: MappedTrade | null;
  validation: ValidationResult;
  debug: DebugInfo;
}
