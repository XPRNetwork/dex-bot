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
let oldOrders = [];
let pairs = [];

const initializeOrders = async() => {
  pairs = await parseEachPairConfig();
  for(var size = 0; size < pairs.length; size++) {
    oldOrders[size] = [];
  }
};

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
  const quantity = +new BN(totalCost/10 ** askPrecision).dividedBy(price).toFixed(bidPrecision);
  const adjustedTotal = +new BN(price).times(quantity).toFixed(askPrecision);
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
};

const getHighestBid = async (orders) => {
  const buyOrders = orders.filter((order) => order.orderSide === ORDERSIDES.BUY);
  if (buyOrders.length === 0) return;
  
  buyOrders.sort(function(orderA, orderB){
    if(BN(orderA.price) > BN(orderB.price)) return -1;
    if(BN(orderA.price) < BN(orderB.price)) return 1;
  });

  const highestBid = new BN(buyOrders[0].price);
  return highestBid;
};

const getLowestAsk = async (orders) => {
  const sellOrders = orders.filter((order) => order.orderSide === ORDERSIDES.SELL);
  if (sellOrders.length === 0) return;

  sellOrders.sort(function(orderA, orderB){
    if(BN(orderA.price) > BN(orderB.price)) return 1;
    if(BN(orderA.price) < BN(orderB.price)) return -1;
  });

  const lowestAsk = new BN(sellOrders[0].price);
  return lowestAsk;
};

const placeOrders = async (orders) => {
  if (orders.length === 0) return;
  for (const order of orders) {
    submitLimitOrder(order.marketSymbol, order.orderSide, order.quantity, order.price);
  };
};

/**
 * Grid Trading Bot Strategy
 * Grid Trading Bots are programs that allow users to automatically buy low and sell high within a pre-set price range.
 * The number of orders is determined by config values like limits, gridLevels, refer config/default.json
 */
 const gridBot = async () => {
  for(var i = 0; i < pairs.length; i++) {
    try {
      const marketSymbol = pairs[i].symbol;
      const marketDetails = await getMarketDetails(marketSymbol);
      const { market } = marketDetails;
      const gridLevels = pairs[i].gridLevels;
      const bidPrecision = market.bid_token.precision;
      const askPrecision = market.ask_token.precision;
      const lastSalePrice = new BN(marketDetails.price).toFixed(askPrecision);
      const openOrders = await getOpenOrders(marketSymbol);
      const gridSize = new BN((pairs[i].upperLimit - pairs[i].lowerLimit) / gridLevels);
      const gridPrice = new BN(gridSize/10 ** bidPrecision).toFixed(askPrecision);
      let latestOrders = [];

      if(!oldOrders[i].length) {
        // Place orders on bot initialization
        for(let index = 0; index <= gridLevels; index+=1) {
          const price = new BN((pairs[i].upperLimit - (index * gridSize))/10 ** bidPrecision).toFixed(askPrecision);
          const { quantity, adjustedTotal } = getQuantityAndAdjustedTotal(+price, pairs[i].pricePerGrid, bidPrecision, askPrecision,);
          const validOrder = new BN(Math.abs(price - lastSalePrice)).isGreaterThanOrEqualTo(gridPrice);
          // Prepare orders and push into a list
          if(validOrder) {
            if(price > lastSalePrice) {
              const order = {
                orderSide: ORDERSIDES.SELL,
                price: +price,
                quantity: quantity,
                marketSymbol,
              };
              oldOrders[i].push(order);
            }
            else if(price < lastSalePrice) {
              const order = {
                orderSide: ORDERSIDES.BUY,
                price: +price,
                quantity: adjustedTotal,
                marketSymbol,
              };
              oldOrders[i].push(order);
            }
          }
        }
        await placeOrders(oldOrders[i]); 
      }
      else if(openOrders.length > 0) {
        // compare open orders with old orders and placce counter orders for the executed orders 
        let currentOrders = openOrders.map(order => ({orderSide: order.order_side, price: order.price, quantity: order.quantity, marketSymbol}));
        for (var j = 0; j < oldOrders[i].length; j++) {
          const newOrder = openOrders.find(openOrders => openOrders.price === oldOrders[i][j].price);
          if(!newOrder) {
            if (oldOrders[i][j].orderSide === ORDERSIDES.BUY) {
              const lowestAsk = await getLowestAsk(currentOrders);
              if(!lowestAsk) continue;
              // Place a counter sell order for the executed buy order
              const sellPrice = new BN(lowestAsk).minus(gridPrice).toFixed(askPrecision);
              const { quantity, adjustedTotal } = getQuantityAndAdjustedTotal(sellPrice, pairs[i].pricePerGrid, bidPrecision, askPrecision);
              const order = {
                orderSide: ORDERSIDES.SELL,
                price: +sellPrice,
                quantity: quantity,
                marketSymbol,
              };
              latestOrders.push(order);
              currentOrders.push(order);
            } else if (oldOrders[i][j].orderSide === ORDERSIDES.SELL) {
              const highestBid = await getHighestBid(currentOrders);
              if(!highestBid) continue;
              // Place a counter buy order for the executed sell order
              const buyPrice = new BN(highestBid).plus(gridPrice).toFixed(askPrecision);
              const { quantity, adjustedTotal } = getQuantityAndAdjustedTotal(buyPrice, pairs[i].pricePerGrid, bidPrecision, askPrecision);
              const order = {
                orderSide: ORDERSIDES.BUY,
                price: +buyPrice,
                quantity: adjustedTotal,
                marketSymbol,
              };
              latestOrders.push(order);
              currentOrders.push(order);
           }
          }
        }
        await placeOrders(latestOrders);
        // Update old orders for next round of inspection
        oldOrders[i] = currentOrders;
      }
    } catch (error) {
      logger.error(error.message);
    }
  }
};

const gridStrategy = {
  gridBot,
  initializeOrders,
};

export default gridStrategy;