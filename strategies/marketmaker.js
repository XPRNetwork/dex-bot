// a basic market maker strategy
import config from 'config';
import * as dexapi from '../dexapi.js';

// Trading config
const botConfig = config.get('bot');

const getMarketDetails = async () => {
  const market = dexapi.getMarketBySymbol(botConfig.symbol);
  const allOrders = await dexapi.fetchOpenOrders(botConfig.username);
  const orders = allOrders.filter((order) => order.market_id === market.market_id);
  // TODO: compute params for order book based on precision of symbol
  const orderBook = await dexapi.fetchOrderBook(botConfig.symbol, 100, 1000000);

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
 * @param {winston.logger} logger
 */
const makeMarkets = async (logger) => {
  logger.info('Executing market maker trades');

  const marketDetails = await getMarketDetails();
  logger.info(marketDetails);
  // prepareOrders();
  // placeOrders();
};

export default makeMarkets;
