// Redeem XMD back to XUSDC
require('dotenv').config();
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;

const rpc = new JsonRpc(['https://proton.eosusa.io']);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey])
});

async function redeemXmd() {
  // Get XMD balance
  const res = await rpc.get_table_rows({
    code: 'xmd.token',
    scope: username,
    table: 'accounts',
    json: true
  });

  const xmdBalance = res.rows[0]?.balance;
  if (!xmdBalance || parseFloat(xmdBalance) < 1) {
    console.log('No XMD to redeem');
    return;
  }

  console.log('Redeeming', xmdBalance, 'to XUSDC...');

  const actions = [{
    account: 'xmd.token',
    name: 'transfer',
    authorization: [{ actor: username, permission: 'active' }],
    data: {
      from: username,
      to: 'xmd.treasury',
      quantity: xmdBalance,
      memo: 'redeem,XUSDC'
    }
  }];

  const result = await api.transact({ actions }, {
    blocksBehind: 3,
    expireSeconds: 120
  });

  console.log('SUCCESS! TX:', result.transaction_id);
}

redeemXmd().catch(console.error);
