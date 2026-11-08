import React, { lazy, Suspense, useState, type ReactNode } from 'react';
import {
    BadgeDollarSign,
    Cog,
    Factory,
    Package,
    ShieldAlert,
    ShieldCheck,
    ShoppingBag,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';
import './factory-reports-hub.css';

const FactoryReportPage = lazy(() => import('./FactoryReportPage'));
const DepartmentReportPage = lazy(() => import('./DepartmentReportPage'));
const ClearReportsPage = lazy(() => import('../shared/ClearReportsPage'));
const FinancialReportsPage = lazy(() => import('../finance/FinancialReportsPage'));
const WarehouseReportPage = lazy(() => import('../warehouse/stock/WarehouseReportPage'));
const MachinesPage = lazy(() => import('../production/MachinesPage'));

type HubProps = {
    user: any;
    locale: any;
    hasProductionFlow: boolean;
    canExport: boolean;
    can: (permission: string) => boolean;
    onNavigate?: (page: string) => void;
};

interface ReportTabItem {
    key: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: ReportTabItem[] = [
    { key: 'production', label: 'Production', icon: Factory },
    { key: 'sales', label: 'Sales', icon: ShoppingBag },
    { key: 'finance', label: 'Money', icon: BadgeDollarSign },
    { key: 'stock', label: 'Stock', icon: Warehouse },
    { key: 'procurement', label: 'Purchasing', icon: Package },
    { key: 'quality', label: 'Quality', icon: ShieldCheck },
    { key: 'people', label: 'People', icon: Users },
    { key: 'maintenance', label: 'Machines', icon: Cog },
    { key: 'safety', label: 'Safety', icon: ShieldAlert },
    { key: 'deliveries', label: 'Deliveries', icon: Truck },
];

/** The owner, administrator and manager read every department of the active factory from one page. */
export default function FactoryReportsHub({ user, locale, hasProductionFlow, canExport, can, onNavigate }: HubProps) {
    const [tab, setTab] = useState<string>(() => {
        try {
            const saved = sessionStorage.getItem('factory-reports-tab');
            return TABS.some((item) => item.key === saved) ? (saved as string) : 'production';
        } catch {
            return 'production';
        }
    });

    const choose = (key: string) => {
        setTab(key);
        try {
            sessionStorage.setItem('factory-reports-tab', key);
        } catch {
            /* storage may be unavailable */
        }
    };

    let body: ReactNode;
    switch (tab) {
        case 'production':
            body = hasProductionFlow ? (
                <FactoryReportPage user={user} locale={locale} />
            ) : (
                <ClearReportsPage canExport={canExport} productionOnly />
            );
            break;
        case 'sales':
        case 'procurement':
        case 'quality':
        case 'people':
        case 'maintenance':
        case 'safety':
            body = <DepartmentReportPage key={tab} department={tab} />;
            break;
        case 'finance':
            body = <FinancialReportsPage />;
            break;
        case 'stock':
            body = <WarehouseReportPage user={user} locale={locale} />;
            break;
        case 'deliveries':
            body = <ClearReportsPage key="deliveries" canExport={canExport} forcedScope="logistics" />;
            break;
        default:
            body = hasProductionFlow ? (
                <FactoryReportPage user={user} locale={locale} />
            ) : (
                <ClearReportsPage canExport={canExport} productionOnly />
            );
    }

    return (
        <section className="frh app-page">
            <div className="frh-tabs-container no-print">
                <nav className="frh-tabs" aria-label="Reports of every department">
                    {TABS.map((item) => {
                        const Icon = item.icon;
                        const isActive = tab === item.key;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                className={`frh-tab-btn ${isActive ? 'active' : ''}`}
                                aria-current={isActive ? 'page' : undefined}
                                onClick={() => choose(item.key)}
                            >
                                <Icon size={16} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
            <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading department report…</div>}>
                {body}
            </Suspense>
        </section>
    );
}
