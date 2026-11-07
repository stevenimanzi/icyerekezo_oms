import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, FileText, Filter, Package, Printer, RefreshCw, Search, Warehouse } from 'lucide-react';
import type { AuthUser, Locale } from '../../../core/types';
import { api } from '../../../core/api';

type Props = {
    user: AuthUser;
    locale: Locale;
};

const iso = (date: Date) => date.toLocaleDateString('en-CA');

export default function WarehouseReportPage({ user, locale }: Props) {
    const today = iso(new Date());
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('week');
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return iso(d);
    });
    const [toDate, setToDate] = useState(today);
    const [specificDate, setSpecificDate] = useState('');
    const [itemFilter, setItemFilter] = useState<'all' | 'raw_material' | 'finished_good' | 'low_stock'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [reportData, setReportData] = useState<any>(null);
    const [inventoryOverview, setInventoryOverview] = useState<any>(null);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const currency = user.current_factory?.currency_code || 'RWF';

    const loadData = async (from = fromDate, to = toDate) => {
        setLoading(true);
        try {
            const [repRes, invRes, anaRes] = await Promise.all([
                api<any>(`/api/reports?scope=warehouse&period=custom&from=${from}&to=${to}`).catch(() => null),
                api<any>('/api/inventory/overview').catch(() => null),
                api<any>('/api/stock/analytics?days=30').catch(() => null),
            ]);

            setReportData(repRes);
            setInventoryOverview(invRes);
            setAnalyticsData(anaRes);
            setError('');
        } catch (e: any) {
            setError(e.message || 'Failed to load warehouse stock report.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(fromDate, toDate);
    }, [fromDate, toDate]);

    const handleQuickPeriod = (p: 'today' | 'yesterday' | 'week' | 'month') => {
        setPeriod(p);
        setSpecificDate('');
        const end = new Date();
        const start = new Date();
        if (p === 'today') {
            // start & end today
        } else if (p === 'yesterday') {
            start.setDate(end.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (p === 'week') {
            start.setDate(end.getDate() - 6);
        } else if (p === 'month') {
            start.setDate(1);
        }
        const f = iso(start);
        const t = iso(end);
        setFromDate(f);
        setToDate(t);
    };

    const handleSpecificDate = (val: string) => {
        setSpecificDate(val);
        if (val) {
            setPeriod('custom');
            setFromDate(val);
            setToDate(val);
        }
    };

    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const money = (v: any) => `${currency} ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    // Build Current Stock Balance Rows
    const stockItems = useMemo(() => {
        const rawList: any[] = inventoryOverview?.stock || [];
        const catalogList: any[] = inventoryOverview?.catalog || [];

        let items: any[] = [];
        if (rawList.length > 0) {
            items = rawList.map((s, idx) => ({
                id: s.id || s.item_id || idx,
                name: s.item_name || 'Item',
                sku: s.sku || '—',
                type: s.item_type || 'material',
                warehouse: s.warehouse_name || 'Main Warehouse',
                unit: s.unit || 'units',
                onHand: Number(s.quantity_on_hand || 0),
                available: Number(s.available_quantity ?? s.quantity_on_hand ?? 0),
                reorderLevel: Number(s.reorder_level || 0),
                unitCost: Number(s.standard_cost || 0),
                stockValue: Number(s.stock_value || (Number(s.quantity_on_hand || 0) * Number(s.standard_cost || 0))),
                isLowStock: Boolean(s.is_low_stock || (Number(s.quantity_on_hand || 0) <= Number(s.reorder_level || 0))),
                isOutOfStock: Number(s.quantity_on_hand || 0) <= 0,
            }));
        } else if (catalogList.length > 0) {
            items = catalogList.map((c, idx) => ({
                id: c.id || idx,
                name: c.name || 'Item',
                sku: c.sku || '—',
                type: c.type || 'material',
                warehouse: 'Main Warehouse',
                unit: c.unit?.symbol || c.unit?.name || 'units',
                onHand: Number(c.total_quantity || 0),
                available: Number(c.total_quantity || 0),
                reorderLevel: Number(c.reorder_level || 0),
                unitCost: Number(c.standard_cost || 0),
                stockValue: Number(c.stock_value || (Number(c.total_quantity || 0) * Number(c.standard_cost || 0))),
                isLowStock: Number(c.total_quantity || 0) <= Number(c.reorder_level || 0),
                isOutOfStock: Number(c.total_quantity || 0) <= 0,
            }));
        }

        return items.filter((item) => {
            if (itemFilter === 'raw_material' && item.type !== 'raw_material' && !/raw|fabric/i.test(item.type)) return false;
            if (itemFilter === 'finished_good' && item.type !== 'finished_good' && !/finished/i.test(item.type)) return false;
            if (itemFilter === 'low_stock' && !item.isLowStock) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = item.name.toLowerCase().includes(q);
                const matchSku = item.sku.toLowerCase().includes(q);
                return matchName || matchSku;
            }
            return true;
        });
    }, [inventoryOverview, itemFilter, searchQuery]);

    // Build Stock Movement Ledger Rows for the period
    const movementRows = useMemo(() => {
        const reportTxs: any[] = reportData?.inventory || [];
        const overviewTxs: any[] = inventoryOverview?.recent_transactions || inventoryOverview?.transactions || [];

        const sourceTxs = reportTxs.length > 0 ? reportTxs : overviewTxs;

        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

        return sourceTxs
            .filter((tx) => {
                if (!tx.occurred_at && !tx.created_at) return true;
                const d = new Date(tx.occurred_at || tx.created_at);
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            })
            .map((tx, idx) => {
                const delta = Number(tx.quantity_delta || 0);
                const isPositive = delta > 0 || tx.type === 'receipt' || tx.type === 'production_output';
                const typeLabel = String(tx.type || (delta > 0 ? 'receipt' : 'issue')).toUpperCase();
                const unitCost = Number(tx.unit_cost || 0);
                const value = Math.abs(delta) * unitCost;

                return {
                    id: tx.id || idx,
                    occurredAt: tx.occurred_at ? new Date(tx.occurred_at).toLocaleString() : '—',
                    type: typeLabel,
                    isPositive,
                    itemName: tx.item_name || tx.item || 'Item',
                    sku: tx.sku || '—',
                    warehouse: tx.warehouse_name || tx.warehouse || 'Main Warehouse',
                    quantityDelta: delta,
                    balanceAfter: tx.balance_after != null ? Number(tx.balance_after) : null,
                    unitCost,
                    totalValue: value,
                    reason: tx.reason || 'Standard movement',
                    performer: tx.performer_department || 'Warehouse Keeper',
                };
            });
    }, [reportData, inventoryOverview, fromDate, toDate]);

    // Summary Totals
    const totalStockValuation = stockItems.reduce((acc, it) => acc + it.stockValue, 0);
    const totalOnHandUnits = stockItems.reduce((acc, it) => acc + it.onHand, 0);
    const lowStockCount = stockItems.filter((it) => it.isLowStock && !it.isOutOfStock).length;
    const outOfStockCount = stockItems.filter((it) => it.isOutOfStock).length;

    const periodReceivedUnits = movementRows
        .filter((m) => m.quantityDelta > 0)
        .reduce((acc, m) => acc + m.quantityDelta, 0);

    const periodIssuedUnits = movementRows
        .filter((m) => m.quantityDelta < 0)
        .reduce((acc, m) => acc + Math.abs(m.quantityDelta), 0);

    const optimalRate = stockItems.length > 0
        ? (((stockItems.length - lowStockCount - outOfStockCount) / stockItems.length) * 100).toFixed(1)
        : '100.0';

    return (
        <section
            className="module-page warehouse-report-page"
            style={{ padding: '20px 24px', maxWidth: 1280, margin: '0 auto', color: 'var(--text)' }}
        >
            <style>{`
                .warehouse-report-card {
                    background: var(--panel);
                    color: var(--text);
                    border: 1px solid var(--line);
                    border-radius: 14px;
                    padding: 24px 28px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
                    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
                }
                .report-kpi-matrix {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    border: 1px solid var(--line);
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 24px;
                    background: var(--panel);
                }
                .report-kpi-cell {
                    padding: 14px 16px;
                    border-right: 1px solid var(--line);
                    display: flex;
                    flex-direction: column;
                    justifyContent: space-between;
                    min-height: 96px;
                }
                .report-kpi-cell:last-child {
                    border-right: none;
                }
                .report-data-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    border: 1px solid var(--line);
                    border-radius: 8px;
                    overflow: hidden;
                    font-size: 0.75rem;
                }
                .report-data-table th {
                    background: var(--soft, rgba(248, 250, 252, 0.6));
                    color: var(--muted);
                    font-size: 0.69rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    padding: 5px 8px !important;
                    border-bottom: 1px solid var(--line);
                    border-right: 1px solid var(--line);
                    text-align: left;
                    white-space: nowrap !important;
                    line-height: 1.2 !important;
                }
                .report-data-table th:last-child {
                    border-right: none;
                }
                .report-data-table td {
                    background: var(--panel);
                    color: var(--text);
                    padding: 5px 8px !important;
                    border-bottom: 1px solid var(--line);
                    border-right: 1px solid var(--line);
                    transition: background 0.15s ease;
                    white-space: nowrap !important;
                    line-height: 1.25 !important;
                    font-size: 0.74rem !important;
                }
                .report-data-table td:last-child {
                    border-right: none;
                }
                .report-data-table tr:last-child td {
                    border-bottom: none;
                }
                .report-data-table tbody tr:hover td {
                    background: var(--soft, rgba(241, 245, 249, 0.6));
                }
                .report-data-table tfoot td {
                    background: var(--soft, rgba(248, 250, 252, 0.8));
                    font-weight: 800;
                    border-top: 2px solid var(--line);
                    padding: 5px 8px !important;
                    white-space: nowrap !important;
                    font-size: 0.74rem !important;
                }
                .print-signatures-block {
                    display: none !important;
                }
                .print-footer-block {
                    display: flex;
                    justifyContent: space-between;
                    align-items: center;
                    margin-top: 18px;
                    padding-top: 10px;
                    border-top: 1px solid var(--line);
                    font-size: 0.72rem;
                    color: var(--muted);
                }

                @media (max-width: 900px) {
                    .report-kpi-matrix {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .report-kpi-cell {
                        border-bottom: 1px solid var(--line) !important;
                    }
                }

                @media print {
                    @page {
                        size: landscape;
                        margin: 6mm 6mm;
                    }
                    nav, aside, .app-sidebar, .module-actions, .no-print, button, .ui-tabs, .app-header, .app-shell-header {
                        display: none !important;
                    }
                    body, #root, .app-layout, .app-content, .module-page {
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                        width: 100% !important;
                    }
                    .warehouse-report-card {
                        box-shadow: none !important;
                        border: 1.5pt solid #000000 !important;
                        background: #ffffff !important;
                        padding: 12px 14px !important;
                        margin: 0 !important;
                        width: 100% !important;
                        border-radius: 0 !important;
                        color: #000000 !important;
                    }
                    .report-kpi-matrix {
                        border: 1pt solid #000000 !important;
                        background: #ffffff !important;
                        border-radius: 0 !important;
                        grid-template-columns: repeat(5, 1fr) !important;
                    }
                    .report-kpi-cell {
                        border-right: 1pt solid #000000 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .report-data-table {
                        border: 1pt solid #000000 !important;
                        border-radius: 0 !important;
                        font-size: 0.70rem !important;
                    }
                    .report-data-table th, .report-data-table td {
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: 1pt solid #000000 !important;
                        padding: 4px 4px !important;
                    }
                    .print-signatures-block {
                        display: grid !important;
                        margin-top: 16px !important;
                        page-break-inside: avoid !important;
                        border: 1.5pt solid #000000 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .print-footer-block {
                        display: flex !important;
                        border-top: 1pt solid #000000 !important;
                        color: #000000 !important;
                    }
                }
            `}</style>

            {/* SCREEN HEADER */}
            <div
                className="no-print"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 18,
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: '1.45rem',
                            fontWeight: 800,
                            margin: 0,
                            letterSpacing: '-0.02em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: 'var(--text)',
                        }}
                    >
                        <Warehouse size={24} style={{ color: '#2563eb' }} />
                        {locale === 'en' ? 'Warehouse Stock Report' : "Rapport de Stock de l'Entrepôt"}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {locale === 'en'
                            ? 'Complete report of items in stock, items received, items sent out, and total value.'
                            : "Rapport complet des articles en stock, reçus, sortis et valeur totale."}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        className="secondary-btn"
                        onClick={() => loadData(fromDate, toDate)}
                        disabled={loading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 8,
                            cursor: 'pointer',
                        }}
                    >
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        {locale === 'en' ? 'Refresh' : 'Actualiser'}
                    </button>
                    <button
                        className="secondary-btn"
                        onClick={() => window.print()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 8,
                            cursor: 'pointer',
                        }}
                    >
                        <Printer size={15} />
                        {locale === 'en' ? 'Print' : 'Imprimer'}
                    </button>
                    <button
                        className="primary-btn"
                        onClick={() => window.print()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                        }}
                    >
                        <FileText size={15} />
                        {locale === 'en' ? 'Export as PDF' : 'Exporter en PDF'}
                    </button>
                </div>
            </div>

            {/* SCREEN CONTROLS & DATE FILTER BAR */}
            <div
                className="panel no-print"
                style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '12px 18px',
                    marginBottom: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>
                            {locale === 'en' ? 'Period:' : 'Période :'}
                        </span>
                        <button
                            className={period === 'today' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('today')}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: 8 }}
                        >
                            {locale === 'en' ? 'Today' : "Aujourd'hui"}
                        </button>
                        <button
                            className={period === 'yesterday' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('yesterday')}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: 8 }}
                        >
                            {locale === 'en' ? 'Yesterday' : 'Hier'}
                        </button>
                        <button
                            className={period === 'week' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('week')}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: 8 }}
                        >
                            {locale === 'en' ? 'Last 7 Days' : '7 derniers jours'}
                        </button>
                        <button
                            className={period === 'month' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('month')}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: 8 }}
                        >
                            {locale === 'en' ? 'This Month' : 'Ce mois'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                            <Calendar size={14} style={{ color: 'var(--muted)' }} />
                            <span>{locale === 'en' ? 'Specific Date:' : 'Date spécifique :'}</span>
                            <input
                                type="date"
                                value={specificDate}
                                onChange={(e) => handleSpecificDate(e.target.value)}
                                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.8rem' }}
                            />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                            <span>{locale === 'en' ? 'From:' : 'Du :'}</span>
                            <input
                                type="date"
                                value={fromDate}
                                max={toDate || undefined}
                                onChange={(e) => {
                                    setPeriod('custom');
                                    setSpecificDate('');
                                    setFromDate(e.target.value);
                                }}
                                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.8rem' }}
                            />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                            <span>{locale === 'en' ? 'To:' : 'Au :'}</span>
                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || undefined}
                                onChange={(e) => {
                                    setPeriod('custom');
                                    setSpecificDate('');
                                    setToDate(e.target.value);
                                }}
                                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.8rem' }}
                            />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                            <Filter size={14} style={{ color: 'var(--muted)' }} />
                            <span>{locale === 'en' ? 'Category:' : 'Catégorie :'}</span>
                            <select
                                value={itemFilter}
                                onChange={(e) => setItemFilter(e.target.value as any)}
                                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                                <option value="all">{locale === 'en' ? 'All Stock Items' : 'Tous les articles'}</option>
                                <option value="raw_material">{locale === 'en' ? 'Raw Materials (Fabrics & Parts)' : 'Matières premières'}</option>
                                <option value="finished_good">{locale === 'en' ? 'Finished Goods' : 'Produits finis'}</option>
                                <option value="low_stock">{locale === 'en' ? 'Running Low (Needs Order)' : 'Stock faible'}</option>
                            </select>
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
                            <input
                                type="text"
                                placeholder={locale === 'en' ? 'Search by item name or code...' : 'Rechercher article/code...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.8rem', width: 180 }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="admin-alert error no-print" style={{ marginBottom: 16 }}>{error}</div>}

            {/* 5 STANDARDIZED EXTERNAL KPIS OUTSIDE REPORT SHEET */}
            <div className="ui-kpis no-print" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginBottom: 16 }}>
                <article className="ui-kpi">
                    <small>{locale === 'en' ? 'Total Stock Value' : 'Valeur Totale'}</small>
                    <strong>{money(totalStockValuation)}</strong>
                    <p>{num(totalOnHandUnits)} {locale === 'en' ? 'total items in store' : 'articles en magasin'}</p>
                </article>

                <article className="ui-kpi">
                    <small>{locale === 'en' ? 'Items Received' : 'Articles Reçus'}</small>
                    <strong style={{ color: '#166534' }}>+{num(periodReceivedUnits)}</strong>
                    <p>{locale === 'en' ? 'New deliveries' : 'Livraisons reçues'}</p>
                </article>

                <article className="ui-kpi">
                    <small>{locale === 'en' ? 'Items Sent Out' : 'Articles Sortis'}</small>
                    <strong style={{ color: '#b45309' }}>-{num(periodIssuedUnits)}</strong>
                    <p>{locale === 'en' ? 'Sent to lines / buyers' : 'Envoyé aux lignes'}</p>
                </article>

                <article className="ui-kpi">
                    <small>{locale === 'en' ? 'Running Low' : 'Stock Bas'}</small>
                    <strong style={{ color: lowStockCount > 0 ? '#b45309' : undefined }}>{lowStockCount}</strong>
                    <p>{locale === 'en' ? 'Needs reordering' : 'À commander bientôt'}</p>
                </article>

                <article className="ui-kpi">
                    <small>{locale === 'en' ? 'Out of Stock' : 'Stock Épuisé'}</small>
                    <strong style={{ color: outOfStockCount > 0 ? '#b91c1c' : undefined }}>{outOfStockCount}</strong>
                    <p>{locale === 'en' ? 'Completely empty' : 'Stock épuisé'}</p>
                </article>
            </div>

            {/* OFFICIAL AUDIT REPORT CARD CONTAINER (SUPPORTS LIGHT & DARK MODE ON SCREEN, PURE WHITE ON PRINT) */}
            <article className="warehouse-report-card">
                {/* OFFICIAL DOCUMENT HEADER */}
                <div
                    style={{
                        borderBottom: '2px solid var(--line)',
                        paddingBottom: 16,
                        marginBottom: 20,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 16,
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: '1.45rem',
                                fontWeight: 900,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                color: 'var(--text)',
                            }}
                        >
                            {user.current_factory?.name || 'ICYEREKEZO OMS FACTORY'}
                        </h2>
                        <div
                            style={{
                                fontSize: '1.05rem',
                                fontWeight: 800,
                                margin: '4px 0 0 0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                color: 'var(--muted)',
                            }}
                        >
                            {locale === 'en' ? 'WAREHOUSE STOCK REPORT' : "RAPPORT DE STOCK DU MAGASIN"}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '2px solid var(--line)', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>SCOPE:</b> WAREHOUSE STOCK ONLY</div>
                        <div><b>PREPARED BY:</b> {user.name} ({user.roles?.[0]?.name || 'Warehouse Keeper'})</div>
                        <div>
                            <b>STOCK HEALTH:</b>{' '}
                            <span style={{ fontWeight: 800, textDecoration: 'underline', color: Number(optimalRate) >= 80 ? '#10b981' : '#f59e0b' }}>
                                {Number(optimalRate) >= 80 ? 'OPTIMAL' : 'ATTENTION REQUIRED'} ({optimalRate}%)
                            </span>
                        </div>
                    </div>
                </div>

                {/* SECTION 1: CURRENT STOCK BALANCES & VALUATION */}
                <div style={{ marginBottom: 28 }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 10,
                            borderBottom: '1px solid var(--line)',
                            paddingBottom: 6,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: '0.92rem',
                                fontWeight: 800,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--text)',
                            }}
                        >
                            {locale === 'en' ? 'I. CURRENT STOCK AND TOTAL VALUE' : 'I. ARTICLES EN STOCK ET VALEUR TOTALE'}
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
                            {stockItems.length} {locale === 'en' ? 'items tracked' : 'articles enregistrés'}
                        </span>
                    </div>

                    <div className="report-table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="report-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 34, textAlign: 'center' }}>#</th>
                                    <th>{locale === 'en' ? 'Item Name' : 'Nom de l\'article'}</th>
                                    <th style={{ width: 120 }}>{locale === 'en' ? 'Type' : 'Type'}</th>
                                    <th style={{ width: 130 }}>{locale === 'en' ? 'Store Room' : 'Emplacement'}</th>
                                    <th style={{ width: 80, textAlign: 'right' }}>{locale === 'en' ? 'In Stock' : 'En stock'}</th>
                                    <th style={{ width: 80, textAlign: 'right' }}>{locale === 'en' ? 'Ready to Use' : 'Prêt à l\'usage'}</th>
                                    <th style={{ width: 75, textAlign: 'right' }}>{locale === 'en' ? 'Min Level' : 'Niveau min.'}</th>
                                    <th style={{ width: 95, textAlign: 'right' }}>{locale === 'en' ? 'Cost per Item' : 'Prix unitaire'}</th>
                                    <th style={{ width: 115, textAlign: 'right' }}>{locale === 'en' ? 'Total Value' : 'Valeur totale'}</th>
                                    <th style={{ width: 95, textAlign: 'center' }}>{locale === 'en' ? 'Status' : 'Statut'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                                            {locale === 'en' ? 'No stock records found matching filter.' : 'Aucun article trouvé dans le stock.'}
                                        </td>
                                    </tr>
                                ) : (
                                    stockItems.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--muted)' }}>{idx + 1}</td>
                                            <td style={{ fontWeight: 700 }}>{item.name}</td>
                                            <td style={{ textTransform: 'capitalize' }}>
                                                {String(item.type).replace('_', ' ')}
                                            </td>
                                            <td>{item.warehouse}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {num(item.onHand)} <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{item.unit}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {num(item.available)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                                                {num(item.reorderLevel)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {money(item.unitCost)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {money(item.stockValue)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {item.isOutOfStock ? (
                                                    <span style={{ display: 'inline-flex', background: 'transparent', color: '#b91c1c', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                                        {locale === 'en' ? 'OUT OF STOCK' : 'ÉPUISÉ'}
                                                    </span>
                                                ) : item.isLowStock ? (
                                                    <span style={{ display: 'inline-flex', background: 'transparent', color: '#b45309', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                                        {locale === 'en' ? 'LOW STOCK' : 'STOCK FAIBLE'}
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', background: 'transparent', color: '#166534', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                                        {locale === 'en' ? 'IN STOCK' : 'EN STOCK'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} style={{ textTransform: 'uppercase' }}>
                                        {locale === 'en' ? 'TOTAL STOCK VALUE & QUANTITY' : 'VALEUR TOTALE & QUANTITÉ EN STOCK'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{num(totalOnHandUnits)}</td>
                                    <td colSpan={3}></td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totalStockValuation)}</td>
                                    <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>
                                        {optimalRate}% {locale === 'en' ? 'Optimal' : 'Conforme'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* SECTION 2: STOCK MOVEMENTS LEDGER (RECEIPTS & ISSUES) */}
                <div style={{ marginBottom: 24 }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 10,
                            borderBottom: '1px solid var(--line)',
                            paddingBottom: 6,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: '0.92rem',
                                fontWeight: 800,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: 'var(--text)',
                            }}
                        >
                            {locale === 'en' ? 'II. ITEMS RECEIVED AND SENT OUT IN THIS PERIOD' : 'II. ARTICLES REÇUS ET SORTIS SUR CETTE PÉRIODE'}
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
                            {movementRows.length} {locale === 'en' ? 'activities recorded' : 'activités enregistrées'}
                        </span>
                    </div>

                    <div className="report-table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                        <table className="report-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 34, textAlign: 'center' }}>#</th>
                                    <th style={{ width: 140 }}>{locale === 'en' ? 'Time' : 'Date & Heure'}</th>
                                    <th style={{ width: 90 }}>{locale === 'en' ? 'Action' : 'Action'}</th>
                                    <th>{locale === 'en' ? 'Item Name' : 'Article'}</th>
                                    <th style={{ width: 125 }}>{locale === 'en' ? 'Store Room' : 'Emplacement'}</th>
                                    <th style={{ width: 85, textAlign: 'right' }}>{locale === 'en' ? 'Added / Sent Out' : 'Quantité'}</th>
                                    <th style={{ width: 85, textAlign: 'right' }}>{locale === 'en' ? 'Stock Left' : 'Stock restant'}</th>
                                    <th style={{ width: 90, textAlign: 'right' }}>{locale === 'en' ? 'Cost per Item' : 'Prix unitaire'}</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>{locale === 'en' ? 'Total Value' : 'Valeur'}</th>
                                    <th style={{ width: 180 }}>{locale === 'en' ? 'Note / Reason' : 'Note / Raison'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movementRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                                            {locale === 'en' ? 'No stock movement entries recorded in this period.' : 'Aucun mouvement de stock enregistré durant cette période.'}
                                        </td>
                                    </tr>
                                ) : (
                                    movementRows.map((m, idx) => (
                                        <tr key={m.id}>
                                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--muted)' }}>{idx + 1}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{m.occurredAt}</td>
                                            <td>
                                                <span
                                                    style={{
                                                        fontWeight: 800,
                                                        fontSize: '0.75rem',
                                                        display: 'inline-flex',
                                                        background: 'transparent',
                                                        color: m.isPositive ? '#166534' : '#b45309',
                                                    }}
                                                >
                                                    {m.isPositive ? (locale === 'en' ? 'RECEIVED' : 'REÇU') : (locale === 'en' ? 'SENT OUT' : 'SORTI')}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 700 }}>{m.itemName}</td>
                                            <td>{m.warehouse}</td>
                                            <td
                                                style={{
                                                    textAlign: 'right',
                                                    fontWeight: 800,
                                                    color: m.quantityDelta > 0 ? '#166534' : 'var(--text)',
                                                }}
                                            >
                                                {m.quantityDelta > 0 ? `+${num(m.quantityDelta)}` : num(m.quantityDelta)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {m.balanceAfter != null ? num(m.balanceAfter) : '—'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {money(m.unitCost)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {money(m.totalValue)}
                                            </td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                {m.reason}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5} style={{ textTransform: 'uppercase' }}>
                                        {locale === 'en' ? 'STOCK ADDED VS SENT OUT' : 'DIFFÉRENCE ENTRÉES VS SORTIES'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: periodReceivedUnits >= periodIssuedUnits ? '#166534' : '#b91c1c' }}>
                                        {num(periodReceivedUnits - periodIssuedUnits)}
                                    </td>
                                    <td colSpan={4} style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                        {locale === 'en' ? `Received: +${num(periodReceivedUnits)} | Sent Out: -${num(periodIssuedUnits)}` : `Reçus : +${num(periodReceivedUnits)} | Sortis : -${num(periodIssuedUnits)}`}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* OFFICIAL SIGN-OFF BLOCK & AUDIT STAMP */}
                <div
                    className="print-signatures-block"
                    style={{
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 16,
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        padding: '16px 20px',
                        marginTop: 18,
                        background: 'var(--soft, #f8fafc)',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--text)' }}>
                            {locale === 'en' ? 'PREPARED BY (WAREHOUSE KEEPER)' : 'PRÉPARÉ PAR (RESPONSABLE MAGASIN)'}
                        </div>
                        <div style={{ marginTop: 2, color: 'var(--text)' }}>{user.name}</div>
                        <div style={{ color: 'var(--muted)' }}>{user.title || 'Warehouse Keeper'}</div>
                        <div style={{ marginTop: 18, borderBottom: '1px solid var(--line)', width: '80%' }}></div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{locale === 'en' ? 'Signature & Date' : 'Signature & Date'}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--text)' }}>
                            {locale === 'en' ? 'CHECKED BY (FACTORY MANAGER)' : 'VÉRIFIÉ PAR (DIRECTEUR USINE)'}
                        </div>
                        <div style={{ marginTop: 2, color: 'var(--text)' }}>Factory Operations Manager</div>
                        <div style={{ color: 'var(--muted)' }}>Inventory Manager</div>
                        <div style={{ marginTop: 18, borderBottom: '1px solid var(--line)', width: '80%' }}></div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{locale === 'en' ? 'Signature & Date' : 'Signature & Date'}</div>
                    </div>

                    <div
                        style={{
                            border: '1.5px dashed var(--line)',
                            height: '95px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                            padding: 8,
                            borderRadius: 8,
                        }}
                    >
                        {user.current_factory?.name || 'FACTORY'}
                        <br />
                        {locale === 'en' ? 'OFFICIAL INVENTORY STAMP & DATE' : 'TIMBRE OFFICIEL & DATE'}
                    </div>
                </div>

                {/* DOCUMENT FOOTER */}
                <div className="print-footer-block">
                    <span>
                        {user.current_factory?.name || 'ICYEREKEZO OMS'} &bull; {locale === 'en' ? 'Warehouse & Stock Inventory Ledger' : 'Grand livre de stock'}
                    </span>
                    <span>
                        {locale === 'en' ? 'Generated on' : 'Généré le'} {new Date().toLocaleString()} &bull; Page 1/1
                    </span>
                    <span>
                        {locale === 'en' ? 'CONFIDENTIAL &bull; FOR INTERNAL FACTORY AUDIT ONLY' : 'CONFIDENTIEL &bull; AUDIT INTERNE'}
                    </span>
                </div>
            </article>
        </section>
    );
}
