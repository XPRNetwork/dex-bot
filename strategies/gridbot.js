// grid bot strategy
import { BigNumber as BN } from 'bignumber.js';
import * as dexapi from '../dexapi.js';
import { submitLimitOrder, ORDERSIDES } from '../dexrpc.js';
import { getConfig, getLogger } from '../utils.js';

// Trading config
const config = getConfig();
const { username } = config;
const { gbpairs } = config.get('gridBot');

const logger = getLogger();

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
  const quantity = +new BN(totalCost/10 ** askPrecision).dividedBy(price).toFixed(bidPrecision, BN.ROUND_UP);
  const adjustedTotal = +new BN(price).times(quantity).toFixed(askPrecision, BN.ROUND_UP);
  return {
    adjustedTotal,
    quantity,
  };
};

const parseEachPairConfig = () => {
  const pairs = [];
  for (const key of Object.keys(gbpairs)) {
    if (gbpairs[key].symbol === undefined) {
      throw new Error(`Market symbol option is missing for market ${marketSymbol} in default.json`);
    }

    if (gbpairs[key].upperLimit === undefined || gbpairs[key].lowerLimit === undefined ||
        gbpairs[key].gridLevels === undefined || gbpairs[key].pricePerGrid === undefined) {
      throw new Error(`Options are missing for market ${marketSymbol} in default.json`);
    }

    pairs.push ({
      symbol: gbpairs[key].symbol,
      upperLimit: parseFloat(gbpairs[key].upperLimit),
      lowerLimit: parseFloat(gbpairs[key].lowerLimit),
      gridLevels: gbpairs[key].gridLevels,
      pricePerGrid: parseFloat(gbpairs[key].pricePerGrid)
    });
  }
    return pairs;
  }

const placeOrders = async (orders) => {
  if (orders.length === 0) return;
  orders.forEach(async (order) => {
    await submitLimitOrder(order.marketSymbol, order.orderSide, order.quantity, order.price);
  });
};

/**
 * Grid Trading Bot Strategy
 * Grid Trading Bots are programs that allow users to automatically buy low and sell high within a pre-set price range.
 * The number of orders is determined by config value gridLevels, see config/default.json
 * The orders should be maker orders and with-in the limits mentioned in parameters
 */
 const gridBot = async () => {
  const pairs = await parseEachPairConfig();

  for(let i = 0; i < pairs.length; i+=1) {
    try {
      const orders = [];
      const marketSymbol = pairs[i].symbol;
      const marketDetails = await getMarketDetails(marketSymbol);
      const { market } = marketDetails;
      const gridLevels = pairs[i].gridLevels;
      const bidPrecision = market.bid_token.precision;
      const askPrecision = market.ask_token.precision;
      const lastSalePrice = new BN(marketDetails.price).toFixed(askPrecision, BN.ROUND_UP);
      const openOrders = await getOpenOrders(marketSymbol);
      const gridSize = new BN((pairs[i].upperLimit - pairs[i].lowerLimit) / gridLevels);

      for(let index = 0; index <= gridLevels; index+=1) {
        const price = new BN((pairs[i].upperLimit - (index * gridSize))/10 ** bidPrecision).toFixed(askPrecision, BN.ROUND_UP);
        let placeBuyOrder = true, placeSellOrder = true;
        // Loop through and decide whehter to place order or not based on price criteria
        openOrders.forEach(async (order) => {
          const oldPrice = new BN(order.price).toFixed(askPrecision, BN.ROUND_UP);
          if(oldPrice === price && order.order_side === ORDERSIDES.BUY) {
            placeBuyOrder = false;
          }
          if(oldPrice === price && order.order_side === ORDERSIDES.SELL) {
            placeSellOrder = false;
          }
        });

        const { quantity, adjustedTotal } = getQuantityAndAdjustedTotal(+price, pairs[i].pricePerGrid, bidPrecision, askPrecision,);
        const thresholdValue = new BN(gridSize/10 ** bidPrecision).toFixed(askPrecision);
        const validOrder = new BN(Math.abs(price - lastSalePrice)).isGreaterThanOrEqualTo(thresholdValue);
 
        // Prepare oreders into a list
        if(validOrder && (openOrders.length < gridLevels)) {
          if(price > lastSalePrice && placeSellOrder) {
            const order = {
              orderSide: ORDERSIDES.SELL,
              price: +price,
              quantity: quantity,
              marketSymbol,
            };
            orders.push(order);
          }
          else if(price < lastSalePrice && placeBuyOrder) {
            const order = {
              orderSide: ORDERSIDES.BUY,
              price: +price,
              quantity: adjustedTotal,
              marketSymbol,
            };
            orders.push(order);
          }
        }
      }
      await placeOrders(orders);
    } catch (error) {
      logger.error(error.message);
    }
  }
};

const gridStrategy = {
  gridBot,
};

export default gridStrategy;