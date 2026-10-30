import { describe, expect, it } from 'vitest';
import { getBrands, getOffers, readGoods } from './parts.js';

const item = {
  goodsID: '1', brand: 'MEYLE', number: '7160500039S', name: 'Рычаг подвески',
  count: 25, price: 999999,
  warehouses: [
    { id: 'a', code: 'МС2', price: 1500, stock: 20, own: true },
    { id: 'b', code: 'МС3', price: '1400.50', stock: '5' },
  ],
};

describe('API data', () => {
  it('handles both documented empty responses', () => {
    expect(readGoods({ goods: [] })).toEqual([]);
    expect(readGoods({ goods: [{ brand: '', number: '', count: 0 }] })).toEqual([]);
  });
  it.each([null, {}, { goods: null }, { goods: [null] }, { goods: [{ warehouses: {} }] }, { goods: [{ analogues: {} }] }, { goods: [{ warehouses: [null] }] }])('rejects malformed response %j', (payload) => {
    expect(() => readGoods(payload)).toThrow('некорректный');
  });
  it('deduplicates and sorts manufacturers case-insensitively', () => {
    expect(getBrands([item, { ...item, brand: ' meyle ' }, { ...item, brand: 'BOSCH' }]).map((brand) => brand.name)).toEqual(['BOSCH', 'MEYLE']);
  });
  it('uses only warehouse prices and matching warehouse stock', () => {
    const offers = getOffers([item], 'MEYLE', item.number);
    expect(offers.map(({ price, stock }) => ({ price, stock }))).toEqual([
      { price: 1500, stock: 20 }, { price: 1400.5, stock: 5 },
    ]);
    expect(offers[0].analogue).toBe(false);
    expect(offers[0].own).toBe(true);
  });
  it('flattens nested analogues and deduplicates repeated offers', () => {
    const analogue = { ...item, brand: 'FEBI', number: '123' };
    const nested = { ...item, analogues: [analogue, { ...analogue, analogues: [analogue] }] };
    const offers = getOffers([nested, item], 'MEYLE', item.number);
    expect(offers).toHaveLength(4);
    expect(offers.filter((offer) => offer.analogue)).toHaveLength(2);
  });
  it('keeps zero stocks and prices without inventing missing values', () => {
    expect(getOffers([{ ...item, warehouses: [{ price: 0, stock: 0 }, { price: '', stock: null }] }], 'MEYLE', item.number).map(({ price, stock }) => ({ price, stock }))).toEqual([
      { price: 0, stock: 0 }, { price: null, stock: null },
    ]);
  });
  it('does not use legacy product price if warehouses are missing', () => {
    const [offer] = getOffers([{ ...item, warehouses: [] }], 'MEYLE', item.number);
    expect(offer.price).toBeNull();
    expect(offer.stock).toBe(25);
    expect(offer.warehouse).toBe('Нет предложений складов');
  });
  it('treats a different article of the same brand as an analogue', () => {
    expect(getOffers([item], 'MEYLE', 'other')[0].analogue).toBe(true);
  });
});
