import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import { fetchMarkets, fetchOpenOrders } from './dexapi.js';

// For testnet use https://protontestnet.greymass.com
const ENDPOINTS = [
  'https://proton.greymass.com',
  'https://proton.eoscafeblock.com',
];

// To export private key from your wallet, follow:
// https://help.proton.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
const config = {
  username: 'user1',
  privateKey: 'PVT_K1_7yLfEMQXtFmCA3beLg6PSyiSp8paRBK2rdpLZ791XNAvRggXu',
};

// Authorization
const authorization = [{
  actor: config.username,
  permission: 'active',
}];

// Initialize
const rpc = new JsonRpc(ENDPOINTS);

const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([config.privateKey]),
});

const transact = (actions) => api.transact({ actions }, {
  blocksBehind: 300,
  expireSeconds: 3000,
});

const markets = { byId: {}, bySymbol: {} };

export const ORDERSIDES = {
  BUY: 1,
  SELL: 2,
};

export const ORDERTYPES = {
  LIMIT: 1,
  STOP_LOSS: 2,
  TAKE_PROFIT: 3,
};

export const FILLTYPES = {
  GOOD_TILL_CANCEL: 0,
  IMMEDIATE_OR_CANCEL: 1,
  POST_ONLY: 2,
};

/**
 * Initialize the application.
 * Sets global variable `markets`
 */
export const initialize = async () => {
  // load all markets for later use
  const allMarkets = await fetchMarkets();
  allMarkets.forEach((market) => {
    markets.byId[market.market_id] = market;
    markets.bySymbol[market.symbol] = market;
  });
};

/**
 * Given a list of on-chain actions, apply authorization and send
 * @param {array} actions - array of actions to send to the chain
 */
const transactOnChain = async (actions) => {
  // apply authorization to each action
  const authorizedActions = actions.map((action) => ({
    ...action,
    authorization,
  }));

  // send all actions to chain
  const main = async () => {
    await transact(authorizedActions);
  };
  main();
};

/**
 * Place a buy or sell limit order
 * @param {string} symbol - market symbol, ex. 'XPR_XMD'
 * @param {number} orderSide - 1 = BUY, 2 = SELL; use ORDERSIDES.BUY, ORDERSIDES.SELL
 * @param {number} quantity - how many to buy/sell
 * @param {number} price - price to pay
 * @returns nothing - use fetchOpenOrders to retrieve details of successful but unfilled orders
 */
export const submitLimitOrder = (symbol, orderSide, quantity, price = undefined) => {
  const market = markets.bySymbol[symbol];
  const askToken = market.ask_token;
  const bidToken = market.bid_token;
  const quantityText = `${quantity.toFixed(bidToken.precision)} ${bidToken.code}`;
  const quantityNormalized = quantity * 10 ** bidToken.precision;
  const pricesNormalized = price * 10 ** askToken.precision;
  const actions = [
    {
      account: bidToken.contract,
      name: 'transfer',
      data: {
        from: config.username,
        to: 'dex',
        quantity: quantityText,
        memo: '',
      },
    },
    {
      account: 'dex',
      name: 'placeorder',
      data: {
        market_id: market.market_id,
        account: config.username,
        order_type: ORDERTYPES.LIMIT,
        order_side: orderSide,
        quantity: quantityNormalized,
        price: pricesNormalized,
        bid_symbol: {
          sym: `${bidToken.precision},${bidToken.code}`,
          contract: bidToken.contract,
        },
        ask_symbol: {
          sym: `${askToken.precision},${askToken.code}`,
          contract: askToken.contract,
        },
        trigger_price: 0,
        fill_type: FILLTYPES.POST_ONLY,
        referrer: '',
      },
    },
    {
      account: 'dex',
      name: 'process',
      data: {
        q_size: 5,
        show_error_msg: 0,
      },
    },
  ];

  transactOnChain(actions);
};

/**
 * Cancel a single order
 * @param {number} orderId - if of order to cancel
 */
export const cancelOrder = (orderId) => {
  const actions = [
    {
      account: 'dex',
      name: 'cancelorder',
      data: {
        account: config.username,
        order_id: orderId,
      },
    },
  ];

  transactOnChain(actions);
};

/**
 * Cancel all orders for the current account
 */
export const cancelAllOrders = async () => {
  const orders = await fetchOpenOrders(config.username);
  orders.forEach((order) => {
    cancelOrder(order.order_id);
  });
};
