import { ORDERSIDES } from '../core/constants';

export interface TradeOrder {
    orderSide: ORDERSIDES;
    price: number;
    quantity: number;
    marketSymbol: string;
}

export interface AdjustmentHistoryEntry {
  price: number;
  at: string;           // ISO timestamp
  reason: 'placed' | 'patience-expired' | 'tier-bump' | 'manual' | 'rebalance';
}

export interface SpikeTrigger {
  price: number;
  at: string;           // ISO timestamp
}

export interface TrackedOrder extends TradeOrder {
    orderId?: string;    // on-chain order_id from the DEX
    placedAt?: string;   // ISO timestamp for debugging
    entryPrice?: number;         // spike fill price (hard floor for TP adjustment)
    cyclesSincePlace?: number;   // trade cycles this TP has been open
    originalTargetPrice?: number; // MA at time of TP placement
    heldSince?: string;          // ISO timestamp set when TP moves to heldRecoveryOrders
    adjustmentHistory?: AdjustmentHistoryEntry[]; // price changes over time
    cancelReason?: string;        // set right before bot-initiated cancel
    spikeTrigger?: SpikeTrigger;  // inherited from spike order that produced this TP
    spikeLevel?: number;          // 1..N; level of the originating spike order
    coveredQuantity?: number;     // spike-only; total quantity already covered by TP placements
}

export interface MockTrackedOrder extends TrackedOrder {
    mockId: string;
    mockStatus: 'open' | 'filled' | 'cancelled';
    filledAt?: string;
    filledPrice?: number;
}