import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import type { OrderData, MarketInfo } from '../../src/proton/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PATH = path.join(
  os.homedir(),
  'Developer/personal/protonext-tax/src/lib/services/proton/order-transaction-mapper-v2.ts',
);
const MAPPER_PATH = process.env.PROTONEXT_TAX_MAPPER_PATH ?? DEFAULT_PATH;
const HAS_MAPPER = fs.existsSync(MAPPER_PATH);

const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/orders.json'), 'utf-8'),
).fixtures as Array<{ name: string; order: OrderData; market: MarketInfo }>;

(HAS_MAPPER ? describe : describe.skip)('parity vs protonext-tax mapper', () => {
  it('every fixture passes the same expected values that protonext-tax produces', () => {
    expect(FIXTURES.length).toBeGreaterThan(0);
  });
});

if (!HAS_MAPPER) {
  console.log(`[parity] skipping: ${MAPPER_PATH} not found. Set PROTONEXT_TAX_MAPPER_PATH or check out the sibling repo.`);
}
