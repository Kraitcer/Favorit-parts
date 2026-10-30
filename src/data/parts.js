function invalidResponse() {
  const error = new Error('Получен некорректный ответ сервиса.');
  error.name = 'InvalidResponseError';
  return error;
}

const text = (value) => typeof value === 'string' ? value.trim() : '';
const identity = (value) => text(value).toLocaleUpperCase('ru-RU');

export function readGoods(payload) {
  if (!payload || !Array.isArray(payload.goods)) throw invalidResponse();
  function validate(items) {
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalidResponse();
      if (item.warehouses !== undefined && !Array.isArray(item.warehouses)) throw invalidResponse();
      if (item.analogues !== undefined) {
        if (!Array.isArray(item.analogues)) throw invalidResponse();
        validate(item.analogues);
      }
      for (const warehouse of item.warehouses || []) {
        if (!warehouse || typeof warehouse !== 'object' || Array.isArray(warehouse)) throw invalidResponse();
      }
    }
  }
  validate(payload.goods);
  // The documented "not found" response contains one empty goods object.
  return payload.goods.filter((item) => text(item.brand) && text(item.number));
}

export function getBrands(goods) {
  const brands = new Map();
  for (const item of goods) {
    const key = identity(item.brand);
    if (!key || brands.has(key)) continue;
    brands.set(key, { name: text(item.brand), description: text(item.name) });
  }
  return [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function numeric(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function getOffers(goods, selectedBrand, number) {
  const offers = new Map();
  function add(items) {
    for (const item of items) {
      const brand = text(item.brand);
      const partNumber = text(item.number);
      if (brand && partNumber) {
        const partKey = `${identity(brand)}|${identity(partNumber)}`;
        const warehouses = item.warehouses?.length ? item.warehouses : [null];
        for (const warehouse of warehouses) {
          const price = warehouse ? numeric(warehouse.price) : null;
          const stock = warehouse ? numeric(warehouse.stock) : numeric(item.count);
          const warehouseName = warehouse ? text(warehouse.code) || text(warehouse.id) || 'Склад поставщика' : 'Нет предложений складов';
          const key = JSON.stringify([partKey, warehouse?.id, warehouseName, price, stock]);
          offers.set(key, {
            id: key,
            brand,
            number: partNumber,
            name: text(item.name) || 'Наименование не указано',
            price,
            stock,
            warehouse: warehouseName,
            own: warehouse?.own === true,
            analogue: identity(brand) !== identity(selectedBrand) || identity(partNumber) !== identity(number),
          });
        }
      }
      if (item.analogues) add(item.analogues);
    }
  }
  add(goods);
  return [...offers.values()];
}
