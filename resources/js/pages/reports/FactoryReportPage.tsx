import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, FileText, Printer, RefreshCw, Factory } from 'lucide-react';
import type { AuthUser, Locale } from '../../core/types';
import { api } from '../../core/api';

type Props = {
    user: AuthUser;
    locale: Locale;
};

const iso = (date: Date) => date.toLocaleDateString('en-CA');

type DeptKey = 'cutting' | 'sewing' | 'finishing' | 'packing';

const DEPARTMENTS: { key: DeptKey; label: { en: string; fr: string }; unit: string }[] = [
    { key: 'cutting', label: { en: 'CUTTING', fr: 'COUPE' }, unit: 'm' },
    { key: 'sewing', label: { en: 'SEWING', fr: 'COUTURE' }, unit: 'pcs' },
    { key: 'finishing', label: { en: 'FINISHING', fr: 'FINITION' }, unit: 'pcs' },
    { key: 'packing', label: { en: 'PACKING', fr: 'EMBALLAGE' }, unit: 'pcs' },
];

export default function FactoryReportPage({ user, locale }: Props) {
    const today = iso(new Date());
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('week');
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return iso(d);
    });
    const [toDate, setToDate] = useState(today);
    const [specificDate, setSpecificDate] = useState('');
    const [selectedDept, setSelectedDept] = useState<'' | DeptKey>('');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadData = async (from = fromDate, to = toDate) => {
        setLoading(true);
        try {
            const url = `/api/flow/factory-report?period=custom&from=${from}&to=${to}${selectedDept ? `&department=${selectedDept}` : ''}`;
            const res = await api<any>(url);
            setData(res);
            setError('');
        } catch (e: any) {
            setError(e.message || 'Failed to load factory report.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(fromDate, toDate);
    }, [fromDate, toDate, selectedDept]);

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

    // Build structured department rows
    const departmentBlocks = useMemo(() => {
        if (!data) return [];

        const visibleDepts = selectedDept
            ? DEPARTMENTS.filter((d) => d.key === selectedDept)
            : DEPARTMENTS;

        return visibleDepts.map((dept) => {
            const block = data[dept.key];
            const lots: any[] = block?.lots || [];

            let rows: any[] = [];
            if (lots.length > 0) {
                rows = lots.map((l: any, idx: number) => {
                    const good = Number(l.good || 0);
                    const damaged = Number(l.damaged || 0);
                    const qcPassed = Number(l.qc_passed || good);
                    const qcStatus = String(l.qc_status || 'passed').toUpperCase();

                    let materialItem = l.fabric || 'Textile material';
                    let qtyUsed = 0;

                    if (dept.key === 'cutting') {
                        qtyUsed = good > 0 ? good * 1.5 : 0;
                    } else if (dept.key === 'sewing') {
                        materialItem = l.fabric ? `${l.fabric} (Cut Pieces)` : 'Cut pieces';
                        qtyUsed = good + damaged;
                    } else if (dept.key === 'finishing') {
                        materialItem = 'Sewn Garments';
                        qtyUsed = good + damaged;
                    } else if (dept.key === 'packing') {
                        materialItem = 'Finished Garments';
                        qtyUsed = good + damaged;
                    }

                    return {
                        id: `${dept.key}-${idx}`,
                        date: fromDate === toDate ? fromDate : toDate,
                        department: dept.label[locale === 'fr' ? 'fr' : 'en'],
                        materialItem,
                        qtyUsed,
                        style: l.product || 'Garment',
                        color: l.color || '—',
                        size: l.size || 'Standard',
                        good,
                        damaged,
                        qcPassed,
                        qcStatus,
                    };
                });
            } else if (block && (Number(block.good || 0) > 0 || Number(block.damaged || 0) > 0)) {
                // If lots array is empty but stage totals exist
                const good = Number(block.good || 0);
                const damaged = Number(block.damaged || 0);
                const qc = block.quality || {};
                const qcPassed = Number(qc.passed || good);
                const qcStatus = qcPassed > 0 ? 'PASSED' : 'PENDING';

                let materialItem = 'Fabric Material';
                let qtyUsed = 0;
                if (dept.key === 'cutting') {
                    qtyUsed = (block.fabric || []).reduce((s: number, f: any) => s + Number(f.used || 0), 0) || (good * 1.5);
                } else {
                    materialItem = dept.key === 'sewing' ? 'Cut pieces' : dept.key === 'finishing' ? 'Sewn garments' : 'Finished items';
                    qtyUsed = Number(block.received || good + damaged);
                }

                rows = [
                    {
                        id: `${dept.key}-summary`,
                        date: fromDate === toDate ? fromDate : toDate,
                        department: dept.label[locale === 'fr' ? 'fr' : 'en'],
                        materialItem,
                        qtyUsed,
                        style: 'Assorted Styles',
                        color: 'Assorted',
                        size: 'All sizes',
                        good,
                        damaged,
                        qcPassed,
                        qcStatus,
                    },
                ];
            }

            const totalUsed = rows.reduce((s, r) => s + r.qtyUsed, 0);
            const totalGood = rows.reduce((s, r) => s + r.good, 0);
            const totalDamaged = rows.reduce((s, r) => s + r.damaged, 0);
            const totalQc = rows.reduce((s, r) => s + r.qcPassed, 0);
            const passRate = totalGood > 0 ? ((totalQc / totalGood) * 100).toFixed(1) : '100.0';

            return {
                ...dept,
                rows,
                totalUsed,
                totalGood,
                totalDamaged,
                totalQc,
                passRate,
            };
        });
    }, [data, selectedDept, fromDate, toDate, locale]);

    // Grand Totals
    const grandInputMeters = departmentBlocks
        .filter((d) => d.key === 'cutting')
        .reduce((s, d) => s + d.totalUsed, 0);
    const grandInputPieces = departmentBlocks
        .filter((d) => d.key !== 'cutting')
        .reduce((s, d) => s + d.totalUsed, 0);
    const grandOutput = departmentBlocks.reduce((s, d) => s + d.totalGood, 0);
    const grandDamaged = departmentBlocks.reduce((s, d) => s + d.totalDamaged, 0);
    const grandQcPassed = departmentBlocks.reduce((s, d) => s + d.totalQc, 0);
    const overallPassRate = grandOutput > 0 ? ((grandQcPassed / grandOutput) * 100).toFixed(1) : '100.0';

    let runningIndex = 0;

    return (
        <section className="module-page factory-report-page" style={{ padding: '20px 24px', maxWidth: 1240, margin: '0 auto', background: '#ffffff' }}>
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
                        margin: 5mm 5mm;
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
                        font-size: 0.70rem !important;
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
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
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
                        <Factory size={20} color="#4f46e5" />
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {locale === 'en' ? 'Factory Operations & Quality Report' : 'Rapport Général des Opérations & Contrôle Qualité'}
                        </h1>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                        {locale === 'en'
                            ? 'Executive multi-department ledger: cutting, sewing, finishing, packing inputs, outputs, defect tracking, and quality audit.'
                            : 'Registre général des opérations multi-départements : coupe, couture, finition, emballage, pertes et contrôle qualité.'}
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
                        href={`/api/flow/factory-report.pdf?period=custom&from=${fromDate}&to=${toDate}${selectedDept ? `&department=${selectedDept}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, textDecoration: 'none', background: '#000000', color: '#ffffff', fontWeight: 600 }}
                    >
                        <FileText size={15} />
                        {locale === 'en' ? 'Export as PDF' : 'Exporter en PDF'}
                    </a>
                </div>
            </div>

            {/* DATE & DEPARTMENT FILTER BAR */}
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
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                            <span>{locale === 'en' ? 'Department:' : 'Département :'}</span>
                            <select
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value as any)}
                                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                                <option value="">{locale === 'en' ? 'All Departments' : 'Tous les Départements'}</option>
                                <option value="cutting">{locale === 'en' ? 'Cutting' : 'Coupe'}</option>
                                <option value="sewing">{locale === 'en' ? 'Sewing' : 'Couture'}</option>
                                <option value="finishing">{locale === 'en' ? 'Finishing' : 'Finition'}</option>
                                <option value="packing">{locale === 'en' ? 'Packing' : 'Emballage'}</option>
                            </select>
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
                            {selectedDept
                                ? `${selectedDept.toUpperCase()} DEPARTMENT REPORT`
                                : locale === 'en' ? 'FACTORY OPERATIONS & QUALITY AUDIT REPORT' : 'RAPPORT GÉNÉRAL DES OPÉRATIONS & QUALITÉ'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '1.5pt solid #000000', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>DEPARTMENTS:</b> {selectedDept ? selectedDept.toUpperCase() : 'ALL DEPARTMENTS'}</div>
                        <div><b>PREPARED BY:</b> {user.name} (Factory Operations Manager)</div>
                        <div><b>QUALITY STATUS:</b> <span style={{ fontWeight: 800, textDecoration: 'underline' }}>PASSED ({overallPassRate}%)</span></div>
                    </div>
                </div>

                {/* 5-COLUMN EXCEL KPI SUMMARY MATRIX */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1pt solid #000000', marginBottom: 18, background: '#ffffff', textAlign: 'center' }}>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>1. Received (Input)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                            {grandInputMeters > 0 ? `${num(grandInputMeters)} m` : `${num(grandInputPieces)} pcs`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Fabric &amp; parts allocated</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>2. Used Items</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                            {grandInputMeters > 0 ? `${num(grandInputMeters)} m` : `${num(grandInputPieces)} pcs`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Consumed in production</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>3. Output Produced</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(grandOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Total units produced</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>4. Damaged / Waste</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: grandDamaged > 0 ? '#b91c1c' : '#000000' }}>{num(grandDamaged)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Scraps, rework &amp; defects</div>
                    </div>
                    <div style={{ padding: '10px 8px', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>5. Quality Control</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: '#000000' }}>{overallPassRate}%</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Factory-wide Verified</div>
                    </div>
                </div>

                {/* SINGLE UNIFIED EXCEL DATA TABLE WITH VERTICAL DEPARTMENTS & ROW SPAN */}
                <div className="report-table-scroll-wrapper" style={{ overflowX: 'auto', marginBottom: 20 }}>
                    <table className="report-print-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #000000', fontSize: '0.80rem', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#ffffff', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: '#ffffff' }}>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', width: '3%', background: '#ffffff' }}>#</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', width: '9%', background: '#ffffff' }}>DATE</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', width: '9%', background: '#ffffff' }}>DEPARTMENT</th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff' }}>
                                    1. RECEIVED &amp; USED
                                </th>
                                <th colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff' }}>
                                    2. OUTPUT PRODUCED
                                </th>
                                <th style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff', width: '8%' }}>
                                    3. DAMAGED
                                </th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', background: '#ffffff', width: '16%' }}>
                                    4. QUALITY CONTROL
                                </th>
                            </tr>
                            <tr style={{ background: '#ffffff' }}>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'left', width: '15%', background: '#ffffff' }}>MATERIAL / ITEM</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '7%', background: '#ffffff' }}>QTY USED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'left', width: '14%', background: '#ffffff' }}>GARMENT STYLE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'center', width: '6%', background: '#ffffff' }}>COLOR</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'center', width: '5%', background: '#ffffff' }}>SIZE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>GOOD PCS</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>SCRAP/DEF</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', width: '8%', background: '#ffffff' }}>PASSED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'center', width: '8%', background: '#ffffff' }}>QC STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departmentBlocks.map((deptBlock) => {
                                const rows = deptBlock.rows;
                                const deptName = deptBlock.label[locale === 'fr' ? 'fr' : 'en'];
                                const rowCount = rows.length > 0 ? rows.length : 1;

                                return (
                                    <React.Fragment key={deptBlock.key}>
                                        {rows.length > 0 ? (
                                            rows.map((row: any, rIdx: number) => {
                                                runningIndex += 1;
                                                return (
                                                    <tr key={row.id || rIdx} style={{ background: '#ffffff' }}>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{runningIndex}</td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{row.date}</td>
                                                        {rIdx === 0 && (
                                                            <td
                                                                rowSpan={rows.length}
                                                                style={{
                                                                    border: '1pt solid #000000',
                                                                    padding: '6px 4px',
                                                                    textAlign: 'center',
                                                                    fontWeight: 800,
                                                                    background: '#ffffff',
                                                                    verticalAlign: 'middle',
                                                                    letterSpacing: '0.04em',
                                                                }}
                                                            >
                                                                {deptName}
                                                            </td>
                                                        )}
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px' }}>{row.materialItem}</td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', fontWeight: 600 }}>
                                                            {num(row.qtyUsed)} {deptBlock.unit}
                                                        </td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px' }}>{row.style}</td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{row.color}</td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{row.size}</td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', fontWeight: 800 }}>
                                                            {num(row.good)}
                                                        </td>
                                                        <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', color: row.damaged > 0 ? '#b91c1c' : '#000000' }}>
                                                            {num(row.damaged)}
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
                                                );
                                            })
                                        ) : (
                                            <tr style={{ background: '#ffffff' }}>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>—</td>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center' }}>{fromDate}</td>
                                                <td style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'center', fontWeight: 800, background: '#ffffff' }}>
                                                    {deptName}
                                                </td>
                                                <td colSpan={9} style={{ border: '1pt solid #000000', padding: 12, textAlign: 'center', fontStyle: 'italic', color: '#666666', background: '#ffffff' }}>
                                                    {locale === 'en' ? `No ${deptName} operations recorded for this period.` : `Aucune opération enregistrée pour ${deptName}.`}
                                                </td>
                                            </tr>
                                        )}

                                        {/* DEPARTMENT SUBTOTAL / DIVIDER LINE */}
                                        {rows.length > 0 && (
                                            <tr style={{ background: '#ffffff', fontWeight: 800, borderTop: '1pt solid #000000', borderBottom: '1.5pt solid #000000' }}>
                                                <td colSpan={4} style={{ border: '1pt solid #000000', padding: '5px 4px', textAlign: 'right', background: '#ffffff' }}>
                                                    SUBTOTAL {deptName}:
                                                </td>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                                    {num(deptBlock.totalUsed)} {deptBlock.unit}
                                                </td>
                                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '5px 4px', background: '#ffffff' }}></td>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                                    {num(deptBlock.totalGood)} pcs
                                                </td>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', color: deptBlock.totalDamaged > 0 ? '#b91c1c' : '#000000', background: '#ffffff' }}>
                                                    {num(deptBlock.totalDamaged)}
                                                </td>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'right', background: '#ffffff' }}>
                                                    {num(deptBlock.totalQc)}
                                                </td>
                                                <td style={{ border: '1pt solid #000000', padding: '5px 3px', textAlign: 'center', background: '#ffffff', fontSize: '0.72rem' }}>
                                                    {deptBlock.passRate}%
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#ffffff', fontWeight: 900, borderTop: '2pt solid #000000' }}>
                                <td colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 4px', textAlign: 'right', background: '#ffffff', fontSize: '0.80rem' }}>
                                    TOTAL FACTORY OPERATIONS:
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 3px', textAlign: 'right', background: '#ffffff', fontSize: '0.80rem' }}>
                                    {grandInputMeters > 0 ? `${num(grandInputMeters)} m` : ''} {grandInputPieces > 0 ? `+ ${num(grandInputPieces)} pcs` : ''}
                                </td>
                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '6px 4px', background: '#ffffff' }}></td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 3px', textAlign: 'right', background: '#ffffff', fontSize: '0.80rem' }}>
                                    {num(grandOutput)} pcs
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 3px', textAlign: 'right', background: '#ffffff', color: grandDamaged > 0 ? '#b91c1c' : '#000000', fontSize: '0.80rem' }}>
                                    {num(grandDamaged)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 3px', textAlign: 'right', background: '#ffffff', fontSize: '0.80rem' }}>
                                    {num(grandQcPassed)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 3px', textAlign: 'center', background: '#ffffff', fontSize: '0.75rem' }}>
                                    {overallPassRate}%
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
                            <div>Name: {user.name}</div>
                            <div>Role: Factory Operations Manager</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                2. SUPERVISOR REVIEW
                            </div>
                            <div>Name: ____________________</div>
                            <div>Role: Production Line Supervisor</div>
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
                    <span>{user.current_factory?.name || 'ICYEREKEZO OMS'} · FACTORY OPERATIONS &amp; QUALITY AUDIT REPORT</span>
                    <span>Page 1 of 1 · Confidential</span>
                </footer>
            </article>
        </section>
    );
}
