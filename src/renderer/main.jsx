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

async function init() {
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    const hasParams = new URLSearchParams(window.location.search).get('u') || 
                      (window.location.hash && new URLSearchParams(window.location.hash.substring(window.location.hash.indexOf('?'))).get('u'));
    
    if (!hasParams && !localStorage.getItem('supabase_url') && !sessionStorage.getItem('temp_supabase_url')) {
      try {
        console.log('[System] Pre-loading backend configuration...');
        const res = await fetch('/config.json');
        if (res.ok) {
          const config = await res.json();
          if (config.supabase_url && config.supabase_key) {
            sessionStorage.setItem('temp_supabase_url', config.supabase_url);
            sessionStorage.setItem('temp_supabase_key', config.supabase_key);
            console.log('[System] Backend configuration loaded successfully.');
          }
        }
      } catch (e) {
        console.warn('[System] Failed to pre-load config.json:', e);
      }
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

init();
