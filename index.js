import config from 'config';
import winston from 'winston';
import * as dexapi from './dexapi.js';
import * as dexrpc from './dexrpc.js';
import * as strategy from './strategies/marketmaker.js';

const x = 2;

/**
 * This is where we call the main maker trading strategy.
 * @param {winston} logger - logger for logging info and errors
 * @returns {Promise<void>} - doesn't return anything
 */
const trade = async (logger) => {
  logger.info('Executing trade()');

  await strategy.trade();
};

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const settings = config.get('bot');
  const logger = winston.createLogger({
    format: winston.format.prettyPrint(),
    transports: [new winston.transports.Console()],
  });

  dexrpc.setLogger(logger);
  await dexapi.initialize();
  try {
    // attempt a trade every n milliseconds
    const tradeInterval = setInterval(async () => {
      try {
        await trade();
      } catch (error) {
        logger.error(error.message);
      }
    }, settings.tradeIntervalMS);

    // Set things up so that when application receives ctl-c we cancel all open orders
    process.stdin.resume();
    process.on('SIGINT', async () => {
      clearInterval(tradeInterval); // stop attempting new trades
      logger.info('Canceling all open orders and shutting down');
      await dexrpc.cancelAllOrders();
      process.exit();
    });
  } catch (error) {
    logger.error(error.message);
  }
};

// start it all up
await main();
