/**
 * Rebalance Script
 *
 * Swaps XPR to XUSDC to achieve 50/50 allocation
 */

import 'dotenv/config';
import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';

const username = process.env.PROTON_USERNAME || 'tradingbot';
const privateKey = process.env.PROTON_PRIVATE_KEY;

if (!privateKey) {
  console.error('Missing PROTON_PRIVATE_KEY in .env');
  process.exit(1);
}

const endpoints = [
  'https://rpc.api.mainnet.metalx.com',
  'https://proton.eosusa.io'
];

const rpc = new JsonRpc(endpoints);
const signatureProvider = new JsSignatureProvider([privateKey]);
const api = new Api({ rpc, signatureProvider });

async function getBalance(account: string, token: string, contract: string): Promise<number> {
  try {
    const result = await rpc.get_table_rows({
      code: contract,
      scope: account,
      table: 'accounts',
      limit: 100,
      json: true
    });

    for (const row of result.rows) {
      if (row.balance.includes(token)) {
        return parseFloat(row.balance.split(' ')[0]);
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

async function swapOnAMM(
  fromToken: string,
  fromContract: string,
  fromAmount: string,
  toToken: string,
  poolSymbol: string,
  minOutput: string
): Promise<void> {
  const memo = `${poolSymbol},${minOutput}`;

  console.log(`Swapping ${fromAmount} via ${poolSymbol}`);
  console.log(`Memo: ${memo}`);

  const actions = [{
    account: fromContract,
    name: 'transfer',
    authorization: [{ actor: username, permission: 'active' }],
    data: {
      from: username,
      to: 'proton.swaps',
      quantity: fromAmount,
      memo: memo
    }
  }];

  const result = await api.transact({ actions }, {
    blocksBehind: 300,
    expireSeconds: 3000
  });

  console.log('Swap successful!');
  console.log('TX:', (result as any).transaction_id);
}

async function main() {
  console.log('=== Portfolio Rebalancer ===\n');
  console.log(`Account: ${username}`);

  // Get current balances
  const xprBalance = await getBalance(username, 'XPR', 'eosio.token');
  const xusdcBalance = await getBalance(username, 'XUSDC', 'xtokens');
  const xmdBalance = await getBalance(username, 'XMD', 'xmd.token');

  console.log('\nCurrent Balances:');
  console.log(`  XPR: ${xprBalance.toFixed(4)}`);
  console.log(`  XUSDC: ${xusdcBalance.toFixed(6)}`);
  console.log(`  XMD: ${xmdBalance.toFixed(6)}`);

  // Get XPR price from AMM
  const poolResult = await rpc.get_table_rows({
    code: 'proton.swaps',
    scope: 'proton.swaps',
    table: 'pools',
    limit: 100,
    json: true
  });

  let xprPrice = 0;
  for (const pool of poolResult.rows) {
    if (pool.lt_symbol.includes('XPRUSDC')) {
      const xprAmount = parseFloat(pool.pool1.quantity.split(' ')[0]);
      const usdcAmount = parseFloat(pool.pool2.quantity.split(' ')[0]);
      xprPrice = usdcAmount / xprAmount;
      break;
    }
  }

  console.log(`\nXPR Price: $${xprPrice.toFixed(6)}`);

  // Calculate total value
  const totalValueUSD = (xprBalance * xprPrice) + xusdcBalance + xmdBalance;
  console.log(`Total Value: ~$${totalValueUSD.toFixed(2)}`);

  // Target: 50% XPR, 50% stables
  const targetStableValue = totalValueUSD / 2;
  const currentStableValue = xusdcBalance + xmdBalance;
  const stablesToBuy = targetStableValue - currentStableValue;

  if (stablesToBuy <= 1) {
    console.log('\nPortfolio already balanced!');
    return;
  }

  // Calculate XPR to swap
  const xprToSwap = stablesToBuy / xprPrice;
  const xprToSwapRounded = Math.floor(xprToSwap);

  console.log(`\nRebalancing Plan:`);
  console.log(`  Swap ${xprToSwapRounded.toFixed(4)} XPR → XUSDC`);
  console.log(`  Expected output: ~$${stablesToBuy.toFixed(2)} XUSDC`);

  // Calculate minimum output with 2% slippage
  const minOutputAmount = stablesToBuy * 0.98;
  const minOutput = `${minOutputAmount.toFixed(6)} XUSDC`;

  console.log(`  Min output (2% slippage): ${minOutput}`);

  // Execute swap
  console.log('\nExecuting swap...');

  await swapOnAMM(
    'XPR',
    'eosio.token',
    `${xprToSwapRounded.toFixed(4)} XPR`,
    'XUSDC',
    'XPRUSDC',
    minOutput
  );

  // Check new balances
  const newXprBalance = await getBalance(username, 'XPR', 'eosio.token');
  const newXusdcBalance = await getBalance(username, 'XUSDC', 'xtokens');

  console.log('\nNew Balances:');
  console.log(`  XPR: ${newXprBalance.toFixed(4)}`);
  console.log(`  XUSDC: ${newXusdcBalance.toFixed(6)}`);

  const newTotalUSD = (newXprBalance * xprPrice) + newXusdcBalance;
  const xprPercent = (newXprBalance * xprPrice / newTotalUSD * 100).toFixed(1);
  const stablePercent = (newXusdcBalance / newTotalUSD * 100).toFixed(1);

  console.log(`\nAllocation: ${xprPercent}% XPR / ${stablePercent}% Stables`);
  console.log('\nRebalancing complete!');
}

main().catch(console.error);
