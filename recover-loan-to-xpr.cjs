// Recovery: Swap excess LOAN back to XPR via AMM
require('dotenv').config();
const { JsonRpc, Api, JsSignatureProvider } = require('@proton/js');

const username = process.env.PROTON_USERNAME;
const privateKey = process.env.PROTON_PRIVATE_KEY;

console.log('Swap LOAN → XPR for account:', username);

const rpc = new JsonRpc(['https://proton.eosusa.io', 'https://proton.greymass.com']);
const api = new Api({
  rpc,
  signatureProvider: new JsSignatureProvider([privateKey])
});

async function swapLoanToXpr() {
  // Check current balances
  const [loanRes, xprRes] = await Promise.all([
    rpc.get_table_rows({ code: 'loan.token', scope: username, table: 'accounts', json: true }),
    rpc.get_table_rows({ code: 'eosio.token', scope: username, table: 'accounts', json: true })
  ]);

  const loanBalance = parseFloat(loanRes.rows[0]?.balance || '0');
  const xprBalance = parseFloat(xprRes.rows[0]?.balance || '0');
  console.log(`Current: ${loanBalance.toFixed(4)} LOAN, ${xprBalance.toFixed(4)} XPR`);

  // Pre-trade LOAN was ~177,622 - swap excess back
  const preTradeLoan = 177622;
  const excessLoan = loanBalance - preTradeLoan;

  if (excessLoan < 100) {
    console.log('No excess LOAN to swap back');
    return;
  }

  console.log(`Excess LOAN from failed trade: ${excessLoan.toFixed(4)}`);

  // Check AMM pool state
  const poolRes = await rpc.get_table_rows({
    code: 'proton.swaps', scope: 'proton.swaps', table: 'pools', json: true, limit: 100
  });
  const xprloan = poolRes.rows.find(p => p.lt_symbol?.includes('XPRLOAN'));
  if (xprloan) {
    console.log(`AMM pool: ${JSON.stringify(xprloan.pool1)} / ${JSON.stringify(xprloan.pool2)}`);
  }

  // Swap in chunks of 50,000 LOAN to minimize slippage
  const chunkSize = 50000;
  const chunks = Math.ceil(excessLoan / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const amount = Math.min(chunkSize, excessLoan - (i * chunkSize));
    const amountStr = `${amount.toFixed(4)} LOAN`;

    // Calculate expected XPR output (rough estimate)
    const expectedXpr = amount * 0.14; // ~0.14 XPR per LOAN based on recent prices
    const minExpected = (expectedXpr * 0.95).toFixed(4); // 5% slippage tolerance

    console.log(`\nChunk ${i+1}/${chunks}: Swapping ${amountStr} → XPR (min: ${minExpected} XPR)`);

    const result = await api.transact({
      actions: [{
        account: 'loan.token',
        name: 'transfer',
        data: {
          from: username,
          to: 'proton.swaps',
          quantity: amountStr,
          memo: `XPRLOAN,${minExpected} XPR`
        },
        authorization: [{ actor: username, permission: 'active' }]
      }]
    }, {
      blocksBehind: 300,
      expireSeconds: 3000
    });

    console.log(`  TX: ${result.transaction_id}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Check final balances
  await new Promise(r => setTimeout(r, 2000));
  const [loanFinal, xprFinal] = await Promise.all([
    rpc.get_table_rows({ code: 'loan.token', scope: username, table: 'accounts', json: true }),
    rpc.get_table_rows({ code: 'eosio.token', scope: username, table: 'accounts', json: true })
  ]);

  console.log(`\nFinal: ${parseFloat(loanFinal.rows[0]?.balance || '0').toFixed(4)} LOAN, ${parseFloat(xprFinal.rows[0]?.balance || '0').toFixed(4)} XPR`);
  console.log(`XPR recovered: ${(parseFloat(xprFinal.rows[0]?.balance || '0') - xprBalance).toFixed(4)}`);
}

swapLoanToXpr().catch(e => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
