import { getConfig, getLogger } from './utils';
import * as dexapi from './dexapi';

import { getStrategy } from './strategies';
import readline from 'readline';
import { postSlackMsg } from './slackapi';
import { events } from './events';
import { tradesEmitter } from './trades';
import { healthMonitor } from './health-monitor';
import type { MockEngine } from './mock-engine';

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function gracefulShutdown(reason: string): Promise<void> {
  const logger = getLogger();
  logger.info(`[Shutdown] ${reason}`);
  events.botStopped(`Graceful shutdown: ${reason}`);
  if (healthMonitor.shouldCancelOrdersOnRestart()) {
    try { await currentStrategy.cancelOwnOrders(); } catch {}
  }
  events.shutdown();
  await delay(2000);
  process.exit(1);
}

function getSymbolsFromConfig(cfg: typeof config): string[] {
  const symbols: string[] = [];
  const strategy = cfg.strategy;
  const strategyConfig = cfg[strategy] as any;
  if (!strategyConfig) return symbols;

  if (strategyConfig.pairs) {
    for (const p of strategyConfig.pairs) {
      if (p.symbol) symbols.push(p.symbol);
    }
  } else if (strategyConfig.symbol) {
    symbols.push(strategyConfig.symbol);
  }
  return symbols;
}

let mockEngineInstance: MockEngine | undefined;

const execTrade = async () => {
  console.log('Bot is live');

  try {
    await currentStrategy.trade();
  } catch (error) {
    const logger = getLogger();
    logger.error(`[TradeLoop] Error: ${(error as Error).message}`);
    events.botError(`Trade cycle error: ${(error as Error).message}`, { error: (error as Error).message });
  }

  // Paper trading: check fills after each trade cycle
  if (mockEngineInstance) {
    for (const symbol of getSymbolsFromConfig(config)) {
      try {
        const price = await dexapi.fetchLatestPrice(symbol);
        const fills = mockEngineInstance.checkFills(symbol, price);
        for (const fill of fills) {
          events.tradeExecuted(`[Paper] Order filled`, {
            mode: 'paper',
            mockId: fill.mockId,
            side: fill.orderSide === 1 ? 'BUY' : 'SELL',
            price: fill.filledPrice,
            quantity: fill.quantity,
            market: symbol,
          });
        }
      } catch (err) {
        console.warn(`[Paper] Failed to check fills for ${symbol}:`, (err as Error).message);
      }
    }
    mockEngineInstance.writeBalanceState();
    mockEngineInstance.saveState();
  }

  if (healthMonitor.isRestartRequested()) {
    await gracefulShutdown('Health monitor triggered restart');
    return;
  }

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

// Initialize dashboard events
events.initialize();
tradesEmitter.initialize();

// Initialize health monitor
healthMonitor.initialize();

/**
 * Main
 * This sets up the logic for the application, the looping, timing, and what to do on exit.
 */
const main = async () => {
  const logger = getLogger();

  await dexapi.initialize();

  // Initialize mock engine for paper trading mode
  const isPaperMode = config.mode === 'paper' || process.env.BOT_MODE === 'paper';
  if (isPaperMode) {
    const { MockEngine } = await import('./mock-engine');
    const engine = new MockEngine(
      process.env.ORDER_STATE_DIR || '',
      process.env.DASHBOARD_INSTANCE_ID || ''
    );
    await engine.initializeBalances(
      dexapi, config.username, getSymbolsFromConfig(config),
      config.paperTrading?.startingBalances
    );
    (currentStrategy as any).mockEngine = engine;
    mockEngineInstance = engine;
    logger.info('[Paper] Mock engine initialized — no real orders will be placed');
  }

  // Emit bot started event
  events.botStarted(`Bot started with strategy: ${config.strategy}${isPaperMode ? ' (paper mode)' : ''}`);
  events.configLoaded('Configuration loaded', {
    strategy: config.strategy,
    username: config.username,
    tradeIntervalMS: config.tradeIntervalMS,
  });

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
        events.botStopped('Bot shutting down - cancelling instance orders');
        events.shutdown();
        await currentStrategy.cancelOwnOrders();
        process.exit();
      }

      process.on('SIGINT', signalHandler)
      process.on('SIGTERM', signalHandler)
      process.on('SIGQUIT', signalHandler)
    }

    // Strategies that are polling-based and should start immediately without initial trade + delay
    const pollingStrategies = new Set([
      'swapper', 'spikeBot', 'momentumBot', 'scannerBot', 'copyTrader',
      'whaleWatcher', 'spreadBot', 'twapBot', 'arbBot',
    ]);

    if (!pollingStrategies.has(config.strategy)) {
      await currentStrategy.trade()
      logger.info(`Waiting for few seconds before fetching the placed orders`);
      await delay(15000)
      execTrade()
      execSlack()
    } else {
      execTrade()
      execSlack()
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    logger.error(errorMsg);
    events.botError(`Fatal error: ${errorMsg}`, { error: errorMsg });
  }
};

// start it all up
await main();