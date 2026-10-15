import { useMemo, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { api } from '../core/api';
import { labels } from '../core/labels';
import type { AuthUser } from '../core/types';
import { buildRoleContext, navGroupsFor } from '../roles/registry';
import { useAppearance } from './hooks/useAppearance';
import { useConnectivity } from './hooks/useConnectivity';
import { useLowStockCount } from './hooks/useLowStockCount';
import { useNotifications } from './hooks/useNotifications';
import { usePageNavigation } from './hooks/usePageNavigation';
import { createAccess, groupNav, visibleNav } from './navigation';
import { PageRouter } from './PageRouter';
import { pageKeyFromPath } from './routing';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

type Props = {
    user: AuthUser;
    onLogout: () => void;
    onMaintenance: (message: string) => void;
};

export function AppShell({ user, onLogout, onMaintenance }: Props) {
    const { locale, setLocale, dark, setDark } = useAppearance();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [switchingFactory, setSwitchingFactory] = useState<number | null>(null);

    const access = useMemo(() => createAccess(user), [user]);
    const context = useMemo(() => buildRoleContext(user, locale, labels[locale]), [user, locale]);
    const { flags } = context;

    const nav = useMemo(() => visibleNav(context, access), [context, access]);
    const entries = useMemo(() => groupNav(nav, navGroupsFor(context)), [nav, context]);
    const availablePages = useMemo(() => nav.map(([page]) => page), [nav]);

    const showSettings =
        !user.is_platform_admin && !flags.isFactoryOwner && access.can('factory.manage');
    const showSupport = !user.is_platform_admin && access.hasFeature('support');

    const allowedPages = useMemo(() => {
        const pages = [...availablePages, 'profile'];
        if (!user.is_platform_admin) {
            if (showSupport) pages.push('support');
            pages.push('notifications');
            if (access.can('factory.manage')) pages.push('settings');
        }

        return pages;
    }, [availablePages, user.is_platform_admin, showSupport, access]);

    const { activePage, setActivePage } = usePageNavigation(user, allowedPages);
    const notifications = useNotifications(user, onMaintenance);
    const { isOnline, pendingSyncCount } = useConnectivity((url) =>
        setActivePage(pageKeyFromPath(user, url)),
    );
    const lowStockCount = useLowStockCount(user, access.can('inventory.view'));

    const switchFactory = async (factoryId: number) => {
        setSwitchingFactory(factoryId);
        try {
            await api('/api/factories/switch', {
                method: 'POST',
                body: JSON.stringify({ factory_id: factoryId }),
            });
            window.location.href = '/dashboard';
        } catch (reason: any) {
            setNotice(reason instanceof Error ? reason.message : 'Unable to switch factory.');
            setSwitchingFactory(null);
        }
    };

    const text = (en: string, fr: string) => (locale === 'en' ? en : fr);

    return (
        <div className="app-shell">
            <Sidebar
                user={user}
                locale={locale}
                labels={labels[locale]}
                entries={entries}
                activePage={activePage}
                open={sidebarOpen}
                lowStockCount={lowStockCount}
                showSettings={showSettings}
                showSupport={showSupport}
                isOwner={flags.isFactoryOwner}
                isSchoolUser={flags.isSchoolUser}
                switchingFactory={switchingFactory}
                onNavigate={setActivePage}
                onClose={() => setSidebarOpen(false)}
                onSwitchFactory={switchFactory}
                onLogout={onLogout}
            />
            {sidebarOpen && (
                <button
                    className="backdrop"
                    aria-label="Close menu"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <main className="main-area">
                <Topbar
                    user={user}
                    locale={locale}
                    labels={labels[locale]}
                    dark={dark}
                    notifications={notifications}
                    onLocaleChange={setLocale}
                    onThemeChange={setDark}
                    onNavigate={setActivePage}
                    onOpenMenu={() => setSidebarOpen(true)}
                    onLogout={onLogout}
                />
                {(!isOnline || pendingSyncCount > 0) && (
                    <div className="connectivity-banner">
                        <WifiOff size={14} />
                        {!isOnline
                            ? text(
                                  "You're offline. Changes will be saved and synced automatically once you reconnect.",
                                  'Vous êtes hors ligne. Les modifications seront synchronisées à la reconnexion.',
                              )
                            : text(
                                  `Syncing ${pendingSyncCount} change${pendingSyncCount > 1 ? 's' : ''}…`,
                                  `Synchronisation de ${pendingSyncCount} modification${pendingSyncCount > 1 ? 's' : ''}…`,
                              )}
                    </div>
                )}
                <div className={`page ${flags.isSchoolUser ? 'school-page' : ''}`}>
                    <PageRouter
                        user={user}
                        locale={locale}
                        dark={dark}
                        flags={flags}
                        access={access}
                        activePage={activePage}
                        availablePages={availablePages}
                        notifications={notifications}
                        onNavigate={setActivePage}
                        onLocaleChange={setLocale}
                        onThemeChange={setDark}
                    />
                </div>
            </main>
            {notice && <div className="toast">{notice}</div>}
        </div>
    );
}
