import { getConfig, getLogger } from './utils';
import * as dexapi from './dexapi';
import * as dexrpc from './dexrpc';
import { getStrategy } from './strategies';
import readline from 'readline';
import { postSlackMsg } from './slackapi';

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const config = getConfig();
  const logger = getLogger();
  
  await dexapi.initialize();
  
  const currentStrategy = getStrategy(config.strategy);
  
  currentStrategy.initialize(config[config.strategy]);

  let RUN = true;
  try {
    process.stdin.resume();
    if (config.cancelOpenOrdersOnExit) {
      if (process.platform === "win32") {
        var rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
      
        rl.on("SIGINT", function () {
          process.emit("SIGINT");
        });
      }
      
      async function signalHandler() {
        RUN = false;
        await dexrpc.cancelAllOrders();
        process.exit();
      }

      process.on('SIGINT', signalHandler)
      process.on('SIGTERM', signalHandler)
      process.on('SIGQUIT', signalHandler)
    }
    
    while(RUN) {
      await Promise.all(
        [
          delay(config.tradeIntervalMS),
          currentStrategy.trade(),
        ]
      );
      await Promise.all(
        [
          delay(config.slackIntervalMS),
          postSlackMsg(),
        ]
      );
    }
  } catch (error) {
    logger.error((error as Error).message);
  }
};

// start it all up
await main();