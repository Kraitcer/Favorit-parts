import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getBrands, getOffers, readGoods } from './parts.js';

export const isApiConfigured = () => Boolean(import.meta.env.VITE_FAVORIT_API_KEY?.trim());

const upstreamErrors = {
  'Empty key!': 'Не указан ключ покупателя.',
  'Invalid key client!': 'Ключ API недействителен. Проверьте VITE_FAVORIT_API_KEY.',
  'Empty number goods!': 'Не указан артикул детали.',
  'Request quota exceeded!': 'Превышен лимит запросов API. Повторите поиск позже.',
};

function upstreamMessage(error) {
  const text = typeof error === 'string' ? error : JSON.stringify(error);
  const messages = Object.entries(upstreamErrors)
    .filter(([message]) => text.includes(message))
    .map(([, translation]) => translation);
  return messages.length ? messages.join(' ') : 'Сервис Фаворит сообщил об ошибке. Проверьте доступ к API в личном кабинете.';
}

export function getApiError(error) {
  if (!error) return '';
  if (typeof error.data === 'string') return error.data;
  if (error.status === 'TIMEOUT_ERROR') return 'Сервис Фаворит не ответил за 20 секунд. Повторите поиск.';
  if (error.status === 'FETCH_ERROR') return 'Не удалось связаться с Фаворит. Проверьте сеть и доступность API. Возможно, сервис блокирует запросы браузера (CORS).';
  if (error.status === 'PARSING_ERROR') return 'Сервис Фаворит вернул некорректный ответ. Повторите поиск позже.';
  if (typeof error.status === 'number') return `Сервис Фаворит недоступен (HTTP ${error.status}). Повторите позже.`;
  return 'Не удалось выполнить запрос. Повторите поиск.';
}

const httpQuery = fetchBaseQuery({
  baseUrl: 'https://api.favorit-parts.ru/hs/hsprice/',
  timeout: 20000,
  credentials: 'omit',
  cache: 'no-store',
  redirect: 'error',
});

async function partsQuery({ number, brand }, api, extraOptions) {
  const key = import.meta.env.VITE_FAVORIT_API_KEY?.trim();
  if (!key) return { error: { status: 'CUSTOM_ERROR', data: 'API не настроен. Добавьте VITE_FAVORIT_API_KEY в файл .env. В режиме разработки перезапустите Vite, для предпросмотра пересоберите приложение.' } };
  if (!number?.trim() || number.length > 100) {
    return { error: { status: 'CUSTOM_ERROR', data: 'Введите артикул длиной от 1 до 100 символов.' } };
  }
  const params = { key, number: number.trim() };
  if (brand) {
    params.brand = brand.trim();
    params.analogues = 'on';
  }
  const result = await httpQuery({ url: '', params }, api, extraOptions);
  const payload = result.error?.data ?? result.data;
  if (payload && typeof payload === 'object' && payload.error) {
    return { error: { status: 'CUSTOM_ERROR', data: upstreamMessage(payload.error) } };
  }
  if (result.error) {
    // Keep raw upstream responses and request URLs out of Redux error state.
    const status = result.error.status === 'PARSING_ERROR' && result.error.originalStatus >= 400
      ? result.error.originalStatus : result.error.status;
    return { error: { status, data: getApiError({ status }) } };
  }
  try {
    return { data: readGoods(result.data) };
  } catch (error) {
    if (error.name !== 'InvalidResponseError') throw error;
    return { error: { status: 'CUSTOM_ERROR', data: 'Сервис Фаворит вернул некорректный ответ. Повторите поиск позже.' } };
  }
}

export const partsApi = createApi({
  reducerPath: 'partsApi',
  baseQuery: partsQuery,
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
    getBrands: builder.query({
      query: (number) => ({ number }),
      transformResponse: getBrands,
    }),
    getOffers: builder.query({
      query: ({ number, brand }) => ({ number, brand }),
      transformResponse: (goods, _meta, { number, brand }) => getOffers(goods, brand, number),
    }),
  }),
});

export const { useLazyGetBrandsQuery, useLazyGetOffersQuery } = partsApi;
