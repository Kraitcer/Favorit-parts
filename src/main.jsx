import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import App from './App.jsx';
import { createStore } from './store/searchSlice.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={createStore()}><App /></Provider>
  </React.StrictMode>,
);
