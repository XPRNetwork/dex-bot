import { JsonRpc, Api, JsSignatureProvider, Serialize } from '@proton/js';
import fetch from 'node-fetch';


// ***** Need to update PRIVATE_KEY, market id and username  ********
// To export private key from your wallet, follow:
// https://help.proton.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
const PRIVATE_KEY = process.env.PROTON_PRIVATE_KEY;
// To cancel all orders eg: const marketSymbol = ''
const marketSymbol = '';

// Authorization
const username = process.env.PROTON_USERNAME;
const authorization = [
  {
    actor: username,
    permission: 'active',
  },
];

const apiRoot = 'https://testnet.api.protondex.com/dex';
const ENDPOINTS = ['https://testnet-rpc.api.protondex.com'];
// Initialize
const rpc = new JsonRpc(ENDPOINTS);

const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([PRIVATE_KEY]),
});

const fetchFromAPI = async (root, path, returnData = true) => {
  const response = await fetch(`${root}${path}`);
  const responseJson = await response.json();
  if (returnData) {
    return responseJson.data;
  }
  return responseJson;
};

const fetchOpenOrders = async (username, limit = 150, offset = 0) => {
  const openOrders = await fetchFromAPI(
    apiRoot,
    `/v1/orders/open?limit=${limit}&offset=${offset}&account=${username}`,
  );
  return openOrders;
};

const fetchMarkets = async () => {
  const marketData = await fetchFromAPI(apiRoot, '/v1/markets/all');
  return marketData;
};

const transact = (actions) => api.transact(
  { actions },
  {
    blocksBehind: 300,
    expireSeconds: 3600,
  },
);

const createCancelAction = (orderId) => ({
  account: 'dex',
  name: 'cancelorder',
  data: {
    account: username,
    order_id: orderId,
  },
  authorization,
});

const withdrawActions = async () => {
  let actions = [];
  actions.push(
  {
    account: 'dex',
    name: 'process',
    data: {
      q_size: 30,
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

  const response = await transact(actions);
}

const main = async () => {
  let cancelList = [];
  let i = 0;
  while(true) {
    const ordersList = await fetchOpenOrders(username, 150, 150 * i);
    if(!ordersList.length) break;
    cancelList.push(...ordersList);
    i++;
  }

  if (marketSymbol) {
    const allMarkets = await fetchMarkets();
    const market = allMarkets.filter(
      (markets) => markets.symbol === marketSymbol,
    );
    if (market === undefined) {
      throw new Error(`Market ${marketSymbol} does not exist`);
    }
    const marketOrders = cancelList.filter(
      (orders) => orders.market_id === market[0].market_id,
    );
    if (!marketOrders.length) {
      console.log(`No orders to cancel for market symbol (${marketSymbol})`);
      return;
    }
    cancelList = marketOrders;
  }
  if(!cancelList.length) {
    console.log(`No orders to cancel`);
    return;
  }
  console.log(`Cancelling all (${cancelList.length}) orders`);
  const actions = cancelList.map((order) => createCancelAction(order.order_id));
  const response = await transact(actions);
  withdrawActions();
  return response;
};
main();
