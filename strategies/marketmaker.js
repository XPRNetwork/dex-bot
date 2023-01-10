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

  for (let index = 0; index < numPairs; index += 1) {
    // buy order
    const buyPrice = (1 + minSpread * (0 - index)) * marketDetails.price;
    orders.push({
      orderSide: ORDERSIDES.BUY,
      price: buyPrice.toFixed(market.ask_token.precision),
      quantity: minOrderTotal + index * quantityStep,
      symbol,
    });
    // sell order
    const sellPrice = (1 + minSpread * (numPairs - (index + 1))) * marketDetails.price;
    orders.push({
      orderSide: ORDERSIDES.SELL,
      price: sellPrice.toFixed(market.ask_token.precision),
      quantity: minSellQuantity + index,
      symbol,
    });
  }

  // now filter out any open orders we already have
  const ordersToPlace = [];
  let numBuys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY).length;
  let numSells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL).length;
  orders.forEach((order) => {
    const isBuy = order.orderSide === ORDERSIDES.BUY;
    let doInclude = true;
    openOrders.forEach((openOrder) => {
      // don't add new orders at the same price on the same side of the book
      if (order.orderSide === openOrder.order_side
        && order.price === openOrder.price.toString()) {
        doInclude = false;
      }
      // don't add new orders if it will result in too many orders
      if (isBuy && numBuys >= numPairs) {
        doInclude = false;
      }
      if (!isBuy && numSells >= numPairs) {
        doInclude = false;
      }
    });
    if (doInclude) {
      ordersToPlace.push(order);
      if (isBuy) {
        numBuys += 1;
      } else {
        numSells += 1;
      }
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
