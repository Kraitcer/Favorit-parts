// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import App from './App.jsx';
import { createStore } from './store/searchSlice.js';
import { partsApi } from './data/api.js';

const stores = [];
beforeEach(() => vi.stubEnv('VITE_FAVORIT_API_KEY', 'test-key'));
afterEach(() => {
  cleanup();
  for (const store of stores.splice(0)) store.dispatch(partsApi.util.resetApiState());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
const reply = (payload, ok = true) => Response.json(payload, { status: ok ? 200 : 502 });
function renderApp() {
  const store = createStore();
  stores.push(store);
  render(<Provider store={store}><App /></Provider>);
  return store;
}
function setup(responses) {
  const fetch = vi.fn();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  const store = renderApp();
  return { fetch, store };
}
function search(number = '123') {
  fireEvent.change(screen.getByLabelText('Артикул детали'), { target: { value: number } });
  fireEvent.click(screen.getByRole('button', { name: /Найти деталь/ }));
}

describe('two-step interface', () => {
  it('shows manufacturers, original and analogue warehouse offers; filters and resets', async () => {
    const { fetch } = setup([
      reply({ goods: [{ brand: 'MEYLE', number: '123', name: 'Рычаг подвески' }] }),
      reply({ goods: [{
        brand: 'MEYLE', number: '123', name: 'Рычаг подвески', price: 999999,
        warehouses: [{ id: '1', code: 'МС2', price: 1500, stock: 20 }],
        analogues: [{ brand: 'FEBI', number: '456', name: 'Аналог рычага', warehouses: [{ id: '2', code: 'МС3', price: 1200, stock: 0 }] }],
      }] }),
    ]);
    search();
    const brand = await screen.findByRole('button', { name: /MEYLE/ });
    fireEvent.click(brand);
    expect(await screen.findByText('Аналог рычага')).toBeInTheDocument();
    expect(screen.getByText('20 шт.')).toBeInTheDocument();
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument();
    expect(screen.getAllByText(/1\s500/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Только в наличии' }));
    expect(screen.queryByText('Аналог рычага')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить артикул' }));
    expect(screen.getByLabelText('Артикул детали')).toHaveValue('');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('performs automatic search only after 500 ms pause', async () => {
    vi.useFakeTimers();
    const { fetch } = setup([reply({ goods: [] })]);
    fireEvent.change(screen.getByLabelText('Артикул детали'), { target: { value: '1' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.change(screen.getByLabelText('Артикул детали'), { target: { value: '12' } });
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0][0].url).searchParams.get('number')).toBe('12');
  });
  it('displays empty manufacturers', async () => {
    setup([reply({ goods: [{}] })]);
    search();
    expect(await screen.findByText('Производители не найдены')).toBeInTheDocument();
  });
  it('displays API errors and retries without changing the article', async () => {
    setup([
      reply({ error: 'Request quota exceeded!' }, false),
      reply({ goods: [{ brand: 'BOSCH', number: '123' }] }),
    ]);
    search();
    expect(await screen.findByRole('alert')).toHaveTextContent('Превышен лимит');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить запрос' }));
    expect(await screen.findByRole('button', { name: /BOSCH/ })).toBeInTheDocument();
  });
  it('shows loaders for both stages and an empty final result', async () => {
    let resolveBrands;
    let resolveOffers;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveBrands = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOffers = resolve; }));
    vi.stubGlobal('fetch', fetch);
    renderApp();
    search();
    expect(screen.getByRole('status')).toHaveTextContent('Ищем производителей');
    await waitFor(() => expect(resolveBrands).toBeTypeOf('function'));
    resolveBrands(reply({ goods: [{ brand: 'MEYLE', number: '123' }] }));
    fireEvent.click(await screen.findByRole('button', { name: /MEYLE/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем предложения');
    await waitFor(() => expect(resolveOffers).toBeTypeOf('function'));
    resolveOffers(reply({ goods: [] }));
    expect(await screen.findByText('Предложения не найдены')).toBeInTheDocument();
  });
  it('shows the offer error and allows retry', async () => {
    setup([
      reply({ goods: [{ brand: 'BOSCH', number: '123' }] }),
      reply({ error: 'Invalid key client!' }, false),
      reply({ goods: [] }),
    ]);
    search();
    fireEvent.click(await screen.findByRole('button', { name: /BOSCH/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ключ API недействителен');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить запрос' }));
    await waitFor(() => expect(screen.getByText('Предложения не найдены')).toBeInTheDocument());
  });
  it('ignores a late response after changing the article', async () => {
    let resolveOld;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(reply({ goods: [{ brand: 'NEW', number: '456' }] }));
    vi.stubGlobal('fetch', fetch);
    renderApp();
    search('123');
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    search('456');
    expect(await screen.findByRole('button', { name: /NEW/ })).toBeInTheDocument();
    await act(async () => { resolveOld(reply({ goods: [{ brand: 'OLD', number: '123' }] })); });
    expect(screen.queryByRole('button', { name: /OLD/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NEW/ })).toBeInTheDocument();
  });
  it('does not show offers from the previous brand while loading the next', async () => {
    let resolveNext;
    const fetch = vi.fn()
      .mockResolvedValueOnce(reply({ goods: [{ brand: 'MEYLE', number: '123' }, { brand: 'FEBI', number: '123' }] }))
      .mockResolvedValueOnce(reply({ goods: [{ brand: 'MEYLE', number: '123', name: 'Первая деталь', warehouses: [{ price: 10, stock: 1 }] }] }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    vi.stubGlobal('fetch', fetch);
    renderApp();
    search();
    fireEvent.click(await screen.findByRole('button', { name: /MEYLE/ }));
    expect(await screen.findByText('Первая деталь')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /FEBI/ }));
    expect(screen.queryByText('Первая деталь')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем предложения FEBI');
    await waitFor(() => expect(resolveNext).toBeTypeOf('function'));
    resolveNext(reply({ goods: [] }));
    expect(await screen.findByText('Предложения не найдены')).toBeInTheDocument();
  });
  it('explains missing client configuration without HTTP', async () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '');
    const { fetch } = setup([]);
    search();
    expect(await screen.findByRole('alert')).toHaveTextContent('VITE_FAVORIT_API_KEY');
    expect(fetch).not.toHaveBeenCalled();
  });
});
