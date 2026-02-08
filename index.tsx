import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// #region agent log
const logDebug = (message: string, data: Record<string, unknown> = {}) => {
  fetch('http://127.0.0.1:7243/ingest/fe1593c0-4d36-4b0e-98c7-f61f224f2549', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runId: 'debug1',
      hypothesisId: 'H1',
      location: 'index.tsx:7',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

const rootElement = document.getElementById('root');
// #region agent log
logDebug('Root element lookup', { found: Boolean(rootElement) });
// #endregion
if (!rootElement) {
  // #region agent log
  logDebug('Root element missing, throwing error');
  // #endregion
  throw new Error("Could not find root element to mount to");
}

// #region agent log
logDebug('Creating React root');
// #endregion
const root = ReactDOM.createRoot(rootElement);
// #region agent log
logDebug('Rendering App');
// #endregion
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);