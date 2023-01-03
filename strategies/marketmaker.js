// a basic market maker strategy
import * as dexapi from '../dexapi.js';
import { cancelOrder } from '../dexrpc.js';
import { getConfig, getLogger } from '../utils.js';

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
const trade = async () => {
  const logger = getLogger();
  logger.info(`Executing ${config.symbol} market maker trades on account ${config.username}`);

  try {
    // await cancelOrder(1046821);
    const marketDetails = await getMarketDetails();
    logger.info(marketDetails);
  } catch (error) {
    logger.error(error.message);
  }

  // prepareOrders();
  // placeOrders();
};

const strategy = {
  trade,
};

export default strategy;
