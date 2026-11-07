import React from 'react';

export function AuthInput({
    icon,
    label,
    action,
    error,
    children,
}: {
    icon?: React.ReactNode;
    label: string;
    action?: React.ReactNode;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <label className={`auth-field ${error ? 'has-error' : ''}`}>
            <span className="auth-field-label">{label}</span>
            <div className="auth-input-wrapper">
                {icon && <span className="auth-input-icon">{icon}</span>}
                {children}
                {action && <div className="auth-input-action">{action}</div>}
            </div>
            {error && <span className="auth-field-error-text">{error}</span>}
        </label>
    );
}
