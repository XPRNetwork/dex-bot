/**
 * Quick test script to verify SimpleDEX pool parsing and profit calculations.
 * Run: npx ts-node --esm scripts/test-simpledex.ts
 */

import { JsonRpc } from '@proton/js';

const rpc = new JsonRpc(['https://proton.eosusa.io']);

interface Pool {
  id: number;
  tokenASymbol: string;
  tokenAPrecision: number;
  tokenBSymbol: string;
  tokenBPrecision: number;
  reserveA: bigint;
  reserveB: bigint;
  feeRate: number;
}

async function main() {
  // 1. Fetch SimpleDEX pools
  console.log('=== SimpleDEX Pools ===');
  const sdexRes = await rpc.get_table_rows({
    json: true, code: 'simpledex', scope: 'simpledex', table: 'pools', limit: 100
  });

  const pools = new Map<number, Pool>();
  const POOL_IDS = [1, 15, 16, 24, 25];

  for (const row of sdexRes.rows) {
    if (!POOL_IDS.includes(row.id)) continue;
    const aSym = row.tokenASymbol.split(',');
    const bSym = row.tokenBSymbol.split(',');
    const pool: Pool = {
      id: row.id,
      tokenASymbol: aSym[1],
      tokenAPrecision: parseInt(aSym[0]),
      tokenBSymbol: bSym[1],
      tokenBPrecision: parseInt(bSym[0]),
      reserveA: BigInt(row.reserveA),
      reserveB: BigInt(row.reserveB),
      feeRate: row.feeRate
    };
    pools.set(pool.id, pool);

    const aFloat = Number(pool.reserveA) / (10 ** pool.tokenAPrecision);
    const bFloat = Number(pool.reserveB) / (10 ** pool.tokenBPrecision);
    console.log(`  Pool ${pool.id}: ${pool.tokenASymbol}/${pool.tokenBSymbol} = ${aFloat.toFixed(4)} / ${bFloat.toFixed(4)} (fee: ${pool.feeRate} bps)`);
  }

  // 2. Fetch proton.swaps pools
  console.log('\n=== proton.swaps AMM Pools ===');
  const ammRes = await rpc.get_table_rows({
    json: true, code: 'proton.swaps', scope: 'proton.swaps', table: 'pools', limit: 100
  });

  interface AmmPool { token1: string; prec1: number; amount1: number; token2: string; prec2: number; amount2: number; fee: number; }
  const ammPools = new Map<string, AmmPool>();

  for (const row of ammRes.rows) {
    const sym = row.lt_symbol?.split(',')[1];
    if (!sym || !['XPRUSDC', 'XPRLOAN', 'SNIPSXP'].includes(sym)) continue;

    const p1 = row.pool1.quantity.trim().split(' ');
    const p2 = row.pool2.quantity.trim().split(' ');
    const prec1 = p1[0].split('.')[1]?.length || 0;
    const prec2 = p2[0].split('.')[1]?.length || 0;

    const pool: AmmPool = {
      token1: p1[1], prec1, amount1: parseFloat(p1[0]),
      token2: p2[1], prec2, amount2: parseFloat(p2[0]),
      fee: row.fee?.exchange_fee || 20
    };
    ammPools.set(sym, pool);
    console.log(`  ${sym}: ${pool.token1}=${pool.amount1.toFixed(4)} / ${pool.token2}=${pool.amount2.toFixed(4)} (fee: ${pool.fee} bps)`);
  }

  // 3. Helper: BigInt AMM swap
  function ammSwap(inputRaw: bigint, reserveInRaw: bigint, reserveOutRaw: bigint, feeBps: number): bigint {
    const fee = inputRaw * BigInt(feeBps) / 10000n;
    const netInput = inputRaw - fee;
    return netInput * reserveOutRaw / (reserveInRaw + netInput);
  }

  // 4. Helper: BigInt SimpleDEX swap
  function sdexSwap(poolId: number, inputRaw: bigint, isTokenAIn: boolean): bigint {
    const pool = pools.get(poolId)!;
    const reserveIn = isTokenAIn ? pool.reserveA : pool.reserveB;
    const reserveOut = isTokenAIn ? pool.reserveB : pool.reserveA;
    const fee = inputRaw * BigInt(pool.feeRate) / 10000n;
    const netInput = inputRaw - fee;
    return netInput * reserveOut / (reserveIn + netInput);
  }

  // 5. Test routes
  const xprloan = ammPools.get('XPRLOAN')!;
  const xprusdc = ammPools.get('XPRUSDC')!;
  const xprPrice = xprusdc.amount2 / xprusdc.amount1;

  const testXpr = 10000; // 10,000 XPR
  const testXprRaw = BigInt(testXpr * 10000); // 4 decimals

  console.log(`\n=== Route Calculations (${testXpr} XPR, price=$${xprPrice.toFixed(6)}, $${(testXpr * xprPrice).toFixed(2)}) ===`);

  // LOAN_TRIANGLE: XPR → LOAN (AMM) → EXIT (SDEX 16) → XPR (SDEX 15)
  {
    const ammInRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
    const ammOutRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));
    const loanRaw = ammSwap(testXprRaw, ammInRaw, ammOutRaw, xprloan.fee);
    const exitRaw = sdexSwap(16, loanRaw, false); // LOAN=tokenB, isTokenAIn=false
    const endXprRaw = sdexSwap(15, exitRaw, false); // EXIT=tokenB, isTokenAIn=false

    const profitRaw = endXprRaw - testXprRaw;
    const profitBps = Number(profitRaw * 10000n / testXprRaw);
    const profitXpr = Number(profitRaw) / 10000;
    console.log(`  LOAN_TRIANGLE:     ${testXpr} XPR → ${(Number(loanRaw)/10000).toFixed(4)} LOAN → ${(Number(exitRaw)/10000).toFixed(4)} EXIT → ${(Number(endXprRaw)/10000).toFixed(4)} XPR | profit: ${profitBps} BPS ($${(profitXpr * xprPrice).toFixed(4)})`);
  }

  // LOAN_TRIANGLE_REV: XPR → EXIT (SDEX 15) → LOAN (SDEX 16) → XPR (AMM)
  {
    const exitRaw = sdexSwap(15, testXprRaw, true); // XPR=tokenA, isTokenAIn=true
    const loanRaw = sdexSwap(16, exitRaw, true); // EXIT=tokenA, isTokenAIn=true
    const ammXprRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
    const ammLoanRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));
    const endXprRaw = ammSwap(loanRaw, ammLoanRaw, ammXprRaw, xprloan.fee);

    const profitRaw = endXprRaw - testXprRaw;
    const profitBps = Number(profitRaw * 10000n / testXprRaw);
    const profitXpr = Number(profitRaw) / 10000;
    console.log(`  LOAN_TRIANGLE_REV: ${testXpr} XPR → ${(Number(exitRaw)/10000).toFixed(4)} EXIT → ${(Number(loanRaw)/10000).toFixed(4)} LOAN → ${(Number(endXprRaw)/10000).toFixed(4)} XPR | profit: ${profitBps} BPS ($${(profitXpr * xprPrice).toFixed(4)})`);
  }

  // LOAN_DIRECT: XPR → LOAN (AMM) → XPR (SDEX 24)
  {
    const ammInRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
    const ammOutRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));
    const loanRaw = ammSwap(testXprRaw, ammInRaw, ammOutRaw, xprloan.fee);
    const endXprRaw = sdexSwap(24, loanRaw, false); // LOAN=tokenB, isTokenAIn=false

    const profitRaw = endXprRaw - testXprRaw;
    const profitBps = Number(profitRaw * 10000n / testXprRaw);
    const profitXpr = Number(profitRaw) / 10000;
    console.log(`  LOAN_DIRECT:       ${testXpr} XPR → ${(Number(loanRaw)/10000).toFixed(4)} LOAN → ${(Number(endXprRaw)/10000).toFixed(4)} XPR | profit: ${profitBps} BPS ($${(profitXpr * xprPrice).toFixed(4)})`);
  }

  // LOAN_DIRECT_REV: XPR → LOAN (SDEX 24) → XPR (AMM)
  {
    const loanRaw = sdexSwap(24, testXprRaw, true); // XPR=tokenA, isTokenAIn=true
    const ammXprRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
    const ammLoanRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));
    const endXprRaw = ammSwap(loanRaw, ammLoanRaw, ammXprRaw, xprloan.fee);

    const profitRaw = endXprRaw - testXprRaw;
    const profitBps = Number(profitRaw * 10000n / testXprRaw);
    const profitXpr = Number(profitRaw) / 10000;
    console.log(`  LOAN_DIRECT_REV:   ${testXpr} XPR → ${(Number(loanRaw)/10000).toFixed(4)} LOAN → ${(Number(endXprRaw)/10000).toFixed(4)} XPR | profit: ${profitBps} BPS ($${(profitXpr * xprPrice).toFixed(4)})`);
  }

  // SNIPS routes
  const snipsxp = ammPools.get('SNIPSXP');
  if (snipsxp && pools.has(25)) {
    // SNIPS_CROSS: XPR → SNIPS (SDEX 25) → XPR (AMM)
    {
      const snipsRaw = sdexSwap(25, testXprRaw, false); // XPR=tokenB, isTokenAIn=false → get SNIPS
      const ammSnipsRaw = BigInt(Math.floor(snipsxp.amount1 * (10 ** snipsxp.prec1)));
      const ammXprRaw = BigInt(Math.floor(snipsxp.amount2 * (10 ** snipsxp.prec2)));
      const endXprRaw = ammSwap(snipsRaw, ammSnipsRaw, ammXprRaw, snipsxp.fee);

      const profitRaw = endXprRaw - testXprRaw;
      const profitBps = Number(profitRaw * 10000n / testXprRaw);
      const profitXpr = Number(profitRaw) / 10000;
      console.log(`  SNIPS_CROSS:       ${testXpr} XPR → ${(Number(snipsRaw)/10000).toFixed(4)} SNIPS → ${(Number(endXprRaw)/10000).toFixed(4)} XPR | profit: ${profitBps} BPS ($${(profitXpr * xprPrice).toFixed(4)})`);
    }

    // SNIPS_CROSS_REV: XPR → SNIPS (AMM) → XPR (SDEX 25)
    {
      const ammSnipsRaw = BigInt(Math.floor(snipsxp.amount1 * (10 ** snipsxp.prec1)));
      const ammXprRaw = BigInt(Math.floor(snipsxp.amount2 * (10 ** snipsxp.prec2)));
      const snipsRaw = ammSwap(testXprRaw, ammXprRaw, ammSnipsRaw, snipsxp.fee);
      const endXprRaw = sdexSwap(25, snipsRaw, true); // SNIPS=tokenA, isTokenAIn=true → get XPR

      const profitRaw = endXprRaw - testXprRaw;
      const profitBps = Number(profitRaw * 10000n / testXprRaw);
      const profitXpr = Number(profitRaw) / 10000;
      console.log(`  SNIPS_CROSS_REV:   ${testXpr} XPR → ${(Number(snipsRaw)/10000).toFixed(4)} SNIPS → ${(Number(endXprRaw)/10000).toFixed(4)} XPR | profit: ${profitBps} BPS ($${(profitXpr * xprPrice).toFixed(4)})`);
    }
  }

  // 6. Optimal trade size search for best route
  console.log('\n=== Optimal Trade Size Search ===');
  for (const size of [100, 500, 1000, 2000, 5000, 10000, 20000, 50000]) {
    const sizeRaw = BigInt(size * 10000);
    const ammInRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
    const ammOutRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));

    // LOAN_TRIANGLE
    const loan1 = ammSwap(sizeRaw, ammInRaw, ammOutRaw, xprloan.fee);
    const exit1 = sdexSwap(16, loan1, false);
    const end1 = sdexSwap(15, exit1, false);
    const bps1 = Number((end1 - sizeRaw) * 10000n / sizeRaw);

    // LOAN_DIRECT
    const loan2 = ammSwap(sizeRaw, ammInRaw, ammOutRaw, xprloan.fee);
    const end2 = sdexSwap(24, loan2, false);
    const bps2 = Number((end2 - sizeRaw) * 10000n / sizeRaw);

    console.log(`  ${size.toString().padStart(6)} XPR ($${(size * xprPrice).toFixed(2).padStart(7)}): TRIANGLE=${bps1.toString().padStart(4)} BPS | DIRECT=${bps2.toString().padStart(4)} BPS`);
  }
}

main().catch(console.error);
