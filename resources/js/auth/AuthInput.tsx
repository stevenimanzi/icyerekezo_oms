import React from 'react';

export function AuthInput({ icon, label, action, children }: { icon: React.ReactNode; label: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <label className="auth-field">
            <span>{label}</span>
            <div>
                {icon}
                {children}
                {action}
            </div>
        </label>
    );
}
