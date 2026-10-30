import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { brandSelected, numberChanged } from './store/searchSlice.js';
import { getApiError, isApiConfigured, useLazyGetBrandsQuery, useLazyGetOffersQuery } from './data/api.js';
import Icon from './components/Icon.jsx';
import { EmptyState, ErrorMessage, Loader } from './components/Feedback.jsx';
import Offers from './components/Offers.jsx';

function ApiStatus() {
  const configured = isApiConfigured();
  return <span className={`api-status ${configured ? 'ready' : 'unconfigured'}`} title="Проверяется наличие ключа в сборке, а не его действительность или доступность API"><i />{configured ? 'Ключ API задан' : 'Требуется ключ API'}</span>;
}

function queryStatus(result, active) {
  if (!active || result.isUninitialized) return 'idle';
  if (result.isFetching) return 'loading';
  if (result.isError) return result.error?.name === 'AbortError' ? 'idle' : 'failed';
  return result.isSuccess ? 'succeeded' : 'idle';
}

export default function App() {
  const dispatch = useDispatch();
  const { number, selectedBrand } = useSelector((state) => state.search);
  const [loadBrands, brandResult] = useLazyGetBrandsQuery();
  const [loadOffers, offerResult] = useLazyGetOffersQuery();
  const brandStatus = queryStatus(brandResult, brandResult.originalArgs === number.trim());
  const offerStatus = queryStatus(offerResult, Boolean(selectedBrand) && offerResult.originalArgs?.number === number.trim() && offerResult.originalArgs?.brand === selectedBrand);
  const brands = brandResult.currentData || [];
  const offers = offerResult.currentData || [];
  const brandError = getApiError(brandResult.error);
  const offerError = getApiError(offerResult.error);
  const timer = useRef(null);
  const brandRequest = useRef(null);
  const offerRequest = useRef(null);
  useEffect(() => {
    if (number.trim()) {
      timer.current = setTimeout(() => {
        brandRequest.current = loadBrands(number.trim(), true);
      }, 500);
    }
    return () => {
      clearTimeout(timer.current);
      brandRequest.current?.abort();
      offerRequest.current?.abort();
    };
  }, [number, loadBrands]);
  function changeNumber(value) {
    brandRequest.current?.abort();
    offerRequest.current?.abort();
    brandResult.reset();
    offerResult.reset();
    dispatch(numberChanged(value));
  }
  function searchBrands() {
    clearTimeout(timer.current);
    if (!number.trim() || brandStatus === 'loading') return;
    offerRequest.current?.abort();
    offerResult.reset();
    dispatch(brandSelected(''));
    brandRequest.current = loadBrands(number.trim());
  }
  function search(event) {
    event.preventDefault();
    searchBrands();
  }
  function selectBrand(brand) {
    if (selectedBrand === brand && offerStatus === 'loading') return;
    offerRequest.current?.abort();
    dispatch(brandSelected(brand));
    offerRequest.current = loadOffers({ number: number.trim(), brand });
  }
  const step = selectedBrand ? 2 : 1;
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand-logo" href="./" aria-label="Деталь — главная"><span className="logo-mark"><Icon name="layers" size={25} /></span>деталь<span className="logo-dot">.</span></a>
      <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <div className="nav-current"><Icon name="search" /><span>Поиск запчастей</span><span className="nav-indicator" /></div>
      <div className="sidebar-guide">
        <div className="sidebar-label">КАК ЭТО РАБОТАЕТ</div>
        <div className={`guide-step ${step === 1 ? 'active' : 'complete'}`}><span className="guide-number">{step === 2 ? <Icon name="check" size={15} /> : '1'}</span><div><strong>Найдите производителя</strong><p>Введите артикул детали</p></div></div>
        <div className={`guide-step ${step === 2 ? 'active' : ''}`}><span className="guide-number">2</span><div><strong>Сравните предложения</strong><p>Выберите нужный бренд</p></div></div>
      </div>
      <div className="sidebar-bottom"><Icon name="shield" size={22} /><strong>Напрямую от источника</strong><p>Наличие и цены из API Фаворит.<br />Без промежуточных каталогов.</p><a href="https://lk.favorit-parts.ru/static/wsprice.pdf" target="_blank" rel="noreferrer">Документация API <Icon name="external" size={13} /></a></div>
      <div className="sidebar-foot">ИНСТРУМЕНТЫ ДЛЯ АВТОБИЗНЕСА</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div>Каталог <span>/</span><strong>Поиск запчастей</strong></div><ApiStatus /></header>
      <main>
        <div className="page-heading"><div className="eyebrow"><span />ПОДБОР АВТОЗАПЧАСТЕЙ</div><h1>Нужная деталь.<br className="mobile-break" /> Все предложения.</h1><p>Найдите производителя по артикулу и сравните цены на деталь и её аналоги.</p></div>
        <section className="panel search-panel" aria-labelledby="search-title">
          <div className="section-title"><span className="step-badge">01</span><div><h2 id="search-title">Артикул и производитель</h2><p>Начните с оригинального номера или артикула детали</p></div><Icon name="search" className="section-icon" size={23} /></div>
          <form onSubmit={search}>
            <label htmlFor="part-number" className="field-label">Артикул детали</label>
            <div className="search-row"><div className="search-field"><Icon name="search" /><input id="part-number" type="text" className="form-control" value={number} maxLength={100} onChange={(event) => changeNumber(event.target.value)} placeholder="Например, 7160500039S" autoComplete="off" spellCheck="false" aria-describedby="search-hint" />{number && <button className="clear-input" type="button" onClick={() => changeNumber('')} aria-label="Очистить артикул"><Icon name="close" size={17} /></button>}</div><button className="btn btn-search" disabled={!number.trim() || brandStatus === 'loading'} type="submit">{brandStatus === 'loading' ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" />Ищем</> : <>Найти деталь<Icon name="arrow" size={18} /></>}</button></div>
            <div id="search-hint" className="field-hint">Производители появятся автоматически после ввода артикула</div>
          </form>
          {brandStatus === 'loading' && <Loader>Ищем производителей по артикулу…</Loader>}
          {brandStatus === 'failed' && <ErrorMessage message={brandError} onRetry={searchBrands} />}
          {brandStatus === 'succeeded' && <div className="brands-area"><div className="brands-heading"><span>Выберите производителя</span><span className="count-badge">{brands.length}</span></div>
            {brands.length === 0 ? <EmptyState title="Производители не найдены">Проверьте артикул или попробуйте другой номер детали.</EmptyState> : <div className="brand-grid">{brands.map((brand) => <button key={brand.name} type="button" className={`brand-card ${selectedBrand === brand.name ? 'selected' : ''}`} onClick={() => selectBrand(brand.name)} aria-pressed={selectedBrand === brand.name}><span className="brand-card-top"><strong>{brand.name}</strong><span className="brand-check"><Icon name={selectedBrand === brand.name ? 'check' : 'arrow'} size={15} /></span></span><span className="brand-description">{brand.description || 'Посмотреть предложения'}</span></button>)}</div>}
          </div>}
        </section>
        <section className="panel offers-panel" aria-labelledby="offers-title" aria-busy={offerStatus === 'loading'}>
          <div className="section-title"><span className={`step-badge ${selectedBrand ? '' : 'muted'}`}>02</span><div><h2 id="offers-title">Предложения и аналоги</h2><p>{selectedBrand ? <>{selectedBrand} <span className="heading-divider">/</span> <span className="mono">{number.trim()}</span></> : 'Цены и наличие на складах поставщиков'}</p></div><span className="result-label">{offerStatus === 'succeeded' ? `${offers.length} предложений` : 'ПОДБОР ПО БРЕНДУ'}</span></div>
          {offerStatus === 'idle' && <EmptyState title="Здесь будут подходящие детали" icon="layers">Введите артикул и выберите производителя.<br />Мы найдём исходную деталь и доступные аналоги.</EmptyState>}
          {offerStatus === 'loading' && <Loader>Загружаем предложения {selectedBrand} и аналоги…</Loader>}
          {offerStatus === 'failed' && <ErrorMessage message={offerError} onRetry={() => selectBrand(selectedBrand)} />}
          {offerStatus === 'succeeded' && <Offers key={`${number}|${selectedBrand}`} offers={offers} />}
        </section>
        <footer className="page-footer"><span><Icon name="shield" size={15} />Данные предоставлены Фаворит</span><span>Точный поиск. Осознанный выбор.</span></footer>
      </main>
    </div>
  </div>;
}
