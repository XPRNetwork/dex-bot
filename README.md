# dexbot

This is code for a basic trading bot against the Proton DEX, https://protondex.com/.

## Getting Started

### prerequisites
- a proton account (https://www.proton.org/wallet/)
- enough funds in your account in the markets that you want to trade in

### run the code
1. `npm install`
1. Add your account name and private key to environment variables, eg
```
export PROTON_USERNAME=user1
export PROTON_PRIVATE_KEY=PVT_K1_7yLfEMQXtFmCA3beLg6PSyiSp8paRBK2rdpLZ791XNAvRggXu
```
1. edit config/default.json to use the market you would like to trade in (symbol value)
1. `npm run bot`

### coding references
- basics for a simple limit order placement, including signing: https://www.docs.protondex.com/developers-dex/submit-dex-order
- instructions on finding your private key: https://help.proton.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
- actions available on the DEX contract: https://www.docs.protondex.com/developers-dex/actions
- general documentation on interacting with proton contracts: https://docs.protonchain.com/built-with-proton.html#sdks

## config params
config/default.json has other config values you can change
```
{
  "bot" : {
    "api": {
        
      // api for readonly dex api
      "apiRoot": "https://metal-dexdb.global.binfra.one/dex",

      // api for readonly proton api
      "lightApiRoot": "https://lightapi.eosamsterdam.net/api"
    },

    // set to true in order to cancel all open orders when the bot shuts down
    "cancelOpenOrdersOnExit": false,

    "rpc": {

      // endpoints for RPC API
      "endpoints" : [
        "https://proton.greymass.com",
        "https://proton.eoscafeblock.com"
      ],

      // private key associated with username
      "privateKey": "PVT_K1_7yLfEMQXtFmCA3beLg6PSyiSp8paRBK2rdpLZ791XNAvRggXu" 
    },

    // market to trade in
    "symbol": "XPR_XUSDC",

    // how often to attempt trade
    "tradeIntervalMS": "5000",

    // username of trader AND API account
    "username": "user1"
  }
}
```

## Actions available in this bot code base

### Markets
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

### Orders
- **cancelOrder** - cancel a single order
```
    const orderId = 966550;
    cancelOrder(orderId);
```
- **cancelAllOrders** - cancel all orders for a given user one by one (not in bulk)
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
