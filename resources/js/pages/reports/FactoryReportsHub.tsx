import { lazy, Suspense, useState, type ReactNode } from 'react';
import { ExportButtons } from '../../components/ExportButtons';
import type { ExportDoc } from '../../core/exportDocument';
import { Alerts, Empty, Kpi, isoDate, money, number, today, useFinanceData } from '../finance/financeKit';
import './factory-reports-hub.css';

const FactoryReportPage = lazy(() => import('./FactoryReportPage'));
const DepartmentReportPage = lazy(() => import('./DepartmentReportPage'));
const ClearReportsPage = lazy(() => import('../shared/ClearReportsPage'));
const FinancialReportsPage = lazy(() => import('../finance/FinancialReportsPage'));
const WarehouseReportPage = lazy(() => import('../warehouse/stock/WarehouseReportPage'));
const MaintenanceWorkspacePage = lazy(() => import('../maintenance/MaintenanceWorkspacePage'));

type HubProps = {
    user: any;
    locale: any;
    hasProductionFlow: boolean;
    canExport: boolean;
    can: (permission: string) => boolean;
    onNavigate?: (page: string) => void;
};

const TABS: { key: string; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'production', label: 'Production' },
    { key: 'sales', label: 'Sales' },
    { key: 'finance', label: 'Money' },
    { key: 'stock', label: 'Stock' },
    { key: 'procurement', label: 'Purchasing' },
    { key: 'quality', label: 'Quality' },
    { key: 'people', label: 'People' },
    { key: 'maintenance', label: 'Machines' },
    { key: 'safety', label: 'Safety' },
    { key: 'deliveries', label: 'Deliveries' },
    { key: 'audit', label: 'Activity log' },
];

const ALERT_TEXT: Record<string, string> = {
    serious_incident: 'Serious safety cases still open',
    machines_down: 'Machines not working',
    overdue_payments: 'Customer orders past their payment date',
    late_orders: 'Customer orders that are late',
    late_production: 'Production orders that are late',
    low_stock: 'Items running low',
    expiring_batches: 'Batches expiring within 30 days',
    service_overdue: 'Machines overdue for service',
    failed_inspections: 'Quality checks failed in these dates',
    payment_receipts: 'Payment receipts waiting for approval',
    held_lots: 'Production lots on hold',
    stuck_deliveries: 'Deliveries between stages waiting over a day',
    material_requests: 'Material requests waiting for stock',
    final_check: 'Pieces waiting for the final check',
};

const daysAgo = (days: number) => isoDate(new Date(Date.now() - days * 86400000));

const kpiText = (item: any, currency: string) => {
    if (item.value === null || item.value === undefined) return '—';
    if (item.kind === 'money') return money(item.value, currency);
    if (item.kind === 'percent') return `${number(item.value)}%`;
    if (item.kind === 'minutes') {
        const m = Math.round(Number(item.value));
        return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
    }

    return number(item.value);
};

function Overview() {
    const [from, setFrom] = useState(daysAgo(29));
    const [to, setTo] = useState(today());
    const { data, loading, error, reload } = useFinanceData<any>(`/api/reports/overview?from=${from}&to=${to}`);
    const currency = data?.currency || 'RWF';

    const exportDoc = (): ExportDoc | null => {
        if (!data) return null;

        return {
            title: `Whole factory report${data.factory ? ` — ${data.factory}` : ''}`,
            subtitle: `From ${data.period.from} to ${data.period.to}`,
            tables: data.sections.map((section: any) => ({
                heading: section.title,
                columns: [{ label: 'Measure' }, { label: 'Value', kind: 'text' }, { label: 'Note' }],
                rows: section.kpis.map((item: any) => [item.label, kpiText(item, currency), item.hint || '']),
            })),
        };
    };

    const setRange = (start: string) => {
        setFrom(start);
        setTo(today());
    };

    return (
        <div className="frh-overview">
            <div className="frh-bar">
                <div className="frh-dates">
                    <label>
                        From
                        <input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} />
                    </label>
                    <label>
                        To
                        <input type="date" value={to} min={from} max={today()} onChange={(event) => event.target.value && setTo(event.target.value)} />
                    </label>
                    <div className="frh-quick" role="group" aria-label="Quick dates">
                        <button type="button" onClick={() => setRange(today())}>
                            Today
                        </button>
                        <button type="button" onClick={() => setRange(daysAgo(6))}>
                            Last 7 days
                        </button>
                        <button type="button" onClick={() => setRange(daysAgo(29))}>
                            Last 30 days
                        </button>
                        <button type="button" onClick={() => setRange(`${new Date().getFullYear()}-01-01`)}>
                            This year
                        </button>
                    </div>
                </div>
                <div className="frh-actions">
                    <ExportButtons doc={exportDoc} disabled={!data} />
                    <button type="button" onClick={reload} disabled={loading}>
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
            </div>
            <Alerts error={error} />

            {data && (
                <>
                    <p className="frh-note">
                        Every number below comes from the records of {data.factory || 'this factory'} for the dates chosen, and matches the report of each department. Figures
                        marked “to date” are balances today and do not depend on the dates.
                    </p>
                    {data.alerts?.length > 0 && (
                        <div className="fb-panel frh-alerts">
                            <h2>Needs attention</h2>
                            <ul>
                                {data.alerts.map((alert: any) => (
                                    <li key={alert.key} className={alert.level}>
                                        {ALERT_TEXT[alert.key] || alert.key}: <b>{alert.count}</b>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {data.sections.map((section: any) => (
                        <div className="fb-panel" key={section.key}>
                            <h2>{section.title}</h2>
                            <div className="fb-kpis">
                                {section.kpis.map((item: any) => (
                                    <Kpi key={item.label} label={item.label} value={kpiText(item, currency)} hint={item.hint || undefined} tone={item.tone || undefined} />
                                ))}
                            </div>
                        </div>
                    ))}
                    {data.top_customers?.length > 0 && (
                        <div className="fb-panel">
                            <h2>Best customers in these dates</h2>
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th className="num">Orders</th>
                                            <th className="num">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.top_customers.map((row: any) => (
                                            <tr key={row.name}>
                                                <td>{row.name}</td>
                                                <td className="num">{number(row.orders)}</td>
                                                <td className="num">{money(row.revenue, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {data.trend?.length > 0 && (
                        <div className="fb-panel">
                            <h2>Last 12 months</h2>
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th className="num">Orders</th>
                                            <th className="num">Sales value</th>
                                            <th className="num">Pieces made</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.trend.map((row: any) => (
                                            <tr key={row.label}>
                                                <td>{row.label}</td>
                                                <td className="num">{number(row.orders)}</td>
                                                <td className="num">{money(row.revenue, currency)}</td>
                                                <td className="num">{number(row.output)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
            {!data && !error && <Empty>Loading the factory report…</Empty>}
        </div>
    );
}

/** The owner, administrator and manager read every department of the active factory from one page. */
export default function FactoryReportsHub({ user, locale, hasProductionFlow, canExport, can, onNavigate }: HubProps) {
    const [tab, setTab] = useState<string>(() => {
        try {
            const saved = sessionStorage.getItem('factory-reports-tab');

            return TABS.some((item) => item.key === saved) ? (saved as string) : 'overview';
        } catch {
            return 'overview';
        }
    });
    const choose = (key: string) => {
        setTab(key);
        try {
            sessionStorage.setItem('factory-reports-tab', key);
        } catch {
            /* the tab simply is not remembered */
        }
    };

    let body: ReactNode;
    switch (tab) {
        case 'production':
            body = hasProductionFlow ? <FactoryReportPage user={user} locale={locale} /> : <ClearReportsPage canExport={canExport} productionOnly />;
            break;
        case 'sales':
        case 'procurement':
        case 'quality':
        case 'people':
        case 'safety':
        case 'audit':
            body = <DepartmentReportPage key={tab} department={tab} />;
            break;
        case 'finance':
            body = <FinancialReportsPage />;
            break;
        case 'stock':
            body = <WarehouseReportPage user={user} locale={locale} />;
            break;
        case 'maintenance':
            body = <MaintenanceWorkspacePage view="reports" can={can} onNavigate={onNavigate} />;
            break;
        case 'deliveries':
            body = <ClearReportsPage key="deliveries" canExport={canExport} forcedScope="logistics" />;
            break;
        default:
            body = <Overview />;
    }

    return (
        <section className="frh">
            <nav className="frh-tabs" aria-label="Reports of every department">
                {TABS.map((item) => (
                    <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} aria-current={tab === item.key ? 'page' : undefined} onClick={() => choose(item.key)}>
                        {item.label}
                    </button>
                ))}
            </nav>
            <Suspense fallback={<Empty>Loading…</Empty>}>{body}</Suspense>
        </section>
    );
}
