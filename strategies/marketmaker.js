// a basic market maker strategy
import * as dexapi from '../dexapi.js';
import getLogger, { getConfig } from '../utils.js';

// Trading config
const config = getConfig();

const getMarketDetails = async () => {
  const market = dexapi.getMarketBySymbol(config.symbol);
  const allOrders = await dexapi.fetchOpenOrders(config.username);
  const orders = allOrders.filter((order) => order.market_id === market.market_id);
  // TODO: compute params for order book based on precision of symbol
  const orderBook = await dexapi.fetchOrderBook(config.symbol, 100, 1000000);

  const tradeStatus = {
    time: new Date().toISOString(),
    lowestAsk: orderBook.asks[0].level,
    highestBid: orderBook.bids[0].level,
    openOrders: orderBook,
    ownOrders: orders,
  };

  return tradeStatus;
};

/**
 * Market Making Trading Strategy
 */
const makeMarkets = async () => {
  const logger = getLogger();
  logger.info('Executing market maker trades');

  const marketDetails = await getMarketDetails();
  logger.info(marketDetails);
  // prepareOrders();
  // placeOrders();
};

export default makeMarkets;
