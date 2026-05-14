import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapOrderToTrade } from '../../src/proton/order-trade-mapper';
import type { OrderData, MarketInfo } from '../../src/proton/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Fixture {
  name: string;
  description: string;
  order: OrderData;
  market: MarketInfo;
  expected: {
    shouldCreate: boolean;
    skipReason?: string;
    buyAmount?: number;
    buyCurrency?: string;
    sellAmount?: number;
    sellCurrency?: string;
    feeAmount?: number;
    feeCurrency?: string;
  };
}

const fixtures: Fixture[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/orders.json'), 'utf-8'),
).fixtures;

const APPROX = (a: number, b: number) => Math.abs(a - b) < 0.000001;

for (const f of fixtures) {
  describe(`mapOrderToTrade: ${f.name}`, () => {
    const result = mapOrderToTrade(f.order, f.market);

    it('shouldCreate matches expected', () => {
      expect(result.shouldCreate).toBe(f.expected.shouldCreate);
    });

    if (!f.expected.shouldCreate && f.expected.skipReason) {
      it(`skip reason matches: "${f.expected.skipReason}"`, () => {
        expect(result.skipReason).toBe(f.expected.skipReason);
      });
    }

    if (f.expected.shouldCreate) {
      it('produces a transaction', () => {
        expect(result.transaction).not.toBeNull();
      });
      it('buyAmount matches', () => {
        expect(APPROX(result.transaction!.buyAmount, f.expected.buyAmount!)).toBe(true);
      });
      it('buyCurrency matches', () => {
        expect(result.transaction!.buyCurrency).toBe(f.expected.buyCurrency);
      });
      it('sellAmount matches', () => {
        expect(APPROX(result.transaction!.sellAmount, f.expected.sellAmount!)).toBe(true);
      });
      it('sellCurrency matches', () => {
        expect(result.transaction!.sellCurrency).toBe(f.expected.sellCurrency);
      });
      if (f.expected.feeAmount !== undefined) {
        it('feeAmount matches', () => {
          expect(APPROX(result.transaction!.feeAmount!, f.expected.feeAmount!)).toBe(true);
        });
      }
      if (f.expected.feeCurrency !== undefined) {
        it('feeCurrency matches', () => {
          expect(result.transaction!.feeCurrency).toBe(f.expected.feeCurrency);
        });
      }
    }
  });
}
