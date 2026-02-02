// Load environment variables from .env file FIRST
import 'dotenv/config';

import { getConfig, getLogger } from './utils.js';
import * as dexapi from './dexapi.js';
import * as dexrpc from './dexrpc.js';
import { getStrategy, getAvailableStrategies } from './strategies/index.js';
import { TradingStrategy } from './interfaces/index.js';
import readline from 'readline';
import { postSlackMsg } from './slackapi.js';
import fs from 'fs';
import path from 'path';

// SINGLETON LOCK - Use a TCP port to prevent multiple instances
import net from 'net';

const LOCK_PORT = 19847; // Unique port for this bot

function acquireLock(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`ERROR: Another bot instance is already running (port ${LOCK_PORT} in use)`);
        console.error('Kill existing instance first: pkill -f "ts-node.*index.ts"');
        resolve(false);
      } else {
        console.error('Lock error:', err);
        resolve(false);
      }
    });

    server.once('listening', () => {
      console.log(`Bot starting with PID ${process.pid} (lock acquired on port ${LOCK_PORT})`);
      resolve(true);
    });

    server.listen(LOCK_PORT, '127.0.0.1');

    // Cleanup on exit
    process.on('SIGINT', () => { server.close(); process.exit(0); });
    process.on('SIGTERM', () => { server.close(); process.exit(0); });
  });
}

// Wrap the main execution in an async IIFE that checks the lock first
const lockAcquired = await acquireLock();
if (!lockAcquired) {
  process.exit(1);
}

// New imports for institutional features
import { initializeDatabase, closeDatabase } from './persistence/database.js';
import { riskManager } from './risk/manager.js';
import { pnlCalculator } from './analytics/pnl.js';
import { marketAnalyzer } from './ai/market-analyzer.js';
import { ammPoolMonitor } from './amm/pool-monitor.js';
import { xmdTreasury } from './xmd/treasury.js';
import { telegramNotifier } from './notifications/telegram.js';
import { marketScanner } from './ai/market-scanner.js';
import { profitabilityTracker } from './analytics/profitability-tracker.js';
import { createTriangleArbitrage } from './strategies/atomic-triangle.js';
import type { TriangleArbitrage } from './strategies/triangle-arbitrage.js';
import { multiHopArbitrage } from './strategies/multi-hop-arbitrage.js';
import { competitorTracker } from './monitoring/competitor-tracker.js';

// Create triangle arbitrage instance (atomic or standard based on config)
let triangleArbitrage: TriangleArbitrage;
import { JsonRpc } from '@proton/js';

const logger = getLogger();
const botStartTime = Date.now();

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

  // 5. Initialize XMD Treasury (if enabled)
  try {
    const xmdConfig = (config as any).xmdTreasury;
    if (xmdConfig?.enabled) {
      await xmdTreasury.initialize();
      logger.info('XMD Treasury initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize XMD Treasury:', error);
  }

  // 6. Initialize Telegram notifications (if enabled)
  try {
    const telegramConfig = (config as any).telegram;
    if (telegramConfig?.enabled) {
      telegramNotifier.initialize(telegramConfig);
      logger.info('Telegram notifications initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize Telegram notifications:', error);
  }

  // 6. Initialize AI Market Scanner
  try {
    const scannerConfig = (config as any).marketScanner;
    if (scannerConfig?.enabled) {
      await marketScanner.initialize();
      marketScanner.startScanning(
        scannerConfig.scanIntervalMs || 30000,
        scannerConfig.summaryIntervalMs || 300000
      );
      logger.info('AI Market Scanner initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize Market Scanner:', error);
  }

  // 7. Initialize Triangle Arbitrage (atomic or standard based on config)
  try {
    const triangleConfig = (config as any).triangleArbitrage;
    if (triangleConfig?.enabled) {
      // Create the appropriate instance (atomic or standard)
      triangleArbitrage = createTriangleArbitrage();
      await triangleArbitrage.start();
      logger.info('Triangle Arbitrage initialized');
    }
  } catch (error) {
    logger.warn('Failed to initialize Triangle Arbitrage:', error);
  }

  // 7b. Initialize Multi-Hop Arbitrage (METAL, LOAN bridges)
  try {
    const multiHopConfig = (config as any).multiHopArbitrage;
    if (multiHopConfig?.enabled) {
      await multiHopArbitrage.start();
      logger.info('Multi-Hop Arbitrage initialized (DRY RUN: ' + multiHopConfig.dryRun + ')');
    }
  } catch (error) {
    logger.warn('Failed to initialize Multi-Hop Arbitrage:', error);
  }

  // 7c. Initialize Competitor Tracker (monitors other arbitrageurs)
  try {
    await competitorTracker.start();
    logger.info('Competitor Tracker initialized - monitoring other arb bots');
  } catch (error) {
    logger.warn('Failed to initialize Competitor Tracker:', error);
  }

  // 8. Initialize DEX API
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
    case 'cross-venue-arbitrage':
      return (config as any).crossVenueArbitrage;
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

    // Print profitability report every analytics cycle
    const metrics = profitabilityTracker.getMetrics();
    if (metrics.totalTrades > 0) {
      logger.info('--- Profitability Metrics ---');
      logger.info(`Trades: ${metrics.successfulTrades}/${metrics.totalTrades} (${(metrics.winRate * 100).toFixed(1)}% win rate)`);
      logger.info(`Expected P&L: $${metrics.totalExpectedProfitUsd.toFixed(4)}`);
      logger.info(`Actual P&L: $${metrics.totalActualProfitUsd.toFixed(4)} (${(metrics.profitAccuracy * 100).toFixed(0)}% accuracy)`);
      logger.info(`Avg Slippage: ${metrics.avgSlippageBps.toFixed(1)} BPS | Max: ${metrics.maxSlippageBps.toFixed(1)} BPS`);
      logger.info(`Execution Quality: ${(metrics.avgExecutionQuality * 100).toFixed(0)}%`);
      logger.info(`Profit/Hour: $${metrics.profitPerHour.toFixed(4)} | Trades/Hour: ${metrics.tradesPerHour.toFixed(2)}`);
    }
  } catch (error) {
    logger.error('Analytics loop error:', error);
  }

  // Run analytics every 5 minutes
  await delay(300000);
  analyticsLoop();
}

/**
 * Get current portfolio balances and status
 */
async function getPortfolioStatus(): Promise<{
  balances: { token: string; amount: number; valueUSD: number; price?: number }[];
  totalValueUSD: number;
  ammPrice: number;
}> {
  const rpcEndpoints = (config as any).rpc?.endpoints || ['https://proton.eosusa.io'];
  const rpc = new JsonRpc(rpcEndpoints);
  const username = process.env.PROTON_USERNAME || '';

  const [xprRes, xtokensRes, xmdRes, loanRes, poolsRes] = await Promise.all([
    rpc.get_table_rows({ code: 'eosio.token', scope: username, table: 'accounts', limit: 10, json: true }),
    rpc.get_table_rows({ code: 'xtokens', scope: username, table: 'accounts', limit: 20, json: true }),
    rpc.get_table_rows({ code: 'xmd.token', scope: username, table: 'accounts', limit: 10, json: true }),
    rpc.get_table_rows({ code: 'loan.token', scope: username, table: 'accounts', limit: 10, json: true }),
    rpc.get_table_rows({ code: 'proton.swaps', scope: 'proton.swaps', table: 'pools', limit: 100, json: true })
  ]);

  let xpr = 0, xusdc = 0, xmd = 0, loan = 0, metal = 0;
  for (const row of xprRes.rows) { if (row.balance?.includes('XPR')) xpr = parseFloat(row.balance); }
  for (const row of xtokensRes.rows) {
    if (row.balance?.includes('XUSDC')) xusdc = parseFloat(row.balance);
    if (row.balance?.includes('METAL')) metal = parseFloat(row.balance);
  }
  for (const row of xmdRes.rows) { if (row.balance?.includes('XMD')) xmd = parseFloat(row.balance); }
  for (const row of loanRes.rows) { if (row.balance?.includes('LOAN')) loan = parseFloat(row.balance); }

  // Get XPR price from XPRUSDC pool
  const xprusdc = poolsRes.rows.find((p: any) => p.lt_symbol.includes('XPRUSDC'));
  const ammPrice = xprusdc ? parseFloat(xprusdc.pool2.quantity) / parseFloat(xprusdc.pool1.quantity) : 0;

  // Get LOAN price from XPRLOAN pool (LOAN per XPR, then convert to USD)
  const xprloan = poolsRes.rows.find((p: any) => p.lt_symbol.includes('XPRLOAN'));
  let loanPrice = 0;
  if (xprloan) {
    const xprInPool = parseFloat(xprloan.pool1.quantity);
    const loanInPool = parseFloat(xprloan.pool2.quantity);
    const loanPerXpr = loanInPool / xprInPool; // LOAN per 1 XPR
    loanPrice = ammPrice / loanPerXpr; // USD per LOAN
  }

  // Get METAL price from METAXPR pool
  const metaxpr = poolsRes.rows.find((p: any) => p.lt_symbol.includes('METAXPR'));
  let metalPrice = 0;
  if (metaxpr) {
    const metalInPool = parseFloat(metaxpr.pool1.quantity);
    const xprInPool = parseFloat(metaxpr.pool2.quantity);
    const xprPerMetal = xprInPool / metalInPool; // XPR per 1 METAL
    metalPrice = xprPerMetal * ammPrice; // USD per METAL
  }

  const xprValueUSD = xpr * ammPrice;
  const loanValueUSD = loan * loanPrice;
  const metalValueUSD = metal * metalPrice;
  const totalValueUSD = xusdc + xprValueUSD + xmd + loanValueUSD + metalValueUSD;

  return {
    balances: [
      { token: 'XUSDC', amount: xusdc, valueUSD: xusdc, price: 1.0 },
      { token: 'XPR', amount: xpr, valueUSD: xprValueUSD, price: ammPrice },
      { token: 'XMD', amount: xmd, valueUSD: xmd, price: 1.0 },
      { token: 'LOAN', amount: loan, valueUSD: loanValueUSD, price: loanPrice },
      { token: 'METAL', amount: metal, valueUSD: metalValueUSD, price: metalPrice }
    ],
    totalValueUSD,
    ammPrice
  };
}

/**
 * Send status report to Telegram
 */
async function sendTelegramStatus(): Promise<void> {
  if (!telegramNotifier.isReady()) return;

  try {
    const portfolio = await getPortfolioStatus();

    // Use fixed starting value from config
    const startingPortfolioValue = (config as any).tracking?.startingPortfolioUSD || portfolio.totalValueUSD;

    const pnlUSD = portfolio.totalValueUSD - startingPortfolioValue;
    const pnlPercent = startingPortfolioValue > 0 ? (pnlUSD / startingPortfolioValue) * 100 : 0;

    // Calculate uptime
    const uptimeMs = Date.now() - botStartTime;
    const uptimeHours = Math.floor(uptimeMs / 3600000);
    const uptimeMins = Math.floor((uptimeMs % 3600000) / 60000);
    const uptime = uptimeHours > 0 ? `${uptimeHours}h ${uptimeMins}m` : `${uptimeMins}m`;

    // Get active pairs from all configs
    const activePairs: string[] = [];

    // Triangle arbitrage pairs
    const triangleConfig = (config as any).triangleArbitrage;
    const trianglePairs = triangleConfig?.pairs
      ?.filter((p: any) => p.enabled)
      ?.map((p: any) => p.name) || [];
    activePairs.push(...trianglePairs);

    // Multi-hop arbitrage paths
    const multiHopConfig = (config as any).multiHopArbitrage;
    const multiHopPaths = multiHopConfig?.paths
      ?.filter((p: any) => p.enabled)
      ?.map((p: any) => p.name) || [];
    activePairs.push(...multiHopPaths);

    await telegramNotifier.sendStatusReport({
      balances: portfolio.balances,
      totalValueUSD: portfolio.totalValueUSD,
      startingValueUSD: startingPortfolioValue,
      pnlUSD,
      pnlPercent,
      activePairs: activePairs.length > 0 ? activePairs : ['None'],
      uptime,
      health: 'healthy',
      healthMessage: `XPR: $${portfolio.ammPrice.toFixed(6)}`
    });
  } catch (error) {
    logger.error('Failed to send Telegram status:', error);
  }
}

/**
 * Status reporting loop (hourly)
 */
async function statusReportLoop(): Promise<void> {
  if (isShuttingDown) return;

  try {
    await sendTelegramStatus();
  } catch (error) {
    logger.error('Status report error:', error);
  }

  // Run every hour
  await delay(3600000);
  statusReportLoop();
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

  // Stop market scanner
  try {
    marketScanner.stopScanning();
  } catch (e) {
    // Ignore
  }

  // Stop triangle arbitrage
  try {
    if (triangleArbitrage) {
      triangleArbitrage.stop();
    }
  } catch (e) {
    // Ignore
  }

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

    // Start Telegram status reporting
    logger.info('Starting Telegram status loop...');
    await sendTelegramStatus(); // Send initial status
    statusReportLoop();

    logger.info('Bot is now live and trading');

  } catch (error) {
    logger.error('Fatal error during startup:', error);
    await gracefulShutdown('startup-error');
  }
}

// Start the bot
await main();
