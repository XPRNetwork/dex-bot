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

const execTrade = async () => {
  console.log('Bot is live');
  await currentStrategy.trade()
  await delay(config.tradeIntervalMS)
  execTrade()
}

const execSlack = async () => {
  await postSlackMsg()
  await delay(config.slackIntervalMS)
  execSlack()
}
const config = getConfig();
const currentStrategy = getStrategy(config.strategy);
currentStrategy.initialize(config[config.strategy]);

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const logger = getLogger();
  
  await dexapi.initialize();

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
        await dexrpc.cancelAllOrders();
        process.exit();
      }

      process.on('SIGINT', signalHandler)
      process.on('SIGTERM', signalHandler)
      process.on('SIGQUIT', signalHandler)
    }
    
    execTrade()
    execSlack()
  } catch (error) {
    logger.error((error as Error).message);
  }
};

// start it all up
await main();