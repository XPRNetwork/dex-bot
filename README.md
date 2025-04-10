# dexbot

This is the code for both market maker and grid trading bot strategies against the MetalX.com DEX
### API and docs information
  Website: https://metalx.com. 

  App: https://app.metalx.com
  
  Docs: https://docs.metalx.com. 
  
  API Reference: https://docs.metalx.com/dex/what-is-metal-x
  
[![ESLint SAST scan workflow](https://github.com/squdgy/dexbot/actions/workflows/eslint.yml/badge.svg?event=push)](https://github.com/squdgy/dexbot/security/code-scanning)

![Tests](https://github.com/squdgy/dexbot/actions/workflows/test.js.yml/badge.svg?event=push)

GRID BOT:
  Grid Trading Bots are programs that allow users to automatically buy at low and sell at high within a pre-set price range. When one sell order is fully executed, the Grid Trading Bot places a buy order in next round based on timeinterval set in tool at a lower grid level, and vice versa. The Grid Trading strategy might perform best in volatile markets, making profits through a series of orders as token’s price fluctuates.
  
  Working Model:
    Bot automatically buys low and sells high based on the parameters you have set.
    
    Example:
      "symbol": "XBTC_XMD",
      "upperLimit": 23000,
      "lowerLimit": 21000,
      "gridLevels": 10,
      "bidAmountPerLevel": 0.0001

    Above setting would set 10 grid levels with each grid size i.e. (23300 - 23100)/10 = 200
    Note: The orders closet to the sale price would be elimiated on placing Initial orders.

Market Maker BOT:
 This bot works against multiple markets to place orders based on levels defined in settings. The purpose of the market making strategy is to put buy and sell orders on the DEX' order books. This strategy doesn’t care about which way the market’s going. The strategy places a ladder of sells at regular intervals above base price, and another ladder of buys beneath it. Use this as a reference and implement yor own trading algorithm.

The bots has been tested on the mainnet with different pairs like XPR_XUSDC, XPR_XMD, and XETH_XMD etc. A new market can always be added under pairs section and restart bot to take effect.

NOTE: Cancelling orders - Script called `cancel-orders-mainnet.js` and `cancel-orders-testnet.js` are available to cancel either market specific or all open orders by the user.

NOTE: User balance and open orders can be integrated to slack channel on running gridbot based periodic intervals. Options slackBotToken and channelId needs to be updated in the config file. Slack bot token can be created by following the documentation at https://api.slack.com/authentication/basics and make sure that invite app into the slack channel

## Getting Started

### prerequisites
- an XPR Network account (You can use WebAuth.com from the app store or online [WebAuth.com](https://wauth.co)
- enough funds in your account to buy and/or sell in the market that you want to trade in

### run the code
1. `npm install`
1. Add your account name and private key to environment variables, eg
```
Mac and Linux:
export PROTON_USERNAME=user1
export PROTON_PRIVATE_KEY=private_key

Windows using powershell:
$env:PROTON_USERNAME = 'user1'
$env:PROTON_PRIVATE_KEY = 'private_key'
```
1. edit config/default.json to use the market you would like to trade in (symbol value)
1. `npm run bot`
1. To run on testnet: `npm run bot:test` (windows - `$env:NODE_ENV = 'test'` and `npm run bot`)

## config params
config/default.json has other config values you can change
```
{
  "bot" : {
    // how often to attempt trade
    "tradeIntervalMS": "5000",

    // Slack bot token eg: xoxb-5672345689032-4846869117232-1clJ35VeuI2y3F1oczinKKHm
    "slackBotToken": "",
    // This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID for the slack bot
    "channelId" = '';

    // set to true in order to cancel all open orders when the bot shuts down
    "cancelOpenOrdersOnExit": false,

    // Enable this to true if you want to place orders always one level above/below depends on buy/sell order for the executed orders 
    "gridPlacement": true,

    // strategy to be applied, marketmaker or gridbot
    "strategy": "gridBot",
    "marketMaker": {
      // represents pairs(markets ids) for the market maker strategy
      "pairs": [
          // symbol: market to trade in

          // gridLevels: how many buy and how many sell orders to put on the books

          // gridInterval: interval(price step or spread between each grid level 0.01 = 1%)

          // base: base for start price to place order - AVERAGE: avg of highestBid and lowestAsk, BID: highestBid price
          //                                       ASK: lowestAsk price, LAST: last price traded

          // orderSide: orderSide represents whether to place gird orders for BOTH(BUY and SELL) or BUY or SELL
          // Options are "BOTH", "BUY", "SELL"
        {
          "symbol": "XPR_XMD",
          "gridLevels": 3,
          "gridInterval": 0.01,
          "base": "BID"
          "orderSide": "BUY"
        },
        {
          "symbol": "XETH_XMD",
          "gridLevels": 2,
          "gridInterval": 0.01,
          "base": "LAST"
          "orderSide": "SELL"
        }
      ]
    },
    // represents pairs(markets ids) for the gridbot strategy
   "gridBot": {
      "pairs": [
        // symbol: market to trade in
        // upperLimit: represents price - upper limit of the trading range
        // lowerLimit: represents price - upper limit of the trading range
        // gridLevels: number of orders to keep
        // bidAmountPerLevel: Amount to bid/ask per each level
        {
          "symbol": "XPR_XMD",
          "upperLimit": 0.0019,
          "lowerLimit": 0.0016,
          "gridLevels": 10,
          "bidAmountPerLevel": 800.00
        },
        {
          "symbol": "XBTC_XMD",
          "upperLimit": 23000,
          "lowerLimit": 21000,
          "gridLevels": 10,
          "bidAmountPerLevel": 0.00006
        }   
      ]
    },
    // permissions on the key ex. active or owner
    "privateKeyPermission": "active"
    "rpc": {

      // endpoints for RPC API
      "endpoints" : [
        "https://rpc.api.mainnet.metalx.com"
      ],

      // api for readonly dex api
      "apiRoot": "https://dex.api.mainnet.metalx.com/dex",

      // api for readonly proton api
      "lightApiRoot": "https://lightapi.eosamsterdam.net/api"
    }
  }
}
```

## Below actions used in this bot code base

### Markets
- **fetchLatestPrice** - retrieves the latest price for a given symbol
```
    const price = await fetchLatestPrice('XPR_XUSDC');
    logger.info(price);
```
- **fetchMarkets** - retrieves all markets that exist on metalx trading
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
- **prepareLimitOrder** - submit a buy or sell limit order to the dex in postonly mode (ensure it is a maker trade)
```
    // place an order to sell XPR into USDC
    const quantity = 570;
    const price = 0.002020;
    prepareLimitOrder('XPR_XUSDC', ORDERSIDES.SELL, quantity, price);
```

### Accounts
- **fetchBalances** - retrieves all balances for a given user
```    
    const response = await fetchBalances('metallicus');
    logger.info(response);
```

### coding references
- basics for a simple limit order placement, including signing: [https://docs.metalx.com/developers-dex/examples/submit-dex-order](https://docs.metalx.com/developers-dex/examples/submit-dex-order)
- instructions on finding your private key: https://help.xprnetwork.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
- actions available on the DEX contract: https://docs.metalx.com/developers-dex/smart-contract/actions
- general documentation on interacting with XPR Network contracts: https://docs.xprnetwork.org/
- base version imported from https://github.com/squdgy/dexbot
