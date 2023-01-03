import config from 'config';
import getLogger from './utils.js';
import * as dexapi from './dexapi.js';
import * as dexrpc from './dexrpc.js';
import * as strategy from './strategies/marketmaker.js';

/**
 * This is where we call the main maker trading strategy.
 * @returns {Promise<void>} - doesn't return anything
 */
const trade = async () => {
  getLogger().info('Executing trade()');

  await strategy.trade();
};

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const settings = config.get('bot');
  const logger = getLogger();

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
