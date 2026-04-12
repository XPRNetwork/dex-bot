import { ORDERSIDES } from '../core/constants';

export interface TradeOrder {
    orderSide: ORDERSIDES;
    price: number;
    quantity: number;
    marketSymbol: string;
}

export interface TrackedOrder extends TradeOrder {
    orderId?: string;    // on-chain order_id from the DEX
    placedAt?: string;   // ISO timestamp for debugging
    entryPrice?: number;         // spike fill price (hard floor for TP adjustment)
    cyclesSincePlace?: number;   // trade cycles this TP has been open
    originalTargetPrice?: number; // MA at time of TP placement
    heldSince?: string;          // ISO timestamp set when TP moves to heldRecoveryOrders
}

export interface MockTrackedOrder extends TrackedOrder {
    mockId: string;
    mockStatus: 'open' | 'filled' | 'cancelled';
    filledAt?: string;
    filledPrice?: number;
}