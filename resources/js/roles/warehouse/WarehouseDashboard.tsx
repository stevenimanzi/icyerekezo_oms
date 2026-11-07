import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    FileText,
    Layers,
    Package,
    PackageMinus,
    PackagePlus,
    RefreshCw,
    Search,
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
            <style>{`
                .warehouse-kpi-row {
                    display: grid !important;
                    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
                    gap: 10px !important;
                    margin-bottom: 14px !important;
                    align-items: stretch !important;
                }
                .warehouse-kpi-card {
                    height: 100% !important;
                    min-height: 72px !important;
                    padding: 10px 12px !important;
                    border-radius: 6px !important;
                    border: 1px solid var(--line, #e2e8f0) !important;
                    background: #ffffff !important;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
                    transition: transform 0.15s ease, box-shadow 0.15s ease !important;
                }
                [data-theme="dark"] .warehouse-kpi-card {
                    background: var(--panel, #1e293b) !important;
                    border-color: var(--line, #334155) !important;
                }
                .warehouse-kpi-card:hover {
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
                }
                @media (max-width: 1240px) {
                    .warehouse-kpi-row {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    }
                }
                @media (max-width: 680px) {
                    .warehouse-kpi-row {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }
                }
            `}</style>
            {/* Header */}
            <div className="page-heading">
                <div>
                    <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Warehouse size={14} />
                        <span>{isFr ? 'Gestion des stocks & Entrepôt' : 'Warehouse & Stock'}</span>
                    </div>
                    <h1>{user.current_factory?.name || (isFr ? 'Entrepôt' : 'Factory Warehouse')}</h1>
                    <p>
                        {isFr
                            ? `Bonjour, ${user.name}. Voici l'état actuel du stock et des mouvements de votre usine.`
                            : `Welcome, ${user.name}. Here is what is in stock and your recent item movements.`}
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
                        borderRadius: 12,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
                        <PackagePlus size={24} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Entrée de stock' : 'Stock In'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Réceptionner des matières' : 'Receive new items'}
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
                        borderRadius: 12,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                        <PackageMinus size={24} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Sortie de stock' : 'Stock Out'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Sortir ou expédier des articles' : 'Send items to work lines'}
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
                        borderRadius: 12,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
                        <Package size={24} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Catalogue Produits' : 'Product List'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Voir tous les articles enregistrés' : 'See all saved items'}
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
                        borderRadius: 12,
                        background: 'var(--panel)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center' }}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <strong style={{ display: 'block', fontSize: 14 }}>{isFr ? 'Rapports de stock' : 'Stock Reports'}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {isFr ? 'Analyses détaillées et historique' : 'View stock & movement reports'}
                        </small>
                    </div>
                </button>
            </div>

            {/* 6 Key KPIs - Compact, real white, single-line titles, no icons */}
            <div
                className="warehouse-kpi-row"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                    gap: 10,
                    marginBottom: 14,
                    alignItems: 'stretch',
                }}
            >
                {/* Total Value */}
                <article
                    className="warehouse-kpi-card"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: '#ffffff',
                    }}
                >
                    <small
                        style={{
                            color: 'var(--muted)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: 1.2,
                        }}
                    >
                        {isFr ? 'Valeur stock' : 'Stock Value'}
                    </small>
                    <strong
                        style={{
                            display: 'block',
                            fontSize: 15.5,
                            marginTop: 3,
                            fontWeight: 800,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        {format.money(totalValue)}
                    </strong>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {isFr ? `${itemsInStock} articles actifs` : `${itemsInStock} items in store`}
                    </p>
                </article>

                {/* Received in period */}
                <article
                    className="warehouse-kpi-card"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: '#ffffff',
                    }}
                >
                    <small
                        style={{
                            color: 'var(--muted)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: 1.2,
                        }}
                    >
                        {isFr ? 'Articles reçus' : 'Items Received'}
                    </small>
                    <strong
                        style={{
                            display: 'block',
                            fontSize: 15.5,
                            marginTop: 3,
                            fontWeight: 800,
                            color: '#10b981',
                            whiteSpace: 'nowrap',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        +{format.moneyShort(receivedValue)}
                    </strong>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {isFr ? 'Marchandises reçues' : 'Added this period'}
                    </p>
                </article>

                {/* Issued in period */}
                <article
                    className="warehouse-kpi-card"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: '#ffffff',
                    }}
                >
                    <small
                        style={{
                            color: 'var(--muted)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: 1.2,
                        }}
                    >
                        {isFr ? 'Articles sortis' : 'Items Sent Out'}
                    </small>
                    <strong
                        style={{
                            display: 'block',
                            fontSize: 15.5,
                            marginTop: 3,
                            fontWeight: 800,
                            color: '#f59e0b',
                            whiteSpace: 'nowrap',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        -{format.moneyShort(issuedValue)}
                    </strong>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {isFr ? 'Distribué' : 'Sent out this period'}
                    </p>
                </article>

                {/* Items to reorder */}
                <article
                    className="warehouse-kpi-card"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: '#ffffff',
                    }}
                >
                    <small
                        style={{
                            color: 'var(--muted)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: 1.2,
                        }}
                    >
                        {isFr ? 'Stock faible' : 'Running Low'}
                    </small>
                    <strong
                        style={{
                            display: 'block',
                            fontSize: 15.5,
                            marginTop: 3,
                            fontWeight: 800,
                            color: lowStockCount > 0 ? '#d97706' : 'var(--text)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {lowStockCount}
                    </strong>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {lowStockCount > 0
                            ? (isFr ? 'Sous le seuil' : 'Needs new order')
                            : (isFr ? 'Niveaux corrects' : 'All stock is good')}
                    </p>
                </article>

                {/* Out of stock */}
                <article
                    className="warehouse-kpi-card"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: '#ffffff',
                    }}
                >
                    <small
                        style={{
                            color: 'var(--muted)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: 1.2,
                        }}
                    >
                        {isFr ? 'Rupture stock' : 'Out of Stock'}
                    </small>
                    <strong
                        style={{
                            display: 'block',
                            fontSize: 15.5,
                            marginTop: 3,
                            fontWeight: 800,
                            color: outOfStockCount > 0 ? '#dc2626' : 'var(--text)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {outOfStockCount}
                    </strong>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {outOfStockCount > 0
                            ? (isFr ? 'Quantité 0' : '0 items left')
                            : (isFr ? 'Aucune rupture' : 'No items empty')}
                    </p>
                </article>

                {/* Quality / Quarantine */}
                <article
                    className="warehouse-kpi-card"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: '#ffffff',
                    }}
                >
                    <small
                        style={{
                            color: 'var(--muted)',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                            lineHeight: 1.2,
                        }}
                    >
                        {isFr ? 'Contrôle qualité' : 'Quality Check'}
                    </small>
                    <strong
                        style={{
                            display: 'block',
                            fontSize: 15.5,
                            marginTop: 3,
                            fontWeight: 800,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {heldQuality}
                    </strong>
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {isFr ? 'Lots en attente' : 'Waiting for check'}
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
                                {isFr ? 'Articles reçus vs Articles sortis' : 'Items Received vs Items Sent Out'}
                            </h2>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                                {isFr
                                    ? `Nombre d'articles reçus et sortis sur les ${days} derniers jours.`
                                    : `Number of items received and sent out over the last ${days} days.`}
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, fontWeight: 500, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 8 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                                <span><b>{isFr ? 'Barre verte (Reçu)' : 'Green bar (Received)'}:</b> {isFr ? 'Articles réceptionnés en stock magasin' : 'Stock items received and added to warehouse inventory'}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} />
                                <span><b>{isFr ? 'Barre orange (Sorti)' : 'Orange bar (Sent Out)'}:</b> {isFr ? 'Matières sorties pour la production ou expédiées' : 'Materials issued to production or dispatched to clients'}</span>
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
                            {isFr ? 'RÉPARTITION DU STOCK' : 'ITEMS BY CATEGORY'}
                        </span>
                        <h2 style={{ fontSize: 17, margin: '2px 0 4px', fontWeight: 700 }}>
                            {isFr ? 'Valeur par Catégorie' : 'Money Value by Category'}
                        </h2>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                            {isFr ? 'Distribution de la valeur en magasin.' : 'Total money value in each group of items.'}
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
                                    ? (isFr ? 'Matières Premières' : 'Raw Materials (Fabrics & Parts)')
                                    : group.key === 'finished_goods'
                                    ? (isFr ? 'Produits Finis' : 'Finished Items')
                                    : (isFr ? 'Fournitures & Autres' : 'Supplies & Other');
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
                                <span>{isFr ? 'Articles nécessitant une attention' : 'Items that Need Attention'}</span>
                            </div>
                            <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                                {isFr
                                    ? `${analytics?.attention?.length} articles sont en rupture ou sous le seuil d'alerte.`
                                    : `${analytics?.attention?.length} items are running out or have reached 0.`}
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
                            {isFr ? 'STOCK ACTUEL' : 'CURRENT STOCK'}
                        </span>
                        <h2 style={{ fontSize: 18, margin: '2px 0 0', fontWeight: 700 }}>
                            {isFr ? 'Tous les articles en stock' : 'All Items in Stock'}
                        </h2>
                    </div>

                    {/* Category Tabs - Clean underline tabs, NO background */}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}>
                        {[
                            ['all', isFr ? 'Tous les articles' : 'All Items'],
                            ['raw_materials', isFr ? 'Matières 1ères' : 'Raw Materials'],
                            ['finished_goods', isFr ? 'Produits Finis' : 'Finished Goods'],
                            ['attention', isFr ? 'À réapprovisionner (Faible / 0)' : 'Needs Attention (Low / 0)'],
                        ].map(([key, label]) => {
                            const active = categoryTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setCategoryTab(key as any)}
                                    style={{
                                        padding: '8px 2px',
                                        fontSize: 13,
                                        fontWeight: active ? 700 : 500,
                                        border: 'none',
                                        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                                        background: 'transparent',
                                        color: active ? '#2563eb' : 'var(--muted)',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        bottom: -1,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
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
                        placeholder={isFr ? 'Rechercher par nom d’article ou code…' : 'Search by item name or code…'}
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
                                <th>{isFr ? 'Article & Code' : 'Item & Code'}</th>
                                <th>{isFr ? 'Type' : 'Type'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Prêt à l\'usage' : 'Ready to Use'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'En stock' : 'In Stock'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Niveau minimum' : 'Minimum Level'}</th>
                                <th style={{ textAlign: 'right' }}>{isFr ? 'Valeur totale' : 'Total Value'}</th>
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
                                            : (isFr ? 'Fourniture' : 'Supplies & Other');

                                    return (
                                        <tr key={item.id || item.name}>
                                            <td>
                                                <strong style={{ fontSize: 13, color: 'var(--text)' }}>{item.name}</strong>
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
                                                            background: 'transparent',
                                                            color: '#b91c1c',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {isFr ? 'Rupture' : 'Out of stock'}
                                                    </span>
                                                ) : isLow ? (
                                                    <span
                                                        className="admin-status"
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#b45309',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {isFr ? 'Stock faible' : 'Low stock'}
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="admin-status"
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#10b981',
                                                            fontSize: 12,
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
                            {isFr ? 'ACTIVITÉ RÉCENTE' : 'RECENT ACTIVITY'}
                        </span>
                        <h2 style={{ fontSize: 17, margin: '2px 0 0', fontWeight: 700 }}>
                            {isFr ? 'Activité récente des stocks' : 'Recent Stock Activity'}
                        </h2>
                    </div>

                    <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th>{isFr ? 'Date' : 'Time'}</th>
                                    <th>{isFr ? 'Article' : 'Item'}</th>
                                    <th>{isFr ? 'Action' : 'Action'}</th>
                                    <th style={{ textAlign: 'right' }}>{isFr ? 'Quantité (+/-)' : 'Quantity (+/-)'}</th>
                                    <th style={{ textAlign: 'right' }}>{isFr ? 'Stock restant' : 'Remaining Stock'}</th>
                                    <th>{isFr ? 'Emplacement' : 'Store Room'}</th>
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
