// a basic market maker strategy
import { BigNumber } from 'bignumber.js';
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
  const orderBook = await dexapi.fetchOrderBook(symbol, 1);
  const lowestAsk = orderBook.asks.length > 0 ? orderBook.asks[0].level : price;
  const highestBid = orderBook.bids.length > 0 ? orderBook.bids[0].level : price;

  const details = {
    highestBid,
    lowestAsk,
    market,
    price,
    time: new Date().toISOString(),
  };

  return details;
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
  const bigMinSpread = new BigNumber(minSpread);
  const lowestAsk = new BigNumber(marketDetails.lowestAsk);
  const highestBid = new BigNumber(marketDetails.highestBid);
  const lastSalePrice = new BigNumber(marketDetails.price);

  const quantityStep = new BigNumber(10 / market.bid_token.multiplier);
  const minOrderTotal = new BigNumber(market.order_min).dividedBy(market.ask_token.multiplier);
  const startPrice = lowestAsk.plus(highestBid).dividedBy(2);
  const orders = [];

  let numBuys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY).length;
  let numSells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL).length;

  for (let index = 0; index < numPairs; index += 1) {
    // buy order
    if (numBuys < numPairs) {
      const buyPrice = (bigMinSpread.times(0 - (index + 1)).plus(1))
        .times(Math.min(lastSalePrice, startPrice));
      const buyQuantity = minOrderTotal.plus(quantityStep.times(index + 1));
      orders.push({
        orderSide: ORDERSIDES.BUY,
        price: buyPrice.toFixed(market.ask_token.precision, BigNumber.ROUND_UP).toString(),
        quantity: buyQuantity.toFixed(market.ask_token.precision, BigNumber.ROUND_UP).toString(),
        symbol,
      });
      numBuys += 1;
    }

    // sell order
    if (numSells < numPairs) {
      const sellPrice = (bigMinSpread.times(0 + (index + 1)).plus(1))
        .times(Math.min(lastSalePrice, startPrice));
      const sellQuantity = minOrderTotal.dividedBy(sellPrice);
      orders.push({
        orderSide: ORDERSIDES.SELL,
        price: sellPrice.toFixed(market.ask_token.precision, BigNumber.ROUND_UP).toString(),
        quantity: sellQuantity.toFixed(market.bid_token.precision, BigNumber.ROUND_UP).toString(),
        symbol,
      });
      numSells += 1;
    }
  }

  return orders;
};

const isValidOrder = (order, marketDetails) => {
  // ensure that the order will not execute if it would match to an order already on the books
  const { highestBid, lowestAsk } = marketDetails;
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

const placeOrders = async (orders, marketDetails) => {
  if (orders.length === 0) return;
  orders.forEach(async (order) => {
    if (!isValidOrder(order, marketDetails)) {
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
    await placeOrders(preparedOrders, marketDetails);
  } catch (error) {
    logger.error(error.message);
  }
};

const strategy = {
  trade,
};

export default strategy;
