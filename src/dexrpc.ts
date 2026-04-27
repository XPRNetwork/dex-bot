// Interactions with the DEX contract, via RPC
import { JsonRpc, Api, JsSignatureProvider, Serialize } from '@proton/js';
import { BigNumber } from 'bignumber.js';
import { FILLTYPES, ORDERSIDES, ORDERTYPES } from './core/constants';
import * as dexapi from './dexapi';
import { getConfig, getLogger, getUsername } from './utils';
import { healthMonitor } from './health-monitor';

type OrderAction = Serialize.Action

const logger = getLogger();

const config = getConfig();
const { endpoints, privateKey, privateKeyPermission } = config.rpc;
const username = getUsername();

const isPaperOrTest = process.env.npm_lifecycle_event === 'test' || process.env.BOT_MODE === 'paper';
let signatureProvider = isPaperOrTest ? undefined : new JsSignatureProvider([privateKey]);
let actions: OrderAction[] = [];

// Initialize
const rpc = new JsonRpc(endpoints);
const api = new Api({
  rpc,
  signatureProvider
});

const apiTransact = async (actions: Serialize.Action[], maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await api.transact({ actions }, {
        blocksBehind: 300,
        expireSeconds: 3000,
      });
      healthMonitor.recordSuccess('rpc');
      return result;
    } catch (error) {
      const msg = (error as Error).message || String(error);
      const isTransient = msg.includes('invalid json response body')
        || msg.includes('Unexpected token')
        || msg.includes('ECONNRESET')
        || msg.includes('ETIMEDOUT')
        || msg.includes('fetch failed');

      if (isTransient && attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        logger.warn(`[RPC] Transient error (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms: ${msg}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      healthMonitor.recordError('rpc', msg);
      throw error;
    }
  }
};

const authorization = [{
  actor: username,
  permission: privateKeyPermission,
}];

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
  const maxRetries = 3;
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await apiTransact(authorizedActions);
      break;
    }
    catch {
      attempts++;
      if (attempts >= maxRetries) {
        logger.error(`Failed after ${maxRetries} attempts`);
        throw Error;
      }
      logger.info(`Retrying RPC connection`);
    }
  }
};

/**
 * Place a buy or sell limit order. Quantity and price are string values to
 * avoid loss of precision when placing order
 */
export const prepareLimitOrder = async (marketSymbol: string, orderSide: ORDERSIDES, quantity: BigNumber.Value, price: number): Promise<void> => {
  const market = dexapi.getMarketBySymbol(marketSymbol);
  if (!market) {
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

  const cPrice = new BigNumber(price);
  const priceNormalized = cPrice.multipliedBy(askToken.multiplier);

  actions.push(
    {
      account: orderSide === ORDERSIDES.SELL ? bidToken.contract : askToken.contract,
      name: 'transfer',
      data: {
        from: username,
        to: 'dex',
        quantity: quantityText,
        memo: '',
      },
      authorization,
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
        fill_type: FILLTYPES.GTC,
        referrer: '',
      },
      authorization,
    },
  );
};

export const submitOrders = async (): Promise<void> => {
  actions.push(
    {
      account: 'dex',
      name: 'process',
      data: {
        q_size: 60,
        show_error_msg: 0,
      },
      authorization,
    },
    {
      account: 'dex',
      name: "withdrawall",
      data: {
        account: username,
      },
      authorization,
    },);

  // Capture-then-clear-then-send: the module-level `actions` queue must be
  // emptied even if apiTransact throws. Otherwise a single failed bundle
  // (network blip, overdrawn, duplicate-tx, anything) leaves the queue
  // dirty, and every subsequent prepareLimitOrder appends to it — cumulative
  // transfers grow until they exceed wallet, producing a persistent
  // "overdrawn balance" loop with no fundamental balance problem.
  const toSend = actions;
  actions = [];

  // Log bundles that exceed the single-order shape (1 transfer + 1 placeorder
  // + process + withdrawall = 4). A normal multi-order placeOrders sends up to
  // 10 pairs (22 actions); anything larger or anything that grows
  // cycle-over-cycle is a strong signal that submitOrders previously failed
  // and leaked state. The breakdown surfaces *which* actions piled up.
  const transferCount = toSend.filter(a => a.name === 'transfer').length;
  const placeorderCount = toSend.filter(a => a.name === 'placeorder').length;
  const processCount = toSend.filter(a => a.name === 'process').length;
  const withdrawallCount = toSend.filter(a => a.name === 'withdrawall').length;

  if (toSend.length > 4) {
    logger.info(
      `[dexrpc] submitOrders sending ${toSend.length} actions ` +
      `(transfers=${transferCount}, placeorders=${placeorderCount}, ` +
      `process=${processCount}, withdrawall=${withdrawallCount})`,
    );
  }

  // More than one process or withdrawall in a single bundle should be
  // impossible given the current design; if it ever shows up, that's a
  // smoking-gun for the leaked-actions failure mode.
  if (processCount > 1 || withdrawallCount > 1) {
    logger.warn(
      `[dexrpc] submitOrders bundle has duplicate epilogue actions ` +
      `(process=${processCount}, withdrawall=${withdrawallCount}) — ` +
      `suggests a prior submit leaked state`,
    );
  }

  await apiTransact(toSend);
}

// Test-only: surface the queued-action count so tests can assert that a
// failed submit doesn't leak state into the next call. Not exported in the
// type-checked public API — kept on the module namespace at runtime only.
export const __getQueuedActionCount = (): number => actions.length;

export const submitProcessAction = async (): Promise<void> => {
  const processAction = [({
    account: 'dex',
    name: 'process',
    data: {
      q_size: 100,
      show_error_msg: 0,
    },
    authorization,
  })];

  const response = apiTransact(processAction);
}

const createCancelAction = (orderId: string | number): OrderAction => ({
  account: 'dex',
  name: 'cancelorder',
  data: {
    account: username,
    order_id: orderId,
  },
  authorization,
});

const withdrawAction = () => ({
  account: 'dex',
  name: "withdrawall",
  data: {
    account: username,
  },
  authorization,
});


/**
 * Withdraw all funds from the DEX escrow back to the user's wallet
 */
export const withdrawAll = async (): Promise<void> => {
  logger.info('Withdrawing all funds from DEX escrow');
  const response = await transact([withdrawAction()]);
  return response;
};

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
  try {
    let cancelList = [];
    let i = 0;
    while (true) {
      const ordersList = await dexapi.fetchOpenOrders(username, 150, 150 * i);
      if (!ordersList.length) break;
      cancelList.push(...ordersList);
      i++;
    }
    if (!cancelList.length) {
      console.log(`No orders to cancel`);
      return;
    }
    console.log(`Cancelling all (${cancelList.length}) orders`);
    const actions = cancelList.map((order) => createCancelAction(order.order_id));
    const response = await transact(actions);
    return response;
  }
  catch (e) {
    console.log('cancel orders error', e)
    return undefined
  }
};


/**
 * Get the current swaps available on-chain
 */
export const getSwaps = async (): Promise<{ [key: string]: any }> => {
  try {
    const rows: { more: boolean, next_key: string, rows: { active: boolean, amplifier: boolean, creator: string, fee: { exchange_fee: number, add_liquidity_fee: number, remove_liquidity_fee: number }, hash: string, lt_symbol: string, memo: string, pool1: { quantity: string, contract: string }, pool2: { quantity: string, contract: string } }[] } =
      await api.rpc.get_table_rows({
        json: true,
        code: "proton.swaps",
        scope: "proton.swaps",
        table: "pools",
        index_position: 1,
        key_type: "i64",
        limit: -1,
        reverse: false,
        show_payer: false
      });

    healthMonitor.recordSuccess('rpc');

    if (rows.rows) {
      logger.info(`Fetched ${rows.rows.length} swap pools from proton.swaps`);
      const returnObj: { [key: string]: any } = {}
      rows.rows.forEach((r) => {
        let cleaned_symbol = r.lt_symbol.split(",")[1];
        returnObj[cleaned_symbol] = r;
      });
      return returnObj;
    }

    return {};
  } catch (error) {
    const msg = (error as Error).message || String(error);
    healthMonitor.recordError('rpc', msg);
    throw error;
  }
}

export const submitSwapRequest = async (sendAmount: string, sendToken: string, sendContract: string, pairSymbol: string) => {
  // Create a random number for the memo
  const randomNumber = Math.floor(Math.random() * 10000000);
  const action = {
    account: sendContract,
    name: 'transfer',
    authorization,
    data: {
      from: username,
      to: 'proton.swaps',
      quantity: sendAmount + ' ' + sendToken,
      memo: pairSymbol + ',' + randomNumber,
    }
  }
  const response = await transact([action]);
  return response;
}