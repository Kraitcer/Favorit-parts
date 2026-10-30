import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { EmptyState } from './Feedback.jsx';

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('ru-RU');

export default function Offers({ offers }) {
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState('default');
  const shown = useMemo(() => {
    const rows = offers.filter((offer) => !availableOnly || offer.stock > 0);
    if (sort === 'price') rows.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === 'stock') rows.sort((a, b) => (b.stock ?? -1) - (a.stock ?? -1));
    return rows;
  }, [offers, availableOnly, sort]);
  const inStock = offers.filter((offer) => offer.stock > 0).length;
  const prices = offers.filter((offer) => offer.stock > 0 && offer.price !== null).map((offer) => offer.price);
  const lowest = prices.length ? Math.min(...prices) : null;
  return <>
    <div className="result-summary">
      <div><span>Предложений</span><strong>{offers.length}</strong></div>
      <div><span>В наличии</span><strong className="text-green">{inStock}</strong></div>
      <div><span>Лучшая цена в наличии</span><strong>{lowest === null ? '—' : money.format(lowest)}</strong></div>
    </div>
    <div className="table-toolbar">
      <label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /><span>Только в наличии</span></label>
      <label className="sort-control"><span>Сортировка</span><select className="form-select form-select-sm" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Сортировка предложений">
        <option value="default">По умолчанию</option><option value="price">Сначала дешевле</option><option value="stock">По остатку</option>
      </select></label>
    </div>
    {shown.length === 0 ? <EmptyState title={offers.length ? 'Нет предложений в наличии' : 'Предложения не найдены'} icon="box">
      {offers.length ? 'Отключите фильтр, чтобы увидеть все найденные позиции.' : 'Попробуйте выбрать другого производителя или проверьте артикул.'}
    </EmptyState> : <div className="table-responsive">
      <table className="table offers-table align-middle mb-0">
        <caption className="visually-hidden">Автозапчасти и аналоги: цена и остаток каждого склада</caption>
        <thead><tr><th>Деталь / производитель</th><th>Склад</th><th>Остаток</th><th className="text-end">Цена</th></tr></thead>
        <tbody>{shown.map((offer) => <tr key={offer.id}>
          <td><div className="part-brand">{offer.brand}<span className={`part-tag ${offer.analogue ? '' : 'original'}`}>{offer.analogue ? 'Аналог' : 'Искомая деталь'}</span></div><div className="part-name">{offer.name}</div><div className="part-number">{offer.number}</div></td>
          <td><div className="warehouse-name"><Icon name="box" size={15} />{offer.warehouse}</div>{offer.own && <span className="warehouse-hint">Склад Фаворит</span>}</td>
          <td><span className={`stock ${offer.stock > 0 ? 'stock-available' : ''}`}>{offer.stock === null ? 'Не указан' : offer.stock > 0 ? `${quantity.format(offer.stock)} шт.` : 'Нет в наличии'}</span></td>
          <td className="text-end price">{offer.price === null ? <span className="price-missing">Не указана</span> : money.format(offer.price)}<span className="price-unit">за единицу</span></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="table-note"><Icon name="info" size={15} />Цены и остатки получены от Фаворит в момент запроса. Каждая строка — отдельное складское предложение.</div>
  </>;
}
