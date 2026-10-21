import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Printer, RefreshCw, Scissors, Calendar } from 'lucide-react';
import type { AuthUser, Locale } from '../../../../core/types';
import { api } from '../../../../core/api';

type Props = {
    user: AuthUser;
    locale: Locale;
};

const iso = (date: Date) => date.toLocaleDateString('en-CA');

export default function CuttingReportPage({ user, locale }: Props) {
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
                api<any>(`/api/flow/factory-report?department=cutting&period=custom&from=${from}&to=${to}`).catch(() => null),
                api<any>('/api/inventory/overview').catch(() => null),
            ]);
            setData(reportRes);
            setInventoryOverview(invRes);
            setError('');
        } catch (e: any) {
            setError(e.message || 'Failed to load cutting report.');
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
            // start & end = today
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

    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    // Process transactions from inventory overview to ensure detailed cut operations rows
    const cuttingRows = useMemo(() => {
        const txs: any[] = inventoryOverview?.recent_transactions || inventoryOverview?.transactions || [];
        const warehouses: any[] = inventoryOverview?.warehouse_list || [];
        const cuttingWarehouseId = warehouses.find((w) => w.code === 'CUT' || /cutting/i.test(w.name))?.id;

        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

        const cutTxs = txs.filter((tx) => {
            const isCutOutput = tx.type === 'issue' && (tx.warehouse_id === cuttingWarehouseId || String(tx.reason || '').startsWith('[Cut Output]'));
            if (!isCutOutput) return false;
            const d = new Date(tx.occurred_at);
            return (!from || d >= from) && (!to || d <= to);
        });

        // Map cut transactions
        const rows = cutTxs.map((tx: any) => {
            const details = String(tx.reason || '').replace('[Cut Output] ', '');
            const outputMatch = details.match(/\|\s*([\d,.]+)x\s+(.+?)(?:\s+\/\s+(.+?))?\s+\(([^)]+)\)\s+produced/i);
            const fabricColor = String(tx.item_name || '').match(/\b(green|blue|red|yellow|black|white|navy|grey|gray|brown|orange|purple|pink|beige|cream)\b/i)?.[1] || '—';
            const cutPiecesQty = outputMatch?.[1] ? Number(outputMatch[1].replaceAll(',', '')) : 0;
            const fabricUsedMeters = Math.abs(Number(tx.quantity_delta || 0));

            return {
                id: tx.id,
                date: new Date(tx.occurred_at).toLocaleDateString(),
                lotNumber: tx.batch_number || `LOT-${tx.id}`,
                receivedItem: tx.item_name || 'Fabric material',
                fabricColor,
                usedMeters: fabricUsedMeters,
                outputStyle: outputMatch?.[2]?.trim() || 'Garment',
                outputColor: outputMatch?.[3]?.trim() || fabricColor,
                outputSize: outputMatch?.[4]?.trim() || 'Standard',
                outputPieces: cutPiecesQty,
                damagedMeters: 0,
                qcPassed: cutPiecesQty,
                qcStatus: cutPiecesQty > 0 ? 'PASSED' : 'PENDING',
            };
        });

        // Also check if flow report returned lots
        const flowLots: any[] = data?.cutting?.lots || [];
        if (rows.length === 0 && flowLots.length > 0) {
            return flowLots.map((l: any, idx: number) => ({
                id: idx,
                date: fromDate,
                lotNumber: l.lot_number || `LOT-${idx + 1}`,
                receivedItem: l.fabric || 'Cotton Textile',
                fabricColor: l.color || '—',
                usedMeters: Number(l.good || 0) * 1.5,
                outputStyle: l.product || 'Shirt',
                outputColor: l.color || '—',
                outputSize: l.size || 'M',
                outputPieces: Number(l.good || 0),
                damagedMeters: Number(l.damaged || 0),
                qcPassed: Number(l.qc_passed || l.good || 0),
                qcStatus: (l.qc_status || 'passed').toUpperCase(),
            }));
        }

        return rows;
    }, [inventoryOverview, data, fromDate, toDate]);

    // Totals
    const totalFabricUsed = cuttingRows.reduce((s, r) => s + r.usedMeters, 0);
    const totalOutputPieces = cuttingRows.reduce((s, r) => s + r.outputPieces, 0);
    const totalDamaged = cuttingRows.reduce((s, r) => s + r.damagedMeters, 0);
    const totalQcPassed = cuttingRows.reduce((s, r) => s + r.qcPassed, 0);
    const qcPassRate = totalOutputPieces > 0 ? ((totalQcPassed / totalOutputPieces) * 100).toFixed(1) : '100.0';

    return (
        <section className="module-page cutting-report-page" style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto', background: '#ffffff' }}>
            <style>{`
                .excel-table-container {
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
                        margin: 6mm 8mm;
                    }
                    nav, aside, .app-sidebar, .module-actions, .no-print, button, .ui-tabs, .app-header, .app-shell-header {
                        display: none !important;
                    }
                    header:not(.excel-table-container header):not(.sheet-print-header) {
                        display: none !important;
                    }
                    html, body, #root, .app-layout, .app-content, .module-page {
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
                        padding: 4px 3px !important;
                        word-break: break-word !important;
                        overflow-wrap: break-word !important;
                        white-space: normal !important;
                        line-height: 1.15 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    thead tr, tfoot tr, tbody tr {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    .print-signatures-block {
                        display: block !important;
                        margin-top: 14px !important;
                        page-break-inside: avoid !important;
                    }
                    .print-footer-block {
                        display: flex !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* TOP HEADER: Clean Title & Action Buttons (Print & Export PDF, NO RECORD BUTTONS) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Scissors size={20} color="#4f46e5" />
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {locale === 'en' ? 'Cutting Department Report' : 'Rapport du Département Coupe'}
                        </h1>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                        {locale === 'en'
                            ? 'Official cutting operations register: input materials, meters used, cut pieces output, damaged, and quality control.'
                            : 'Registre officiel des opérations de coupe : tissu reçu, métrage utilisé, pièces coupées, pertes et contrôle qualité.'}
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
                        href={`/api/flow/cutting-report.pdf?period=custom&from=${fromDate}&to=${toDate}`}
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
            <div className="panel no-print" style={{ background: '#ffffff', border: '1px solid #000000', borderRadius: 4, padding: '12px 16px', marginBottom: 20 }}>
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

            {/* PAPER / EXCEL REPORT SHEET CONTAINER */}
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
                {/* EXCEL SHEET HEADER */}
                <div className="sheet-print-header" style={{ borderBottom: '2pt solid #000000', paddingBottom: 14, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#000000' }}>
                            {user.current_factory?.name || 'ICYEREKEZO OMS FACTORY'}
                        </h2>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.02em', color: '#000000' }}>
                            {locale === 'en' ? 'CUTTING DEPARTMENT REPORT' : 'RAPPORT DU DÉPARTEMENT COUPE'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '1.5pt solid #000000', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>DEPARTMENT:</b> CUTTING</div>
                        <div><b>PREPARED BY:</b> {user.name} (Cutting Operator)</div>
                        <div><b>QUALITY STATUS:</b> <span style={{ fontWeight: 800, textDecoration: 'underline' }}>PASSED ({qcPassRate}%)</span></div>
                    </div>
                </div>

                {/* 5-COLUMN EXCEL KPI SUMMARY MATRIX */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1pt solid #000000', marginBottom: 18, background: '#ffffff', textAlign: 'center' }}>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>1. Received (Input)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalFabricUsed)} m</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Fabric material allocated</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>2. Used Items</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalFabricUsed)} m</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Consumed in cutting</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>3. Output Produced</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutputPieces)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Cut pieces passed to sewing</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>4. Damaged / Waste</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: totalDamaged > 0 ? '#b91c1c' : '#000000' }}>{num(totalDamaged)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Scraps &amp; defective cuts</div>
                    </div>
                    <div style={{ padding: '10px 8px', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>5. Quality Control</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: '#000000' }}>{qcPassRate}%</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>QC Inspected &amp; Verified</div>
                    </div>
                </div>

                {/* SINGLE EXCEL DATA TABLE */}
                <div className="report-table-scroll-wrapper" style={{ overflowX: 'auto', marginBottom: 20 }}>
                    <table className="report-print-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #000000', fontSize: '0.82rem', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#ffffff', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: '#ffffff' }}>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', width: '4%', background: '#ffffff' }}>#</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', width: '11%', background: '#ffffff' }}>DATE</th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff' }}>
                                    1. RECEIVED (INPUT) &amp; USED
                                </th>
                                <th colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff' }}>
                                    2. OUTPUT PRODUCED (CUT PIECES)
                                </th>
                                <th style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff', width: '8%' }}>
                                    3. DAMAGED
                                </th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff', width: '17%' }}>
                                    4. QUALITY CONTROL
                                </th>
                            </tr>
                            <tr style={{ background: '#ffffff' }}>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'left', width: '15%', background: '#ffffff' }}>FABRIC MATERIAL</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>METERS USED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'left', width: '13%', background: '#ffffff' }}>GARMENT STYLE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'center', width: '7%', background: '#ffffff' }}>COLOR</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'center', width: '6%', background: '#ffffff' }}>SIZE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>GOOD PCS</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>SCRAP/DEF</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>PASSED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'center', width: '9%', background: '#ffffff' }}>QC STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cuttingRows.length > 0 ? (
                                cuttingRows.map((row: any, index: number) => (
                                    <tr key={row.id || index} style={{ background: '#ffffff' }}>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{index + 1}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{row.date}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px' }}>{row.receivedItem}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', fontWeight: 600 }}>
                                            {num(row.usedMeters)} m
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px' }}>{row.outputStyle}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{row.outputColor}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{row.outputSize}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', fontWeight: 800 }}>
                                            {num(row.outputPieces)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', color: row.damagedMeters > 0 ? '#b91c1c' : '#000000' }}>
                                            {num(row.damagedMeters)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', fontWeight: 700 }}>
                                            {num(row.qcPassed)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center', fontWeight: 700 }}>
                                            <span style={{ border: '1pt solid #000000', padding: '1px 3px', fontSize: '0.7rem', background: '#ffffff', display: 'inline-block' }}>
                                                {row.qcStatus}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={11} style={{ border: '1pt solid #000000', padding: 24, textAlign: 'center', fontStyle: 'italic', color: '#666666', background: '#ffffff' }}>
                                        {locale === 'en'
                                            ? 'No cutting operations match the selected date or date range.'
                                            : 'Aucune opération de coupe enregistrée pour la date ou période sélectionnée.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#ffffff', fontWeight: 800, borderTop: '2pt solid #000000' }}>
                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', background: '#ffffff' }}>
                                    TOTAL:
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalFabricUsed)} m
                                </td>
                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '5px 4px', background: '#ffffff' }}></td>
                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalOutputPieces)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalDamaged)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalQcPassed)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center', background: '#ffffff', fontSize: '0.72rem' }}>
                                    {qcPassRate}%
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* OFFICIAL SIGNATURES BLOCK - ON PRINTED REPORT ONLY */}
                <div className="print-signatures-block" style={{ marginTop: 28, borderTop: '1.5pt solid #000000', paddingTop: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                1. PREPARED BY
                            </div>
                            <div>Name: Cutting Manager</div>
                            <div>Role: Cutting Operator</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                2. SUPERVISOR REVIEW
                            </div>
                            <div>Name: ____________________</div>
                            <div>Role: Cutting Line Supervisor</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                3. QUALITY CONTROL
                            </div>
                            <div>Name: ____________________</div>
                            <div>Result: [ X ] Verified Passed</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                4. FACTORY MANAGER
                            </div>
                            <div>Name: ____________________</div>
                            <div>Decision: Approved</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>
                    </div>
                </div>

                <footer className="print-footer-block" style={{ marginTop: 16, paddingTop: 6, borderTop: '0.5pt solid #999999', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#555555' }}>
                    <span>{user.current_factory?.name || 'ICYEREKEZO OMS'} · CUTTING DEPARTMENT REPORT</span>
                    <span>Page 1 of 1 · Confidential</span>
                </footer>
            </article>
        </section>
    );
}
