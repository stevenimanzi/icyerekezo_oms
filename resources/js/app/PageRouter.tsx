import type { AuthUser, Locale } from '../core/types';
import AgreementWorkspacePage from '../pages/logistics/AgreementWorkspacePage';
import LogisticsOverviewPage from '../pages/logistics/LogisticsOverviewPage';
import FactorySettingsPage from '../pages/factory/FactorySettingsPage';
import FinanceOverviewPage from '../pages/finance/FinanceOverviewPage';
import FinancialReportsPage from '../pages/finance/FinancialReportsPage';
import HrOverviewPage from '../pages/hr/HrOverviewPage';
import ProcurementOverviewPage from '../pages/procurement/ProcurementOverviewPage';
import { ProductionFlowPage, TeamManagementPage } from '../pages/production/FactoryManagerModules';
import MachinesPage from '../pages/production/MachinesPage';
import ProductionOperations from '../pages/production/ProductionOperations';
import QualityControlPage from '../pages/quality/QualityControlPage';
import SafetyOverviewPage from '../pages/safety/SafetyOverviewPage';
import SalesOverviewPage from '../pages/sales/SalesOverviewPage';
import ReportsPage from '../pages/shared/ClearReportsPage';
import { NotificationsPage } from '../pages/shared/NotificationsPage';
import ProductCatalogPage from '../pages/shared/ProductCatalogPage';
import ProfileSettingsPage from '../pages/shared/ProfileSettingsPage';
import { UserSupportChat } from '../pages/shared/UserSupportChat';
import IncomingRequestsPage from '../pages/warehouse/IncomingRequestsPage';
import InventoryManagementPage from '../pages/warehouse/InventoryManagementPage';
import CuttingWorkspacePage from '../roles/cutting/CuttingWorkspacePage';
import FinishingWorkspacePage from '../roles/finishing/FinishingWorkspacePage';
import type { RoleFlags } from '../roles/flags';
import { homeFor } from '../roles/home';
import OwnerActivityPage from '../roles/owner/OwnerActivityPage';
import PackingWorkspacePage from '../roles/packing/PackingWorkspacePage';
import PlatformAdminPage from '../roles/platform-admin/PlatformAdminPage';
import { SCHOOL_PAGES } from '../roles/school';
import SchoolPortalPage from '../roles/school/SchoolPortalPage';
import SewingWorkspacePage from '../roles/sewing/SewingWorkspacePage';
import type { NotificationsState } from './hooks/useNotifications';
import type { Access } from './navigation';
import { PageBoundary } from './PageBoundary';
import { pageKeyFromPath } from './routing';

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

const LOGISTICS_TABS: Record<string, string> = { dispatch: 'dispatch', vehicles: 'vehicles', 'delivery-confirmation': 'proof' };

export function PageRouter(props: Props) {
    const resetKey = props.flags.isSchoolUser && SCHOOL_PAGES.includes(props.activePage) ? `school-${props.activePage}` : props.activePage;

    return (
        <PageBoundary resetKey={resetKey}>
            <CurrentPage {...props} />
        </PageBoundary>
    );
}

function CurrentPage({ user, locale, dark, flags, access, activePage, availablePages, notifications, onNavigate, onLocaleChange, onThemeChange }: Props) {
    const { can } = access;

    if (flags.isSchoolUser && SCHOOL_PAGES.includes(activePage)) {
        return <SchoolPortalPage page={activePage} onNavigate={onNavigate} locale={locale} />;
    }

    if (activePage === 'profile') {
        return <ProfileSettingsPage user={user} locale={locale} dark={dark} onLocaleChange={onLocaleChange} onThemeChange={onThemeChange} />;
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

    if (user.is_platform_admin) return <PlatformAdminPage page={activePage} locale={locale} />;

    if (activePage === 'support') return <UserSupportChat user={user} locale={locale} />;

    if (activePage in CUTTING_TABS) return <CuttingWorkspacePage user={user} locale={locale} initialTab={CUTTING_TABS[activePage]} />;
    if (activePage === 'sewing-workspace') return <SewingWorkspacePage user={user} locale={locale} />;
    if (activePage === 'finishing-workspace') return <FinishingWorkspacePage user={user} locale={locale} />;
    if (activePage === 'packing-workspace') return <PackingWorkspacePage user={user} locale={locale} />;

    if (activePage === 'dashboard') {
        const Home = homeFor(flags);

        return <Home user={user} locale={locale} onNavigate={onNavigate} pages={availablePages} />;
    }

    if (activePage === 'activity') {
        return <OwnerActivityPage user={user} locale={locale} onNavigate={onNavigate} pages={availablePages} />;
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
            return <SalesOverviewPage />;
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
            return <LogisticsOverviewPage can={can} initialTab={LOGISTICS_TABS[activePage] || 'shipments'} />;
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
                    forcedScope={activePage === 'logistics-reports' || flags.isLogisticsUser ? 'logistics' : undefined}
                />
            );
        case 'quality':
            return <QualityControlPage can={can} />;
        case 'machines':
            return <MachinesPage can={can} />;
        case 'production':
            return can('factory.manage') ? <ProductionFlowPage /> : <ProductionOperations can={can} />;
    }

    return <PageNotFound locale={locale} onNavigate={onNavigate} />;
}

function PageNotFound({ locale, onNavigate }: { locale: Locale; onNavigate: (page: string) => void }) {
    return (
        <div className="panel empty-state">
            <h3>{locale === 'en' ? 'This page is not available' : "Cette page n'est pas disponible"}</h3>
            <p>{locale === 'en' ? 'It may have moved, or you may not have access to it.' : "Elle a peut-être été déplacée, ou vous n'y avez pas accès."}</p>
            <button className="secondary-btn" onClick={() => onNavigate('dashboard')}>
                {locale === 'en' ? 'Go to the dashboard' : 'Aller au tableau de bord'}
            </button>
        </div>
    );
}
