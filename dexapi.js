// Contains methods for interacting with the off-chain DEX API
const dexApiRoot = 'https://metal-dexdb.global.binfra.one/dex';

/**
 * Generic GET request to the DEX API
 * @param {string} path - path for data, ex. /v1/markets/all
 * @returns {object} - json data
 */
const fetchFromAPI = async (path) => {
  const url = `${dexApiRoot}${path}`;
  const response = await fetch(url);
  const responseJson = await response.json();
  return responseJson.data;
};

/**
 * Get all available markets
 * @returns {array} - list of all markets available on ProtonDEX
 */
export const fetchMarkets = async () => {
  const marketData = await fetchFromAPI('/v1/markets/all');
  return marketData;
};

/**
 * Get all open orders for the current account
 * @returns  {array} - list of all open orders
 */
export const fetchOpenOrders = async (username) => {
  const openOrders = await fetchFromAPI(`/v1/orders/open?limit=100&offset=0&account=${username}`);
  return openOrders;
};
