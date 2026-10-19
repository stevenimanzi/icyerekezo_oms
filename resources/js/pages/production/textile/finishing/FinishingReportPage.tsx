import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Printer, RefreshCw, Calendar } from 'lucide-react';
import type { AuthUser, Locale } from '../../../../core/types';
import { api } from '../../../../core/api';

type Props = {
    user: AuthUser;
    locale: Locale;
};

const iso = (date: Date) => date.toLocaleDateString('en-CA');

export default function FinishingReportPage({ user, locale }: Props) {
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
                api<any>(`/api/flow/factory-report?department=finishing&period=custom&from=${from}&to=${to}`).catch(() => null),
                api<any>('/api/inventory/overview').catch(() => null),
            ]);
            setData(reportRes);
            setInventoryOverview(invRes);
            setError('');
        } catch (e: any) {
            setError(e.message || 'Failed to load finishing report.');
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

    const finishingRows = useMemo(() => {
        const lots = data?.finishing?.lots || [];
        if (lots.length > 0) {
            return lots.map((l: any, idx: number) => ({
                id: idx,
                date: fromDate,
                lotNumber: l.lot_number || `FIN-${idx + 1}`,
                receivedItem: l.product || 'Garment Lot',
                style: l.product || 'Garment',
                color: l.color || '—',
                size: l.size || 'Standard',
                inputReceived: Number(l.good || 0) + Number(l.damaged || 0),
                outputFinished: Number(l.good || 0),
                damaged: Number(l.damaged || 0),
                qcPassed: Number(l.qc_passed || l.good || 0),
                qcStatus: (l.qc_status || 'passed').toUpperCase(),
            }));
        }
        return [];
    }, [data, fromDate]);

    const totalInput = finishingRows.reduce((s, r) => s + r.inputReceived, 0);
    const totalOutput = finishingRows.reduce((s, r) => s + r.outputFinished, 0);
    const totalDamaged = finishingRows.reduce((s, r) => s + r.damaged, 0);
    const totalQc = finishingRows.reduce((s, r) => s + r.qcPassed, 0);
    const passRate = totalOutput > 0 ? ((totalQc / totalOutput) * 100).toFixed(1) : '100.0';

    return (
        <section className="module-page finishing-report-page" style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto', background: '#ffffff' }}>
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
                    display: block !important;
                }
                @media print {
                    @page {
                        size: auto;
                        margin: 8mm;
                    }
                    nav, header, .app-sidebar, .module-actions, .no-print, button, .ui-tabs, .app-header {
                        display: none !important;
                    }
                    body, #root, .app-layout, .app-content, .module-page {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                    }
                    .excel-table-container {
                        box-shadow: none !important;
                        border: 1.5pt solid #000000 !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        padding: 16px 20px !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                    }
                    table {
                        width: 100% !important;
                        page-break-inside: auto;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                    }
                    th, td {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        color: #000000 !important;
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
                }
            `}</style>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {locale === 'en' ? 'Finishing Department Report' : 'Rapport du Département Finition'}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                        {locale === 'en'
                            ? 'Official finishing & ironing register: received sewn garments, finished output, quality audit, and handoff to packing.'
                            : 'Registre officiel de finition et repassage : vêtements reçus, pièces terminées, contrôle qualité et transfert vers emballage.'}
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
                        href={`/api/flow/factory-report.pdf?department=finishing&period=custom&from=${fromDate}&to=${toDate}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, textDecoration: 'none', background: '#000000', color: '#ffffff', fontWeight: 600 }}
                    >
                        <FileText size={15} />
                        {locale === 'en' ? 'Export as PDF' : 'Exporter en PDF'}
                    </a>
                </div>
            </div>

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
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#000000' }}>
                            {user.current_factory?.name || 'ICYEREKEZO OMS FACTORY'}
                        </h2>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.02em', color: '#000000' }}>
                            {locale === 'en' ? 'FINISHING DEPARTMENT REPORT' : 'RAPPORT DU DÉPARTEMENT FINITION'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '1.5pt solid #000000', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>DEPARTMENT:</b> FINISHING</div>
                        <div><b>PREPARED BY:</b> {user.name} (Finishing Operator)</div>
                        <div><b>QUALITY STATUS:</b> <span style={{ fontWeight: 800, textDecoration: 'underline' }}>PASSED ({passRate}%)</span></div>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1pt solid #000000', marginBottom: 18, background: '#ffffff', textAlign: 'center' }}>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>1. Received (Input)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalInput || totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>From sewing lines</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>2. Processed</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Trimmed &amp; ironed</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>3. Output Produced</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Passed to packing</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>4. Flaws / Stains</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: totalDamaged > 0 ? '#b91c1c' : '#000000' }}>{num(totalDamaged)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Defective / damaged</div>
                    </div>
                    <div style={{ padding: '10px 8px', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>5. Quality Control</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: '#000000' }}>{passRate}%</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Verified Passed</div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #000000', fontSize: '0.82rem', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#ffffff' }}>
                        <thead>
                            <tr style={{ background: '#ffffff' }}>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', width: 40, background: '#ffffff' }}>#</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', width: 95, background: '#ffffff' }}>DATE</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'left', width: 110, background: '#ffffff' }}>LOT / BATCH #</th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff' }}>
                                    1. RECEIVED (INPUT)
                                </th>
                                <th colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff' }}>
                                    2. OUTPUT PRODUCED (FINISHED GARMENTS)
                                </th>
                                <th style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff', width: 85 }}>
                                    3. FLAWS
                                </th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff', width: 130 }}>
                                    4. QUALITY CONTROL
                                </th>
                            </tr>
                            <tr style={{ background: '#ffffff' }}>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'left', background: '#ffffff' }}>GARMENT DESCRIPTION</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', width: 80, background: '#ffffff' }}>PCS RECEIVED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'left', background: '#ffffff' }}>PRODUCT STYLE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', width: 60, background: '#ffffff' }}>COLOR</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', width: 50, background: '#ffffff' }}>SIZE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', width: 80, background: '#ffffff' }}>FINISHED GOOD</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', background: '#ffffff' }}>STAINS / FLAWS</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', background: '#ffffff' }}>PASSED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', background: '#ffffff' }}>QC STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finishingRows.length > 0 ? (
                                finishingRows.map((row: any, index: number) => (
                                    <tr key={row.id || index} style={{ background: '#ffffff' }}>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{index + 1}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.date}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', fontWeight: 600 }}>{row.lotNumber}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px' }}>{row.receivedItem}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 600 }}>
                                            {num(row.inputReceived || row.outputFinished)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px' }}>{row.style}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.color}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.size}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>
                                            {num(row.outputFinished)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', color: row.damaged > 0 ? '#b91c1c' : '#000000' }}>
                                            {num(row.damaged)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>
                                            {num(row.qcPassed || row.outputFinished)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', fontWeight: 700 }}>
                                            <span style={{ border: '1pt solid #000000', padding: '1px 5px', fontSize: '0.72rem', background: '#ffffff' }}>
                                                {row.qcStatus}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={12} style={{ border: '1pt solid #000000', padding: 24, textAlign: 'center', fontStyle: 'italic', color: '#666666', background: '#ffffff' }}>
                                        {locale === 'en'
                                            ? 'No finishing operations recorded for the selected date or date range.'
                                            : 'Aucune opération de finition enregistrée pour la date ou période sélectionnée.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#ffffff', fontWeight: 800, borderTop: '2pt solid #000000' }}>
                                <td colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    TOTAL FINISHING REGISTER:
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalInput || totalOutput)} pcs
                                </td>
                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '6px 8px', background: '#ffffff' }}></td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalOutput)} pcs
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalDamaged)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalQc || totalOutput)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff' }}>
                                    {passRate}% VERIFIED
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* SIGNATURES BLOCK - ON PRINTED REPORT ONLY */}
                <div className="print-signatures-block" style={{ marginTop: 28, borderTop: '1.5pt solid #000000', paddingTop: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                1. PREPARED BY
                            </div>
                            <div>Name: Finishing Manager</div>
                            <div>Role: Finishing Operator</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                2. SUPERVISOR REVIEW
                            </div>
                            <div>Name: ____________________</div>
                            <div>Role: Finishing Line Supervisor</div>
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

                <footer style={{ marginTop: 16, paddingTop: 6, borderTop: '0.5pt solid #999999', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#555555' }}>
                    <span>{user.current_factory?.name || 'ICYEREKEZO OMS'} · FINISHING DEPARTMENT REPORT</span>
                    <span>Page 1 of 1 · Confidential</span>
                </footer>
            </article>
        </section>
    );
}
