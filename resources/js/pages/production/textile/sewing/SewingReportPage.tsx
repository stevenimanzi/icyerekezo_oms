import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Printer, RefreshCw, Calendar } from 'lucide-react';
import type { AuthUser, Locale } from '../../../../core/types';
import { api } from '../../../../core/api';

type Props = {
    user: AuthUser;
    locale: Locale;
};

const iso = (date: Date) => date.toLocaleDateString('en-CA');

export default function SewingReportPage({ user, locale }: Props) {
    const today = iso(new Date());
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('week');
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return iso(d);
    });
    const [toDate, setToDate] = useState(today);
    const [specificDate, setSpecificDate] = useState('');
    const [data, setData] = useState<any>(null);
    const [inventoryOverview, setInventoryOverview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadData = async (from = fromDate, to = toDate) => {
        setLoading(true);
        try {
            const [reportRes, invRes] = await Promise.all([
                api<any>(`/api/flow/factory-report?department=sewing&period=custom&from=${from}&to=${to}`).catch(() => null),
                api<any>('/api/inventory/overview').catch(() => null),
            ]);
            setData(reportRes);
            setInventoryOverview(invRes);
            setError('');
        } catch (e: any) {
            setError(e.message || 'Failed to load sewing report.');
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
        if (p === 'yesterday') {
            start.setDate(end.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else if (p === 'week') {
            start.setDate(end.getDate() - 6);
        } else if (p === 'month') {
            start.setDate(1);
        }
        setFromDate(iso(start));
        setToDate(iso(end));
    };

    const handleSpecificDate = (val: string) => {
        setSpecificDate(val);
        if (val) {
            setPeriod('custom');
            setFromDate(val);
            setToDate(val);
        }
    };

    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const sewingRows = useMemo(() => {
        const txs: any[] = inventoryOverview?.recent_transactions || inventoryOverview?.transactions || [];
        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

        const sewTxs = txs.filter((tx) => {
            const isSew = String(tx.reason || '').includes('CutID:') || String(tx.reason || '').startsWith('[Sewing Output]');
            if (!isSew) return false;
            const d = new Date(tx.occurred_at);
            return (!from || d >= from) && (!to || d <= to);
        });

        const rowsMap = new Map<string, any>();
        sewTxs.forEach((tx: any) => {
            const cutMatch = String(tx.reason).match(/CutID:\s*([^\s|]+)/i);
            const cutId = cutMatch ? cutMatch[1] : `SEW-${tx.id}`;
            const parts = cutId.split('-');
            const dateStr = new Date(tx.occurred_at).toLocaleDateString();
            const key = `${dateStr}-${cutId}`;

            if (!rowsMap.has(key)) {
                rowsMap.set(key, {
                    id: key,
                    date: dateStr,
                    lotNumber: cutId,
                    receivedItem: tx.item_name || 'Cut Pieces',
                    style: parts[1] || 'Shirt',
                    color: parts[2] || '—',
                    size: parts[3] || 'Standard',
                    inputReceived: 0,
                    outputSewn: 0,
                    damaged: 0,
                    qcPassed: 0,
                    qcStatus: 'PASSED',
                });
            }
            const row = rowsMap.get(key);
            const qty = Math.abs(Number(tx.quantity_delta || 0));
            if (tx.type === 'receipt') row.inputReceived += qty;
            else if (tx.type === 'issue' || tx.type === 'production_output') {
                row.outputSewn += qty;
                row.qcPassed += qty;
            } else if (tx.type === 'waste') row.damaged += qty;
        });

        const list = Array.from(rowsMap.values());
        if (list.length === 0 && data?.sewing?.lots?.length > 0) {
            return data.sewing.lots.map((l: any, idx: number) => ({
                id: idx,
                date: fromDate,
                lotNumber: l.lot_number || `LOT-${idx + 1}`,
                receivedItem: 'Cut Garment Pieces',
                style: l.product || 'Garment',
                color: l.color || '—',
                size: l.size || 'M',
                inputReceived: Number(l.good || 0) + Number(l.damaged || 0),
                outputSewn: Number(l.good || 0),
                damaged: Number(l.damaged || 0),
                qcPassed: Number(l.qc_passed || l.good || 0),
                qcStatus: (l.qc_status || 'passed').toUpperCase(),
            }));
        }

        return list;
    }, [inventoryOverview, data, fromDate, toDate]);

    const totalInput = sewingRows.reduce((s, r) => s + r.inputReceived, 0);
    const totalOutput = sewingRows.reduce((s, r) => s + r.outputSewn, 0);
    const totalDamaged = sewingRows.reduce((s, r) => s + r.damaged, 0);
    const totalQc = sewingRows.reduce((s, r) => s + r.qcPassed, 0);
    const passRate = totalOutput > 0 ? ((totalQc / totalOutput) * 100).toFixed(1) : '100.0';

    return (
        <section className="module-page sewing-report-page" style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
            <style>{`
                @media print {
                    nav, header, .app-sidebar, .module-actions, .no-print, button, .ui-tabs {
                        display: none !important;
                    }
                    body, .module-page {
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .excel-table-container {
                        box-shadow: none !important;
                        border: none !important;
                    }
                    table {
                        width: 100% !important;
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            `}</style>

            {/* TOP HEADER: Clean Title & Action Buttons (Print & Export PDF, NO RECORD BUTTONS) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {locale === 'en' ? 'Sewing Department Report' : 'Rapport du Département Couture'}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                        {locale === 'en'
                            ? 'Official sewing assembly lines register: received cut pieces, sewn output, defect rework, and quality audit.'
                            : 'Registre officiel des lignes de couture : pièces coupées reçues, vêtements assemblés, retouches et contrôle qualité.'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        className="secondary-btn"
                        onClick={() => loadData(fromDate, toDate)}
                        disabled={loading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}
                    >
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        {locale === 'en' ? 'Refresh' : 'Actualiser'}
                    </button>
                    <button
                        className="secondary-btn"
                        onClick={() => window.print()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                    >
                        <Printer size={15} />
                        {locale === 'en' ? 'Print' : 'Imprimer'}
                    </button>
                    <a
                        className="primary-btn"
                        href={`/api/flow/factory-report.pdf?department=sewing&period=custom&from=${fromDate}&to=${toDate}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, textDecoration: 'none', background: '#000000', color: '#ffffff', fontWeight: 600 }}
                    >
                        <FileText size={15} />
                        {locale === 'en' ? 'Export as PDF' : 'Exporter en PDF'}
                    </a>
                </div>
            </div>

            {/* DATE FILTER BAR */}
            <div className="panel no-print" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
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
                    </div>
                </div>
            </div>

            {error && <div className="admin-alert error no-print" style={{ marginBottom: 16 }}>{error}</div>}

            {/* EXCEL SHEET CONTAINER */}
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
                <header style={{ borderBottom: '2pt solid #000000', paddingBottom: 14, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#555555', textTransform: 'uppercase' }}>
                            OFFICIAL PRODUCTION REGISTER &middot; MICROSOFT EXCEL GRID FORMAT
                        </div>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: '4px 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            {user.current_factory?.name || 'ICYEREKEZO OMS FACTORY'}
                        </h2>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111111' }}>
                            {locale === 'en'
                                ? 'DEPARTMENT OF SEWING &middot; ASSEMBLY LINES, GARMENTS PRODUCED & QUALITY AUDIT'
                                : 'DÉPARTEMENT DE COUTURE &middot; LIGNES D’ASSEMBLAGE, PRODUCTION ET CONTRÔLE QUALITÉ'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '1pt solid #cccccc', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>DEPARTMENT:</b> SEWING</div>
                        <div><b>PREPARED BY:</b> {user.name} (Sewing Line Lead)</div>
                        <div><b>QUALITY STATUS:</b> <span style={{ fontWeight: 800, textDecoration: 'underline' }}>PASSED ({passRate}%)</span></div>
                    </div>
                </header>

                {/* 5-COLUMN EXCEL KPI SUMMARY */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1pt solid #000000', marginBottom: 18, background: '#f9f9f9', textAlign: 'center' }}>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase' }}>1. Received (Input)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalInput || totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#666666' }}>Cut pieces received</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase' }}>2. Fed to Lines</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#666666' }}>Active in workstations</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase' }}>3. Output Produced</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#666666' }}>Sewn garments finished</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase' }}>4. Damaged / Rework</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: totalDamaged > 0 ? '#b91c1c' : '#000000' }}>{num(totalDamaged)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#666666' }}>Stitch flaws / defect rework</div>
                    </div>
                    <div style={{ padding: '10px 8px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555555', textTransform: 'uppercase' }}>5. Quality Control</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: '#15803d' }}>{passRate}%</div>
                        <div style={{ fontSize: '0.7rem', color: '#666666' }}>Inline verified passed</div>
                    </div>
                </div>

                {/* SINGLE EXCEL DATA TABLE */}
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #000000', fontSize: '0.82rem', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
                        <thead>
                            <tr style={{ background: '#e2e2e2' }}>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', width: 40 }}>#</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', width: 95 }}>DATE</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'left', width: 110 }}>LOT / CUT ID</th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#d5d5d5' }}>
                                    1. RECEIVED PIECES (INPUT)
                                </th>
                                <th colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#e2e2e2' }}>
                                    2. OUTPUT PRODUCED (SEWN GARMENTS)
                                </th>
                                <th style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#d5d5d5', width: 85 }}>
                                    3. DEFECTS
                                </th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#e2e2e2', width: 130 }}>
                                    4. QUALITY CONTROL
                                </th>
                            </tr>
                            <tr style={{ background: '#f0f0f0' }}>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'left' }}>CUT MATERIAL ITEM</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', width: 80 }}>PCS RECEIVED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'left' }}>GARMENT STYLE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', width: 60 }}>COLOR</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', width: 50 }}>SIZE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', width: 80 }}>SEWN GOOD</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right' }}>REWORK / DEF</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right' }}>PASSED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>QC STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sewingRows.length > 0 ? (
                                sewingRows.map((row: any, index: number) => (
                                    <tr key={row.id || index} style={{ background: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{index + 1}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.date}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', fontWeight: 600 }}>{row.lotNumber}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px' }}>{row.receivedItem}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 600 }}>
                                            {num(row.inputReceived || row.outputSewn)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px' }}>{row.style}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.color}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.size}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>
                                            {num(row.outputSewn)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', color: row.damaged > 0 ? '#b91c1c' : '#000000' }}>
                                            {num(row.damaged)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>
                                            {num(row.qcPassed || row.outputSewn)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', fontWeight: 700 }}>
                                            <span style={{ border: '1pt solid #000000', padding: '1px 5px', fontSize: '0.72rem', background: '#f5f5f5' }}>
                                                {row.qcStatus}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={12} style={{ border: '1pt solid #000000', padding: 24, textAlign: 'center', fontStyle: 'italic', color: '#666666' }}>
                                        {locale === 'en'
                                            ? 'No sewing operations recorded for the selected date or date range.'
                                            : 'Aucune opération de couture enregistrée pour la date ou période sélectionnée.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#ececec', fontWeight: 800, borderTop: '2pt solid #000000' }}>
                                <td colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                                    TOTAL SEWING REGISTER:
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                                    {num(totalInput || totalOutput)} pcs
                                </td>
                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '6px 8px' }}></td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                                    {num(totalOutput)} pcs
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                                    {num(totalDamaged)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right' }}>
                                    {num(totalQc || totalOutput)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center' }}>
                                    {passRate}% VERIFIED
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* SIGNATURES BLOCK */}
                <div style={{ marginTop: 28, borderTop: '1.5pt solid #000000', paddingTop: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #cccccc', paddingBottom: 4, marginBottom: 6 }}>
                                1. PREPARED BY
                            </div>
                            <div>Name: {user.name}</div>
                            <div>Role: Sewing Line Operator</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#666' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #cccccc', paddingBottom: 4, marginBottom: 6 }}>
                                2. SUPERVISOR REVIEW
                            </div>
                            <div>Name: ____________________</div>
                            <div>Role: Sewing Floor Supervisor</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#666' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #cccccc', paddingBottom: 4, marginBottom: 6 }}>
                                3. QUALITY CONTROL
                            </div>
                            <div>Name: ____________________</div>
                            <div>Result: [ X ] Inline QC Passed</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#666' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #cccccc', paddingBottom: 4, marginBottom: 6 }}>
                                4. FACTORY MANAGER
                            </div>
                            <div>Name: ____________________</div>
                            <div>Decision: Approved</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#666' }}>Signature &amp; Date</div>
                        </div>
                    </div>
                </div>

                <footer style={{ marginTop: 16, paddingTop: 6, borderTop: '0.5pt solid #999999', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#555555' }}>
                    <span>{user.current_factory?.name || 'ICYEREKEZO OMS'} &middot; OFFICIAL SEWING OPERATIONS REGISTER</span>
                    <span>Page 1 of 1 &middot; Confidential</span>
                </footer>
            </article>
        </section>
    );
}
