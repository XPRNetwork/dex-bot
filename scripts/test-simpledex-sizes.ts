import { JsonRpc } from '@proton/js';
const rpc = new JsonRpc(['https://proton.eosusa.io']);

async function main() {
  const sdexRes = await rpc.get_table_rows({ json: true, code: 'simpledex', scope: 'simpledex', table: 'pools', limit: 100 });
  const ammRes = await rpc.get_table_rows({ json: true, code: 'proton.swaps', scope: 'proton.swaps', table: 'pools', limit: 100 });

  const pools = new Map<number, { reserveA: bigint; reserveB: bigint; feeRate: number }>();
  for (const row of sdexRes.rows) {
    if (![15,16,24,25].includes(row.id)) continue;
    pools.set(row.id, { reserveA: BigInt(row.reserveA), reserveB: BigInt(row.reserveB), feeRate: row.feeRate });
  }

  let xprloan = { amount1: 0, prec1: 0, amount2: 0, prec2: 0, fee: 20 };
  let xprusdc = { amount1: 0, amount2: 0 };
  for (const row of ammRes.rows) {
    const sym = row.lt_symbol?.split(',')[1];
    if (sym === 'XPRLOAN') {
      const p1 = row.pool1.quantity.split(' '), p2 = row.pool2.quantity.split(' ');
      xprloan = { amount1: parseFloat(p1[0]), prec1: p1[0].split('.')[1].length, amount2: parseFloat(p2[0]), prec2: p2[0].split('.')[1].length, fee: row.fee.exchange_fee };
    }
    if (sym === 'XPRUSDC') {
      const p1 = row.pool1.quantity.split(' '), p2 = row.pool2.quantity.split(' ');
      xprusdc = { amount1: parseFloat(p1[0]), amount2: parseFloat(p2[0]) };
    }
  }

  const xprPrice = xprusdc.amount2 / xprusdc.amount1;
  const ammSwap = (i: bigint, ri: bigint, ro: bigint, f: number) => {
    const fee = i * BigInt(f) / 10000n;
    const n = i - fee;
    return n * ro / (ri + n);
  };
  const sdexSwap = (id: number, i: bigint, isA: boolean) => {
    const p = pools.get(id)!;
    const ri = isA ? p.reserveA : p.reserveB;
    const ro = isA ? p.reserveB : p.reserveA;
    const fee = i * BigInt(p.feeRate) / 10000n;
    const n = i - fee;
    return n * ro / (ri + n);
  };

  const ammInRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
  const ammOutRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));

  console.log('=== Fine-grained trade size search ===');
  console.log('  Size XPR |  Size USD | TRI BPS |  TRI USD | DIR BPS |  DIR USD');
  for (const size of [50, 75, 100, 150, 200, 300, 400, 500, 600, 700, 800, 1000, 1500, 2000, 3000]) {
    const sizeRaw = BigInt(size * 10000);

    // LOAN_TRIANGLE: XPR → LOAN (AMM) → EXIT (SDEX 16) → XPR (SDEX 15)
    const loan1 = ammSwap(sizeRaw, ammInRaw, ammOutRaw, xprloan.fee);
    const exit1 = sdexSwap(16, loan1, false);
    const end1 = sdexSwap(15, exit1, false);
    const bps1 = Number((end1 - sizeRaw) * 10000n / sizeRaw);
    const usd1 = Number(end1 - sizeRaw) / 10000 * xprPrice;

    // LOAN_DIRECT: XPR → LOAN (AMM) → XPR (SDEX 24)
    const loan2 = ammSwap(sizeRaw, ammInRaw, ammOutRaw, xprloan.fee);
    const end2 = sdexSwap(24, loan2, false);
    const bps2 = Number((end2 - sizeRaw) * 10000n / sizeRaw);
    const usd2 = Number(end2 - sizeRaw) / 10000 * xprPrice;

    console.log(`  ${size.toString().padStart(8)} | $${(size*xprPrice).toFixed(3).padStart(7)} | ${bps1.toString().padStart(7)} | $${usd1.toFixed(5).padStart(8)} | ${bps2.toString().padStart(7)} | $${usd2.toFixed(5).padStart(8)}`);
  }

  // Also check reverse directions
  console.log('\n=== Reverse directions ===');
  console.log('  Size XPR |  Size USD | TRI_REV | REV USD  | DIR_REV | REV USD');
  const ammXprRaw = BigInt(Math.floor(xprloan.amount1 * (10 ** xprloan.prec1)));
  const ammLoanRaw = BigInt(Math.floor(xprloan.amount2 * (10 ** xprloan.prec2)));
  for (const size of [50, 75, 100, 150, 200, 300, 400, 500, 700, 1000]) {
    const sizeRaw = BigInt(size * 10000);

    // LOAN_TRIANGLE_REV: XPR → EXIT (SDEX 15) → LOAN (SDEX 16) → XPR (AMM)
    const exit3 = sdexSwap(15, sizeRaw, true);
    const loan3 = sdexSwap(16, exit3, true);
    const end3 = ammSwap(loan3, ammLoanRaw, ammXprRaw, xprloan.fee);
    const bps3 = Number((end3 - sizeRaw) * 10000n / sizeRaw);
    const usd3 = Number(end3 - sizeRaw) / 10000 * xprPrice;

    // LOAN_DIRECT_REV: XPR → LOAN (SDEX 24) → XPR (AMM)
    const loan4 = sdexSwap(24, sizeRaw, true);
    const end4 = ammSwap(loan4, ammLoanRaw, ammXprRaw, xprloan.fee);
    const bps4 = Number((end4 - sizeRaw) * 10000n / sizeRaw);
    const usd4 = Number(end4 - sizeRaw) / 10000 * xprPrice;

    console.log(`  ${size.toString().padStart(8)} | $${(size*xprPrice).toFixed(3).padStart(7)} | ${bps3.toString().padStart(7)} | $${usd3.toFixed(5).padStart(8)} | ${bps4.toString().padStart(7)} | $${usd4.toFixed(5).padStart(8)}`);
  }
}

main().catch(console.error);
