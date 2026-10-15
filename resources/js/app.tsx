import React from 'react';
import { createRoot } from 'react-dom/client';
import '../css/auth-premium.css';
import { App } from './app/App';
import GlobalOperationToasts from './pages/shared/GlobalOperationToasts';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

createRoot(document.getElementById('app')!).render(
    <React.StrictMode>
        <GlobalOperationToasts />
        <App />
    </React.StrictMode>,
);
