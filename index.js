import { getConfig, getLogger } from './utils.js';
import * as dexapi from './dexapi.js';
import * as dexrpc from './dexrpc.js';
import strategy from './strategies/marketmaker.js';
import gridStrategy from './strategies/gridbot.js';

/**
 * This is where we call the trading strategy.
 * @returns {Promise<void>} - doesn't return anything
 */
const trade = async () => {
  await strategy.trade();
};

/**
 * This is where we call the trading strategy.
 * @returns {Promise<void>} - doesn't return anything
 */
 const gridBot = async () => {
  await gridStrategy.gridBot();
};

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const config = getConfig();
  const logger = getLogger();

  await dexapi.initialize();
  try {
    // attempt to trade every n milliseconds
    const tradeInterval = setInterval(async () => {
      try {
        if (config.strategy === "marketMaker") {
          await trade();
        }
        else if(config.strategy === "gridBot") {
          await gridBot();
        }
      } catch (error) {
        logger.error(error.message);
      }
    }, config.tradeIntervalMS);

    if (config.cancelOpenOrdersOnExit) {
      // Set things up so that when application receives ctl-c we cancel all open orders
      process.stdin.resume();
      process.on('SIGINT', async () => {
        clearInterval(tradeInterval); // stop attempting new trades
        logger.info('Canceling all open orders and shutting down');
        await dexrpc.cancelAllOrders();
        process.exit();
      });
    }
  } catch (error) {
    logger.error(error.message);
  }
};

// start it all up
await main();
