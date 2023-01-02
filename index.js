import winston from 'winston';
import { initialize } from './dexrpc.js';
import makeMarkets from './strategies/marketmaker.js';

/**
 * This is the main market maker trading strategy.
 * This is where logic will go to determine price, quantity etc.
 * @param {string} market - Which market to make a market in, ex. XPR_XUSDC
 * @param {winston} logger - logger for logging info and errors
 * @returns {Promise<void>} - doesn't return anything
 */
const trade = async (market, logger) => {
  logger.info('Executing trade()');

  await makeMarkets(logger);
};

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const logger = winston.createLogger({
    format: winston.format.prettyPrint(),
    transports: [new winston.transports.Console()],
  });

  await initialize();
  try {
    // attempt a trade every n milliseconds
    const tradeInterval = setInterval(async () => {
      try {
        const market = 'XPR_XUSDC';
        await trade(market, logger);
      } catch (error) {
        logger.error(error.message);
      }
    }, 5000);

    // Set things up so that when application receives ctl-c we cancel all open orders
    process.stdin.resume();
    process.on('SIGINT', async () => {
      clearInterval(tradeInterval); // stop attempting new trades
      logger.info('Canceling all open orders and shutting down');
      // await cancelAllOrders();
      process.exit();
    });
  } catch (error) {
    logger.error(error.message);
  }
};

// start it all up
await main();
