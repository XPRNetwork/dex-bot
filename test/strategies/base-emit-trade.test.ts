import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils', () => ({
  getConfig: () => ({
    dashboard: { url: 'http://d.test', apiKey: 'k', instanceId: 'i1', enabled: true },
    strategy: 'gridBot',
  }),
  getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
  getUsername: () => 'tester',
}));

vi.mock('../../src/dexapi', () => ({ getMarketBySymbol: () => undefined }));
vi.mock('../../src/dexrpc', () => ({
  prepareLimitOrder: vi.fn(),
  submitProcessAction: vi.fn(),
  submitOrders: vi.fn(),
  cancelOrder: vi.fn(),
}));

describe('TradingStrategyBase.emitFillAsTrade', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
  });

  it('builds a both-legs trade via the mapper and posts it', async () => {
    const { TradingStrategyBase } = await import('../../src/strategies/base');
    const { tradesEmitter } = await import('../../src/trades');
    tradesEmitter.initialize();

    class TestStrat extends (TradingStrategyBase as any) {
      async initialize() {} async trade() {}
    }
    const s = new TestStrat();

    await s.emitFillAsTrade(
      {
        orderId: '999', orderSide: 1, orderType: 0, marketId: 1,
        accountName: 'tester', price: 0.003673,
        quantityInit: 73.69541, quantityFilled: 73.69541,
        filledTotal: 20069.5561, filledAmount: 20053.5005, filledFee: 16.0556,
        finalStatus: 'filled', isFullyFilled: true,
        orderCreatedAt: '2026-01-15T10:00:00.000Z',
        orderCompletedAt: '2026-01-15T10:00:05.000Z',
      },
      {
        marketId: 1, symbol: 'XPR_XMD',
        baseToken: 'XPR', quoteToken: 'XMD',
        makerFee: 0.001, takerFee: 0.002,
      },
      { mode: 'live', txId: 'txn-9' },
    );

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.venue).toBe('proton');
    expect(body.symbol).toBe('XPR_XMD');
    expect(body.sentAmount).toBeCloseTo(73.69541);
    expect(body.sentCurrency).toBe('XMD');
    expect(body.receivedAmount).toBeCloseTo(20053.5005);
    expect(body.receivedCurrency).toBe('XPR');
    expect(body.feeCurrency).toBe('XPR');
    expect(body.txId).toBe('txn-9');
  });
});
