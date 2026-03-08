// Test script to verify trading works
require('dotenv').config();
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;

console.log('Testing with account:', username);

const rpc = new JsonRpc(['https://proton.eosusa.io', 'https://proton.greymass.com']);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey])
});

async function testAmmSwap() {
  console.log('=== Testing AMM Swap ===');

  // Get current balance
  const balRes = await rpc.get_table_rows({
    code: 'eosio.token',
    scope: username,
    table: 'accounts',
    limit: 10,
    json: true
  });

  let xprBalance = 0;
  for (const row of balRes.rows) {
    if (row.balance && row.balance.includes('XPR')) {
      xprBalance = parseFloat(row.balance);
    }
  }
  console.log('XPR Balance:', xprBalance);

  if (xprBalance < 100) {
    console.log('Not enough XPR for test');
    return;
  }

  // Test: Swap 100 XPR -> XUSDC via AMM
  const testAmount = 100; // 100 XPR
  // Get AMM price first
  const poolRes = await rpc.get_table_rows({
    code: 'proton.swaps',
    scope: 'proton.swaps',
    table: 'pools',
    limit: 100,
    json: true
  });
  const pool = poolRes.rows.find(p => p.lt_symbol.includes('XPRUSDC'));
  const xpr = parseFloat(pool.pool1.quantity);
  const usdc = parseFloat(pool.pool2.quantity);
  const price = usdc / xpr;
  const expectedOut = testAmount * price * 0.95; // 5% slippage buffer
  const minOutput = expectedOut.toFixed(6) + ' XUSDC';

  console.log('AMM Price: $' + price.toFixed(6));
  console.log('\nSwapping', testAmount, 'XPR -> XUSDC...');
  console.log('Min output:', minOutput);

  const actions = [{
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{ actor: username, permission: 'active' }],
    data: {
      from: username,
      to: 'proton.swaps',
      quantity: testAmount.toFixed(4) + ' XPR',
      memo: 'XPRUSDC,' + minOutput
    }
  }];

  try {
    const result = await api.transact({ actions }, {
      blocksBehind: 3,
      expireSeconds: 120
    });

    console.log('✅ SUCCESS!');
    console.log('TX:', result.transaction_id);

  } catch (error) {
    console.log('❌ FAILED:', error.message);
    if (error.json) {
      console.log('Details:', JSON.stringify(error.json, null, 2));
    }
  }
}

testAmmSwap();
