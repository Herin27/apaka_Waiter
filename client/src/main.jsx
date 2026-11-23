import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import App from './App';
import './index.css';

registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event('aw:pwa-update-available'));
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
