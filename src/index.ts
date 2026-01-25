import { getConfig, getLogger } from './utils.js';
import * as dexapi from './dexapi.js';
import * as dexrpc from './dexrpc.js';
import { getStrategy, getAvailableStrategies } from './strategies/index.js';
import { TradingStrategy } from './interfaces/index.js';
import readline from 'readline';
import { postSlackMsg } from './slackapi.js';

// New imports for institutional features
import { initializeDatabase, closeDatabase } from './persistence/database.js';
import { riskManager } from './risk/manager.js';
import { pnlCalculator } from './analytics/pnl.js';
import { marketAnalyzer } from './ai/market-analyzer.js';
import { ammPoolMonitor } from './amm/pool-monitor.js';

const logger = getLogger();

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface ActiveStrategy {
  name: string;
  instance: TradingStrategy;
  enabled: boolean;
}

// Active strategies
let activeStrategies: ActiveStrategy[] = [];
let config = getConfig();
let isShuttingDown = false;

/**
 * Initialize all infrastructure components
 */
async function initializeInfrastructure(): Promise<void> {
  logger.info('Initializing institutional trading infrastructure...');

  // 1. Initialize persistence layer
  try {
    const persistenceConfig = (config as any).persistence;
    if (persistenceConfig) {
      initializeDatabase(persistenceConfig);
      logger.info('Database initialized');
    } else {
      initializeDatabase();
      logger.info('Database initialized with default config');
    }
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }

  // 2. Initialize risk management
  try {
    const riskConfig = (config as any).risk;
    if (riskConfig) {
      riskManager.updateConfig({
        maxPositionUSD: riskConfig.maxPositionUSD,
        maxTotalExposureUSD: riskConfig.maxTotalExposureUSD,
        maxPositionPercent: riskConfig.maxPositionPercent,
        minOrderSizeUSD: riskConfig.minOrderSizeUSD,
        maxOrdersPerMinute: riskConfig.maxOrdersPerMinute,
        circuitBreaker: {
          enabled: riskConfig.circuitBreakerEnabled,
          maxDrawdownPercent: riskConfig.maxDrawdownPercent,
          dailyLossLimitUSD: riskConfig.dailyLossLimitUSD,
          consecutiveLossLimit: riskConfig.consecutiveLossLimit,
          cooldownMinutes: riskConfig.cooldownMinutes,
          autoReset: riskConfig.autoReset
        }
      });
    }
    logger.info('Risk management initialized');
  } catch (error) {
    logger.error('Failed to initialize risk management:', error);
  }

  // 3. Initialize AI analyzer (if configured)
  try {
    const claudeConfig = (config as any).claude;
    if (claudeConfig?.enabled) {
      const apiKey = claudeConfig.apiKey || process.env.CLAUDE_API_KEY;
      if (apiKey) {
        marketAnalyzer.initialize(apiKey);
        logger.info('Claude AI analyzer initialized');
      } else {
        logger.warn('Claude API key not found - AI features disabled');
      }
    }
  } catch (error) {
    logger.warn('Failed to initialize Claude AI:', error);
  }

  // 4. Initialize AMM pool monitor (if arbitrage is enabled)
  try {
    const arbConfig = (config as any).arbitrage;
    if (arbConfig?.enabled) {
      await ammPoolMonitor.initialize();
      logger.info('AMM pool monitor initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize AMM pool monitor:', error);
  }

  // 5. Initialize DEX API
  await dexapi.initialize();
  logger.info('DEX API initialized');

  logger.info('Infrastructure initialization complete');
}

/**
 * Initialize strategies based on configuration
 */
async function initializeStrategies(): Promise<void> {
  logger.info('Initializing trading strategies...');

  const strategiesConfig = (config as any).strategies as { name: string; enabled: boolean }[] | undefined;

  if (strategiesConfig && strategiesConfig.length > 0) {
    // Multi-strategy mode
    for (const stratConfig of strategiesConfig) {
      if (!stratConfig.enabled) continue;

      try {
        const strategy = getStrategy(stratConfig.name);
        const strategyOptions = getStrategyOptions(stratConfig.name);
        await strategy.initialize(strategyOptions);

        activeStrategies.push({
          name: stratConfig.name,
          instance: strategy,
          enabled: true
        });

        logger.info(`Strategy ${stratConfig.name} initialized`);
      } catch (error) {
        logger.error(`Failed to initialize strategy ${stratConfig.name}:`, error);
      }
    }
  } else {
    // Single strategy mode (backwards compatible)
    const strategy = getStrategy(config.strategy);
    const strategyOptions = getStrategyOptions(config.strategy);
    await strategy.initialize(strategyOptions);

    activeStrategies.push({
      name: config.strategy,
      instance: strategy,
      enabled: true
    });

    logger.info(`Strategy ${config.strategy} initialized`);
  }

  logger.info(`${activeStrategies.length} strategies active`);
}

/**
 * Get strategy-specific options from config
 */
function getStrategyOptions(strategyName: string): any {
  switch (strategyName) {
    case 'gridBot':
      return (config as any).gridBot;
    case 'marketMaker':
      return (config as any).marketMaker;
    case 'amm-dex-arbitrage':
      return (config as any).arbitrage;
    case 'claude-adaptive-mm':
      return {
        ...(config as any).claudeAdaptiveMM,
        claudeApiKey: (config as any).claude?.apiKey || process.env.CLAUDE_API_KEY
      };
    default:
      return (config as any)[strategyName] || {};
  }
}

/**
 * Execute trade cycle for all active strategies
 */
async function executeTradeCycle(): Promise<void> {
  for (const strategy of activeStrategies) {
    if (!strategy.enabled || isShuttingDown) continue;

    try {
      // Check risk before trading
      const riskStatus = riskManager.getRiskStatus(strategy.name);

      if (!riskStatus.canTrade) {
        logger.warn(`Strategy ${strategy.name} halted by risk manager`);
        continue;
      }

      if (riskStatus.warnings.length > 0) {
        logger.warn(`Risk warnings for ${strategy.name}: ${riskStatus.warnings.join(', ')}`);
      }

      await strategy.instance.trade();

    } catch (error) {
      logger.error(`Trade cycle error for ${strategy.name}:`, error);
    }
  }
}

/**
 * Execute analytics cycle
 */
async function executeAnalyticsCycle(): Promise<void> {
  for (const strategy of activeStrategies) {
    try {
      // Save daily P&L snapshot
      pnlCalculator.saveDailyPnL(strategy.name);

      // Save metrics
      const metrics = pnlCalculator.calculateMetrics(strategy.name, 'DAILY');
      pnlCalculator.saveMetrics(metrics);

      // Save risk snapshots
      riskManager.saveSnapshots(strategy.name);

    } catch (error) {
      logger.error(`Analytics error for ${strategy.name}:`, error);
    }
  }
}

/**
 * Trading loop
 */
async function tradeLoop(): Promise<void> {
  if (isShuttingDown) return;

  logger.info('Trade cycle executing...');

  try {
    await executeTradeCycle();
  } catch (error) {
    logger.error('Trade loop error:', error);
  }

  await delay(config.tradeIntervalMS);
  tradeLoop();
}

/**
 * Analytics loop (runs less frequently)
 */
async function analyticsLoop(): Promise<void> {
  if (isShuttingDown) return;

  try {
    await executeAnalyticsCycle();
  } catch (error) {
    logger.error('Analytics loop error:', error);
  }

  // Run analytics every 5 minutes
  await delay(300000);
  analyticsLoop();
}

/**
 * Slack notification loop
 */
async function slackLoop(): Promise<void> {
  if (isShuttingDown) return;

  try {
    await postSlackMsg();
  } catch (error) {
    logger.error('Slack notification error:', error);
  }

  await delay(config.slackIntervalMS);
  slackLoop();
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, initiating graceful shutdown...`);

  // Stop all strategies
  for (const strategy of activeStrategies) {
    strategy.enabled = false;
    if (typeof (strategy.instance as any).stop === 'function') {
      (strategy.instance as any).stop();
    }
  }

  // Cancel open orders if configured
  if (config.cancelOpenOrdersOnExit) {
    logger.info('Cancelling all open orders...');
    try {
      await dexrpc.cancelAllOrders();
      logger.info('Orders cancelled');
    } catch (error) {
      logger.error('Error cancelling orders:', error);
    }
  }

  // Final analytics save
  logger.info('Saving final analytics...');
  await executeAnalyticsCycle();

  // Close database
  closeDatabase();

  logger.info('Shutdown complete');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('=== Institutional-Grade DEX Bot ===');
  logger.info(`Available strategies: ${getAvailableStrategies().join(', ')}`);

  // Set up signal handlers
  process.stdin.resume();

  if (process.platform === 'win32') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', () => process.emit('SIGINT' as any));
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  try {
    // Initialize infrastructure
    await initializeInfrastructure();

    // Initialize strategies
    await initializeStrategies();

    // Initial trade execution
    logger.info('Executing initial trade cycle...');
    await executeTradeCycle();

    // Wait before starting loops
    logger.info('Waiting before starting monitoring loops...');
    await delay(15000);

    // Start all loops
    logger.info('Starting trade loop...');
    tradeLoop();

    logger.info('Starting analytics loop...');
    analyticsLoop();

    logger.info('Starting Slack notification loop...');
    slackLoop();

    logger.info('Bot is now live and trading');

  } catch (error) {
    logger.error('Fatal error during startup:', error);
    await gracefulShutdown('startup-error');
  }
}

// Start the bot
await main();
