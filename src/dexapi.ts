import { Depth, Market, OrderHistory, Trade } from '@proton/wrap-constants';
import fetch from 'node-fetch';
import { getConfig } from './utils';

// Contains methods for interacting with the off-chain DEX API
const { apiRoot } = getConfig().rpc;
const { lightApiRoot } = getConfig().rpc;

/**
 * Generic GET request to one of the APIs
 */
const fetchFromAPI = async <T>(root: string, path: string, returnData = true): Promise<T> => {
  const response = await fetch(`${root}${path}`);
  const responseJson = await response.json() as any;
  if (returnData) {
    return responseJson.data as T;
  }
  return responseJson;
};

export const fetchMarkets = async (): Promise<Market[]> => {
  const marketData = await fetchFromAPI<Market[]>(apiRoot, '/v1/markets/all');
  return marketData;
};

/**
 * Return an orderbook for the provided market. Use a higher step number for low priced currencies
 */
export const fetchOrderBook = async (symbol: string, limit = 100, step = 100000): Promise<{ bids: Depth[], asks: Depth[] }> => {
  const orderBook = await fetchFromAPI<{ bids: Depth[], asks: Depth[] }>(apiRoot, `/v1/orders/depth?symbol=${symbol}&limit=${limit}&step=${step}`);
  return orderBook;
};

/**
 * Get all open orders for a given user
 * @param {string} username - name of proton user/account to retrieve orders for
 * @returns  {Promise<array>} - list of all open orders
 */
export const fetchOpenOrders = async (username: string): Promise<OrderHistory[]> => {
  const openOrders = await fetchFromAPI<OrderHistory[]>(apiRoot, `/v1/orders/open?limit=250&offset=0&account=${username}`);
  return openOrders;
};

/**
 * Return history of unopened orders for a given user
 */
export const fetchOrderHistory = async (username: string, limit = 100, offset = 0): Promise<OrderHistory[]> => {
  const orderHistory = await fetchFromAPI<OrderHistory[]>(apiRoot, `/v1/orders/history?limit=${limit}&offset=${offset}&account=${username}`);
  return orderHistory;
};

/**
 * Given a market symbol, return the most recent trades to have executed in that market
 */
export const fetchTrades = async (symbol: string, count = 100, offset = 0): Promise<Trade[]> => {
  const response = await fetchFromAPI<Trade[]>(apiRoot, `/v1/trades/recent?symbol=${symbol}&limit=${count}&offset=${offset}`);
  return response;
};

/**
 * Given a market symbol, get the price for it
 */
export const fetchLatestPrice = async (symbol: string): Promise<number> => {
  const trades = await fetchTrades(symbol, 1);
  return trades[0].price;
};

export interface Balance {
    currency: string;
    amount: number;
    contract: string;
    decimals: number;
}

type TokenBalance = string;
/**
 *
 * @param {string} username - name of proton user/account to retrieve history for
 * @returns {Promise<array>} - array of balances,
 * ex. {"decimals":"4","contract":"eosio.token","amount":"123.4567","currency":"XPR"}
 */
export const fetchBalances = async (username: string): Promise<Balance[]> => {
  const chain = process.env.NODE_ENV === 'test' ? 'protontest' : 'proton';
  const response = await fetchFromAPI<{ balances: Balance[] }>(lightApiRoot, `/balances/${chain}/${username}`, false);
  return response.balances;
};

export const fetchTokenBalance = async (username: string, contractname: string, token: string): Promise<TokenBalance> => {
  const chain = process.env.NODE_ENV === 'test' ? 'protontest' : 'proton';
  const tBalance = await fetchFromAPI<TokenBalance>(lightApiRoot, `/tokenbalance/${chain}/${username}/${contractname}/${token}`, false);
  return tBalance;
};

const marketsRepo: { 
  byId: Map<number, Market>; 
  bySymbol: Map<string, Market>; 
} = { 
  byId: new Map(), 
  bySymbol: new Map() 
};
export const getMarketById = (id: number): Market | undefined => marketsRepo.byId.get(id);
export const getMarketBySymbol = (symbol: string): Market | undefined => marketsRepo.bySymbol.get(symbol);

/**
 * Initialize. Gets and stores all dex markets
 */
export const initialize = async () => {
  // load all markets for later use
  const allMarkets = await fetchMarkets();
  allMarkets.forEach((market) => {
    marketsRepo.byId.set(market.market_id, market);
    marketsRepo.bySymbol.set(market.symbol, market);
  });
};
