import { ORDERSIDES } from '../core/constants';

export interface TradeOrder {
    orderSide: ORDERSIDES;
    price: number;
    quantity: number;
    marketSymbol: string;
}