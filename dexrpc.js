// Interactions with the DEX contract, via RPC
import config from 'config';
import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import * as dexapi from './dexapi.js';

let logger = () => {};

/**
 * Set a logger for the api
 * @param {object} arg - a winston.logger instance
 */
export const setLogger = (arg) => {
  logger = arg;
};

const botConfig = config.get('bot');
const rpcConfig = config.get('rpc');
const ENDPOINTS = rpcConfig.endpoints;

// Authorization
const authorization = [{
  actor: botConfig.username,
  permission: 'active',
}];

// Initialize
const rpc = new JsonRpc(ENDPOINTS);

const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([rpcConfig.privateKey]),
});

/**
 * Send the transactions to the API
 * @param {array} actions - list of actions
 * @returns {object}
 */
const transact = async (actions) => {
  // apply authorization to each action
  const actionsWithAuth = actions.map((action) => ({
    ...action,
    authorization,
  }));

  const response = await api.transact({ actionsWithAuth }, {
    blocksBehind: 300,
    expireSeconds: 3000,
  });
  return response;
};

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
 * Place a buy or sell limit order
 * @param {string} symbol - market symbol, ex. 'XPR_XMD'
 * @param {number} orderSide - 1 = BUY, 2 = SELL; use ORDERSIDES.BUY, ORDERSIDES.SELL
 * @param {number} quantity - how many to buy/sell
 * @param {number} price - price to pay
 * @returns nothing - use fetchOpenOrders to retrieve details of successful but unfilled orders
 * @returns {Promise<object>} - response object from the api.transact()
*/
export const submitLimitOrder = async (symbol, orderSide, quantity, price = undefined) => {
  const market = dexapi.getMarketBySymbol(symbol);
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
        from: botConfig.username,
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
        account: botConfig.username,
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

  const response = await transact(actions);
  return response;
};

/**
 * Cancel a single order
 * @param {number} orderId - if of order to cancel
 * @returns {Promise<object>} - response object from the api.transact()
 */
export const cancelOrder = async (orderId) => {
  logger.info(`Canceling order with id: ${orderId}`);
  const actions = [
    {
      account: 'dex',
      name: 'cancelorder',
      data: {
        account: botConfig.username,
        order_id: orderId,
      },
    },
  ];

  const response = await transact(actions);
  return response;
};

/**
 * Cancel all orders for the current account
* @returns {Promise<void>} - nothing
*/
export const cancelAllOrders = async () => {
  const orders = await dexapi.fetchOpenOrders(botConfig.username);
  await Promise.all(orders.map(async (order) => {
    // TODO: handle errors (race condition)
    await cancelOrder(order.order_id);
  }));
};
