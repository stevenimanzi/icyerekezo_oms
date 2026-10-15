import { lazy, Suspense } from 'react';
import type { AuthUser, Locale } from '../core/types';
import type { RoleFlags } from '../roles/flags';
import { homeFor } from '../roles/home';
import { SCHOOL_PAGES } from '../roles/school';
import type { NotificationsState } from './hooks/useNotifications';
import type { Access } from './navigation';
import { PageBoundary } from './PageBoundary';
import { pageKeyFromPath } from './routing';

const AgreementWorkspacePage = lazy(() => import('../pages/logistics/AgreementWorkspacePage'));
const CuttingWorkspacePage = lazy(
    () => import('../pages/production/textile/cutting/CuttingWorkspacePage'),
);
const FactorySettingsPage = lazy(() => import('../pages/factory/FactorySettingsPage'));
const FinanceOverviewPage = lazy(() => import('../pages/finance/FinanceOverviewPage'));
const FinancialReportsPage = lazy(() => import('../pages/finance/FinancialReportsPage'));
const FinishingWorkspacePage = lazy(
    () => import('../pages/production/textile/finishing/FinishingWorkspacePage'),
);
const HrOverviewPage = lazy(() => import('../pages/hr/HrOverviewPage'));
const IncomingRequestsPage = lazy(() => import('../pages/warehouse/IncomingRequestsPage'));
const InventoryManagementPage = lazy(() => import('../pages/warehouse/InventoryManagementPage'));
const LogisticsOverviewPage = lazy(() => import('../pages/logistics/LogisticsOverviewPage'));
const MachinesPage = lazy(() => import('../pages/production/MachinesPage'));
const NotificationsPage = lazy(() =>
    import('../pages/shared/NotificationsPage').then((module) => ({
        default: module.NotificationsPage,
    })),
);
const OwnerActivityPage = lazy(() => import('../roles/owner/OwnerActivityPage'));
const PackingWorkspacePage = lazy(
    () => import('../pages/production/textile/packing/PackingWorkspacePage'),
);
const ProcurementOverviewPage = lazy(() => import('../pages/procurement/ProcurementOverviewPage'));
const ProductCatalogPage = lazy(() => import('../pages/shared/ProductCatalogPage'));
const ProductionFlowPage = lazy(() =>
    import('../pages/production/FactoryManagerModules').then((module) => ({
        default: module.ProductionFlowPage,
    })),
);
const ProductionOperations = lazy(() => import('../pages/production/ProductionOperations'));
const ProfileSettingsPage = lazy(() => import('../pages/shared/ProfileSettingsPage'));
const QualityControlPage = lazy(() => import('../pages/quality/QualityControlPage'));
const ReportsPage = lazy(() => import('../pages/shared/ClearReportsPage'));
const SafetyOverviewPage = lazy(() => import('../pages/safety/SafetyOverviewPage'));
const SalesOverviewPage = lazy(() => import('../pages/sales/SalesOverviewPage'));
const ManualSalesPage = lazy(() => import('../pages/sales/manual/ManualSalesPage'));
const SchoolPortalPage = lazy(() => import('../roles/school/SchoolPortalPage'));
const SewingWorkspacePage = lazy(
    () => import('../pages/production/textile/sewing/SewingWorkspacePage'),
);
const SystemAdminPage = lazy(() => import('../roles/system-admin/SystemAdminPage'));
const TeamManagementPage = lazy(() =>
    import('../pages/production/FactoryManagerModules').then((module) => ({
        default: module.TeamManagementPage,
    })),
);
const UserSupportChat = lazy(() =>
    import('../pages/shared/UserSupportChat').then((module) => ({
        default: module.UserSupportChat,
    })),
);

type Props = {
    user: AuthUser;
    locale: Locale;
    dark: boolean;
    flags: RoleFlags;
    access: Access;
    activePage: string;
    availablePages: string[];
    notifications: NotificationsState;
    onNavigate: (page: string) => void;
    onLocaleChange: (locale: Locale) => void;
    onThemeChange: (dark: boolean) => void;
};

const CUTTING_TABS: Record<string, 'request' | 'cut' | 'damaged' | 'report'> = {
    'cutting-workspace': 'request',
    'fabric-request': 'request',
    'cut-fabrics': 'cut',
    'damaged-fabrics': 'damaged',
    'cutting-report': 'report',
};

const LOGISTICS_TABS: Record<string, string> = {
    dispatch: 'dispatch',
    vehicles: 'vehicles',
    'delivery-confirmation': 'proof',
};

export function PageRouter(props: Props) {
    const resetKey =
        props.flags.isSchoolUser && SCHOOL_PAGES.includes(props.activePage)
            ? `school-${props.activePage}`
            : props.activePage;

    return (
        <PageBoundary resetKey={resetKey}>
            <Suspense fallback={<PageLoading />}>
                <CurrentPage {...props} />
            </Suspense>
        </PageBoundary>
    );
}

function CurrentPage({
    user,
    locale,
    dark,
    flags,
    access,
    activePage,
    availablePages,
    notifications,
    onNavigate,
    onLocaleChange,
    onThemeChange,
}: Props) {
    const { can } = access;

    if (flags.isSchoolUser && SCHOOL_PAGES.includes(activePage)) {
        return <SchoolPortalPage page={activePage} onNavigate={onNavigate} locale={locale} />;
    }

    if (activePage === 'profile') {
        return (
            <ProfileSettingsPage
                user={user}
                locale={locale}
                dark={dark}
                onLocaleChange={onLocaleChange}
                onThemeChange={onThemeChange}
            />
        );
    }

    if (activePage === 'notifications') {
        return (
            <NotificationsPage
                announcements={notifications.announcements}
                notifications={notifications.notifications}
                locale={locale}
                onMarkRead={notifications.markRead}
                onMarkAllRead={notifications.markAllRead}
                onOpen={(url) => {
                    if (url) onNavigate(pageKeyFromPath(user, url));
                }}
            />
        );
    }

    if (user.is_platform_admin) return <SystemAdminPage page={activePage} locale={locale} />;

    if (activePage === 'support') return <UserSupportChat user={user} locale={locale} />;

    if (activePage in CUTTING_TABS)
        return (
            <CuttingWorkspacePage
                user={user}
                locale={locale}
                initialTab={CUTTING_TABS[activePage]}
            />
        );
    if (activePage === 'sewing-workspace')
        return <SewingWorkspacePage user={user} locale={locale} />;
    if (activePage === 'finishing-workspace')
        return <FinishingWorkspacePage user={user} locale={locale} />;
    if (activePage === 'packing-workspace')
        return <PackingWorkspacePage user={user} locale={locale} />;

    if (activePage === 'dashboard') {
        const Home = homeFor(flags);

        return <Home user={user} locale={locale} onNavigate={onNavigate} pages={availablePages} />;
    }

    if (activePage === 'activity') {
        return (
            <OwnerActivityPage
                user={user}
                locale={locale}
                onNavigate={onNavigate}
                pages={availablePages}
            />
        );
    }

    switch (activePage) {
        case 'incoming-requests':
            return <IncomingRequestsPage />;
        case 'inventory':
            return <InventoryManagementPage user={user} locale={locale} />;
        case 'products':
            return <ProductCatalogPage user={user} locale={locale} />;
        case 'procurement':
            return <ProcurementOverviewPage />;
        case 'sales':
            return flags.isNoguchiFactory ? (
                <SalesOverviewPage />
            ) : (
                <ManualSalesPage user={user} locale={locale} />
            );
        case 'finance':
            return <FinanceOverviewPage />;
        case 'finance-reports':
            return <FinancialReportsPage />;
        case 'hr':
            return <HrOverviewPage />;
        case 'safety':
            return <SafetyOverviewPage />;
        case 'logistics':
        case 'dispatch':
        case 'vehicles':
        case 'delivery-confirmation':
            return (
                <LogisticsOverviewPage
                    can={can}
                    initialTab={LOGISTICS_TABS[activePage] || 'shipments'}
                />
            );
        case 'agreement':
            if (flags.isLogisticsUser) return <AgreementWorkspacePage can={can} />;
            break;
        case 'settings':
            return <FactorySettingsPage />;
        case 'team':
            return <TeamManagementPage />;
        case 'reports':
        case 'logistics-reports':
            return (
                <ReportsPage
                    key={activePage}
                    canExport={can('reports.export')}
                    productionOnly={user.workspace === 'production' && !flags.isExecutiveUser}
                    forcedScope={
                        activePage === 'logistics-reports' || flags.isLogisticsUser
                            ? 'logistics'
                            : undefined
                    }
                />
            );
        case 'quality':
            return <QualityControlPage can={can} />;
        case 'machines':
            return <MachinesPage can={can} />;
        case 'production':
            return can('factory.manage') ? (
                <ProductionFlowPage />
            ) : (
                <ProductionOperations can={can} />
            );
    }

    return <PageNotFound locale={locale} onNavigate={onNavigate} />;
}

function PageNotFound({
    locale,
    onNavigate,
}: {
    locale: Locale;
    onNavigate: (page: string) => void;
}) {
    return (
        <div className="panel empty-state">
            <h3>
                {locale === 'en' ? 'This page is not available' : "Cette page n'est pas disponible"}
            </h3>
            <p>
                {locale === 'en'
                    ? 'It may have moved, or you may not have access to it.'
                    : "Elle a peut-être été déplacée, ou vous n'y avez pas accès."}
            </p>
            <button className="secondary-btn" onClick={() => onNavigate('dashboard')}>
                {locale === 'en' ? 'Go to the dashboard' : 'Aller au tableau de bord'}
            </button>
        </div>
    );
}

function PageLoading() {
    return (
        <div className="panel page-recovery page-reconnecting" role="status">
            <p>Loading…</p>
        </div>
    );
}
