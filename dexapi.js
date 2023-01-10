import { getConfig } from './utils.js';

// Contains methods for interacting with the off-chain DEX API
const apiConfig = getConfig().api;

/**
 * Generic GET request to one of the APIs
 * @param {string} root - root url for the API, ex. https://metal-dexdb.global.binfra.one/dex
 * @param {string} path - path for data, ex. /v1/markets/all
 * @returns {Promise<object>} - json data
 */
const fetchFromAPI = async (root, path) => {
  const response = await fetch(`${root}${path}`);
  const responseJson = await response.json();
  return responseJson.data;
};

/**
 * Get all available markets
 * @returns {Promise<array>} - list of all markets available on ProtonDEX
 */
export const fetchMarkets = async () => {
  const marketData = await fetchFromAPI(apiConfig.apiRoot, '/v1/markets/all');
  return marketData;
};

/**
 * Return an orderbook for the provided market. Use a higher step number for low priced currencies
 * @param {string} symbol - market symbol
 * @param {number} limit - maximum number of records to return
 * @param {number} step - controls aggregation by price; ex. 0.01, 0.1, 1, 10, 100
 * @returns {Promise<object>} - asks and bids for the market
 */
export const fetchOrderBook = async (symbol, limit = 100, step = 1000) => {
  const orderBook = await fetchFromAPI(apiConfig.apiRoot, `/v1/orders/depth?symbol=${symbol}&limit=${limit}&step=${step}`);
  return orderBook;
};

/**
 * Get all open orders for a given user
 * @param {string} username - name of proton user/account to retrieve orders for
 * @returns  {Promise<array>} - list of all open orders
 */
export const fetchOpenOrders = async (username) => {
  const openOrders = await fetchFromAPI(apiConfig.apiRoot, `/v1/orders/open?limit=100&offset=0&account=${username}`);
  return openOrders;
};

/**
 * Return history of unopened orders for a given user
 * @param {string} username - name of proton user/account to retrieve history for
 * @param {number} limit - maximum number of records to return
 * @param {number} offset - where to start in the list - used for paging
 * @returns {Promise<array>} - returns an array of orders, most recent first
 */
export const fetchOrderHistory = async (username, limit = 100, offset = 0) => {
  const orderHistory = await fetchFromAPI(apiConfig.apiRoot, `/v1/orders/history?limit=${limit}&offset=${offset}&account=${username}`);
  return orderHistory;
};

/**
 * Given a market symbol, return the most recent trades to have executed in that market
 * @param {string} symbol - market symbol
 * @param {number} count - how many trades to return
 * @param {number} offset - where to start, used for paging
 * @returns a list of recent trades
 */
export const fetchTrades = async (symbol, count = 100, offset = 0) => {
  const response = await fetchFromAPI(apiConfig.apiRoot, `/v1/trades/recent?symbol=${symbol}&limit=${count}&offset=${offset}`);
  return response;
};

/**
 * Given a market symbol, get the price for it
 * @param {string} symbol - market symbol
 * @returns returns the price of the most recently executed trade
 */
export const fetchLatestPrice = async (symbol) => {
  const trades = await fetchTrades(symbol, 1);
  return trades[0].price;
};

/**
 *
 * @param {string} username - name of proton user/account to retrieve history for
 * @returns {Promise<array>} - array of balances,
 * ex. {"decimals":"4","contract":"eosio.token","amount":"123.4567","currency":"XPR"}
 */
export const fetchBalances = async (username) => {
  const response = await fetchFromAPI(apiConfig.lightApiRoot, `/balances/proton/${username}`);
  return response.balances;
};

const markets = { byId: {}, bySymbol: {} };
export const getMarketById = (id) => markets.byId[id];
export const getMarketBySymbol = (symbol) => markets.bySymbol[symbol];

/**
 * Initialize. Gets and stores all dex markets
 */
export const initialize = async () => {
  // load all markets for later use
  const allMarkets = await fetchMarkets();
  allMarkets.forEach((market) => {
    markets.byId[market.market_id] = market;
    markets.bySymbol[market.symbol] = market;
  });
};
