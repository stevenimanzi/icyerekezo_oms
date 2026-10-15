import { useEffect, useState } from 'react';
import { AuthScreen } from '../auth/AuthScreen';
import { ForgotPasswordPage } from '../auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../auth/ResetPasswordPage';
import { api } from '../core/api';
import type { AuthUser } from '../core/types';
import { AppShell } from './AppShell';
import { Logo } from './Logo';
import { MaintenanceScreen } from './MaintenanceScreen';

export function App() {
    const path = window.location.pathname;

    if (path === '/forgot-password') return <ForgotPasswordPage />;
    if (path.startsWith('/reset-password/')) return <ResetPasswordPage />;

    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [maintenance, setMaintenance] = useState('');

    useEffect(() => {
        api<{ user: AuthUser }>('/api/auth/me')
            .then((data) => setUser(data.user))
            .catch((reason: any) => {
                setUser(null);
                if (reason?.status === 503) setMaintenance(reason.message);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading)
        return (
            <div className="boot-screen">
                <Logo />
            </div>
        );
    if (maintenance)
        return (
            <MaintenanceScreen
                message={maintenance}
                onRetry={() => window.location.reload()}
                onAdmin={() => setMaintenance('')}
            />
        );
    if (!user) return <AuthScreen onAuthenticated={setUser} onMaintenance={setMaintenance} />;

    const logout = async () => {
        setUser(null);
        try {
            await api('/api/auth/logout', { method: 'POST' });
        } finally {
            try {
                sessionStorage.clear();
            } catch {}
            window.history.replaceState(null, '', '/');
            window.location.replace('/');
        }
    };
    return <AppShell user={user} onLogout={logout} onMaintenance={setMaintenance} />;
}
