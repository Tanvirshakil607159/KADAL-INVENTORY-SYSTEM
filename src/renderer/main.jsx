import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { webBridge } from './web/web-bridge';

// Inject web bridge if running in browser
if (!window.kadal) {
  console.log('[System] Initializing Web Bridge...');
  window.kadal = webBridge;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
