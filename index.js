import winston from 'winston';
import { fetchMarkets, fetchOpenOrders, fetchOrderBook, fetchOrderHistory } from './dexapi.js';
import {
  cancelOrder, cancelAllOrders, initialize, submitLimitOrder, ORDERSIDES,
} from './dexrpc.js';

// SET THIS VALUE
const username = 'user1';

const main = async () => {
  const transport = new winston.transports.Console();
  const logger = winston.createLogger({
    transports: [transport],
  });

  await initialize();
  try {
    // == place an order to sell XPR into USDC
    // const quantity = 570;
    // const price = 0.002020;
    // submitLimitOrder('XPR_XUSDC', ORDERSIDES.SELL, quantity, price);

    // == cancel all orders
    // cancelAllOrders();

    // == cancel a single order
    // const orderId = 966550;
    // cancelOrder(orderId);

    // == fetchMarkets
    // const response = await fetchMarkets();
    // logger.info(response);

    // == fetchOpenOrders
    // const response = await fetchOpenOrders(username);
    // logger.info(response);

    // == fetchOrderBook
    // const response = await fetchOrderBook('XBTC_XUSDC', 100, 0.01);
    // logger.info(response);

    // == fetchOrderHistory
    const response = await fetchOrderHistory('squdgy', 20, 0);
    logger.info(response);
  } catch (error) {
    logger.error(error);
  }
};

main();
