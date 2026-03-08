// Recovery: Cancel stuck LOAN sell order on DEX and withdraw LOAN
require('dotenv').config();
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;

console.log('Cancel LOAN order for account:', username);

const rpc = new JsonRpc(['https://proton.eosusa.io', 'https://proton.greymass.com']);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey])
});

async function cancelAndRecover() {
  const orderId = 26126187;

  // Check LOAN balance before
  const loanBefore = await rpc.get_table_rows({
    code: 'loan.token', scope: username, table: 'accounts', json: true
  });
  console.log('LOAN before:', loanBefore.rows);

  // Cancel order + withdraw in one transaction
  console.log(`Cancelling order ${orderId} and withdrawing...`);
  const result = await api.transact({
    actions: [
      {
        account: 'dex',
        name: 'cancelorder',
        data: { account: username, order_id: orderId },
        authorization: [{ actor: username, permission: 'active' }]
      },
      {
        account: 'dex',
        name: 'withdrawall',
        data: { account: username },
        authorization: [{ actor: username, permission: 'active' }]
      }
    ]
  }, {
    blocksBehind: 300,
    expireSeconds: 3000
  });

  console.log('Transaction:', result.transaction_id);

  // Wait and check balance after
  await new Promise(r => setTimeout(r, 2000));

  const loanAfter = await rpc.get_table_rows({
    code: 'loan.token', scope: username, table: 'accounts', json: true
  });
  console.log('LOAN after:', loanAfter.rows);

  const xmdAfter = await rpc.get_table_rows({
    code: 'xmd.token', scope: username, table: 'accounts', json: true
  });
  console.log('XMD after:', xmdAfter.rows);

  console.log('Done! LOAN should be back in wallet.');
}

cancelAndRecover().catch(e => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
