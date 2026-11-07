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

        // If stock array is empty, fallback to catalog
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
        // Collect transactions from reportData.inventory OR inventoryOverview.recent_transactions
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
            style={{ padding: '20px 24px', maxWidth: 1240, margin: '0 auto', background: '#ffffff' }}
        >
            <style>{`
                .excel-table-container,
                .excel-table-container table,
                .excel-table-container thead,
                .excel-table-container tbody,
                .excel-table-container tfoot,
                .excel-table-container tr {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                }
                .excel-table-container th {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    border: 1pt solid #000000 !important;
                    font-weight: 700 !important;
                }
                .excel-table-container td {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    border: 1pt solid #000000 !important;
                }
                .print-signatures-block {
                    display: none !important;
                }
                .print-footer-block {
                    display: none !important;
                }
                @media print {
                    @page {
                        size: landscape;
                        margin: 6mm 6mm;
                    }
                    nav, aside, .app-sidebar, .module-actions, .no-print, button, .ui-tabs, .app-header, .app-shell-header {
                        display: none !important;
                    }
                    header:not(.excel-table-container header):not(.sheet-print-header) {
                        display: none !important;
                    }
                    body, #root, .app-layout, .app-content, .module-page {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .excel-table-container {
                        box-shadow: none !important;
                        border: 1.5pt solid #000000 !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        padding: 12px 14px !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                        overflow: visible !important;
                    }
                    .report-table-scroll-wrapper {
                        overflow: visible !important;
                        width: 100% !important;
                        margin-bottom: 12px !important;
                    }
                    table.report-print-table {
                        width: 100% !important;
                        table-layout: fixed !important;
                        border-collapse: collapse !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        font-size: 0.72rem !important;
                    }
                    table.report-print-table th, table.report-print-table td {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        border: 1pt solid #000000 !important;
                        padding: 5px 4px !important;
                        word-break: break-word !important;
                        overflow-wrap: break-word !important;
                        white-space: normal !important;
                        line-height: 1.2 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    .print-signatures-block {
                        display: block !important;
                        margin-top: 16px !important;
                        page-break-inside: avoid !important;
                    }
                    .print-footer-block {
                        display: flex !important;
                        page-break-inside: avoid !important;
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
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: '1.4rem',
                            fontWeight: 800,
                            margin: 0,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Warehouse size={22} color="#1e40af" />
                        {locale === 'en' ? 'Warehouse & Stock Inventory Report' : "Rapport d'Inventaire et du Stock"}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                        {locale === 'en'
                            ? 'Comprehensive warehouse ledger: stock in (receipts), stock out (issues/dispatch), inventory valuation, adjustments, and reorder status.'
                            : "Grand livre du magasin : entrées en stock (réceptions), sorties (distributions), valorisation, ajustements et seuils de réapprovisionnement."}
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
                            borderRadius: 6,
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
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
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
                            borderRadius: 6,
                            background: '#000000',
                            color: '#ffffff',
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
                    background: '#ffffff',
                    border: '1px solid #000000',
                    borderRadius: 4,
                    padding: '12px 16px',
                    marginBottom: 20,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginRight: 4 }}>
                            {locale === 'en' ? 'Period:' : 'Période :'}
                        </span>
                        <button
                            className={period === 'today' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('today')}
                            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        >
                            {locale === 'en' ? 'Today' : "Aujourd'hui"}
                        </button>
                        <button
                            className={period === 'yesterday' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('yesterday')}
                            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        >
                            {locale === 'en' ? 'Yesterday' : 'Hier'}
                        </button>
                        <button
                            className={period === 'week' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('week')}
                            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        >
                            {locale === 'en' ? 'Last 7 Days' : '7 derniers jours'}
                        </button>
                        <button
                            className={period === 'month' ? 'primary-btn' : 'secondary-btn'}
                            onClick={() => handleQuickPeriod('month')}
                            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        >
                            {locale === 'en' ? 'This Month' : 'Ce mois'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                            <Calendar size={14} color="#64748b" />
                            <span>{locale === 'en' ? 'Specific Date:' : 'Date spécifique :'}</span>
                            <input
                                type="date"
                                value={specificDate}
                                onChange={(e) => handleSpecificDate(e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
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
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
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
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                            <Filter size={14} color="#64748b" />
                            <span>{locale === 'en' ? 'Category:' : 'Catégorie :'}</span>
                            <select
                                value={itemFilter}
                                onChange={(e) => setItemFilter(e.target.value as any)}
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                                <option value="all">{locale === 'en' ? 'All Stock Items' : 'Tous les articles'}</option>
                                <option value="raw_material">{locale === 'en' ? 'Raw Materials (Fabric)' : 'Matières premières'}</option>
                                <option value="finished_good">{locale === 'en' ? 'Finished Goods' : 'Produits finis'}</option>
                                <option value="low_stock">{locale === 'en' ? 'Reorder Needed' : 'À réapprovisionner'}</option>
                            </select>
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} color="#64748b" style={{ position: 'absolute', left: 8 }} />
                            <input
                                type="text"
                                placeholder={locale === 'en' ? 'Search SKU / Item...' : 'Rechercher article/SKU...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '4px 8px 4px 28px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem', width: 170 }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="admin-alert error no-print" style={{ marginBottom: 16 }}>{error}</div>}

            {/* OFFICIAL PRINTABLE AUDIT SHEET CONTAINER */}
            <article
                className="excel-table-container"
                style={{
                    background: '#ffffff',
                    color: '#000000',
                    border: '1.5pt solid #000000',
                    borderRadius: 2,
                    padding: '24px 28px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}
            >
                {/* OFFICIAL DOCUMENT HEADER */}
                <div
                    className="sheet-print-header"
                    style={{
                        borderBottom: '2pt solid #000000',
                        paddingBottom: 14,
                        marginBottom: 18,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
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
                                color: '#000000',
                            }}
                        >
                            {user.current_factory?.name || 'ICYEREKEZO OMS FACTORY'}
                        </h2>
                        <div
                            style={{
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                margin: '4px 0 0 0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                color: '#000000',
                            }}
                        >
                            {locale === 'en' ? 'WAREHOUSE & STOCK INVENTORY AUDIT REPORT' : "RAPPORT D'AUDIT D'INVENTAIRE ET DU STOCK"}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '1.5pt solid #000000', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>SCOPE:</b> WAREHOUSE &amp; INVENTORY ONLY</div>
                        <div><b>PREPARED BY:</b> {user.name} ({user.roles?.[0]?.name || 'Warehouse Keeper'})</div>
                        <div>
                            <b>STOCK HEALTH:</b>{' '}
                            <span style={{ fontWeight: 800, textDecoration: 'underline' }}>
                                {Number(optimalRate) >= 80 ? 'OPTIMAL' : 'ATTENTION REQUIRED'} ({optimalRate}%)
                            </span>
                        </div>
                    </div>
                </div>

                {/* 5-COLUMN KPI SUMMARY MATRIX (MATCHING FACTORY AUDIT BOXES) */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 0,
                        border: '1pt solid #000000',
                        marginBottom: 20,
                        background: '#ffffff',
                        textAlign: 'center',
                    }}
                >
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>
                            1. TOTAL STOCK VALUATION
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                            {money(totalStockValuation)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>
                            {num(totalOnHandUnits)} {locale === 'en' ? 'units on hand' : 'unités en stock'}
                        </div>
                    </div>

                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>
                            2. RECEIVED (STOCK IN)
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                            {num(periodReceivedUnits)} {locale === 'en' ? 'units' : 'unités'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>
                            {locale === 'en' ? 'Supplier receipts & intake' : 'Réceptions fournisseurs'}
                        </div>
                    </div>

                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>
                            3. ISSUED (STOCK OUT)
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                            {num(periodIssuedUnits)} {locale === 'en' ? 'units' : 'unités'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>
                            {locale === 'en' ? 'Allocated & dispatched' : 'Sorties & allocations'}
                        </div>
                    </div>

                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>
                            4. ITEMS TO REORDER
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: lowStockCount > 0 ? '#b91c1c' : '#000000' }}>
                            {lowStockCount} {locale === 'en' ? 'items' : 'articles'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>
                            {locale === 'en' ? 'At or below reorder level' : 'Au seuil minimum'}
                        </div>
                    </div>

                    <div style={{ padding: '10px 8px', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>
                            5. OUT OF STOCK
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: outOfStockCount > 0 ? '#b91c1c' : '#000000' }}>
                            {outOfStockCount} {locale === 'en' ? 'items' : 'articles'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>
                            {locale === 'en' ? 'Zero available balance' : 'Stock épuisé (0)'}
                        </div>
                    </div>
                </div>

                {/* SECTION 1: CURRENT STOCK BALANCES & VALUATION */}
                <div style={{ marginBottom: 24 }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 8,
                            borderBottom: '1.5pt solid #000000',
                            paddingBottom: 4,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: '0.95rem',
                                fontWeight: 900,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                            }}
                        >
                            {locale === 'en' ? 'I. CURRENT STOCK BALANCES & VALUATION REGISTER' : 'I. REGISTRE DES DISPONIBILITÉS & VALORISATION DU STOCK'}
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#333' }}>
                            {stockItems.length} {locale === 'en' ? 'tracked item lines' : 'articles enregistrés'}
                        </span>
                    </div>

                    <div className="report-table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                        <table
                            className="report-print-table"
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.78rem',
                                border: '1pt solid #000000',
                                textAlign: 'left',
                            }}
                        >
                            <thead>
                                <tr style={{ borderBottom: '1.5pt solid #000000', background: '#f8fafc' }}>
                                    <th style={{ padding: '6px 8px', width: '30px', textAlign: 'center' }}>#</th>
                                    <th style={{ padding: '6px 8px' }}>{locale === 'en' ? 'Item Name & Specification' : 'Nom de l\'article'}</th>
                                    <th style={{ padding: '6px 8px', width: '100px' }}>{locale === 'en' ? 'SKU / Code' : 'Code SKU'}</th>
                                    <th style={{ padding: '6px 8px', width: '110px' }}>{locale === 'en' ? 'Category' : 'Catégorie'}</th>
                                    <th style={{ padding: '6px 8px', width: '130px' }}>{locale === 'en' ? 'Warehouse / Store' : 'Emplacement'}</th>
                                    <th style={{ padding: '6px 8px', width: '75px', textAlign: 'right' }}>{locale === 'en' ? 'On-Hand' : 'En stock'}</th>
                                    <th style={{ padding: '6px 8px', width: '75px', textAlign: 'right' }}>{locale === 'en' ? 'Available' : 'Disponible'}</th>
                                    <th style={{ padding: '6px 8px', width: '75px', textAlign: 'right' }}>{locale === 'en' ? 'Reorder' : 'Seuil'}</th>
                                    <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right' }}>{locale === 'en' ? 'Unit Cost' : 'Coût unit.'}</th>
                                    <th style={{ padding: '6px 8px', width: '110px', textAlign: 'right' }}>{locale === 'en' ? 'Total Value' : 'Valeur totale'}</th>
                                    <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>{locale === 'en' ? 'Status' : 'Statut'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                            {locale === 'en' ? 'No stock records found matching filter.' : 'Aucun article trouvé dans le stock.'}
                                        </td>
                                    </tr>
                                ) : (
                                    stockItems.map((item, idx) => (
                                        <tr key={item.id} style={{ borderBottom: '1pt solid #000000' }}>
                                            <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                                            <td style={{ padding: '5px 8px', fontWeight: 700 }}>{item.name}</td>
                                            <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{item.sku}</td>
                                            <td style={{ padding: '5px 8px', textTransform: 'capitalize' }}>
                                                {String(item.type).replace('_', ' ')}
                                            </td>
                                            <td style={{ padding: '5px 8px' }}>{item.warehouse}</td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>
                                                {num(item.onHand)} <span style={{ fontSize: '0.7rem', color: '#666' }}>{item.unit}</span>
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                                {num(item.available)}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#444' }}>
                                                {num(item.reorderLevel)}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                                {money(item.unitCost)}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>
                                                {money(item.stockValue)}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                                {item.isOutOfStock ? (
                                                    <span style={{ fontWeight: 800, color: '#b91c1c', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                        {locale === 'en' ? 'OUT OF STOCK' : 'ÉPUISÉ'}
                                                    </span>
                                                ) : item.isLowStock ? (
                                                    <span style={{ fontWeight: 800, color: '#b45309', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                        {locale === 'en' ? 'LOW STOCK' : 'RÉAPPRO.'}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontWeight: 700, color: '#15803d', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                        {locale === 'en' ? 'IN STOCK' : 'OPTIMAL'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2pt solid #000000', fontWeight: 800, background: '#f8fafc' }}>
                                    <td colSpan={5} style={{ padding: '7px 8px', textTransform: 'uppercase' }}>
                                        {locale === 'en' ? 'TOTAL INVENTORY VALUATION & VOLUME' : 'VALORISATION & VOLUME GLOBAL DU STOCK'}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{num(totalOnHandUnits)}</td>
                                    <td colSpan={3} style={{ padding: '7px 8px' }}></td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{money(totalStockValuation)}</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'center', fontSize: '0.72rem' }}>
                                        {optimalRate}% {locale === 'en' ? 'Optimal' : 'Conforme'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* SECTION 2: STOCK MOVEMENTS LEDGER (RECEIPTS & ISSUES) */}
                <div style={{ marginBottom: 20 }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 8,
                            borderBottom: '1.5pt solid #000000',
                            paddingBottom: 4,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: '0.95rem',
                                fontWeight: 900,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                            }}
                        >
                            {locale === 'en' ? 'II. PERIOD STOCK MOVEMENTS REGISTER (RECEIPTS & ISSUES)' : 'II. REGISTRE DES MOUVEMENTS DE STOCK DU PÉRIODE (ENTRÉES & SORTIES)'}
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#333' }}>
                            {movementRows.length} {locale === 'en' ? 'transactions recorded' : 'transactions enregistrées'}
                        </span>
                    </div>

                    <div className="report-table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                        <table
                            className="report-print-table"
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.78rem',
                                border: '1pt solid #000000',
                                textAlign: 'left',
                            }}
                        >
                            <thead>
                                <tr style={{ borderBottom: '1.5pt solid #000000', background: '#f8fafc' }}>
                                    <th style={{ padding: '6px 8px', width: '30px', textAlign: 'center' }}>#</th>
                                    <th style={{ padding: '6px 8px', width: '130px' }}>{locale === 'en' ? 'Date & Time' : 'Date & Heure'}</th>
                                    <th style={{ padding: '6px 8px', width: '90px' }}>{locale === 'en' ? 'Type' : 'Type'}</th>
                                    <th style={{ padding: '6px 8px' }}>{locale === 'en' ? 'Item Name' : 'Article'}</th>
                                    <th style={{ padding: '6px 8px', width: '90px' }}>{locale === 'en' ? 'SKU' : 'SKU'}</th>
                                    <th style={{ padding: '6px 8px', width: '120px' }}>{locale === 'en' ? 'Warehouse' : 'Entrepôt'}</th>
                                    <th style={{ padding: '6px 8px', width: '80px', textAlign: 'right' }}>{locale === 'en' ? 'Quantity (+/-)' : 'Quantité'}</th>
                                    <th style={{ padding: '6px 8px', width: '80px', textAlign: 'right' }}>{locale === 'en' ? 'Balance' : 'Solde'}</th>
                                    <th style={{ padding: '6px 8px', width: '85px', textAlign: 'right' }}>{locale === 'en' ? 'Unit Cost' : 'Coût unit.'}</th>
                                    <th style={{ padding: '6px 8px', width: '105px', textAlign: 'right' }}>{locale === 'en' ? 'Total Value' : 'Valeur'}</th>
                                    <th style={{ padding: '6px 8px', width: '180px' }}>{locale === 'en' ? 'Reason / Reference' : 'Référence / Motif'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movementRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                            {locale === 'en' ? 'No stock movement entries recorded in this period.' : 'Aucun mouvement de stock enregistré durant cette période.'}
                                        </td>
                                    </tr>
                                ) : (
                                    movementRows.map((m, idx) => (
                                        <tr key={m.id} style={{ borderBottom: '1pt solid #000000' }}>
                                            <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                                            <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{m.occurredAt}</td>
                                            <td style={{ padding: '5px 8px' }}>
                                                <span
                                                    style={{
                                                        fontWeight: 800,
                                                        fontSize: '0.7rem',
                                                        color: m.isPositive ? '#15803d' : '#b45309',
                                                    }}
                                                >
                                                    {m.type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '5px 8px', fontWeight: 700 }}>{m.itemName}</td>
                                            <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.sku}</td>
                                            <td style={{ padding: '5px 8px' }}>{m.warehouse}</td>
                                            <td
                                                style={{
                                                    padding: '5px 8px',
                                                    textAlign: 'right',
                                                    fontWeight: 800,
                                                    color: m.quantityDelta > 0 ? '#15803d' : '#000000',
                                                }}
                                            >
                                                {m.quantityDelta > 0 ? `+${num(m.quantityDelta)}` : num(m.quantityDelta)}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                                {m.balanceAfter != null ? num(m.balanceAfter) : '—'}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                                {money(m.unitCost)}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>
                                                {money(m.totalValue)}
                                            </td>
                                            <td style={{ padding: '5px 8px', fontSize: '0.75rem', color: '#333' }}>
                                                {m.reason}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2pt solid #000000', fontWeight: 800, background: '#f8fafc' }}>
                                    <td colSpan={6} style={{ padding: '7px 8px', textTransform: 'uppercase' }}>
                                        {locale === 'en' ? 'PERIOD NET STOCK FLOW' : 'FLUX NET DE STOCK SUR LA PÉRIODE'}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                                        {num(periodReceivedUnits - periodIssuedUnits)}
                                    </td>
                                    <td colSpan={4} style={{ padding: '7px 8px', fontSize: '0.72rem', color: '#444' }}>
                                        {locale === 'en' ? `Received: +${num(periodReceivedUnits)} | Issued: -${num(periodIssuedUnits)}` : `Reçus : +${num(periodReceivedUnits)} | Sortis : -${num(periodIssuedUnits)}`}
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
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 16,
                        border: '1.5pt solid #000000',
                        padding: '16px 20px',
                        marginTop: 16,
                        background: '#ffffff',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 800, textTransform: 'uppercase' }}>
                            {locale === 'en' ? 'PREPARED BY (WAREHOUSE KEEPER)' : 'PRÉPARÉ PAR (RESPONSABLE MAGASIN)'}
                        </div>
                        <div style={{ marginTop: 2 }}>{user.name}</div>
                        <div style={{ color: '#444' }}>{user.title || 'Warehouse Keeper'}</div>
                        <div style={{ marginTop: 18, borderBottom: '1pt solid #000000', width: '80%' }}></div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>{locale === 'en' ? 'Signature & Date' : 'Signature & Date'}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 800, textTransform: 'uppercase' }}>
                            {locale === 'en' ? 'VERIFIED BY (FACTORY / OPERATIONS)' : 'VÉRIFIÉ PAR (DIRECTEUR OPÉRATIONS)'}
                        </div>
                        <div style={{ marginTop: 2 }}>Factory Operations Manager</div>
                        <div style={{ color: '#444' }}>Quality &amp; Inventory Auditor</div>
                        <div style={{ marginTop: 18, borderBottom: '1pt solid #000000', width: '80%' }}></div>
                        <div style={{ fontSize: '0.7rem', color: '#666' }}>{locale === 'en' ? 'Signature & Date' : 'Signature & Date'}</div>
                    </div>

                    <div
                        style={{
                            border: '1.5pt dashed #000000',
                            height: '95px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#555',
                            textTransform: 'uppercase',
                            padding: 8,
                        }}
                    >
                        {user.current_factory?.name || 'FACTORY'}
                        <br />
                        {locale === 'en' ? 'OFFICIAL INVENTORY STAMP & DATE' : 'TIMBRE OFFICIEL & DATE'}
                    </div>
                </div>

                {/* DOCUMENT FOOTER */}
                <div
                    className="print-footer-block"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 14,
                        paddingTop: 8,
                        borderTop: '1pt solid #cbd5e1',
                        fontSize: '0.7rem',
                        color: '#666',
                    }}
                >
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
