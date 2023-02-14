// Interactions with the DEX contract, via RPC
import { JsonRpc, Api, JsSignatureProvider, Serialize } from '@proton/js';
import { BigNumber } from 'bignumber.js';
import { FILLTYPES, ORDERSIDES, ORDERTYPES } from './core/constants';
import * as dexapi from './dexapi';
import { getConfig, getLogger, getUsername } from './utils';

interface OrderAction extends Omit< Serialize.Action, 'authorization'> {}

const logger = getLogger();

const config = getConfig();
const { endpoints, privateKey, privateKeyPermission } = config.rpc;
const username = getUsername();

let signatureProvider = process.env.npm_lifecycle_event === 'test'? undefined : new JsSignatureProvider([privateKey]);

// Initialize
const rpc = new JsonRpc(endpoints);
const api = new Api({
  rpc,
  signatureProvider
});

const apiTransact = (actions: Serialize.Action[] ) => api.transact({ actions }, {
  blocksBehind: 300,
  expireSeconds: 3000,
});

/**
 * Given a list of on-chain actions, apply authorization and send
 */
const transact = async (actions: OrderAction[]) => {
  // apply authorization to each action
  const authorization = [{
    actor: username,
    permission: privateKeyPermission,
  }];
  const authorizedActions = actions.map((action) => ({ ...action, authorization }));
  await apiTransact(authorizedActions);
};

/**
 * Place a buy or sell limit order. Quantity and price are string values to
 * avoid loss of precision when placing order
 */
export const submitLimitOrder = async (marketSymbol: string, orderSide: ORDERSIDES, quantity: BigNumber.Value, price: number | undefined = undefined): Promise<void> => {
  const market = dexapi.getMarketBySymbol(marketSymbol);
  if(!market) {
    throw new Error(`No market found by symbol ${marketSymbol}`);
  }
  const askToken = market.ask_token;
  const bidToken = market.bid_token;

  const bnQuantity = new BigNumber(quantity);
  const quantityText = orderSide === ORDERSIDES.SELL
    ? `${bnQuantity.toFixed(bidToken.precision)} ${bidToken.code}`
    : `${bnQuantity.toFixed(askToken.precision)} ${askToken.code}`;

  const orderSideText = orderSide === ORDERSIDES.SELL ? 'sell' : 'buy';
  logger.info(`Placing ${orderSideText} order for ${quantityText} at ${price}`);

  const quantityNormalized = orderSide === ORDERSIDES.SELL
    ? (bnQuantity.times(bidToken.multiplier)).toString()
    : (bnQuantity.times(askToken.multiplier)).toString();
  const priceNormalized = Math.trunc((price || 0) * askToken.multiplier);
  
  logger.info('Normalized price', priceNormalized);
  logger.info('Normalized quantity', quantityNormalized);

  const actions: OrderAction[] = [
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
        q_size: 50,
        show_error_msg: 0,
      },
    },
  ];

  const response = await transact(actions);
  return response;
};

const createCancelAction = (orderId: string): OrderAction => ({
  account: 'dex',
  name: 'cancelorder',
  data: {
    account: username,
    order_id: orderId,
  },
});

/**
 * Cancel a single order
 */
export const cancelOrder = async (orderId: string): Promise<void> => {
  logger.info(`Canceling order with id: ${orderId}`);
  const response = await transact([createCancelAction(orderId)]);
  return response;
};

/**
 * Cancel all orders for the current account
 */
export const cancelAllOrders = async (): Promise<void> => {
  const orders = await dexapi.fetchOpenOrders(username);
  if (!orders.length) {
    logger.info('No orders to cancel)');
    return undefined;
  }
  logger.info(`Canceling all (${orders.length}) orders`);
  const actions = orders.map((order: any) => createCancelAction(order.order_id));
  const response = await transact(actions);
  return response;
};
