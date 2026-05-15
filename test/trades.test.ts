import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/utils', async () => {
  return {
    getConfig: () => ({
      dashboard: {
        url: 'http://dashboard.test',
        apiKey: 'k1',
        instanceId: 'i1',
        enabled: true,
      },
    }),
    getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
  };
});

describe('tradesEmitter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a trade to /api/trades with correct shape', async () => {
    const { tradesEmitter } = await import('../src/trades');
    tradesEmitter.initialize();
    await tradesEmitter.emit({
      instanceId: 'i1', symbol: 'XPR_XMD', side: 'BUY',
      price: 0.002, quantity: 1000, mode: 'live',
      venue: 'proton',
      sentAmount: 2, sentCurrency: 'XMD',
      receivedAmount: 1000, receivedCurrency: 'XPR',
      feeCurrency: 'XPR',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://dashboard.test/api/trades');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.symbol).toBe('XPR_XMD');
    expect(body.venue).toBe('proton');
    expect(body.sentAmount).toBe(2);
  });

  it('retries on transient HTTP failure (max 3 attempts)', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'fail' });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'fail' });
    fetchMock.mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ success: true }) });

    const { tradesEmitter } = await import('../src/trades');
    tradesEmitter.initialize();
    await tradesEmitter.emit({
      instanceId: 'i1', symbol: 'XPR_XMD', side: 'BUY',
      price: 0.002, quantity: 1000, mode: 'live', venue: 'proton',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('drops the trade after 3 failed attempts', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'fail' });

    const { tradesEmitter } = await import('../src/trades');
    tradesEmitter.initialize();
    await tradesEmitter.emit({
      instanceId: 'i1', symbol: 'XPR_XMD', side: 'BUY',
      price: 0.002, quantity: 1000, mode: 'live', venue: 'proton',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('no-op when dashboard is disabled', async () => {
    vi.doMock('../src/utils', () => ({
      getConfig: () => ({ dashboard: { enabled: false } }),
      getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
    }));
    vi.resetModules();
    const { tradesEmitter } = await import('../src/trades');
    tradesEmitter.initialize();
    await tradesEmitter.emit({
      instanceId: 'i1', symbol: 'XPR_XMD', side: 'BUY',
      price: 0.002, quantity: 1000, mode: 'live', venue: 'proton',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
