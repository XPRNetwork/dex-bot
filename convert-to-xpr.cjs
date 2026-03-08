require('dotenv').config();
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const rpc = new JsonRpc(['https://proton.eosusa.io']);
const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;

const signatureProvider = new JsSignatureProvider([privateKey]);
const api = new Api({ rpc, signatureProvider });

async function main() {
  console.log('=== Converting LOAN and METAL to XPR via DEX ===\n');

  // Step 1: Sell 500,000 LOAN on DEX for XMD
  const loanToSell = 500000;
  const loanRaw = Math.floor(loanToSell * 1e4);
  const loanPrice = Math.floor(0.000400 * 1e6); // Sell at $0.0004 (below market)

  console.log('Selling 500,000 LOAN on DEX...');

  const loanActions = [
    {
      account: 'loan.token',
      name: 'transfer',
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        from: username,
        to: 'dex',
        quantity: loanToSell.toFixed(4) + ' LOAN',
        memo: ''
      }
    },
    {
      account: 'dex',
      name: 'placeorder',
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        market_id: 11,
        account: username,
        order_type: 1,
        order_side: 2,
        quantity: loanRaw,
        price: loanPrice,
        bid_symbol: { sym: '4,LOAN', contract: 'loan.token' },
        ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
        trigger_price: 0,
        fill_type: 0,
        referrer: ''
      }
    },
    {
      account: 'dex',
      name: 'process',
      authorization: [{ actor: username, permission: 'active' }],
      data: { q_size: 10, show_error_msg: 0 }
    },
    {
      account: 'dex',
      name: 'withdrawall',
      authorization: [{ actor: username, permission: 'active' }],
      data: { account: username }
    }
  ];

  try {
    const r1 = await api.transact({ actions: loanActions }, { blocksBehind: 3, expireSeconds: 120 });
    console.log('LOAN sell order placed:', r1.transaction_id);
  } catch (e) {
    console.error('LOAN sell failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Step 2: Sell 1000 METAL on DEX for XMD
  const metalToSell = 1000;
  const metalRaw = Math.floor(metalToSell * 1e8);
  const metalPrice = Math.floor(0.14 * 1e6);

  console.log('Selling 1,000 METAL on DEX...');

  const metalActions = [
    {
      account: 'xtokens',
      name: 'transfer',
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        from: username,
        to: 'dex',
        quantity: metalToSell.toFixed(8) + ' METAL',
        memo: ''
      }
    },
    {
      account: 'dex',
      name: 'placeorder',
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        market_id: 10,
        account: username,
        order_type: 1,
        order_side: 2,
        quantity: metalRaw,
        price: metalPrice,
        bid_symbol: { sym: '8,METAL', contract: 'xtokens' },
        ask_symbol: { sym: '6,XMD', contract: 'xmd.token' },
        trigger_price: 0,
        fill_type: 0,
        referrer: ''
      }
    },
    {
      account: 'dex',
      name: 'process',
      authorization: [{ actor: username, permission: 'active' }],
      data: { q_size: 10, show_error_msg: 0 }
    },
    {
      account: 'dex',
      name: 'withdrawall',
      authorization: [{ actor: username, permission: 'active' }],
      data: { account: username }
    }
  ];

  try {
    const r2 = await api.transact({ actions: metalActions }, { blocksBehind: 3, expireSeconds: 120 });
    console.log('METAL sell order placed:', r2.transaction_id);
  } catch (e) {
    console.error('METAL sell failed:', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Check XMD balance and redeem to XUSDC
  const xmdBal = await rpc.get_table_rows({
    code: 'xmd.token', scope: username, table: 'accounts', json: true
  });

  let xmdAmount = 0;
  for (const row of xmdBal.rows) {
    if (row.balance && row.balance.includes('XMD')) xmdAmount = parseFloat(row.balance);
  }

  console.log('\nXMD balance:', xmdAmount.toFixed(6));

  if (xmdAmount > 1) {
    console.log('Redeeming XMD to XUSDC...');
    const redeemActions = [{
      account: 'xmd.token',
      name: 'transfer',
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        from: username,
        to: 'xmd.treasury',
        quantity: xmdAmount.toFixed(6) + ' XMD',
        memo: 'redeem,XUSDC'
      }
    }];

    try {
      const r3 = await api.transact({ actions: redeemActions }, { blocksBehind: 3, expireSeconds: 120 });
      console.log('XMD redeemed:', r3.transaction_id);
    } catch (e) {
      console.error('Redeem failed:', e.message);
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  // Step 4: Buy XPR with XUSDC
  const xusdcBal = await rpc.get_table_rows({
    code: 'xtokens', scope: username, table: 'accounts', json: true
  });

  let xusdcAmount = 0;
  for (const row of xusdcBal.rows) {
    if (row.balance && row.balance.includes('XUSDC')) xusdcAmount = parseFloat(row.balance);
  }

  console.log('XUSDC balance:', xusdcAmount.toFixed(6));

  // Keep $50 XUSDC for trading, convert rest to XPR
  const xusdcToSwap = Math.max(0, xusdcAmount - 50);

  if (xusdcToSwap > 10) {
    const poolsRes = await rpc.get_table_rows({
      code: 'proton.swaps', scope: 'proton.swaps', table: 'pools', limit: 100, json: true
    });
    const xprusdc = poolsRes.rows.find(p => p.lt_symbol.includes('XPRUSDC'));
    const ammPrice = parseFloat(xprusdc.pool2.quantity) / parseFloat(xprusdc.pool1.quantity);
    const expectedXpr = xusdcToSwap / ammPrice * 0.998;
    const minXpr = (expectedXpr * 0.97).toFixed(4);

    console.log('Swapping', xusdcToSwap.toFixed(6), 'XUSDC -> ~' + expectedXpr.toFixed(0) + ' XPR');

    const swapActions = [{
      account: 'xtokens',
      name: 'transfer',
      authorization: [{ actor: username, permission: 'active' }],
      data: {
        from: username,
        to: 'proton.swaps',
        quantity: xusdcToSwap.toFixed(6) + ' XUSDC',
        memo: 'XPRUSDC,' + minXpr + ' XPR'
      }
    }];

    try {
      const r4 = await api.transact({ actions: swapActions }, { blocksBehind: 3, expireSeconds: 120 });
      console.log('XUSDC -> XPR swap:', r4.transaction_id);
    } catch (e) {
      console.error('Swap failed:', e.message);
    }
  }

  // Final balances
  await new Promise(r => setTimeout(r, 1000));
  console.log('\n=== Final Balances ===');

  const finalXpr = await rpc.get_table_rows({ code: 'eosio.token', scope: username, table: 'accounts', json: true });
  const finalXtokens = await rpc.get_table_rows({ code: 'xtokens', scope: username, table: 'accounts', json: true });
  const finalLoan = await rpc.get_table_rows({ code: 'loan.token', scope: username, table: 'accounts', json: true });
  const finalXmd = await rpc.get_table_rows({ code: 'xmd.token', scope: username, table: 'accounts', json: true });

  for (const row of finalXpr.rows) console.log(row.balance);
  for (const row of finalXtokens.rows) {
    if (row.balance && (row.balance.includes('XUSDC') || row.balance.includes('METAL'))) console.log(row.balance);
  }
  for (const row of finalLoan.rows) console.log(row.balance);
  for (const row of finalXmd.rows) console.log(row.balance);
}

main().catch(console.error);
