import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import { App } from './App';
import './styles/theme.css';
import './styles/animations.css';

// Register service worker with auto-update
registerSW({
  onNeedRefresh() {
    // Could show a prompt to the user, for now auto-update
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
