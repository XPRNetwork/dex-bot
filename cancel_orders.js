const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const fetch = require('node-fetch');
// ********* Need to update endpoint based on mainnet or testnet   ********
// For testnet use https://protontestnet.greymass.com
// Mainnet: https://proton.greymass.com
const ENDPOINTS = ['https://proton.greymass.com'];

// To export private key from your wallet, follow:
// https://help.proton.org/hc/en-us/articles/4410313687703-How-do-I-backup-my-private-key-in-the-WebAuth-Wallet-
const PRIVATE_KEY = 'PRIVATE_KEY';
const apiRoot = 'https://metal-dexdb.global.binfra.one/dex';
// ***** Need to update PRIVATE_KEY, market id and username  ********
// To cancel all orders eg: const marketSymbol = ''
const marketSymbol = 'symbol';

// Authorization
const username = 'username';
const authorization = [
  {
    actor: username,
    permission: 'active',
  },
];

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

const fetchOpenOrders = async (username) => {
  const openOrders = await fetchFromAPI(
    apiRoot,
    `/v1/orders/open?limit=250&offset=0&account=${username}`,
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
    expireSeconds: 3000,
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

const main = async () => {
  let cancelList = [];
  const orders = await fetchOpenOrders(username);
  if (!marketSymbol) {
    cancelList = orders;
  } else {
    const allMarkets = await fetchMarkets();
    const market = allMarkets.filter(
      (markets) => markets.symbol === marketSymbol,
    );
    if (market === undefined) {
      throw new Error(`Market ${marketSymbol} does not exist`);
    }
    const marketOrders = orders.filter(
      (orders) => orders.market_id === market[0].market_id,
    );
    if (!marketOrders.length) {
      console.log(`No orders to cancel for market symbol (${marketSymbol})`);
      return;
    }
    cancelList = marketOrders;
  }
  console.log(`Canceling all (${cancelList.length}) orders`);
  const actions = cancelList.map((order) => createCancelAction(order.order_id));
  const response = await transact(actions);
  return response;
};
main();
