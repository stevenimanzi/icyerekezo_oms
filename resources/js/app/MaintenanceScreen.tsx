import React from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

export function MaintenanceScreen({
    message,
    onRetry,
    onAdmin,
}: {
    message: string;
    onRetry: () => void;
    onAdmin: () => void;
}) {
    return (
        <div className="auth-viewport">
            <div className="auth-container" style={{ maxWidth: 560, gridTemplateColumns: '1fr', minHeight: 'auto' }}>
                <div className="auth-form-panel" style={{ padding: '48px 36px', textAlign: 'center', alignItems: 'center' }}>
                    <div style={{ marginBottom: 28 }}>
                        <Logo />
                    </div>

                    <div
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                        }}
                    >
                        <AlertTriangle size={28} />
                    </div>

                    <h1 className="auth-title" style={{ fontSize: 26, marginBottom: 10 }}>
                        Scheduled Maintenance
                    </h1>

                    <p className="auth-subtitle" style={{ maxWidth: 420, margin: '0 auto 28px auto', fontSize: 14 }}>
                        {message ||
                            'ICYEREKEZO OMS is undergoing brief scheduled maintenance to enhance stability and performance. Please check back shortly.'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
                        <button type="button" className="auth-btn-primary" onClick={onRetry}>
                            <RefreshCw size={16} />
                            <span>Check again</span>
                        </button>

                        <button
                            type="button"
                            className="auth-btn-secondary"
                            onClick={onAdmin}
                            style={{ justifyContent: 'center' }}
                        >
                            <ShieldCheck size={16} className="text-blue-600" />
                            <span>Platform administrator sign in</span>
                        </button>
                    </div>

                    <div className="auth-bottom-copyright" style={{ marginTop: 24, padding: 0 }}>
                        <span>Platform administrators retain full access during maintenance windows.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
