import React, { useEffect, useState } from 'react';
import { ChevronRight, PackageOpen } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { startPolling } from '../../core/polling';

async function loadDashboard(period: string, from?: string, to?: string) {
    let url = `/api/executive/dashboard?period=${period}`;
    if (period === 'custom' && from && to) {
        url += `&from=${from}&to=${to}`;
    }
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    const text = await response.text();
    let payload: any;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error('The dashboard could not read the server response.');
    }
    if (!response.ok) {
        throw new Error(payload.message || 'Unable to load dashboard data.');
    }
    return payload;
}

const number = (value: any) =>
    Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const getStatusColor = (status: string) => {
    switch (String(status || '').toLowerCase()) {
        case 'delivered':
        case 'completed':
        case 'success':
            return '#16a34a';
        case 'accepted':
            return '#2563eb';
        case 'partial':
            return '#7c3aed';
        case 'pending':
            return '#d97706';
        case 'cancelled':
        case 'rejected':
            return '#dc2626';
        default:
            return '#2563eb';
    }
};

export default function ExecutiveDashboard({ user, locale, onNavigate }: any) {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [period, setPeriod] = useState('all_time');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
    const isOwner = user.roles?.some((role: any) => role.slug === 'factory-owner');

    const load = () =>
        loadDashboard(period, startDate, endDate)
            .then((result) => {
                setData(result);
                setError('');
                setUpdatedAt(new Date());
            })
            .catch((reason) => setError(reason.message));

    useEffect(() => {
        load();
        const timer = startPolling(load, 15000);
        return () => window.clearInterval(timer);
    }, [period, startDate, endDate]);

    const metrics = data?.metrics || {};
    const orders = data?.orders || [];
    const isSpecialized = Boolean(metrics.isSpecialized);

    const greeting = isOwner
        ? locale === 'fr'
            ? `Bonjour, ${user.name}. Voici les performances actuelles de votre usine.`
            : `Welcome, ${user.name}. Here is your factory’s current performance.`
        : locale === 'fr'
          ? `Bonjour, ${user.name}. Voici les travaux importants de votre usine.`
          : `Welcome, ${user.name}. Here is the work that needs your attention.`;

    return (
        <section className="executive-live">
            <div className="page-heading">
                <div>
                    <div className="eyebrow">
                        <span></span>
                        {locale === 'fr' ? 'DONNÉES DE L’USINE' : 'FACTORY DATA'}
                    </div>
                    <h1>
                        {isOwner
                            ? locale === 'fr'
                                ? "Performances de l'usine"
                                : 'Factory performance'
                            : locale === 'fr'
                              ? "Opérations de l'usine"
                              : 'Factory operations'}
                    </h1>
                    <p>{greeting}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        className="admin-input"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        style={{
                            padding: '0.4rem 2rem 0.4rem 1rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            fontWeight: 600,
                        }}
                    >
                        <option value="daily">{locale === 'fr' ? 'Quotidien (Aujourd’hui)' : 'Daily (Today)'}</option>
                        <option value="weekly">
                            {locale === 'fr' ? 'Hebdomadaire (7 jours)' : 'Weekly (Last 7 Days)'}
                        </option>
                        <option value="monthly">{locale === 'fr' ? 'Mensuel (Ce mois)' : 'Monthly (This Month)'}</option>
                        <option value="yearly">{locale === 'fr' ? 'Annuel (Cette année)' : 'Annually (This Year)'}</option>
                        <option value="custom">{locale === 'fr' ? 'Période personnalisée' : 'Custom Date Range'}</option>
                        <option value="all_time">
                            {locale === 'fr' ? 'Tout le temps' : 'All Time'}
                        </option>
                    </select>

                    {period === 'custom' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="admin-input"
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.875rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    background: '#ffffff',
                                }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>~</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="admin-input"
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.875rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    background: '#ffffff',
                                }}
                            />
                        </div>
                    )}

                    {!isOwner && !isSpecialized && (
                        <button className="primary-btn" onClick={() => onNavigate('production')}>
                            {locale === 'fr'
                                ? 'Nouvel ordre de production'
                                : 'New production order'}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}

            <div className="live-report-status">
                <span>
                    {updatedAt
                        ? (locale === 'fr' ? 'Données actualisées à ' : 'Data updated at ') +
                          updatedAt.toLocaleTimeString()
                        : locale === 'fr'
                          ? 'Connexion aux données…'
                          : 'Connecting to live data…'}
                </span>
            </div>

            {isSpecialized ? (
                <section className="department-metrics cols-6">
                    <Metric
                        label={locale === 'fr' ? 'Commandes totales' : 'Total orders'}
                        value={number(metrics.totalOrders)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Vêtements commandés' : 'Garments ordered'}
                        value={number(metrics.totalGarmentsOrdered)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Vêtements livrés' : 'Garments delivered'}
                        value={number(metrics.totalGarmentsDelivered)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Emballés / Prêts' : 'Packed / Ready'}
                        value={number(metrics.totalGarmentsPacked)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Revenu total (RWF)' : 'Total revenue (RWF)'}
                        value={`RWF ${number(metrics.totalRevenue)}`}
                    />
                    <Metric
                        label={
                            locale === 'fr' ? 'Achèvement des livraisons' : 'Delivery completion'
                        }
                        value={`${number(metrics.completionRate)}%`}
                    />
                </section>
            ) : (
                <section className="department-metrics cols-4">
                    <Metric
                        label={locale === 'fr' ? 'Production aujourd’hui' : 'Production today'}
                        value={number(metrics.productionToday)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Ordres ouverts' : 'Open production orders'}
                        value={number(metrics.openOrders)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Stock à surveiller' : 'Low-stock materials'}
                        value={number(metrics.lowStock)}
                    />
                    <Metric
                        label={locale === 'fr' ? 'Achèvement production' : 'Production completion'}
                        value={`${number(metrics.completionRate)}%`}
                    />
                </section>
            )}

            {data?.stage_overview && (
                <article className="panel" style={{ marginBottom: '1.5rem' }}>
                    <div className="panel-title">
                        <h2>
                            {locale === 'fr'
                                ? 'Bilan opérationnel des départements'
                                : 'Department Operational Overview'}
                        </h2>
                        <span className="ui-chip ok" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                            {locale === 'fr' ? 'Registre actif' : 'Active stages'}
                        </span>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ width: '100%', minWidth: 0, tableLayout: 'auto' }}>
                            <thead>
                                <tr>
                                    <th>{locale === 'fr' ? 'Département' : 'Department'}</th>
                                    <th className="num">{locale === 'fr' ? '1. Entrants' : '1. Input'}</th>
                                    <th className="num">{locale === 'fr' ? '2. Sortie' : '2. Output'}</th>
                                    <th className="num">{locale === 'fr' ? '3. Défauts' : '3. Damaged'}</th>
                                    <th>{locale === 'fr' ? '4. Qualité' : '4. QC Status'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.stage_overview.map((st: any) => (
                                    <tr key={st.stage}>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <b>{st.stage}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b>{number(st.input)}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b style={{ color: 'var(--ui-good, #16a34a)' }}>{number(st.output)}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b className={st.damaged > 0 ? 'alert' : ''}>{number(st.damaged)}</b>
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <span className={`ui-chip ${st.damaged === 0 ? 'ok' : 'warn'}`}>
                                                {st.qc_status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            <article className="panel chart-panel executive-chart-panel">
                <PanelTitle
                    title={
                        isSpecialized
                            ? locale === 'fr'
                                ? 'Performances des commandes et livraisons'
                                : 'Order and delivery performance'
                            : locale === 'fr'
                              ? 'Production'
                              : 'Production output'
                    }
                    action={
                        <div className="chart-legend">
                            <span className="actual-dot">
                                {isSpecialized
                                    ? locale === 'fr'
                                        ? 'Livré'
                                        : 'Delivered'
                                    : locale === 'fr'
                                      ? 'Réel'
                                      : 'Actual'}
                            </span>
                            <span className="target-dot">
                                {isSpecialized
                                    ? locale === 'fr'
                                        ? 'Commandé'
                                        : 'Ordered'
                                    : locale === 'fr'
                                      ? 'Planifié'
                                      : 'Planned'}
                            </span>
                        </div>
                    }
                />
                <div className="chart-wrap">
                    {data ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.chart}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="var(--line)"
                                />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                                <YAxis tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="target"
                                    stroke="#94a3b8"
                                    fill="none"
                                    strokeDasharray="5 5"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#2563eb"
                                    fill="#2563eb22"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <Empty
                            text={
                                locale === 'fr'
                                    ? 'Chargement des données…'
                                    : 'Loading performance data…'
                            }
                        />
                    )}
                </div>
            </article>

            <article className="panel orders-panel">
                <PanelTitle
                    title={
                        isSpecialized
                            ? locale === 'fr'
                                ? 'Commandes récentes'
                                : 'Recent customer orders'
                            : locale === 'fr'
                              ? 'Ordres de production actifs'
                              : 'Active production orders'
                    }
                    action={
                        <button
                            className="text-btn"
                            onClick={() => onNavigate(isSpecialized ? 'sales' : 'production')}
                        >
                            {locale === 'fr' ? 'Tout voir' : 'View all'}
                            <ChevronRight size={16} />
                        </button>
                    }
                />
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>{locale === 'fr' ? 'Numéro' : 'Order'}</th>
                                <th>
                                    {isSpecialized
                                        ? locale === 'fr'
                                            ? 'École / Client'
                                            : 'School / Customer'
                                        : locale === 'fr'
                                          ? 'Produit'
                                          : 'Product'}
                                </th>
                                <th>{locale === 'fr' ? 'Statut' : 'Status'}</th>
                                <th>{locale === 'fr' ? 'Échéance' : 'Due date'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length ? (
                                orders.map((item: any) => {
                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <strong>{item.order_number}</strong>
                                            </td>
                                            <td>
                                                <div className="product-cell">
                                                    <div>
                                                        <strong>
                                                            {item.school_name ||
                                                                item.item?.name ||
                                                                'Order'}
                                                        </strong>
                                                        <small>
                                                            {item.location || item.item?.sku || ''}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span
                                                    className="status"
                                                    style={{
                                                        background: 'transparent',
                                                        padding: 0,
                                                        color: getStatusColor(item.status),
                                                        fontWeight: 700,
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    {String(item.status || '').replaceAll('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                {item.planned_end
                                                    ? new Date(
                                                          `${String(item.planned_end).slice(0, 10)}T12:00:00`,
                                                      ).toLocaleDateString()
                                                    : 'Not set'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4}>
                                        <Empty
                                            text={
                                                locale === 'fr'
                                                    ? 'Aucune commande enregistrée.'
                                                    : 'No orders recorded yet.'
                                            }
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </section>
    );
}

function Metric({ label, value }: any) {
    return (
        <article className="department-metric panel">
            <div>
                <small>{label}</small>
                <strong>{value}</strong>
            </div>
        </article>
    );
}

function PanelTitle({ title, action }: any) {
    return (
        <div className="panel-title">
            <h2>{title}</h2>
            {action}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return (
        <div className="executive-empty">
            <span>{text}</span>
        </div>
    );
}
