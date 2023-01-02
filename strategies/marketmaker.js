// a basic market maker strategy
import { fetchOpenOrders, fetchOrderBook } from '../dexapi.js';
import { getMarketBySymbol } from '../dexrpc.js';

// Trading config
const marketMakerConfig = {
  username: 'user1',
  symbol: 'XPR_XUSDC',
};

const getMarketDetails = async () => {
  const market = getMarketBySymbol(marketMakerConfig.symbol);
  const allOrders = await fetchOpenOrders(marketMakerConfig.username);
  const orders = allOrders.filter((order) => order.market_id === market.market_id);
  const orderBook = await fetchOrderBook(marketMakerConfig.symbol, 100, 1000000);

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
