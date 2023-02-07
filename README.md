# dexbot

This is the code for both market maker and grid trading bot strategies against the Proton DEX, https://protondex.com/.

[![ESLint SAST scan workflow](https://github.com/squdgy/dexbot/actions/workflows/eslint.yml/badge.svg?event=push)](https://github.com/squdgy/dexbot/security/code-scanning)

![Tests](https://github.com/squdgy/dexbot/actions/workflows/test.js.yml/badge.svg?event=push)

GRID BOT:
  Grid Trading Bots are programs that allow users to automatically buy low and sell high within a pre-set price range. When one sell order is fully executed, the Grid Trading Bot places a buy order in next round based timeinterval set in tool at a lower grid level, and vice versa. The Grid Trading strategy might perform best in volatile markets, making profits through a series of orders as a token’s price fluctuates.
  Working Model:
    Bot automatically buys low and sells high based on the parameters you have set. 
    Example:
    "symbol": "XBTC_XMD",
    "upperLimit": 2330000000000,
    "lowerLimit": 2280000000000,
    "gridLevels": 10,
    "pricePerGrid": 2000000

    Above setting would set 10 grid levels with each grid size i.e. (2330000000000 - 2280000000000)/10 = 50
    Note: The orders closet to the sale price would be elimiated on placing Initial orders.

Market Maker BOT:
 This bot works against multiple markets to place orders bsed on levels defined in settings. The purpose of the market making strategy is to put buy and sell orders on the DEX' order books. This strategy doesn’t care about which way the market’s going. The strategy places a ladder of sells at regular intervals above base price, and another ladder of buys beneath it. Use this as a reference and implement yor own trading algorithm.

The bots has been tested on the mainnet with different pairs like XPR_XUSDC, XPR_XMD, and XETH_XMD etc. A new market can always be added under pairs section and restart bot to take effect.

## Getting Started

### prerequisites
- a proton account (https://www.proton.org/wallet/)
- enough funds in your account to buy and/or sell in the market that you want to trade in

### run the code
1. `npm install`
1. Add your account name and private key to environment variables, eg
```
export PROTON_USERNAME=user1
export PROTON_PRIVATE_KEY=PVT_K1_7yLfEMQXtFmCA3beLg6PSyiSp8paRBK2rdpLZ791XNAvRggXu
```
1. edit config/default.json to use the market you would like to trade in (symbol value)
1. `npm run bot`
1. To run on testnet: `NODE_ENV=test npm run bot`

## config params
config/default.json has other config values you can change
```
{
  "bot" : {
    // how often to attempt trade
    "tradeIntervalMS": "5000",

    // set to true in order to cancel all open orders when the bot shuts down
    "cancelOpenOrdersOnExit": false,

    // strategy to be applied, marketmaker or gridbot
    "strategy": "gridBot",
    "marketmaker": {
      // represents pairs(markets ids) for the market maker strategy
      "mmpairs": [
          // symbol: market to trade in

          // gridLevels: how many buy and how many sell orders to put on the books

          // gridInterval: interval(price step or spread between each grid level 0.01 = 1%)

          // base: base for start price to place order - AVERAGE: avg of highestBid and lowestAsk, BID: highestBid price
          //                                       ASK: lowestAsk price, LAST: last price traded

          // orderSide: orderSide represents whether to place gird orders for BOTH(BUY and SELL) or BUY or SELL
          // Options are "BOTH", "BUY", "SELL"
        {
          "symbol": "XPR_XMD",
          gridLevels": 3,
          "gridInterval": 0.01,
          "base": "BID"
          "orderSide": "BUY"
        },
        {
          "symbol": "XETH_XMD",
          gridLevels": 2,
          "gridInterval": 0.01,
          "base": "LAST"
          "orderSide": "SELL"
        }
      ]
    },
    // represents pairs(markets ids) for the gridbot strategy
   "gridBot": {
      "gbpairs": [
        // symbol: market to trade in
        // upperLimit: represents price - upper limit of the trading range
        // lowerLimit: represents price - upper limit of the trading range
        // gridLevels: number of orders to keep
        // pricePerGrid: cost per each grid
        {
          "symbol": "XBTC_XMD",
          "upperLimit": 2450000000000,
          "lowerLimit": 2350000000000,
          "gridLevels": 10,
          "pricePerGrid": 2000000
        },
        {
          "symbol": "XPR_XMD",
          "upperLimit": 24.50,
          "lowerLimit": 22.50,
          "gridLevels": 10,
          "pricePerGrid": 2000000
        }
      ]
    },
    // permissions on the key ex. active or owner
    "privateKeyPermission": "active"
    "rpc": {

      // endpoints for RPC API
      "endpoints" : [
        "https://proton.greymass.com",
        "https://proton.eoscafeblock.com"
      ],

      // api for readonly dex api
      "apiRoot": "https://metal-dexdb.global.binfra.one/dex",

      // api for readonly proton api
      "lightApiRoot": "https://lightapi.eosamsterdam.net/api"
    }
  }
}
```

## Actions available in this bot code base

### Markets
- **fetchLatestPrice** - retrieves the latest price for a given symbol
```
    const price = await fetchLatestPrice('XPR_XUSDC');
    logger.info(price);
```
- **fetchMarkets** - retrieves all markets that exist on the proton dex
```
    const response = await fetchMarkets();
    logger.info(response);
```
- **fetchOrderBook** - retrieves order book data for a single market
```
    const response = await fetchOrderBook('XBTC_XUSDC', 100, 0.01);
    logger.info(response);
```
- **fetchTrades** - retrieves trades on the given market
```
    const response = await fetchTrades('XPR_XUSDC', 100, 0);
    logger.info(response);
```

### Orders
- **cancelOrder** - cancel a single order
```
    const orderId = 966550;
    cancelOrder(orderId);
```
- **cancelAllOrders** - cancel all orders for a given user
```
    cancelAllOrders();
```
- **fetchOpenOrders** - retrieve all open orders for a given user
```
    const response = await fetchOpenOrders(username);
    logger.info(response);
```
- **fetchOrderHistory** - retrieves order history for a given user
```
    const response = await fetchOrderHistory('metallicus', 20, 0);
    logger.info(response);
```
- **submitLimitOrder** - submit a buy or sell limit order to the dex in postonly mode (ensure it is a maker trade)
```
    // place an order to sell XPR into USDC
    const quantity = 570;
    const price = 0.002020;
    submitLimitOrder('XPR_XUSDC', ORDERSIDES.SELL, quantity, price);
```

### Accounts
- **fetchBalances** - retrieves all balances for a given user
```    
    const response = await fetchBalances('metallicus');
    logger.info(response);
```

### coding references
- basics for a simple limit order placement, including signing: https://www.docs.protondex.com/developers-dex/submit-dex-order
- instructions on finding your private key: https://help.proton.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
- actions available on the DEX contract: https://www.docs.protondex.com/developers-dex/actions
- general documentation on interacting with proton contracts: https://docs.protonchain.com/built-with-proton.html#sdks
- base version imported from https://github.com/squdgy/dexbot
