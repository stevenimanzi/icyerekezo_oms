import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../core/api';
import type { AuthUser } from '../core/types';
import { Logo } from './Logo';
import { MaintenanceScreen } from './MaintenanceScreen';

const AuthScreen = lazy(() =>
    import('../auth/AuthScreen').then((module) => ({ default: module.AuthScreen })),
);
const ForgotPasswordPage = lazy(() =>
    import('../auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
    import('../auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
);
const AppShell = lazy(() => import('./AppShell').then((module) => ({ default: module.AppShell })));

function BootScreen() {
    return (
        <div className="boot-screen">
            <Logo />
        </div>
    );
}

export function App() {
    const path = window.location.pathname;

    return (
        <Suspense fallback={<BootScreen />}>
            {path === '/forgot-password' ? (
                <ForgotPasswordPage />
            ) : path.startsWith('/reset-password/') ? (
                <ResetPasswordPage />
            ) : (
                <Session />
            )}
        </Suspense>
    );
}

function Session() {
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

    if (loading) return <BootScreen />;
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
