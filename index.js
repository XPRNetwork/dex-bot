import winston from 'winston';
import {
  cancelAllOrders, initialize, submitLimitOrder, ORDERSIDES,
} from './dexrpc.js';

/**
 * This is the main market maker trading strategy.
 * This is where logic will go to determine price, quantity etc.
 * @param {string} market - Which market to make a market in, ex. XPR_XUSDC
 * @param {winston} logger - logger for logging info and errors
 * @returns {Promise<void>} - doesn't return anything
 */
const trade = async (market, logger) => {
  logger.info('Executing trade()');

  // == place an order to sell
  const quantity = 500;
  const price = 0.002025;
  await submitLimitOrder(market, ORDERSIDES.SELL, quantity, price);

  // TODO: trading strategy
};

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const transport = new winston.transports.Console();
  const logger = winston.createLogger({
    transports: [transport],
  });

  await initialize();
  try {
    // attempt a trade every n milliseconds
    const tradeInterval = setInterval(async () => {
      try {
        const market = 'XPR_XUSDC';
        await trade(market, logger);
      } catch (error) {
        logger.error(error);
      }
    }, 5000);

    // Set things up so that when application receives ctl-c we cancel all open orders
    process.stdin.resume();
    process.on('SIGINT', async () => {
      clearInterval(tradeInterval); // stop attempting new trades
      logger.info('Canceling all open orders and shutting down');
      await cancelAllOrders();
      process.exit();
    });
  } catch (error) {
    logger.error(error);
  }
};

// start it all up
await main();
