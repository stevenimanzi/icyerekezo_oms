import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    Boxes,
    CheckCircle2,
    Clock,
    FileText,
    Layers,
    Package,
    PackageMinus,
    PackagePlus,
    RefreshCw,
    Search,
    ShieldAlert,
    Warehouse,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { api } from '../../core/api';
import { makeFormat } from '../../core/format';
import { startPolling } from '../../core/polling';
import type { HomeProps } from '../types';
import type { StockAnalytics, StockRow } from '../../pages/warehouse/stock/types';

const PERIODS = [7, 30, 90] as const;
const REFRESH_MS = 20000;

export default function WarehouseDashboard({ user, locale, onNavigate }: HomeProps) {
    const isFr = locale === 'fr';
    const currency = user.current_factory?.currency_code || 'RWF';
    const format = useMemo(() => makeFormat(locale, currency), [locale, currency]);

    const [days, setDays] = useState<number>(30);
    const [analytics, setAnalytics] = useState<StockAnalytics | null>(null);
    const [overview, setOverview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Table state
    const [search, setSearch] = useState('');
    const [categoryTab, setCategoryTab] = useState<'all' | 'raw_materials' | 'finished_goods' | 'attention'>('all');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [analyticsRes, overviewRes] = await Promise.all([
                api<StockAnalytics>(`/api/inventory/analytics?days=${days}`).catch(() => null),
                api<any>('/api/inventory/overview').catch(() => null),
            ]);
            if (analyticsRes) setAnalytics(analyticsRes);
            if (overviewRes) setOverview(overviewRes);
            setError('');
        } catch (err: any) {
            setError(err?.message || 'Unable to load warehouse dashboard data.');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        loadData();
        const timer = startPolling(loadData, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [loadData]);

    // Consolidate stock rows
    const allStockItems: StockRow[] = useMemo(() => {
        if (analytics) {
            return [
                ...(analytics.raw_materials || []),
                ...(analytics.finished_goods || []),
                ...(analytics.other || []),
            ];
        }
        if (overview?.stock) {
            return overview.stock.map((s: any) => ({
                id: s.id,
                name: s.item_name,
                color: null,
                sku: s.sku,
                type: s.item_type || 'raw_materials',
                unit: s.unit,
                on_hand: Number(s.quantity_on_hand || 0),
                available: Number(s.available_quantity || s.quantity_on_hand || 0),
                reserved: Number(s.quantity_reserved || 0),
                held: Number(s.quantity_quarantined || 0),
                reorder_level: Number(s.reorder_level || 0),
                value: Number(s.stock_value || (s.quantity_on_hand * s.standard_cost) || 0),
                status: (Number(s.quantity_on_hand) <= 0
                    ? 'out'
                    : Number(s.reorder_level) > 0 && Number(s.quantity_on_hand) <= Number(s.reorder_level)
                    ? 'low'
                    : 'ok') as 'ok' | 'low' | 'out',
            }));
        }
        return [];
    }, [analytics, overview]);

    // Filter table items
    const filteredStock = useMemo(() => {
        return allStockItems.filter((item) => {
            // Category tab
            if (categoryTab === 'raw_materials' && item.type !== 'raw_materials') return false;
            if (categoryTab === 'finished_goods' && item.type !== 'finished_goods') return false;
            if (categoryTab === 'attention' && item.status === 'ok') return false;

            // Search
            if (search.trim()) {
                const q = search.toLowerCase();
                const matchName = item.name?.toLowerCase().includes(q);
                const matchSku = item.sku?.toLowerCase().includes(q);
                if (!matchName && !matchSku) return false;
            }
            return true;
        });
    }, [allStockItems, categoryTab, search]);

    // Movement Chart data
    const movementData = useMemo(() => {
        if (!analytics?.movement?.daily) return [];
        return analytics.movement.daily.map((d) => ({
            date: d.day ? d.day.slice(5) : '',
            received: Number(d.received || 0),
            issued: Number(d.issued || 0),
        }));
    }, [analytics]);

    // Category distribution max
    const maxGroupValue = useMemo(() => {
        if (!analytics?.by_type?.length) return 1;
        return Math.max(1, ...analytics.by_type.map((g) => g.value || 0));
    }, [analytics]);

    // KPI values
    const totalValue = analytics?.kpis?.total_value ?? overview?.total_value ?? 0;
    const itemsInStock = analytics?.kpis?.items_in_stock ?? overview?.items ?? allStockItems.length;
    const lowStockCount = analytics?.kpis?.low_stock ?? overview?.low_stock ?? allStockItems.filter((i) => i.status === 'low').length;
    const outOfStockCount = analytics?.kpis?.out_of_stock ?? allStockItems.filter((i) => i.status === 'out').length;
    const heldQuality = analytics?.kpis?.held_for_quality ?? 0;
    const receivedValue = analytics?.movement?.received_value ?? 0;
    const issuedValue = analytics?.movement?.issued_value ?? 0;

    const recentTransactions = overview?.recent_transactions || [];

    return (
        <section className="ow warehouse-dashboard" style={{ padding: '0 0 40px' }}>
            {/* Header */}
            <div className="page-heading">
                <div>
                    <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Warehouse size={14} />
                        <span>{isFr ? 'Gestion des stocks & Entrepôt' : 'Warehouse & Stock Operations'}</span>
                    </div>
                    <h1>{user.current_factory?.name || (isFr ? 'Entrepôt' : 'Factory Warehouse')}</h1>
                    <p>
                        {isFr
                            ? `Bonjour, ${user.name}. Voici l'état actuel du stock et des mouvements de votre usine.`
                            : `Welcome, ${user.name}. Here is an overview of your factory stock and movements.`}
                    </p>
                </div>
                <div className="ow-controls" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <select
                        aria-label="Period"
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--panel)',
                            color: 'var(--text)',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        <option value={7}>{isFr ? 'Derniers 7 jours' : 'Last 7 days'}</option>
                        <option value={30}>{isFr ? 'Derniers 30 jours' : 'Last 30 days'}</option>
                        <option value={90}>{isFr ? 'Derniers 90 jours' : 'Last 90 days'}</option>
                    </select>
                    <button className="secondary-btn" onClick={loadData} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        {isFr ? 'Actualiser' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}

            {/* Quick Actions Navigation */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                }}
            >
                <button
                    onClick={() => onNavigate('stock-in')}
                    className="panel"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                    }}
                >
                    <div
                        style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            padding: 10,
                            borderRadius: 8,
                            display: 'flex',
                        }}
                    >
                        <PackagePlus size={20} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Entrée de stock' : 'Stock In'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Réceptionner des matières' : 'Receive materials & goods'}
                        </small>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('incoming-requests')}
                    className="panel"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                    }}
                >
                    <div
                        style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            padding: 10,
                            borderRadius: 8,
                            display: 'flex',
                        }}
                    >
                        <PackageMinus size={20} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Sortie de stock' : 'Stock Out'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Sortir ou expédier des articles' : 'Issue to lines & dispatch'}
                        </small>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('products')}
                    className="panel"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                    }}
                >
                    <div
                        style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: '#3b82f6',
                            padding: 10,
                            borderRadius: 8,
                            display: 'flex',
                        }}
                    >
                        <Package size={20} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Catalogue Produits' : 'Product Catalog'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Voir tous les articles enregistrés' : 'View registered items & SKUs'}
                        </small>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('reports')}
                    className="panel"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 18px',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                    }}
                >
                    <div
                        style={{
                            background: 'rgba(139, 92, 246, 0.12)',
                            color: '#8b5cf6',
                            padding: 10,
                            borderRadius: 8,
                            display: 'flex',
                        }}
                    >
                        <FileText size={20} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Rapports de stock' : 'Stock Reports'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Analyses détaillées et historique' : 'Detailed analytics & logs'}
                        </small>
                    </div>
                </button>
            </div>

            {/* 6 Key KPIs */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 14,
                    marginBottom: 20,
                }}
            >
                {/* Total Value */}
                <article className="panel" style={{ padding: '16px 18px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                            {isFr ? 'Valeur totale du stock' : 'Total Stock Value'}
                        </small>
                        <span style={{ color: '#2563eb' }}><Boxes size={18} /></span>
                    </div>
                    <strong style={{ display: 'block', fontSize: 24, marginTop: 8, color: 'var(--text)' }}>
                        {format.money(totalValue)}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {isFr ? `${itemsInStock} articles actifs` : `${itemsInStock} active items`}
                    </p>
                </article>

                {/* Received in period */}
                <article className="panel" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                            {isFr ? 'Entrées (Période)' : 'Stock In (Period)'}
                        </small>
                        <span style={{ color: '#10b981' }}><ArrowDownRight size={18} /></span>
                    </div>
                    <strong style={{ display: 'block', fontSize: 24, marginTop: 8, color: '#10b981' }}>
                        +{format.moneyShort(receivedValue)}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {isFr ? 'Marchandises réceptionnées' : 'Total incoming value'}
                    </p>
                </article>

                {/* Issued in period */}
                <article className="panel" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                            {isFr ? 'Sorties (Période)' : 'Stock Out (Period)'}
                        </small>
                        <span style={{ color: '#f59e0b' }}><ArrowUpRight size={18} /></span>
                    </div>
                    <strong style={{ display: 'block', fontSize: 24, marginTop: 8, color: '#f59e0b' }}>
                        -{format.moneyShort(issuedValue)}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {isFr ? 'Distribué en production' : 'Total issued to lines'}
                    </p>
                </article>

                {/* Items to reorder */}
                <article
                    className="panel"
                    style={{
                        padding: '16px 18px',
                        borderLeft: lowStockCount > 0 ? '4px solid #f59e0b' : '1px solid var(--line)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                            {isFr ? 'À réapprovisionner' : 'Items to Reorder'}
                        </small>
                        <span style={{ color: '#f59e0b' }}><AlertTriangle size={18} /></span>
                    </div>
                    <strong style={{ display: 'block', fontSize: 24, marginTop: 8, color: lowStockCount > 0 ? '#d97706' : 'var(--text)' }}>
                        {lowStockCount}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {lowStockCount > 0
                            ? (isFr ? 'Stock inférieur au seuil' : 'Below safety threshold')
                            : (isFr ? 'Niveaux corrects' : 'All levels adequate')}
                    </p>
                </article>

                {/* Out of stock */}
                <article
                    className="panel"
                    style={{
                        padding: '16px 18px',
                        borderLeft: outOfStockCount > 0 ? '4px solid #ef4444' : '1px solid var(--line)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                            {isFr ? 'Rupture de stock' : 'Out of Stock'}
                        </small>
                        <span style={{ color: '#ef4444' }}><ShieldAlert size={18} /></span>
                    </div>
                    <strong style={{ display: 'block', fontSize: 24, marginTop: 8, color: outOfStockCount > 0 ? '#dc2626' : 'var(--text)' }}>
                        {outOfStockCount}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {outOfStockCount > 0
                            ? (isFr ? 'Quantité nulle (0)' : 'Zero balance items')
                            : (isFr ? 'Aucune rupture' : 'No stockouts')}
                    </p>
                </article>

                {/* Quality / Quarantine */}
                <article className="panel" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                            {isFr ? 'En contrôle qualité' : 'Held for Quality'}
                        </small>
                        <span style={{ color: '#8b5cf6' }}><Clock size={18} /></span>
                    </div>
                    <strong style={{ display: 'block', fontSize: 24, marginTop: 8, color: 'var(--text)' }}>
                        {heldQuality}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {isFr ? 'Lots en attente d’inspection' : 'Batches in QA / quarantine'}
                    </p>
                </article>
            </div>

            {/* Charts Section */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)',
                    gap: 16,
                    marginBottom: 24,
                }}
            >
                {/* Movement Trends Chart */}
                <article className="panel" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {isFr ? 'FLUX QUOTIDIEN' : 'DAILY STOCK MOVEMENTS'}
                            </span>
                            <h2 style={{ fontSize: 17, margin: '2px 0 4px', fontWeight: 700 }}>
                                {isFr ? 'Entrées vs Sorties' : 'Stock In vs Stock Out Trend'}
                            </h2>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                                {isFr
                                    ? `Volumes reçus et distribués sur les ${days} derniers jours.`
                                    : `Quantities received and issued over the last ${days} days.`}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
                                {isFr ? 'Reçu' : 'Received'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
                                {isFr ? 'Sorti' : 'Issued'}
                            </span>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: 260 }}>
                        {movementData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={movementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.7} />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'var(--muted)', fontSize: 11 }}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'var(--muted)', fontSize: 11 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--panel)',
                                            border: '1px solid var(--line)',
                                            borderRadius: 8,
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                            fontSize: 12,
                                        }}
                                    />
                                    <Bar dataKey="received" name={isFr ? 'Reçu' : 'Received'} fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="issued" name={isFr ? 'Sorti' : 'Issued'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
                                {isFr ? 'En attente de données de mouvement…' : 'Waiting for movement data…'}
                            </div>
                        )}
                    </div>
                </article>

                {/* Stock Value by Category Breakdown */}
                <article className="panel" style={{ padding: 20 }}>
                    <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {isFr ? 'RÉPARTITION DU STOCK' : 'CATEGORY BREAKDOWN'}
                        </span>
                        <h2 style={{ fontSize: 17, margin: '2px 0 4px', fontWeight: 700 }}>
                            {isFr ? 'Valeur par Catégorie' : 'Stock Value by Category'}
                        </h2>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                            {isFr ? 'Distribution de la valeur d’inventaire en magasin.' : 'Inventory valuation by material group.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(analytics?.by_type || [
                            { key: 'raw_materials', items: 6, value: totalValue },
                            { key: 'finished_goods', items: 2, value: 0 },
                            { key: 'other', items: 0, value: 0 },
                        ]).map((group) => {
                            const label =
                                group.key === 'raw_materials'
                                    ? (isFr ? 'Matières Premières' : 'Raw Materials')
                                    : group.key === 'finished_goods'
                                    ? (isFr ? 'Produits Finis' : 'Finished Goods')
                                    : (isFr ? 'Fournitures & Autres' : 'Trims & Other');
                            const barColor =
                                group.key === 'raw_materials'
                                    ? '#2563eb'
                                    : group.key === 'finished_goods'
                                    ? '#10b981'
                                    : '#8b5cf6';
                            const percent = maxGroupValue > 0 ? (group.value / maxGroupValue) * 100 : 0;

                            return (
                                <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                        <span style={{ fontWeight: 600 }}>
                                            {label}{' '}
                                            <small style={{ color: 'var(--muted)', fontWeight: 500 }}>
                                                ({group.items} {isFr ? 'articles' : 'items'})
                                            </small>
                                        </span>
                                        <strong>{format.money(group.value)}</strong>
                                    </div>
                                    <div
                                        style={{
                                            width: '100%',
                                            height: 8,
                                            background: 'var(--soft, #f1f5f9)',
                                            borderRadius: 999,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: `${Math.max(4, Math.min(100, percent))}%`,
                                                height: '100%',
                                                background: barColor,
                                                borderRadius: 999,
                                                transition: 'width 0.4s ease',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Needs Attention Alert Box */}
                    {(analytics?.attention?.length || 0) > 0 && (
                        <div
                            style={{
                                marginTop: 24,
                                padding: '12px 14px',
                                background: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: 8,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                                <AlertTriangle size={15} />
                                <span>{isFr ? 'Articles nécessitant une attention' : 'Items Requiring Attention'}</span>
                            </div>
                            <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                                {isFr
                                    ? `${analytics?.attention?.length} articles sont en rupture ou sous le seuil d'alerte.`
                                    : `${analytics?.attention?.length} items are currently at or below their reorder threshold.`}
                            </small>
                        </div>
                    )}
                </article>
            </div>

            {/* Table to show Overview of Stock */}
            <article className="panel" style={{ padding: 20, marginBottom: 24 }}>
                <header
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {isFr ? 'INVENTAIRE COMPLET' : 'CURRENT INVENTORY'}
                        </span>
                        <h2 style={{ fontSize: 18, margin: '2px 0 0', fontWeight: 700 }}>
                            {isFr ? 'Aperçu du stock' : 'Stock Overview Table'}
                        </h2>
                    </div>

                    {/* Category Tabs */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                            ['all', isFr ? 'Tous les articles' : 'All Items'],
                            ['raw_materials', isFr ? 'Matières 1ères' : 'Raw Materials'],
                            ['finished_goods', isFr ? 'Produits Finis' : 'Finished Goods'],
                            ['attention', isFr ? 'Stock Faible / Rupture' : 'Low / Out of Stock'],
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setCategoryTab(key as any)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    border: '1px solid var(--line)',
                                    background: categoryTab === key ? '#2563eb' : 'var(--panel)',
                                    color: categoryTab === key ? '#ffffff' : 'var(--text)',
                                    cursor: 'pointer',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Filter / Search Bar */}
                <div style={{ marginBottom: 14, position: 'relative' }}>
                    <Search
                        size={16}
                        style={{
                            position: 'absolute',
                            left: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--muted)',
                        }}
                    />
                    <input
                        type="text"
                        placeholder={isFr ? 'Rechercher par nom d’article ou référence SKU…' : 'Search stock by item name or SKU…'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '9px 12px 9px 36px',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--panel)',
                            color: 'var(--text)',
                            fontSize: 13,
                        }}
                    />
                </div>

                {/* Table */}
                <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th>{isFr ? 'Article & SKU' : 'Item & SKU'}</th>
                                <th>{isFr ? 'Catégorie' : 'Category'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Stock disponible' : 'Available'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Qté en main' : 'On Hand'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Seuil d’alerte' : 'Reorder Level'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Valeur estimée' : 'Stock Value'}</th>
                                <th style={{ textAlign: 'center' }}>{isFr ? 'Statut' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStock.length > 0 ? (
                                filteredStock.map((item) => {
                                    const isOut = item.status === 'out';
                                    const isLow = item.status === 'low';
                                    const categoryLabel =
                                        item.type === 'raw_materials' || item.type === 'raw_material'
                                            ? (isFr ? 'Matière première' : 'Raw Material')
                                            : item.type === 'finished_goods' || item.type === 'finished_good'
                                            ? (isFr ? 'Produit fini' : 'Finished Good')
                                            : (isFr ? 'Fourniture' : 'Trim / Other');

                                    return (
                                        <tr key={item.id || item.sku}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong style={{ fontSize: 13, color: 'var(--text)' }}>{item.name}</strong>
                                                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                                                        {item.sku}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{categoryLabel}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {format.number(item.available)} {item.unit || ''}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {format.number(item.on_hand)} {item.unit || ''}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>
                                                {item.reorder_level > 0 ? `${format.number(item.reorder_level)} ${item.unit || ''}` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {format.money(item.value)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {isOut ? (
                                                    <span
                                                        className="admin-status"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.12)',
                                                            color: '#dc2626',
                                                            padding: '4px 8px',
                                                            borderRadius: 6,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {isFr ? 'Rupture' : 'Out of stock'}
                                                    </span>
                                                ) : isLow ? (
                                                    <span
                                                        className="admin-status"
                                                        style={{
                                                            background: 'rgba(245, 158, 11, 0.12)',
                                                            color: '#d97706',
                                                            padding: '4px 8px',
                                                            borderRadius: 6,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {isFr ? 'Stock faible' : 'Low stock'}
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="admin-status"
                                                        style={{
                                                            background: 'rgba(16, 185, 129, 0.12)',
                                                            color: '#16a34a',
                                                            padding: '4px 8px',
                                                            borderRadius: 6,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {isFr ? 'En stock' : 'In stock'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                                        {isFr ? 'Aucun article correspondant.' : 'No matching stock items found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            {/* Recent Stock Transactions Activity */}
            {recentTransactions.length > 0 && (
                <article className="panel" style={{ padding: 20 }}>
                    <div style={{ marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {isFr ? 'HISTORIQUE RÉCENT' : 'RECENT ACTIVITY'}
                        </span>
                        <h2 style={{ fontSize: 17, margin: '2px 0 0', fontWeight: 700 }}>
                            {isFr ? 'Dernières Transactions de Stock' : 'Latest Stock Transactions'}
                        </h2>
                    </div>

                    <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th>{isFr ? 'Date' : 'Time'}</th>
                                    <th>{isFr ? 'Article' : 'Item'}</th>
                                    <th>{isFr ? 'Opération' : 'Type'}</th>
                                    <th style={{ textAlign: 'right' }}>{isFr ? 'Variation' : 'Quantity Delta'}</th>
                                    <th style={{ textAlign: 'right' }}>{isFr ? 'Nouveau Solde' : 'Balance After'}</th>
                                    <th>{isFr ? 'Entrepôt' : 'Warehouse'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTransactions.slice(0, 8).map((tx: any) => {
                                    const delta = Number(tx.quantity_delta || 0);
                                    const isPositive = delta > 0;
                                    return (
                                        <tr key={tx.id}>
                                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                {tx.occurred_at ? new Date(tx.occurred_at).toLocaleString() : '—'}
                                            </td>
                                            <td>
                                                <strong style={{ fontSize: 13 }}>{tx.item_name}</strong>
                                                <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                                                    {tx.sku}
                                                </small>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 12, textTransform: 'capitalize' }}>
                                                    {String(tx.type || '').replaceAll('_', ' ')}
                                                </span>
                                            </td>
                                            <td
                                                style={{
                                                    textAlign: 'right',
                                                    fontWeight: 700,
                                                    color: isPositive ? '#16a34a' : '#ef4444',
                                                }}
                                            >
                                                {isPositive ? `+${delta}` : delta} {tx.unit || ''}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {tx.balance_after} {tx.unit || ''}
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                {tx.warehouse_name || 'Main Warehouse'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}
        </section>
    );
}
