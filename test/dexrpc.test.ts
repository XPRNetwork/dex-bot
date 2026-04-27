import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock utils so dexrpc can initialize without real config/secrets.
vi.mock('../src/utils', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  getConfig: () => ({
    rpc: { endpoints: ['https://test'], privateKey: '5JLkR4qUCwzM9j9Wxe1nRBtUx8r7JR3UFt6vEAnSj9TyZkM5Yyt', privateKeyPermission: 'active' },
  }),
  getUsername: () => 'testuser',
}));

vi.mock('../src/health-monitor', () => ({
  healthMonitor: {
    recordSuccess: vi.fn(),
    recordError: vi.fn(),
  },
}));

// Mock @proton/js so api.transact is a controllable spy. vi.mock is hoisted,
// so we capture the spy via vi.hoisted to dodge TDZ on `transactSpy`.
const { transactSpy } = vi.hoisted(() => ({ transactSpy: vi.fn() }));
vi.mock('@proton/js', () => {
  class Api {
    transact = transactSpy;
    constructor(_args: unknown) {}
  }
  class JsonRpc {
    constructor(_endpoints: string[]) {}
  }
  class JsSignatureProvider {
    constructor(_keys: string[]) {}
  }
  const Serialize = {};
  return { Api, JsonRpc, JsSignatureProvider, Serialize };
});

import { ORDERSIDES } from '../src/core/constants';
import { prepareLimitOrder, submitOrders, __getQueuedActionCount } from '../src/dexrpc';
import * as dexapi from '../src/dexapi';

const market = {
  market_id: 1,
  symbol: 'XPR_XMD',
  bid_token: { code: 'XPR', precision: 4, contract: 'eosio.token', multiplier: 10000 },
  ask_token: { code: 'XMD', precision: 6, contract: 'xmd.token', multiplier: 1000000 },
};

describe('dexrpc.submitOrders — actions queue lifecycle', () => {
  beforeEach(() => {
    transactSpy.mockReset();
    vi.spyOn(dexapi, 'getMarketBySymbol').mockReturnValue(market as never);
  });

  it('clears the queued actions even when apiTransact throws', async () => {
    transactSpy.mockRejectedValueOnce(new Error('assertion failure with message: overdrawn balance'));

    await prepareLimitOrder('XPR_XMD', ORDERSIDES.SELL, 25000, 0.003);
    expect(__getQueuedActionCount()).toBe(2); // transfer + placeorder

    await expect(submitOrders()).rejects.toThrow(/overdrawn balance/);

    // The bug: before the fix, this would still be > 0 and the next
    // prepareLimitOrder would append onto a stale queue.
    expect(__getQueuedActionCount()).toBe(0);
  });

  it('does not include actions from a previously failed submit in the next bundle', async () => {
    transactSpy.mockRejectedValueOnce(new Error('assertion failure with message: overdrawn balance'));
    await prepareLimitOrder('XPR_XMD', ORDERSIDES.SELL, 25000, 0.003);
    await expect(submitOrders()).rejects.toThrow();

    transactSpy.mockResolvedValueOnce({ transaction_id: 'tx-2' });
    await prepareLimitOrder('XPR_XMD', ORDERSIDES.SELL, 25000, 0.003);
    await submitOrders();

    // Second submit should send: 1 transfer + 1 placeorder + 1 process + 1 withdrawall = 4 actions.
    // If the queue weren't cleared, it would be 6+ (the stale prior bundle plus the new one).
    const sentActions = transactSpy.mock.calls[1][0].actions;
    expect(sentActions).toHaveLength(4);
    expect(sentActions[0].name).toBe('transfer');
    expect(sentActions[1].name).toBe('placeorder');
    expect(sentActions[2].name).toBe('process');
    expect(sentActions[3].name).toBe('withdrawall');
  });

  it('clears the queue on a successful submit too', async () => {
    transactSpy.mockResolvedValueOnce({ transaction_id: 'tx-1' });
    await prepareLimitOrder('XPR_XMD', ORDERSIDES.SELL, 25000, 0.003);
    await submitOrders();
    expect(__getQueuedActionCount()).toBe(0);
  });
});
