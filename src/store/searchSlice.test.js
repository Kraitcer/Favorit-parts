import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, numberChanged, brandSelected } from './searchSlice.js';
import { getApiError, partsApi } from '../data/api.js';

const stores = [];
const response = (goods) => Response.json({ goods });
const item = { brand: 'MEYLE', number: '123', warehouses: [{ price: 10, stock: 2 }] };
const makeStore = () => {
  const store = createStore();
  stores.push(store);
  return store;
};
beforeEach(() => vi.stubEnv('VITE_FAVORIT_API_KEY', 'test-key'));
afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(partsApi.util.resetApiState());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('RTK Query API', () => {
  it('runs both steps directly over HTTPS and encodes special characters', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response([{ ...item, brand: 'A&B', number: '#123' }]))
      .mockResolvedValueOnce(response([{ ...item, brand: 'A&B', number: '#123' }]));
    vi.stubGlobal('fetch', fetch);
    const store = makeStore();
    const brands = await store.dispatch(partsApi.endpoints.getBrands.initiate('#123')).unwrap();
    expect(brands[0].name).toBe('A&B');
    const offers = await store.dispatch(partsApi.endpoints.getOffers.initiate({ number: '#123', brand: 'A&B' })).unwrap();
    expect(offers[0].price).toBe(10);
    const first = new URL(fetch.mock.calls[0][0].url);
    const second = new URL(fetch.mock.calls[1][0].url);
    expect(first.origin).toBe('https://api.favorit-parts.ru');
    expect(first.pathname).toBe('/hs/hsprice/');
    expect(first.searchParams.has('brand')).toBe(false);
    expect(first.searchParams.has('analogues')).toBe(false);
    expect(second.searchParams.get('key')).toBe('test-key');
    expect(second.searchParams.get('number')).toBe('#123');
    expect(second.searchParams.get('brand')).toBe('A&B');
    expect(second.searchParams.get('analogues')).toBe('on');
  });
  it('deduplicates requests, caches per argument and supports explicit refresh', async () => {
    const fetch = vi.fn().mockImplementation(async () => response([item]));
    vi.stubGlobal('fetch', fetch);
    const store = makeStore();
    await Promise.all([
      store.dispatch(partsApi.endpoints.getBrands.initiate('123')),
      store.dispatch(partsApi.endpoints.getBrands.initiate('123')),
    ]);
    await store.dispatch(partsApi.endpoints.getBrands.initiate('123'));
    expect(fetch).toHaveBeenCalledTimes(1);
    await store.dispatch(partsApi.endpoints.getBrands.initiate('123', { forceRefetch: true }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps late responses isolated by article and manufacturer', async () => {
    let resolveOld;
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(response([{ ...item, brand: 'NEW' }])));
    const store = makeStore();
    const old = store.dispatch(partsApi.endpoints.getOffers.initiate({ number: '1', brand: 'OLD' }));
    await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    await store.dispatch(partsApi.endpoints.getOffers.initiate({ number: '2', brand: 'NEW' }));
    resolveOld(response([{ ...item, brand: 'OLD' }]));
    await old;
    expect(partsApi.endpoints.getOffers.select({ number: '2', brand: 'NEW' })(store.getState()).data[0].brand).toBe('NEW');
  });
  it('resets the selected brand when the article changes', () => {
    const store = makeStore();
    store.dispatch(numberChanged('123'));
    store.dispatch(brandSelected('MEYLE'));
    store.dispatch(numberChanged('456'));
    expect(store.getState().search).toEqual({ number: '456', selectedBrand: '' });
  });
  it('reports a missing key without sending HTTP', async () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await makeStore().dispatch(partsApi.endpoints.getBrands.initiate('123'));
    expect(getApiError(result.error)).toContain('VITE_FAVORIT_API_KEY');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['Invalid key client!', 'Ключ API недействителен'],
    ['Request quota exceeded!', 'Превышен лимит'],
    ['Empty key!', 'Не указан ключ'],
    ['Empty number goods!', 'Не указан артикул'],
    [['Invalid key client!', 'Request quota exceeded!'], 'Превышен лимит'],
    ['Unknown test-key', 'Сервис Фаворит сообщил об ошибке'],
  ])('translates upstream error %j', async (error, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error })));
    const result = await makeStore().dispatch(partsApi.endpoints.getBrands.initiate('123'));
    expect(getApiError(result.error)).toContain(message);
    expect(JSON.stringify(result.error)).not.toContain('test-key');
  });
  it.each([
    [() => new Response('forbidden', { status: 403 }), '403'],
    [() => new Response('not json'), 'некорректный ответ'],
    [() => Response.json({ unexpected: [] }), 'некорректный ответ'],
  ])('handles HTTP, JSON and schema errors', async (reply, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply()));
    const result = await makeStore().dispatch(partsApi.endpoints.getBrands.initiate('123'));
    expect(getApiError(result.error)).toContain(message);
  });
  it('reports network / CORS failures and can retry', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(response([])));
    const store = makeStore();
    const failed = await store.dispatch(partsApi.endpoints.getBrands.initiate('123'));
    expect(getApiError(failed.error)).toContain('CORS');
    const retried = await store.dispatch(partsApi.endpoints.getBrands.initiate('123', { forceRefetch: true }));
    expect(retried.data).toEqual([]);
  });
  it('aborts an in-flight HTTP request', async () => {
    let signal;
    vi.stubGlobal('fetch', vi.fn((request) => new Promise((_resolve, reject) => {
      signal = request.signal;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const store = makeStore();
    const request = store.dispatch(partsApi.endpoints.getBrands.initiate('123'));
    await vi.waitFor(() => expect(signal).toBeDefined());
    request.abort();
    const result = await request;
    expect(result.error.name).toBe('AbortError');
    expect(signal.aborted).toBe(true);
  });
  it('times out a hanging HTTP request', async () => {
    vi.useFakeTimers();
    try {
      let started = false;
      vi.stubGlobal('fetch', vi.fn((request) => new Promise((_resolve, reject) => {
        started = true;
        request.signal.addEventListener('abort', () => reject(request.signal.reason));
      })));
      const request = makeStore().dispatch(partsApi.endpoints.getBrands.initiate('123'));
      await vi.advanceTimersByTimeAsync(0);
      expect(started).toBe(true);
      await vi.advanceTimersByTimeAsync(20000);
      const result = await request;
      expect(result.error.status).toBe('TIMEOUT_ERROR');
      expect(getApiError(result.error)).toContain('20 секунд');
    } finally {
      vi.useRealTimers();
    }
  });
});
