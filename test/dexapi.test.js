import chai from 'chai';
import { fetchBalances } from '../dexapi.js';

const { assert } = chai;

describe('fetchBalances', () => {
  it('should fetch real balances', async () => {
    const balances = await fetchBalances('user1');
    assert.isArray({});
  });
});
