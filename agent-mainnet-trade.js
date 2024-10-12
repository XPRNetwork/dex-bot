// agent-mainnet-trade.js

// Import necessary modules
import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import process, { argv } from 'process';
import { fileURLToPath } from 'url';
import BigNumber from 'bignumber.js';
import fetch from 'node-fetch';

// Handle __dirname and __filename in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// ***** Configuration *****

// Your Proton account username
const USERNAME = process.env.PROTON_USERNAME;

// Your Proton private key
const PRIVATE_KEY = process.env.PROTON_PRIVATE_KEY;

// OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Telegram Bot API Key and Chat ID
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Maximum trade size (default 10.0000 XMD)
const MAX_TRADE_SIZE = parseFloat(process.env.MAX_TRADE_SIZE || '10.0');

// Maximum number of orders per market (default 1)
const MAX_ORDERS_PER_MARKET = parseInt(process.env.MAX_ORDERS_PER_MARKET || '1', 10);

// Markets to avoid (default [])
const MARKETS_TO_AVOID = process.env.MARKETS_TO_AVOID
  ? process.env.MARKETS_TO_AVOID.split(',')
  : [];

// Allowed markets to trade
const ALLOWED_MARKETS = [
  'XBTC_XMD',
  'XETH_XMD',
  'XPR_XMD',
  'XMT_XMD',
  'XDOGE_XMD',
  'XXRP_XMD',
  'METAL_XMD',
  'XLTC_XMD',
];

// Map market symbols to CoinGecko coin IDs
const marketToCoinGeckoId = {
  'XBTC_XMD': 'bitcoin',
  'XETH_XMD': 'ethereum',
  'XPR_XMD': 'proton',
  'XMT_XMD': 'metal',
  'XDOGE_XMD': 'dogecoin',
  'XXRP_XMD': 'ripple',
  'METAL_XMD': 'metal-blockchain',
  'XLTC_XMD': 'litecoin',
};

// Proton RPC endpoints
const ENDPOINTS = ['https://proton.eoscafeblock.com'];

// Delay between agent wake-ups in seconds (default 180)
const AGENT_DELAY = parseInt(process.env.AGENT_DELAY || '180', 10);

// *************************

// Check if all required environment variables are set
if (!USERNAME || !PRIVATE_KEY || !OPENAI_API_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(
    'Please set the PROTON_USERNAME, PROTON_PRIVATE_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, and TELEGRAM_CHAT_ID environment variables.'
  );
  process.exit(1);
}

// Parse command-line arguments
let autoMode = false;
let delaySeconds = AGENT_DELAY;

argv.forEach((arg, index) => {
  if (arg === '--auto') {
    autoMode = true;
  } else if (arg === '--delay') {
    const delayArg = argv[index + 1];
    if (delayArg && !isNaN(Number(delayArg))) {
      delaySeconds = parseInt(delayArg, 10);
    } else {
      console.error('Invalid or missing value for --delay. Please provide the delay in seconds.');
      process.exit(1);
    }
  }
});

// Initialize Proton API
const rpc = new JsonRpc(ENDPOINTS[0]);
const signatureProvider = new JsSignatureProvider([PRIVATE_KEY]);
const api = new Api({
  rpc,
  signatureProvider,
});

// Initialize SQLite Database
let db;

// Logging levels
const LogLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
};

// Function to log messages to console, file, and database
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  // Console
  console.log(logMessage);

  // File
  fs.appendFileSync('agent.log', logMessage + '\n');

  // Database
  if (db) {
    db.run('INSERT INTO logs (timestamp, level, message) VALUES (?, ?, ?)', [timestamp, level, message]);
  }
}

// Function to send Telegram notifications
async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log(LogLevel.ERROR, `Failed to send Telegram message: ${error.message}`);
  }
}

// Function to initialize the database
async function initializeDatabase() {
  db = await open({
    filename: path.join(__dirname, 'agent.db'),
    driver: sqlite3.Database,
  });

  // Check and update database schema
  await db.exec(`
    PRAGMA foreign_keys = ON;
  `);

  // Create or update tables as needed
  await db.exec(`
    CREATE TABLE IF NOT EXISTS market_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      market_id INTEGER,
      symbol TEXT,
      volume_bid REAL,
      volume_ask REAL,
      open REAL,
      close REAL,
      high REAL,
      low REAL,
      change_percentage REAL
    );

    CREATE TABLE IF NOT EXISTS fear_and_greed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      value INTEGER,
      value_classification TEXT,
      time_until_update INTEGER
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      action TEXT,
      market TEXT,
      price REAL,
      amount REAL,
      total_cost REAL,
      reason TEXT,
      success BOOLEAN,
      closing_trade_id INTEGER,
      profit_loss REAL,
      percentage_change REAL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      level TEXT,
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      token_code TEXT,
      balance REAL
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      open_trade_id INTEGER,
      close_trade_id INTEGER,
      market TEXT,
      amount REAL,
      open_price REAL,
      close_price REAL,
      profit_loss REAL,
      percentage_change REAL,
      FOREIGN KEY (open_trade_id) REFERENCES trades(id),
      FOREIGN KEY (close_trade_id) REFERENCES trades(id)
    );

    CREATE TABLE IF NOT EXISTS historical_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_symbol TEXT,
      timestamp DATETIME,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL
    );

    CREATE TABLE IF NOT EXISTS historical_data_fetch_times (
      market_symbol TEXT PRIMARY KEY,
      last_fetch_time INTEGER
    );
  `);

  // Perform any necessary schema updates
  await performSchemaUpdates();
}

// Function to perform schema updates if needed
async function performSchemaUpdates() {
  // Example: Add new columns to existing tables if they don't exist
  const tableColumns = {
    trades: ['total_cost', 'closing_trade_id', 'profit_loss', 'percentage_change'],
    positions: [
      'id',
      'open_trade_id',
      'close_trade_id',
      'market',
      'amount',
      'open_price',
      'close_price',
      'profit_loss',
      'percentage_change',
    ],
    balances: ['token_code', 'balance'],
    historical_data_fetch_times: ['market_symbol', 'last_fetch_time'],
  };

  for (const [tableName, columns] of Object.entries(tableColumns)) {
    for (const column of columns) {
      try {
        await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${column}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          // Column already exists, continue
          continue;
        } else {
          log(LogLevel.ERROR, `Failed to update schema for table ${tableName}: ${error.message}`);
        }
      }
    }
  }

  // Ensure 'market_symbol' column exists in 'historical_prices' table
  const columns = await db.all(`PRAGMA table_info(historical_prices)`);
  const hasMarketSymbol = columns.some(column => column.name === 'market_symbol');

  if (!hasMarketSymbol) {
    await db.run(`ALTER TABLE historical_prices ADD COLUMN market_symbol TEXT`);
  }
}

// Function to fetch market data and store in database
async function fetchAndStoreMarketData() {
  try {
    const response = await fetch('https://dex.api.mainnet.metalx.com/dex/v1/trades/daily');
    const data = await response.json();

    if (data && data.data) {
      const stmt = await db.prepare(`
        INSERT INTO market_data (market_id, symbol, volume_bid, volume_ask, open, close, high, low, change_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const market of data.data) {
        await stmt.run(
          market.market_id,
          market.symbol,
          market.volume_bid,
          market.volume_ask,
          market.open,
          market.close,
          market.high,
          market.low,
          market.change_percentage
        );
      }

      await stmt.finalize();
      log(LogLevel.INFO, 'Market data fetched and stored successfully.');
    } else {
      log(LogLevel.WARNING, 'No market data received.');
    }
  } catch (error) {
    log(LogLevel.ERROR, `Failed to fetch market data: ${error.message}`);
  }
}

// Function to fetch Fear and Greed Index and store in database
async function fetchAndStoreFearAndGreed() {
  try {
    const response = await fetch('https://api.alternative.me/fng/');
    const data = await response.json();

    if (data && data.data && data.data.length > 0) {
      const fearData = data.data[0];
      await db.run(
        `
        INSERT INTO fear_and_greed (value, value_classification, time_until_update)
        VALUES (?, ?, ?)
      `,
        [
          parseInt(fearData.value, 10),
          fearData.value_classification,
          fearData.time_until_update ? parseInt(fearData.time_until_update, 10) : null,
        ]
      );

      log(LogLevel.INFO, 'Fear and Greed Index data fetched and stored successfully.');
    } else {
      log(LogLevel.WARNING, 'No Fear and Greed Index data received.');
    }
  } catch (error) {
    log(LogLevel.ERROR, `Failed to fetch Fear and Greed Index data: ${error.message}`);
  }
}

// Function to fetch balances and store in database using the Metal X API
async function fetchAndStoreBalances() {
  try {
    const url = `https://dex.api.mainnet.metalx.com/dex/v1/account/balances?account=${USERNAME}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.data) {
      // Clear existing balances
      await db.run(`DELETE FROM balances`);

      // Insert new balances
      const insertStmt = await db.prepare(`INSERT INTO balances (token_code, balance) VALUES (?, ?)`);
      for (const balance of data.data) {
        await insertStmt.run(balance.currency, balance.amount);
      }
      await insertStmt.finalize();

      log(LogLevel.INFO, `Balances fetched and stored successfully.`);
    } else {
      log(LogLevel.WARNING, 'No balances data received.');
    }
  } catch (error) {
    log(LogLevel.ERROR, `Failed to fetch balances: ${error.message}`);
  }
}

// Function to delay execution for a given number of milliseconds
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to fetch and store historical market data from CoinGecko
async function fetchAndStoreHistoricalData() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 24 * 60 * 60; // Last 24 hours

    for (const [marketSymbol, coinId] of Object.entries(marketToCoinGeckoId)) {
      // Only proceed if the market is in our allowed markets
      if (!ALLOWED_MARKETS.includes(marketSymbol)) {
        continue;
      }

      // Check when historical data was last fetched for this market
      const lastFetchRow = await db.get(
        `SELECT last_fetch_time FROM historical_data_fetch_times WHERE market_symbol = ?`,
        [marketSymbol]
      );

      const currentTime = Date.now();
      const oneHourInMs = 60 * 60 * 1000;

      if (lastFetchRow && currentTime - lastFetchRow.last_fetch_time < oneHourInMs) {
        log(LogLevel.INFO, `Historical data for market ${marketSymbol} was fetched less than an hour ago. Skipping.`);
        continue;
      }

      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${oneDayAgo}&to=${now}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.prices) {
        const stmt = await db.prepare(`
          INSERT INTO historical_prices (market_symbol, timestamp, open, high, low, close, volume)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // Only take every nth data point to reduce data size
        const interval = Math.ceil(data.prices.length / 24); // Approximate to 24 data points
        for (let i = 0; i < data.prices.length; i += interval) {
          const [timestamp, price] = data.prices[i];
          const date = new Date(timestamp);
          await stmt.run(
            marketSymbol,
            date.toISOString(),
            price, // open
            price, // high (placeholder)
            price, // low (placeholder)
            price, // close
            null   // volume (not provided)
          );
        }

        await stmt.finalize();
        log(LogLevel.INFO, `Historical data for market ${marketSymbol} fetched and stored successfully.`);

        // Update the last fetch time
        await db.run(
          `INSERT OR REPLACE INTO historical_data_fetch_times (market_symbol, last_fetch_time) VALUES (?, ?)`,
          [marketSymbol, currentTime]
        );
      } else {
        log(LogLevel.WARNING, `No historical data received for market ${marketSymbol}.`);
      }

      // Wait for 10 seconds to avoid rate limiting
      await delay(20000);
    }
  } catch (error) {
    log(LogLevel.ERROR, `Failed to fetch historical data: ${error.message}`);
  }
}

// Function to get the latest data from the database
async function getLatestData() {
  // Get the latest market data (limit to the top 5 entries)
  const marketData = await db.all(
    `SELECT * FROM market_data ORDER BY timestamp DESC LIMIT 5`
  );

  // Get the latest fear and greed index
  const fearAndGreed = await db.get(
    `SELECT * FROM fear_and_greed ORDER BY timestamp DESC LIMIT 1`
  );

  // Get the latest balances
  const balances = await db.all(
    `SELECT * FROM balances ORDER BY timestamp DESC`
  );

  // Get recent trades (limit to the last 5 trades)
  const trades = await db.all(
    `SELECT * FROM trades ORDER BY timestamp DESC LIMIT 5`
  );

  // Get summarized historical prices
  const historicalData = {};

  for (const marketSymbol of ALLOWED_MARKETS) {
    const prices = await db.all(
      `SELECT * FROM historical_prices WHERE market_symbol = ? ORDER BY timestamp DESC LIMIT 24`,
      [marketSymbol]
    );

    if (prices.length > 0) {
      const closingPrices = prices.map(p => p.close);
      const averagePrice = closingPrices.reduce((a, b) => a + b, 0) / closingPrices.length;
      const latestPrice = closingPrices[0];
      const priceChange = ((latestPrice - closingPrices[closingPrices.length - 1]) / closingPrices[closingPrices.length - 1]) * 100;

      historicalData[marketSymbol] = {
        averagePrice: averagePrice.toFixed(4),
        latestPrice: latestPrice.toFixed(4),
        priceChange: priceChange.toFixed(2),
      };
    }
  }

  return {
    marketData,
    fearAndGreed,
    balances,
    trades,
    historicalData,
  };
}

async function getAIDecision() {
  log(LogLevel.INFO, 'Fetching AI decision...');

  // Get the latest data
  const data = await getLatestData();

  // Prepare the data as a JSON string
  const dataString = JSON.stringify(data, null, 2);

  const prompt = `Based on the following data, decide which orders to place to maximize XMD holdings. Analyze the historical price trends to inform your decision.

  Data:
  ${dataString}
  
  Constraints:
  - The maximum trade size is ${MAX_TRADE_SIZE} XMD (total trade value in XMD).
  - Do not suggest trades where the total value exceeds this amount.
  - Ensure the suggested amount does not exceed the available balance.
  - The minimum order size is 1.0 XMD.
  - You can trade in any available market listed in the data.
  - All amounts should be in the correct decimal format for the respective tokens.
  - Use the token precision provided in the market data when calculating amounts.
  - Important: Market symbols are in the format BASE_QUOTE (e.g., XPR_XMD).
    - "Buy" action means buying the BASE asset using the QUOTE asset.
    - "Sell" action means selling the BASE asset to receive the QUOTE asset.
  - Since our goal is to maximize XMD holdings, suggest actions that result in increasing XMD balance.
  
  Provide your decision in the following format:
  
  Action: <buy/sell>
  Market: <market_symbol>
  Price: <price>
  Amount: <amount of BASE asset>
  Reason: <brief_reason>
  
  Do not include any additional text.`;
  

  // Call the OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Use 'gpt-4o' as requested
      messages: [
        {
          role: 'system',
          content:
            'You are an AI trading assistant that makes trading decisions to maximize XMD holdings. Use the provided data to make informed decisions within the given constraints.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      n: 1,
      stop: null,
      temperature: 0.5,
    }),
  });

  const responseData = await response.json();

  if (responseData.error) {
    throw new Error(`OpenAI API error: ${responseData.error.message}`);
  }

  const aiResponse = responseData.choices[0].message.content.trim();
  log(LogLevel.INFO, `AI Decision:\n${aiResponse}`);

  return aiResponse;
}

// Function to parse AI decision
function parseAIDecision(aiResponse) {
  const actions = [];
  const actionBlocks = aiResponse.split(/Action:/i).slice(1); // Split the response into blocks for each action

  for (const block of actionBlocks) {
    const actionMatch = block.match(/^\s*(buy|sell)/i);
    const marketMatch = block.match(/Market:\s*([\w_]+)/);
    const priceMatch = block.match(/Price:\s*(\d+(\.\d+)?)/);
    const amountMatch = block.match(/Amount:\s*(\d+(\.\d+)?)/);
    const reasonMatch = block.match(/Reason:\s*(.+)/);

    if (actionMatch && marketMatch && priceMatch && amountMatch && reasonMatch) {
      actions.push({
        action: actionMatch[1].toLowerCase(),
        market: marketMatch[1],
        price: parseFloat(priceMatch[1]),
        amount: parseFloat(amountMatch[1]),
        reason: reasonMatch[1].trim(),
      });
    } else {
      log(LogLevel.WARNING, 'Failed to parse one of the AI actions.');
    }
  }

  if (actions.length > 0) {
    return actions;
  } else {
    log(LogLevel.ERROR, 'Failed to parse AI decision.');
    return null;
  }
}

// Function to get market details
async function getMarketDetails(marketSymbol) {
  try {
    const response = await fetch('https://dex.api.mainnet.metalx.com/dex/v1/markets/all');
    const data = await response.json();

    if (data && data.data) {
      const market = data.data.find((m) => m.symbol === marketSymbol);
      if (market) {
        return market;
      } else {
        log(LogLevel.ERROR, `Market ${marketSymbol} not found.`);
        return null;
      }
    } else {
      log(LogLevel.WARNING, 'No market data received.');
      return null;
    }
  } catch (error) {
    log(LogLevel.ERROR, `Failed to fetch market details: ${error.message}`);
    return null;
  }
}

// Function to fetch open orders for a specific market
async function fetchOpenOrders(marketId) {
  try {
    const url = `https://dex.api.mainnet.metalx.com/dex/v1/account/orders?account=${USERNAME}&market_id=${marketId}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.data) {
      return data.data; // Return array of open orders
    } else {
      log(LogLevel.WARNING, 'No open orders data received.');
      return [];
    }
  } catch (error) {
    log(LogLevel.ERROR, `Failed to fetch open orders: ${error.message}`);
    return [];
  }
}

// Define constants used in order placement
const ORDERSIDES = {
  BUY: 1,
  SELL: 2,
};

const ORDERTYPES = {
  LIMIT: 1,
  MARKET: 2,
};

const FILLTYPES = {
  GTC: 0,
  FOK: 1,
  IOC: 2,
};

// Function to execute trade based on AI decision
async function executeTrade(decision) {
    // Validate the decision
    if (!ALLOWED_MARKETS.includes(decision.market)) {
      log(LogLevel.WARNING, `Market ${decision.market} is not in the allowed list.`);
      return;
    }
  
    if (MARKETS_TO_AVOID.includes(decision.market)) {
      log(LogLevel.WARNING, `Market ${decision.market} is in the avoid list.`);
      return;
    }
  
    // Fetch the latest balances
    await fetchAndStoreBalances();
  
    // Get market details
    const marketDetails = await getMarketDetails(decision.market);
    if (!marketDetails) {
      log(LogLevel.ERROR, `Market ${decision.market} not found.`);
      return;
    }
  
    // Check for existing open orders in this market
    const openOrders = await fetchOpenOrders(marketDetails.market_id);
    if (openOrders.length >= MAX_ORDERS_PER_MARKET) {
      log(LogLevel.INFO, `Already have an open order in market ${decision.market}. Skipping new order.`);
      return;
    }
  
    // Fetch balances for base and quote assets
    const baseToken = marketDetails.bid_token;
    const quoteToken = marketDetails.ask_token;
  
    const baseTokenCode = baseToken.code;
    const quoteTokenCode = quoteToken.code;
  
    const baseTokenBalanceRow = await db.get(
      `SELECT balance FROM balances WHERE token_code = ? ORDER BY timestamp DESC LIMIT 1`,
      [baseTokenCode]
    );
    const quoteTokenBalanceRow = await db.get(
      `SELECT balance FROM balances WHERE token_code = ? ORDER BY timestamp DESC LIMIT 1`,
      [quoteTokenCode]
    );
  
    const baseTokenBalance = baseTokenBalanceRow ? parseFloat(baseTokenBalanceRow.balance) : 0.0;
    const quoteTokenBalance = quoteTokenBalanceRow ? parseFloat(quoteTokenBalanceRow.balance) : 0.0;
  
    // Calculate total cost for buy and sell actions
    let totalCost = decision.amount * decision.price;
  
    // Check if the total trade value exceeds the maximum trade size
    if (totalCost > MAX_TRADE_SIZE) {
      // Adjust the amount downwards to meet MAX_TRADE_SIZE
      decision.amount = Math.floor((MAX_TRADE_SIZE / decision.price) * 10 ** baseToken.precision) / 10 ** baseToken.precision;
      totalCost = decision.amount * decision.price;
      log(LogLevel.INFO, `Adjusted trade amount to ${decision.amount.toFixed(baseToken.precision)} to meet MAX_TRADE_SIZE.`);
    }
  
    // Check if the trade amount exceeds the available balance
    if (decision.action === 'buy' && totalCost > quoteTokenBalance) {
      log(LogLevel.WARNING, `Insufficient ${quoteTokenCode} balance for the trade.`);
      return;
    }
  
    if (decision.action === 'sell' && decision.amount > baseTokenBalance) {
      log(LogLevel.WARNING, `Insufficient ${baseTokenCode} balance for the trade.`);
      return;
    }
  
    // Ensure minimum order size is met (1.0 XMD)
    if (totalCost < 1.0) {
      log(LogLevel.WARNING, `Trade total (${totalCost.toFixed(4)} XMD) is below the minimum order size of 1.0 XMD.`);
      return;
    }

  // Prepare the transaction
  const dexContract = 'dex'; // DEX contract account
  const tokenContract = decision.action === 'sell' ? baseToken.contract : quoteToken.contract;
  const tokenCode = decision.action === 'sell' ? baseToken.code : quoteToken.code;
  const tokenPrecision = decision.action === 'sell' ? baseToken.precision : quoteToken.precision;
  const tokenMultiplier = decision.action === 'sell' ? baseToken.multiplier : quoteToken.multiplier;

  const quantity = parseFloat(decision.action === 'sell' ? decision.amount : totalCost).toFixed(tokenPrecision);
  const quantityText = `${quantity} ${tokenCode}`;

  // Normalize quantity and price
  const bnQuantity = new BigNumber(decision.action === 'sell' ? decision.amount : totalCost);
  const quantityNormalized = bnQuantity.multipliedBy(tokenMultiplier).toFixed(0);

  const priceMultiplier = quoteToken.multiplier;
  const cPrice = new BigNumber(decision.price);
  const priceNormalized = cPrice.multipliedBy(priceMultiplier).toFixed(0);

  const orderSide = decision.action === 'buy' ? ORDERSIDES.BUY : ORDERSIDES.SELL;

  const bidSymbol = {
    sym: `${baseToken.precision},${baseToken.code}`,
    contract: baseToken.contract,
  };

  const askSymbol = {
    sym: `${quoteToken.precision},${quoteToken.code}`,
    contract: quoteToken.contract,
  };

  const actions = [
    // Transfer action
    {
      account: tokenContract,
      name: 'transfer',
      authorization: [
        {
          actor: USERNAME,
          permission: 'active',
        },
      ],
      data: {
        from: USERNAME,
        to: dexContract,
        quantity: quantityText,
        memo: '',
      },
    },
    // Place order action
    {
      account: dexContract,
      name: 'placeorder',
      authorization: [
        {
          actor: USERNAME,
          permission: 'active',
        },
      ],
      data: {
        market_id: marketDetails.market_id,
        account: USERNAME,
        order_type: ORDERTYPES.LIMIT,
        order_side: orderSide,
        fill_type: FILLTYPES.GTC,
        bid_symbol: bidSymbol,
        ask_symbol: askSymbol,
        referrer: '',
        quantity: quantityNormalized,
        price: priceNormalized,
        trigger_price: '0',
      },
    },
    // Process action
    {
      account: dexContract,
      name: 'process',
      authorization: [
        {
          actor: USERNAME,
          permission: 'active',
        },
      ],
      data: {
        q_size: 60,
        show_error_msg: 0,
      },
    },
    // Withdraw all action
    {
      account: dexContract,
      name: 'withdrawall',
      authorization: [
        {
          actor: USERNAME,
          permission: 'active',
        },
      ],
      data: {
        account: USERNAME,
      },
    },
  ];

  // Log the action being attempted
  log(
    LogLevel.INFO,
    `Attempting to execute trade: ${JSON.stringify(actions, null, 2)}`
  );

  try {
    const result = await api.transact(
      { actions },
      {
        blocksBehind: 300,
        expireSeconds: 3000,
      }
    );

    log(LogLevel.INFO, `Trade executed successfully: ${result.transaction_id}`);

    // Insert the trade into the trades table
    const dbResult = await db.run(
      `INSERT INTO trades (action, market, price, amount, total_cost, reason, success) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        decision.action,
        decision.market,
        decision.price,
        decision.amount,
        totalCost,
        decision.reason,
        1,
      ]
    );

    const tradeId = dbResult.lastID;

    // Position tracking
    if (decision.action === 'sell') {
      // Open a new position (since we're selling base asset to get XMD)
      await db.run(
        `INSERT INTO positions (open_trade_id, market, amount, open_price) VALUES (?, ?, ?, ?)`,
        [tradeId, decision.market, decision.amount, decision.price]
      );
    } else if (decision.action === 'buy') {
      // Close existing position
      const openPosition = await db.get(
        `SELECT * FROM positions WHERE market = ? AND close_trade_id IS NULL ORDER BY id ASC LIMIT 1`,
        [decision.market]
      );

      if (openPosition) {
        const profitLoss = (openPosition.open_price - decision.price) * decision.amount;
        const percentageChange = ((openPosition.open_price - decision.price) / openPosition.open_price) * 100;

        // Update the position
        await db.run(
          `UPDATE positions SET close_trade_id = ?, close_price = ?, profit_loss = ?, percentage_change = ? WHERE id = ?`,
          [tradeId, decision.price, profitLoss, percentageChange, openPosition.id]
        );

        // Update the trades table with profit/loss info
        await db.run(
          `UPDATE trades SET closing_trade_id = ?, profit_loss = ?, percentage_change = ? WHERE id = ?`,
          [tradeId, profitLoss, percentageChange, tradeId]
        );

        // Send detailed trade summary to Telegram
        const message = `
Trade Closed:
Market: ${decision.market}
Amount: ${decision.amount}
Open Price: ${openPosition.open_price}
Close Price: ${decision.price}
Profit/Loss: ${profitLoss.toFixed(4)}
Percentage Change: ${percentageChange.toFixed(2)}%
`;
        sendTelegramMessage(message);
      } else {
        log(LogLevel.WARNING, `No open position found to close in market ${decision.market}.`);
      }
    }

    sendTelegramMessage(
      `Trade executed: ${decision.action.toUpperCase()} ${decision.amount} ${baseTokenCode} in ${decision.market} at ${decision.price}.`
    );

  } catch (error) {
    let errorMessage = error.message;
    if (error.json && error.json.error && error.json.error.details) {
      const details = error.json.error.details.map((d) => d.message).join('\n');
      errorMessage = details;
    }
    log(LogLevel.ERROR, `Trade execution failed: ${errorMessage}`);
    sendTelegramMessage(
      `Trade failed: ${decision.action.toUpperCase()} ${decision.amount} ${baseTokenCode} in ${decision.market} at ${decision.price}. Error: ${errorMessage}`
    );
    await db.run(
      `INSERT INTO trades (action, market, price, amount, reason, success) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        decision.action,
        decision.market,
        decision.price,
        decision.amount,
        decision.reason,
        0,
      ]
    );
  }
}

// Function to execute the agent's main logic
async function executeAgent() {
  try {
    // Fetch and store data every 10 minutes
    const lastMarketDataFetch = await db.get(
      `SELECT MAX(timestamp) as lastFetch FROM market_data`
    );
    const lastFGIFetch = await db.get(
      `SELECT MAX(timestamp) as lastFetch FROM fear_and_greed`
    );
    const now = Date.now();

    if (
      !lastMarketDataFetch ||
      now - new Date(lastMarketDataFetch.lastFetch).getTime() > 10 * 60 * 1000
    ) {
      await fetchAndStoreMarketData();
    }

    if (!lastFGIFetch || now - new Date(lastFGIFetch.lastFetch).getTime() > 10 * 60 * 1000) {
      await fetchAndStoreFearAndGreed();
    }

    // Fetch and store balances
    await fetchAndStoreBalances();

    // Fetch and store historical data
    await fetchAndStoreHistoricalData();

    // Get AI decision
    const aiResponse = await getAIDecision();
    const decisions = parseAIDecision(aiResponse);

    if (!decisions) {
      return;
    }

    for (const decision of decisions) {
      if (autoMode) {
        log(LogLevel.INFO, 'Auto mode enabled. Proceeding to execute trade.');
        await executeTrade(decision);
      } else {
        // Prompt for confirmation
        const confirmation = await promptInput(
          `Do you want to execute the following trade?\nAction: ${decision.action.toUpperCase()}\nMarket: ${decision.market}\nPrice: ${decision.price}\nAmount: ${decision.amount}\nReason: ${decision.reason}\n(yes/no): `
        );
        if (confirmation.toLowerCase() === 'yes') {
          await executeTrade(decision);
        } else {
          log(LogLevel.INFO, 'Trade cancelled by user.');
          await db.run(
            `INSERT INTO trades (action, market, price, amount, reason, success) VALUES (?, ?, ?, ?, ?, ?)`,
            [decision.action, decision.market, decision.price, decision.amount, decision.reason, 0]
          );
        }
      }
    }
  } catch (error) {
    log(LogLevel.ERROR, `An error occurred: ${error.message}`);
    sendTelegramMessage(`Agent encountered an error: ${error.message}`);
  }
}

// Function to get user input from the console
function promptInput(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

// Main function
async function main() {
  await initializeDatabase();

  let retryCount = 0;
  const maxRetries = 30;

  if (delaySeconds > 0) {
    log(LogLevel.INFO, `Agent started in loop mode with a delay of ${delaySeconds} seconds.`);
    while (true) {
      try {
        await executeAgent();
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        log(LogLevel.ERROR, `Execution failed: ${error.message}`);
        retryCount++;
        if (retryCount >= maxRetries) {
          log(LogLevel.ERROR, 'Max retries reached. Exiting.');
          break;
        }
      }
      log(LogLevel.INFO, `Waiting for ${delaySeconds} seconds before the next run...\n`);
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  } else {
    await executeAgent();
  }
}

main();
