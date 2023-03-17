import { prepareLimitOrder, submitProcessAction, submitOrders } from "../dexrpc";
import { TradeOrder, TradingStrategy } from "../interfaces";
import * as dexapi from "../dexapi";
import { getUsername, getLogger } from "../utils";
import { Market } from '@proton/wrap-constants';

export interface MarketDetails {
  highestBid: number;
  lowestAsk: number;
  market?: Market;
  price: number;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

export abstract class TradingStrategyBase implements TradingStrategy {
  abstract initialize(options?: any): Promise<void>;

  abstract trade(): Promise<void>;

  protected dexAPI = dexapi;
  protected username = getUsername();

  protected async placeOrders(orders: TradeOrder[]): Promise<void> {
    for(var i = 1; i <= orders.length; i++) {
        await prepareLimitOrder(
          orders[i-1].marketSymbol,
          orders[i-1].orderSide,
          orders[i-1].quantity,
          orders[i-1].price
      );
      if(i%30 === 0 || i === orders.length) {
        await submitProcessAction();
        await submitOrders();
        await delay(2000);
      };
    }
  }

  protected async getOpenOrders(marketSymbol: string) {
    const market = this.dexAPI.getMarketBySymbol(marketSymbol);
    if (market === undefined) {
      throw new Error(`Market ${marketSymbol} does not exist`);
    }
    await delay(3000);
    const allOrders = await this.dexAPI.fetchOpenOrders(this.username);
    const orders = allOrders.filter(
      (order) => order.market_id === market.market_id
    );
    return orders;
  }

  protected async getMarketDetails(marketSymbol: string): Promise<MarketDetails> {
    const market = dexapi.getMarketBySymbol(marketSymbol);
    const price = await dexapi.fetchLatestPrice(marketSymbol);
    const orderBook = await dexapi.fetchOrderBook(marketSymbol, 1);
    const lowestAsk =
      orderBook.asks.length > 0 ? orderBook.asks[0].level : price;
    const highestBid =
      orderBook.bids.length > 0 ? orderBook.bids[0].level : price;

    const details = {
      highestBid,
      lowestAsk,
      market,
      price,
    };

    return details;
  }
}
