import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getLogger } from '../utils.js';

const logger = getLogger();

let db: Database.Database | null = null;

export interface DatabaseConfig {
  type: 'sqlite';
  path: string;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  type: 'sqlite',
  path: './data/dex-bot.db'
};

/**
 * Initialize the database connection and run migrations
 */
export function initializeDatabase(config: DatabaseConfig = DEFAULT_CONFIG): Database.Database {
  if (db) {
    return db;
  }

  // Ensure the data directory exists
  const dbDir = path.dirname(config.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info(`Initializing SQLite database at ${config.path}`);

  db = new Database(config.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  logger.info('Database initialized successfully');
  return db;
}

/**
 * Get the database instance (must call initializeDatabase first)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Run all database migrations
 */
function runMigrations(database: Database.Database): void {
  logger.info('Running database migrations...');

  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrations = [
    { name: '001_initial_schema', sql: migration001InitialSchema },
    { name: '002_arbitrage_tables', sql: migration002ArbitrageTables },
    { name: '003_analytics_tables', sql: migration003AnalyticsTables },
    { name: '004_risk_tables', sql: migration004RiskTables },
  ];

  const appliedMigrations = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];

  const appliedSet = new Set(appliedMigrations.map(m => m.name));

  for (const migration of migrations) {
    if (!appliedSet.has(migration.name)) {
      logger.info(`Applying migration: ${migration.name}`);
      database.exec(migration.sql);
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    }
  }

  logger.info('Migrations completed');
}

// Migration 001: Initial schema for orders and trades
const migration001InitialSchema = `
  -- Orders table: tracks all orders placed by the bot
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy TEXT NOT NULL,
    market_symbol TEXT NOT NULL,
    order_side TEXT NOT NULL CHECK (order_side IN ('BUY', 'SELL')),
    price REAL NOT NULL,
    quantity REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'FAILED')),
    dex_order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    filled_at DATETIME,
    filled_quantity REAL DEFAULT 0,
    average_fill_price REAL,
    fee REAL DEFAULT 0,
    error_message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders(strategy);
  CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_symbol);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_dex_id ON orders(dex_order_id);

  -- Trades table: tracks individual trade executions
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    strategy TEXT NOT NULL,
    market_symbol TEXT NOT NULL,
    trade_side TEXT NOT NULL CHECK (trade_side IN ('BUY', 'SELL')),
    price REAL NOT NULL,
    quantity REAL NOT NULL,
    total REAL NOT NULL,
    fee REAL DEFAULT 0,
    fee_token TEXT,
    realized_pnl REAL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_trades_order ON trades(order_id);
  CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
  CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_symbol);
  CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades(executed_at);
`;

// Migration 002: Arbitrage-specific tables
const migration002ArbitrageTables = `
  -- Arbitrage opportunities table
  CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_symbol TEXT NOT NULL,
    amm_price REAL NOT NULL,
    dex_bid REAL NOT NULL,
    dex_ask REAL NOT NULL,
    spread_bps REAL NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('AMM_TO_DEX', 'DEX_TO_AMM')),
    potential_profit REAL NOT NULL,
    trade_size REAL,
    executed INTEGER DEFAULT 0,
    execution_profit REAL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_arb_pool ON arbitrage_opportunities(pool_symbol);
  CREATE INDEX IF NOT EXISTS idx_arb_detected ON arbitrage_opportunities(detected_at);
  CREATE INDEX IF NOT EXISTS idx_arb_executed ON arbitrage_opportunities(executed);

  -- AMM pool snapshots for analysis
  CREATE TABLE IF NOT EXISTS amm_pool_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_symbol TEXT NOT NULL,
    reserve1 REAL NOT NULL,
    reserve2 REAL NOT NULL,
    token1_symbol TEXT NOT NULL,
    token2_symbol TEXT NOT NULL,
    liquidity_usd REAL,
    price REAL NOT NULL,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_pool_symbol ON amm_pool_snapshots(pool_symbol);
  CREATE INDEX IF NOT EXISTS idx_pool_captured ON amm_pool_snapshots(captured_at);
`;

// Migration 003: Analytics and P&L tables
const migration003AnalyticsTables = `
  -- Daily P&L snapshots
  CREATE TABLE IF NOT EXISTS daily_pnl (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    strategy TEXT NOT NULL,
    realized_pnl REAL DEFAULT 0,
    unrealized_pnl REAL DEFAULT 0,
    fees_paid REAL DEFAULT 0,
    trades_count INTEGER DEFAULT 0,
    volume REAL DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    max_drawdown REAL DEFAULT 0,
    UNIQUE(date, strategy)
  );

  CREATE INDEX IF NOT EXISTS idx_daily_pnl_date ON daily_pnl(date);
  CREATE INDEX IF NOT EXISTS idx_daily_pnl_strategy ON daily_pnl(strategy);

  -- Position snapshots for tracking
  CREATE TABLE IF NOT EXISTS position_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy TEXT NOT NULL,
    market_symbol TEXT NOT NULL,
    position_size REAL NOT NULL,
    average_entry_price REAL NOT NULL,
    current_price REAL NOT NULL,
    unrealized_pnl REAL NOT NULL,
    position_value_usd REAL NOT NULL,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_pos_strategy ON position_snapshots(strategy);
  CREATE INDEX IF NOT EXISTS idx_pos_captured ON position_snapshots(captured_at);

  -- Strategy performance metrics
  CREATE TABLE IF NOT EXISTS strategy_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME')),
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(strategy, metric_name, period, calculated_at)
  );

  CREATE INDEX IF NOT EXISTS idx_metrics_strategy ON strategy_metrics(strategy);
  CREATE INDEX IF NOT EXISTS idx_metrics_name ON strategy_metrics(metric_name);
`;

// Migration 004: Risk management tables
const migration004RiskTables = `
  -- Risk events log
  CREATE TABLE IF NOT EXISTS risk_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN ('POSITION_LIMIT', 'EXPOSURE_LIMIT', 'DRAWDOWN_ALERT', 'CIRCUIT_BREAKER', 'DAILY_LOSS_LIMIT', 'KILL_SWITCH')),
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    strategy TEXT,
    market_symbol TEXT,
    threshold_value REAL,
    actual_value REAL,
    action_taken TEXT,
    message TEXT NOT NULL,
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_risk_type ON risk_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_risk_severity ON risk_events(severity);
  CREATE INDEX IF NOT EXISTS idx_risk_occurred ON risk_events(occurred_at);

  -- Circuit breaker state
  CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy TEXT NOT NULL UNIQUE,
    is_triggered INTEGER DEFAULT 0,
    triggered_at DATETIME,
    trigger_reason TEXT,
    reset_at DATETIME,
    consecutive_losses INTEGER DEFAULT 0,
    drawdown_percent REAL DEFAULT 0
  );

  -- Exposure history for tracking
  CREATE TABLE IF NOT EXISTS exposure_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy TEXT NOT NULL,
    total_exposure_usd REAL NOT NULL,
    long_exposure_usd REAL DEFAULT 0,
    short_exposure_usd REAL DEFAULT 0,
    max_single_position_usd REAL DEFAULT 0,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_exposure_strategy ON exposure_history(strategy);
  CREATE INDEX IF NOT EXISTS idx_exposure_captured ON exposure_history(captured_at);
`;

// Utility function to get current date in YYYY-MM-DD format
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Utility function to get current timestamp in SQLite format
export function getCurrentTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
