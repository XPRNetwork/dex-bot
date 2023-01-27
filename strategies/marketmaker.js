// a basic market maker strategy
import { BigNumber as BN } from 'bignumber.js';
import * as dexapi from '../dexapi.js';
import { submitLimitOrder, ORDERSIDES } from '../dexrpc.js';
import { getConfig, getLogger } from '../utils.js';

// Trading config
const config = getConfig();
const { username } = config;
const mmConfig = config.get('marketmaker');
const {pairs } = mmConfig;

const getMarketDetails = async (marketSymbol) => {
  const market = dexapi.getMarketBySymbol(marketSymbol);
  const price = await dexapi.fetchLatestPrice(marketSymbol);
  const orderBook = await dexapi.fetchOrderBook(marketSymbol, 1);
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

const getOpenOrders = async (marketSymbol) => {
  const market = dexapi.getMarketBySymbol(marketSymbol);
  if (market === undefined) {
    throw new Error(`Market ${marketSymbol} does not exist`);
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

const getGridInterval = (marketSymbol) => {
  let interval;
  for (const key of Object.keys(pairs)) {
    if ( marketSymbol === pairs[key].symbol)
      interval = pairs[key].gridInterval;
  }
  if (interval === undefined) {
    throw new Error(`GridInterval option is missing for market ${marketSymbol} in default.json`);
  }

  return interval;
}

const getGridLevels = (marketSymbol) => {
  let levels;
  for (const key of Object.keys(pairs)) {
    if ( marketSymbol === pairs[key].symbol)
    levels = pairs[key].gridLevels;
  }

  if (levels === undefined) {
    throw new Error(`GridLevels option is missing for market ${marketSymbol} in default.json`);
  }

  return levels;
}

const getBase = (marketSymbol) => {
  let type;
  for (const key of Object.keys(pairs)) {
    if ( marketSymbol === pairs[key].symbol)
    type = pairs[key].base;
  }

  if (type === undefined) {
    throw new Error(`Base option is missing for market ${marketSymbol} in default.json`);
  }

  return type;
}

const getGridOrderSide = (marketSymbol) => {
  let side;
  for (const key of Object.keys(pairs)) {
    if ( marketSymbol === pairs[key].symbol)
      side = pairs[key].orderSide;
  }

  if (side === undefined) {
    throw new Error(`OrderSide option is missing for market ${marketSymbol} in default.json`);
  }

  return side;
}

const createBuyOrder = (marketSymbol, marketDetails, index) => {
  const { market } = marketDetails;
  const askPrecision = market.ask_token.precision;
  const bidPrecision = market.bid_token.precision;
  const bigMinSpread = new BN(getGridInterval(marketSymbol));
  const minOrder = market.order_min / market.ask_token.multiplier;

  const lastSalePrice = new BN(marketDetails.price);
  const lowestAsk = new BN(marketDetails.lowestAsk);
  const highestBid = new BN(marketDetails.highestBid);
  const base = new String(getBase(marketSymbol));
  const avgPrice = lowestAsk.plus(highestBid).dividedBy(2);
  let startPrice;

  switch(base) {
    case 'BID':
      startPrice = highestBid;
      break;
    case 'ASK':
      startPrice = lowestAsk;
      break;
    case 'LAST':
      startPrice = lastSalePrice;
      break;
    case 'AVERAGE':
    default:
      startPrice = avgPrice;
      break;
  }
  

  const buyPrice = (bigMinSpread.times(0 - (index + 1)).plus(1))
    .times(startPrice).decimalPlaces(askPrecision, BN.ROUND_DOWN);
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
    marketSymbol,
  };
  return order;
};

const createSellOrder = (marketSymbol, marketDetails, index) => {
  const { market } = marketDetails;
  const askPrecision = market.ask_token.precision;
  const bidPrecision = market.bid_token.precision;
  const bigMinSpread = new BN(getGridInterval(marketSymbol));
  const minOrder = market.order_min / market.ask_token.multiplier;

  const lastSalePrice = new BN(marketDetails.price);
  const lowestAsk = new BN(marketDetails.lowestAsk);
  const highestBid = new BN(marketDetails.highestBid);
  const base = new String(getBase(marketSymbol));
  const avgPrice = lowestAsk.plus(highestBid).dividedBy(2);
  let startPrice;

  switch(base) {
    case 'BID':
      startPrice = highestBid;
      break;
    case 'ASK':
      startPrice = lowestAsk;
      break;
    case 'LAST':
      startPrice = lastSalePrice;
      break;
    default:
      startPrice = avgPrice;
      break;
  }

  const sellPrice = (bigMinSpread.times(0 + (index + 1)).plus(1))
    .times(Math.max(startPrice)).decimalPlaces(askPrecision, BN.ROUND_UP);
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
    marketSymbol,
  };

  return order;
};

// prepare the orders we want to have on the books
const prepareOrders = async (marketSymbol, marketDetails, openOrders) => {
  const orders = [];
  let numBuys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY).length;
  let numSells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL).length;

  const levels = new BN(getGridLevels(marketSymbol));
  let side = getGridOrderSide(marketSymbol);

  for (let index = 0; index < levels; index += 1) {
    // buy order
    if ((numSells < levels) && ((side === "BOTH") || (side === "BUY"))) {
      orders.push(createBuyOrder(marketSymbol, marketDetails, index));
      numBuys += 1;
    }

    // sell order
    if ((numSells < levels) && ((side === "BOTH") || (side === "SELL"))) {
      orders.push(createSellOrder(marketSymbol, marketDetails, index));
      numSells += 1;
    }
  }

  return orders;
};

const placeOrders = async (orders) => {
  if (orders.length === 0) return;
  orders.forEach(async (order) => {
    await submitLimitOrder(order.marketSymbol, order.orderSide, order.quantity, order.price);
  });
};

/**
 * Market Making Trading Strategy
 * The goal is to always have some buy and some sell side orders on the books.
 * The number of orders is determined by config value gridLevels, see config/default.json
 * The orders should be maker orders.
 */
const trade = async () => {
  for(let i = 0; i < pairs.length; i+=1) {
    const logger = getLogger();
    logger.info(`Executing ${pairs[i].symbol} market maker trades on account ${username}`);

    try {
      const openOrders = await getOpenOrders(pairs[i].symbol);

      // any orders to place?
      const gridLevels = new BN(getGridLevels(pairs[i].symbol));
      const buys = openOrders.filter((order) => order.order_side === ORDERSIDES.BUY);
      const sells = openOrders.filter((order) => order.order_side === ORDERSIDES.SELL);
      if (buys.length >= gridLevels && sells.length >= gridLevels) {
        logger.info(`nothing to do - we have enough orders on the books for ${pairs[i].symbol}`);
        return;
      }

      const marketDetails = await getMarketDetails(pairs[i].symbol);
      const preparedOrders = await prepareOrders(pairs[i].symbol, marketDetails, openOrders);
      await placeOrders(preparedOrders);
    } catch (error) {
      logger.error(error.message);
    }
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
