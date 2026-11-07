import React, { Component, type ComponentType, type ErrorInfo } from 'react';
import { AlertCircle, CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import type { Locale } from '../../core/types';
import { AnnouncementsScreen } from './screens/AnnouncementsScreen';
import { AuditLogsScreen } from './screens/AuditLogsScreen';
import { BackupsScreen } from './screens/BackupsScreen';
import { FactoriesScreen } from './screens/FactoriesScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SubscriptionsScreen } from './screens/SubscriptionsScreen';
import { SupportScreen } from './screens/SupportScreen';
import { UsersScreen } from './screens/UsersScreen';
import { adminPages, FALLBACK_PAGE } from './pageInfo';
import { useAdminData, type AdminContext } from './useAdminData';

class AdminScreenBoundary extends Component<
    { children: React.ReactNode; onReset?: () => void },
    { hasError: boolean; error: string }
> {
    state = { hasError: false, error: '' };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error?.message || 'Error rendering admin screen' };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('AdminScreenBoundary caught error:', error, info);
    }

    reset = () => {
        this.setState({ hasError: false, error: '' });
        this.props.onReset?.();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="panel"
                    style={{
                        padding: 32,
                        textAlign: 'center',
                        maxWidth: 600,
                        margin: '24px auto',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                    }}
                >
                    <AlertCircle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
                    <h2 style={{ fontSize: 18, marginBottom: 8 }}>Unable to display this view</h2>
                    <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
                        A temporary display error occurred while rendering this section. Your
                        system administrator data and database remain completely safe.
                    </p>
                    <button className="primary-btn" onClick={this.reset} style={{ margin: '0 auto' }}>
                        <RefreshCw size={15} />
                        Reload view
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const screens: Record<string, ComponentType<{ ctx: AdminContext }>> = {
    'platform-dashboard': OverviewScreen,
    factories: FactoriesScreen,
    'platform-users': UsersScreen,
    subscriptions: SubscriptionsScreen,
    announcements: AnnouncementsScreen,
    'support-center': SupportScreen,
    backups: BackupsScreen,
    'audit-logs': AuditLogsScreen,
    'system-settings': SettingsScreen,
};

export default function SystemAdminPage({ page }: { page: string; locale: Locale }) {
    const ctx = useAdminData(page);
    const info = adminPages[page] || adminPages[FALLBACK_PAGE];
    const Screen = screens[page] || screens[FALLBACK_PAGE];

    return (
        <section className="platform-page">
            <div className="platform-heading">
                <div>
                    <span className="platform-kicker">SYSTEM ADMINISTRATION</span>
                    <h1>{info.title}</h1>
                    <p>{info.description}</p>
                </div>
                <div className="platform-heading-actions">
                    <button className="secondary-btn" onClick={ctx.load} disabled={ctx.busy}>
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                    {info.canCreate && (
                        <button
                            className="primary-btn"
                            onClick={() => ctx.setShowForm(!ctx.showForm)}
                        >
                            <Plus size={16} />
                            {page === 'backups' ? 'Create backup' : 'Create new'}
                        </button>
                    )}
                </div>
            </div>
            {ctx.error && <div className="admin-alert error">{ctx.error}</div>}
            {ctx.success && (
                <div className="admin-alert success">
                    <CheckCircle2 size={16} />
                    {ctx.success}
                </div>
            )}

            <AdminScreenBoundary key={page} onReset={ctx.load}>
                <Screen ctx={ctx} />
            </AdminScreenBoundary>

            {ctx.busy && !ctx.data && (
                <div className="admin-loading">Loading platform controls…</div>
            )}
        </section>
    );
}
