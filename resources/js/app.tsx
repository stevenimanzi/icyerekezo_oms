import React from 'react';
import { createRoot } from 'react-dom/client';
import '../css/auth-premium.css';
import './components/ui.css';
import { App } from './app/App';
import GlobalOperationToasts from './pages/shared/GlobalOperationToasts';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

class GlobalErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('Application render error caught by root boundary:', error, errorInfo);
        const msg = error?.message || '';
        if (
            msg.includes('dynamically imported module') ||
            msg.includes('Loading chunk') ||
            msg.includes('Failed to fetch')
        ) {
            const reloaded = sessionStorage.getItem('app_chunk_reloaded');
            if (!reloaded) {
                sessionStorage.setItem('app_chunk_reloaded', '1');
                window.location.reload();
            }
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, textAlign: 'center', background: '#f8fafc', color: '#1e293b', fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '32px 28px', maxWidth: 440, width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>ICYEREKEZO OMS</h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 20px 0' }}>
                            An updated version was detected or a connection hiccup occurred.
                        </p>
                        <button
                            onClick={() => {
                                sessionStorage.clear();
                                window.location.reload();
                            }}
                            style={{ width: '100%', padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            Refresh &amp; Continue
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

createRoot(document.getElementById('app')!).render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <GlobalOperationToasts />
            <App />
        </GlobalErrorBoundary>
    </React.StrictMode>,
);
