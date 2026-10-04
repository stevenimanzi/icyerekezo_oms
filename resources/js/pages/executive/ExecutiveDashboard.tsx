import React, { useEffect, useState } from 'react';
import { Boxes, ChevronRight, PackageOpen } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

async function loadDashboard(period: string) {
    const response = await fetch(`/api/executive/dashboard?period=${period}`, {
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

export default function ExecutiveDashboard({ user, locale, onNavigate }: any) {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [period, setPeriod] = useState('all_time');
    const isOwner = user.roles?.some((role: any) => role.slug === 'factory-owner');

    const load = () =>
        loadDashboard(period)
            .then((result) => {
                setData(result);
                setError('');
                setUpdatedAt(new Date());
            })
            .catch((reason) => setError(reason.message));

    useEffect(() => {
        load();
        const timer = window.setInterval(load, 5000);
        return () => window.clearInterval(timer);
    }, [period]);

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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select
                        className="admin-input"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        style={{
                            padding: '0.4rem 2rem 0.4rem 1rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                        }}
                    >
                        <option value="daily">{locale === 'fr' ? 'Quotidien' : 'Daily'}</option>
                        <option value="weekly">{locale === 'fr' ? 'Hebdomadaire' : 'Weekly'}</option>
                        <option value="monthly">{locale === 'fr' ? 'Mensuel' : 'Monthly'}</option>
                        <option value="yearly">{locale === 'fr' ? 'Annuel' : 'Yearly'}</option>
                        <option value="all_time">{locale === 'fr' ? 'Tout le temps' : 'All Time'}</option>
                    </select>
                    {!isOwner && !isSpecialized && (
                        <button className="primary-btn" onClick={() => onNavigate('production')}>
                            {locale === 'fr' ? 'Nouvel ordre de production' : 'New production order'}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}

            <div className="live-report-status">
                <i></i>
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
                        label={locale === 'fr' ? 'Achèvement des livraisons' : 'Delivery completion'}
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
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
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
                        <Empty text={locale === 'fr' ? 'Chargement des données…' : 'Loading performance data…'} />
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
                                <th>{locale === 'fr' ? 'Progression' : 'Progress'}</th>
                                <th>{locale === 'fr' ? 'Échéance' : 'Due date'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length ? (
                                orders.map((item: any) => {
                                    const progress =
                                        Number(item.planned_quantity) > 0
                                            ? Math.min(
                                                  100,
                                                  Math.round(
                                                      (Number(item.completed_quantity) /
                                                          Number(item.planned_quantity)) *
                                                          100,
                                                  ),
                                              )
                                            : 0;
                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <strong>{item.order_number}</strong>
                                            </td>
                                            <td>
                                                <div className="product-cell">
                                                    <span className="product-icon p0">
                                                        <Boxes size={17} />
                                                    </span>
                                                    <div>
                                                        <strong>
                                                            {item.school_name || item.item?.name || 'Order'}
                                                        </strong>
                                                        <small>{item.location || item.item?.sku || ''}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={'status s0'}>
                                                    {String(item.status || '').replaceAll('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="progress-cell">
                                                    <div className="progress">
                                                        <span
                                                            style={{
                                                                width: `${progress}%`,
                                                                background: '#2563eb',
                                                            }}
                                                        />
                                                    </div>
                                                    <b>
                                                        {progress}% ({number(item.completed_quantity)}/
                                                        {number(item.planned_quantity)})
                                                    </b>
                                                </div>
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
                                    <td colSpan={5}>
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
            <PackageOpen size={22} />
            <span>{text}</span>
        </div>
    );
}
