/**
 * Claim graduated tokens from simplelaunch curves
 */
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');
require('dotenv').config();

const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;
const curveId = parseInt(process.argv[2] || '104');

if (!username || !privateKey) {
  console.error('Missing PROTON_USERNAME or PROTON_PRIVATE_KEY');
  process.exit(1);
}

const rpc = new JsonRpc(['https://proton.eosusa.io']);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey]),
});

async function main() {
  // Check holdings
  const holdings = await rpc.get_table_rows({
    code: 'simplelaunch', scope: username, table: 'holdings',
    lower_bound: curveId, upper_bound: curveId, limit: 1, json: true,
  });

  if (!holdings.rows.length || holdings.rows[0].tokenId !== curveId) {
    console.log(`No holdings for curve ${curveId}`);
    return;
  }

  console.log(`Holdings for curve ${curveId}: ${holdings.rows[0].amount}`);

  // Claim
  const result = await api.transact({
    actions: [{
      account: 'simplelaunch',
      name: 'claim',
      authorization: [{ actor: username, permission: 'active' }],
      data: { account: username, tokenId: curveId },
    }]
  }, { blocksBehind: 3, expireSeconds: 120 });

  console.log(`Claimed! TX: ${result.transaction_id}`);

  // Check simpletoken balance
  const balances = await rpc.get_table_rows({
    code: 'simpletoken', scope: username, table: 'accounts', limit: 50, json: true,
  });
  for (const row of balances.rows) {
    if (row.balance.includes('YUNO')) {
      console.log(`YUNO balance: ${row.balance}`);
    }
  }
}

main().catch(e => console.error(e.message));
