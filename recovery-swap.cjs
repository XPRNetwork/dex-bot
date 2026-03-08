// Recovery: Swap XPR back to XUSDC via AMM
require('dotenv').config();
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;

console.log('Recovery swap for account:', username);

const rpc = new JsonRpc(['https://proton.eosusa.io', 'https://proton.greymass.com']);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey])
});

async function recoverXprToXusdc() {
  // Get current balances
  const [xprRes, xusdcRes] = await Promise.all([
    rpc.get_table_rows({
      code: 'eosio.token',
      scope: username,
      table: 'accounts',
      limit: 10,
      json: true
    }),
    rpc.get_table_rows({
      code: 'xtokens',
      scope: username,
      table: 'accounts',
      limit: 20,
      json: true
    })
  ]);

  let xpr = 0, xusdc = 0;
  for (const row of xprRes.rows) {
    if (row.balance?.includes('XPR')) xpr = parseFloat(row.balance);
  }
  for (const row of xusdcRes.rows) {
    if (row.balance?.includes('XUSDC')) xusdc = parseFloat(row.balance);
  }

  console.log('Current balances:');
  console.log('  XPR:', xpr.toFixed(4));
  console.log('  XUSDC:', xusdc.toFixed(6));

  // Get AMM price
  const poolsRes = await rpc.get_table_rows({
    code: 'proton.swaps',
    scope: 'proton.swaps',
    table: 'pools',
    limit: 100,
    json: true
  });

  const xprusdc = poolsRes.rows.find(p => p.lt_symbol.includes('XPRUSDC'));
  const ammXpr = parseFloat(xprusdc.pool1.quantity);
  const ammUsdc = parseFloat(xprusdc.pool2.quantity);
  const ammPrice = ammUsdc / ammXpr;

  console.log('AMM XPR price: $' + ammPrice.toFixed(6));
  console.log('XPR value: $' + (xpr * ammPrice).toFixed(2));

  // Swap enough XPR to get ~$150 XUSDC
  const targetXusdc = 150;
  const xprToSell = Math.min(targetXusdc / ammPrice, xpr * 0.5); // Max 50% of holdings

  if (xprToSell < 1000) {
    console.log('Not enough XPR to swap');
    return;
  }

  const minXusdcOut = (xprToSell * ammPrice * 0.97).toFixed(6); // 3% slippage

  console.log(`\nSwapping ${xprToSell.toFixed(4)} XPR for ~${minXusdcOut} XUSDC...`);

  const actions = [{
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{ actor: username, permission: 'active' }],
    data: {
      from: username,
      to: 'proton.swaps',
      quantity: `${xprToSell.toFixed(4)} XPR`,
      memo: `XPRUSDC,${minXusdcOut} XUSDC`
    }
  }];

  try {
    const result = await api.transact({ actions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });

    console.log('SUCCESS! TX:', result.transaction_id);

    // Check new balance
    await new Promise(r => setTimeout(r, 2000));
    const newRes = await rpc.get_table_rows({
      code: 'xtokens',
      scope: username,
      table: 'accounts',
      limit: 20,
      json: true
    });

    for (const row of newRes.rows) {
      if (row.balance?.includes('XUSDC')) {
        console.log('New XUSDC balance:', row.balance);
      }
    }
  } catch (error) {
    console.log('FAILED:', error.message);
    if (error.json) {
      console.log('Details:', JSON.stringify(error.json, null, 2));
    }
  }
}

recoverXprToXusdc();
