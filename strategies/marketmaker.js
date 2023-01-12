// a basic market maker strategy
import * as dexapi from '../dexapi.js';
import { submitLimitOrder, ORDERSIDES } from '../dexrpc.js';
import { getConfig, getLogger } from '../utils.js';

// Trading config
const config = getConfig();
const { username } = config;
const mmConfig = config.get('marketmaker');
const { minSpread, numPairs, symbol } = mmConfig;

const getMarketDetails = async () => {
  const market = dexapi.getMarketBySymbol(symbol);
  const price = await dexapi.fetchLatestPrice(symbol);

  const tradeStatus = {
    time: new Date().toISOString(),
    market,
    price,
  };

  return tradeStatus;
};

const getOpenOrders = async () => {
  const market = dexapi.getMarketBySymbol(symbol);
  const allOrders = await dexapi.fetchOpenOrders(username);
  const orders = allOrders.filter((order) => order.market_id === market.market_id);
  await Promise.all(orders);

  return orders;
};

// prepare the orders we want to have on the books
const prepareOrders = async (marketDetails, openOrders) => {
  const { market } = marketDetails;
  const quantityStep = 10 / market.bid_token.multiplier;
  const minOrderTotal = market.order_min / market.ask_token.multiplier;
  const minSellQuantity = Math.ceil(minOrderTotal / marketDetails.price);
  const orders = [];

  let numBuys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY).length;
  let numSells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL).length;

  for (let index = 0; index < numPairs; index += 1) {
    // buy order
    if (numBuys < numPairs) {
      const buyPrice = (1 + minSpread * (0 - index)) * marketDetails.price;
      orders.push({
        orderSide: ORDERSIDES.BUY,
        price: buyPrice.toFixed(market.ask_token.precision),
        quantity: minOrderTotal + index * quantityStep,
        symbol,
      });
      numBuys += 1;
    }
    // sell order
    if (numSells < numPairs) {
      const sellPrice = (1 + minSpread * (numPairs - (index + 1))) * marketDetails.price;
      orders.push({
        orderSide: ORDERSIDES.SELL,
        price: sellPrice.toFixed(market.ask_token.precision),
        quantity: minSellQuantity + index,
        symbol,
      });
      numSells += 1;
    }
  }

  return orders;
};

const isValidOrder = (order, orderBook) => {
  // ensure that the order will not execute if it would match to an order already on the books
  const lowestAsk = orderBook.asks[0].level;
  const highestBid = orderBook.bids[0].level;
  if (order.orderSide === ORDERSIDES.SELL && order.price <= highestBid) {
    getLogger().warn(`Not placing sell order as it would execute: ${order.price} highestBid: ${highestBid}`);
    return false;
  }
  if (order.orderSide === ORDERSIDES.BUY && order.price >= lowestAsk) {
    getLogger().warn(`Not placing buy order as it would execute: ${order.price} lowestAsk: ${highestBid}`);
    return false;
  }

  // ensure that the order really meets the min. value
  const market = dexapi.getMarketBySymbol(symbol);
  const total = order.orderSide === ORDERSIDES.SELL ? order.price * order.quantity : order.quantity;
  if (total < market.order_min / market.ask_token.multiplier) {
    getLogger().warn(`Not placing sell order because it does not meet the minimum order requirements ${total} < ${market.order_min / market.ask_token.multiplier}`);
    return false;
  }

  return true;
};

const placeOrders = async (orders) => {
  const orderBook = await dexapi.fetchOrderBook(orders[0].symbol, 1);
  orders.forEach(async (order) => {
    if (!isValidOrder(order, orderBook)) {
      return;
    }
    await submitLimitOrder(order.symbol, order.orderSide, order.quantity, order.price);
  });
};

/**
 * Market Making Trading Strategy
 * The goal is to always have some buy and some sell side orders on the books.
 * The number of orders is determined by config value numPairs, see config/default.json
 * The orders should be maker orders.
 */
const trade = async () => {
  const logger = getLogger();
  logger.info(`Executing ${symbol} market maker trades on account ${username}`);

  try {
    const openOrders = await getOpenOrders();

    // any orders to place?
    const buys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY);
    const sells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL);
    if (buys.length >= numPairs && sells.length >= numPairs) {
      logger.info('nothing to do - we have enough orders on the books');
      return;
    }

    const marketDetails = await getMarketDetails();
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
