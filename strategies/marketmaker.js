// a basic market maker strategy
import { BigNumber as BN } from 'bignumber.js';
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
  };

  return details;
};

const getOpenOrders = async () => {
  const market = dexapi.getMarketBySymbol(symbol);
  if (market === undefined) {
    throw new Error(`Market ${symbol} does not exist`);
  }
  const allOrders = await dexapi.fetchOpenOrders(username);
  const orders = allOrders.filter((order) => order.market_id === market.market_id);
  await Promise.all(orders);

  return orders;
};

/**
 * Given a price and total cost return a quantity value. Use precision values in the bid and ask
 * currencies, and return an adjusted total to account for losses during rounding. The adjustedTotal
 * value is used for buy orders
 * @param {number} price - cost to pay in the ask currency
 * @param {number} totalCost - total cost in the ask currency
 * @param {number} bidPrecision - precision for the bid currency
 * @param {number} askPrecision - precision for the ask currency
 * @returns {object} object with adjustedTotak and quantity values
 */
const getQuantityAndAdjustedTotal = (price, totalCost, bidPrecision, askPrecision) => {
  const quantity = +new BN(totalCost).dividedBy(price).toFixed(bidPrecision, BN.ROUND_UP);
  const adjustedTotal = +new BN(price).times(quantity).toFixed(askPrecision, BN.ROUND_UP);
  return {
    adjustedTotal,
    quantity,
  };
};

const createBuyOrder = (marketDetails, index) => {
  const { market } = marketDetails;
  const askPrecision = market.ask_token.precision;
  const bidPrecision = market.bid_token.precision;
  const bigMinSpread = new BN(minSpread);
  const minOrder = market.order_min / market.ask_token.multiplier;

  const lastSalePrice = new BN(marketDetails.price);
  const lowestAsk = new BN(marketDetails.lowestAsk);
  const highestBid = new BN(marketDetails.highestBid);
  const startPrice = lowestAsk.plus(highestBid).dividedBy(2);

  const buyPrice = (bigMinSpread.times(0 - (index + 1)).plus(1))
    .times(Math.min(lastSalePrice, startPrice)).decimalPlaces(askPrecision, BN.ROUND_DOWN);
  const { adjustedTotal } = getQuantityAndAdjustedTotal(
    +buyPrice,
    minOrder,
    bidPrecision,
    askPrecision,
  );

  const order = {
    orderSide: ORDERSIDES.BUY,
    price: +buyPrice,
    quantity: adjustedTotal,
    symbol,
  };
  return order;
};

const createSellOrder = (marketDetails, index) => {
  const { market } = marketDetails;
  const askPrecision = market.ask_token.precision;
  const bidPrecision = market.bid_token.precision;
  const bigMinSpread = new BN(minSpread);
  const minOrder = market.order_min / market.ask_token.multiplier;

  const lastSalePrice = new BN(marketDetails.price);
  const lowestAsk = new BN(marketDetails.lowestAsk);
  const highestBid = new BN(marketDetails.highestBid);
  const startPrice = lowestAsk.plus(highestBid).dividedBy(2);

  const sellPrice = (bigMinSpread.times(0 + (index + 1)).plus(1))
    .times(Math.max(lastSalePrice, startPrice)).decimalPlaces(askPrecision, BN.ROUND_UP);
  const { quantity } = getQuantityAndAdjustedTotal(
    +sellPrice,
    minOrder,
    bidPrecision,
    askPrecision,
  );

  const order = {
    orderSide: ORDERSIDES.SELL,
    price: +sellPrice,
    quantity,
    symbol,
  };

  return order;
};

// prepare the orders we want to have on the books
const prepareOrders = async (marketDetails, openOrders) => {
  const orders = [];
  let numBuys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY).length;
  let numSells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL).length;

  for (let index = 0; index < numPairs; index += 1) {
    // buy order
    if (numBuys < numPairs) {
      orders.push(createBuyOrder(marketDetails, index));
      numBuys += 1;
    }

    // sell order
    if (numSells < numPairs) {
      orders.push(createSellOrder(marketDetails, index));
      numSells += 1;
    }
  }

  return orders;
};

const placeOrders = async (orders) => {
  if (orders.length === 0) return;
  orders.forEach(async (order) => {
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

// export some internal function solely to test them
if (process.env.NODE_ENV === 'test') {
  strategy.internals = {
    createBuyOrder, createSellOrder,
  };
}

export default strategy;
