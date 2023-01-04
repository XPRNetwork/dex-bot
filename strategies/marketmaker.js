// a basic market maker strategy
import * as dexapi from '../dexapi.js';
import { submitLimitOrder, ORDERSIDES } from '../dexrpc.js';
import { getConfig, getLogger } from '../utils.js';

// Trading config
const config = getConfig();

// Market maker config values
const NUM_ORDER_PAIRS = 4; // Number of pairs to create, e.g. 2 pairs is 2 buy and 2 sell orders

const getMarketDetails = async () => {
  const market = dexapi.getMarketBySymbol(config.symbol);
  // TODO: compute params for order book based on precision of symbol
  const orderBook = await dexapi.fetchOrderBook(config.symbol, 100, 1000000);

  const tradeStatus = {
    time: new Date().toISOString(),
    lowestAsk: orderBook.asks[0].level,
    highestBid: orderBook.bids[0].level,
    market,
  };

  return tradeStatus;
};

const getOpenOrders = async () => {
  const market = dexapi.getMarketBySymbol(config.symbol);
  const allOrders = await dexapi.fetchOpenOrders(config.username);
  const orders = allOrders.filter((order) => order.market_id === market.market_id);
  await Promise.all(orders);

  return orders;
};

// prepare the orders we want to have on the books
const prepareOrders = async (marketDetails, openOrders) => {
  const logger = getLogger();

  if (openOrders.length >= NUM_ORDER_PAIRS * 2) {
    // TODO: check that these are not all onoe 1 side of the book
    logger.info('nothing to do - we have enough orders on the books');
    return [];
  }
  const { market } = marketDetails;
  const quantityStep = 10 ** (market.bid_token.precision * -1);
  const priceStep = 10 ** (market.ask_token.precision * -1);
  const minOrderTotal = market.order_min / 10 ** market.ask_token.precision;
  const minSellQuantity = Math.ceil(minOrderTotal / marketDetails.highestBid);
  const orders = [];

  for (let index = 0; index < NUM_ORDER_PAIRS; index += 1) {
    // buy order
    orders.push({
      symbol: config.symbol,
      orderSide: ORDERSIDES.BUY,
      quantity: minOrderTotal + index * quantityStep,
      price: (marketDetails.highestBid - priceStep * (index + 1))
        .toFixed(market.ask_token.precision),
    });
    // sell order
    orders.push({
      symbol: config.symbol,
      orderSide: ORDERSIDES.SELL,
      quantity: minSellQuantity + index,
      price: (marketDetails.lowestAsk + priceStep * (index + 1))
        .toFixed(market.ask_token.precision),
    });
  }

  // now filter out any open orders we already have
  const ordersToPlace = [];
  orders.forEach((order) => {
    let doInclude = true;
    openOrders.forEach((openOrder) => {
      if (order.orderSide === openOrder.order_side
        && order.price === openOrder.price.toString()) {
        doInclude = false;
      }
    });
    if (doInclude) {
      ordersToPlace.push(order);
    }
  });

  return ordersToPlace;
};

const placeOrders = async (orders) => {
  orders.forEach(async (order) => {
    await submitLimitOrder(order.symbol, order.orderSide, order.quantity, order.price);
  });
};

/**
 * Market Making Trading Strategy
 * The goal is to always have some buy and some sell side orders on the books.
 * The orders should be maker orders.
 */
const trade = async () => {
  const logger = getLogger();
  logger.info(`Executing ${config.symbol} market maker trades on account ${config.username}`);

  try {
    const marketDetails = await getMarketDetails();
    const openOrders = await getOpenOrders();
    const preparedOrders = await prepareOrders(marketDetails, openOrders);
    await placeOrders(preparedOrders);
  } catch (error) {
    logger.error(error.message);
  }
};

const strategy = {
  trade,
};

export default strategy;
