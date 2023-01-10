// Interactions with the DEX contract, via RPC
import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import * as dexapi from './dexapi.js';
import { getConfig, getLogger } from './utils.js';

const logger = getLogger();

const config = getConfig();
const { username } = config;
const { endpoints, privateKey } = config.get('rpc');

// Initialize
const rpc = new JsonRpc(endpoints);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey]),
});

const apiTransact = (actions) => api.transact({ actions }, {
  blocksBehind: 300,
  expireSeconds: 3000,
});

/**
 * Given a list of on-chain actions, apply authorization and send
 * @param {array} actions - array of actions to send to the chain
 */
const transact = async (actions) => {
  // apply authorization to each action
  const authorization = [{
    actor: username,
    permission: 'active',
  }];
  const authorizedActions = actions.map((action) => ({ ...action, authorization }));
  await apiTransact(authorizedActions);
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
 * @param {number} quantity - for buys, the qty of ask tokens, for sells the qty of bid tokens
 * @param {number} price - price to pay
 * @returns nothing - use fetchOpenOrders to retrieve details of successful but unfilled orders
 * @returns {Promise<object>} - response object from the api.transact()
*/
export const submitLimitOrder = async (symbol, orderSide, quantity, price = undefined) => {
  const orderSideText = orderSide === ORDERSIDES.SELL ? 'sell' : 'buy';
  logger.info(`Attempting to place order for ${symbol} ${quantity} price:${price}, ${orderSideText}`);
  const market = dexapi.getMarketBySymbol(symbol);
  const askToken = market.ask_token;
  const bidToken = market.bid_token;
  const quantityText = orderSide === ORDERSIDES.SELL
    ? `${quantity.toFixed(bidToken.precision)} ${bidToken.code}`
    : `${quantity.toFixed(askToken.precision)} ${askToken.code}`;
  const quantityNormalized = orderSide === ORDERSIDES.SELL
    ? quantity.toFixed(bidToken.precision) * (10 ** bidToken.precision)
    : quantity.toFixed(askToken.precision) * (10 ** askToken.precision);
  const priceNormalized = orderSide === ORDERSIDES.SELL
    ? Math.trunc(price * (10 ** askToken.precision))
    : Math.trunc(price * (10 ** bidToken.precision));
  const actions = [
    {
      account: orderSide === ORDERSIDES.SELL ? bidToken.contract : askToken.contract,
      name: 'transfer',
      data: {
        from: username,
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
        account: username,
        order_type: ORDERTYPES.LIMIT,
        order_side: orderSide,
        quantity: quantityNormalized,
        price: priceNormalized,
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

const createCancelAction = (orderId) => ({
  account: 'dex',
  name: 'cancelorder',
  data: {
    account: username,
    order_id: orderId,
  },
});

/**
 * Cancel a single order
 * @param {number} orderId - if of order to cancel
 * @returns {Promise<void>}
 */
export const cancelOrder = async (orderId) => {
  logger.info(`Canceling order with id: ${orderId}`);
  const response = await transact([createCancelAction(orderId)]);
  return response;
};

/**
 * Cancel all orders for the current account
* @returns {Promise<void>}
*/
export const cancelAllOrders = async () => {
  const orders = await dexapi.fetchOpenOrders(username);
  logger.info(`Canceling all (${orders.length}) orders`);
  const actions = orders.map((order) => createCancelAction(order.order_id));
  const response = await transact(actions);
  return response;
};
