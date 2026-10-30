import { configureStore, createSlice } from '@reduxjs/toolkit';
import { partsApi } from '../data/api.js';

const searchSlice = createSlice({
  name: 'search',
  initialState: { number: '', selectedBrand: '' },
  reducers: {
    numberChanged: (_state, action) => ({ number: action.payload, selectedBrand: '' }),
    brandSelected: (state, action) => { state.selectedBrand = action.payload; },
  },
});

export const { numberChanged, brandSelected } = searchSlice.actions;
export const createStore = () => configureStore({
  reducer: { search: searchSlice.reducer, [partsApi.reducerPath]: partsApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(partsApi.middleware),
});
