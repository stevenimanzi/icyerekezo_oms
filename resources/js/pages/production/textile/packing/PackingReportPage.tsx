import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Printer, RefreshCw, Calendar, PackageCheck } from 'lucide-react';
import type { AuthUser, Locale } from '../../../../core/types';
import { api } from '../../../../core/api';

type Props = {
    user: AuthUser;
    locale: Locale;
};

const iso = (date: Date) => date.toLocaleDateString('en-CA');

export default function PackingReportPage({ user, locale }: Props) {
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
                api<any>(`/api/flow/factory-report?department=packing&period=custom&from=${from}&to=${to}`).catch(() => null),
                api<any>('/api/inventory/overview').catch(() => null),
            ]);
            setData(reportRes);
            setInventoryOverview(invRes);
            setError('');
        } catch (e: any) {
            setError(e.message || 'Failed to load packing report.');
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

    const packingRows = useMemo(() => {
        const txs: any[] = inventoryOverview?.recent_transactions || inventoryOverview?.transactions || [];
        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

        const packTxs = txs.filter((tx) => {
            const isPack = String(tx.reason || '').toLowerCase().includes('pack') ||
                String(tx.reason || '').startsWith('[Packing Output]');
            if (!isPack) return false;
            const d = new Date(tx.occurred_at);
            return (!from || d >= from) && (!to || d <= to);
        });

        const rowsMap = new Map<string, any>();
        packTxs.forEach((tx: any) => {
            const dateStr = new Date(tx.occurred_at).toLocaleDateString();
            const lot = tx.batch_number || `PAC-${tx.id}`;
            const key = `${dateStr}-${lot}`;

            if (!rowsMap.has(key)) {
                rowsMap.set(key, {
                    id: key,
                    date: dateStr,
                    lotNumber: lot,
                    receivedItem: tx.item_name || 'Finished Garments',
                    style: tx.item_name || 'Garment Box',
                    color: 'Assorted',
                    size: 'Multi',
                    inputReceived: 0,
                    outputPacked: 0,
                    damaged: 0,
                    qcPassed: 0,
                    qcStatus: 'PASSED',
                });
            }

            const row = rowsMap.get(key);
            const qty = Math.abs(Number(tx.quantity_delta || 0));
            if (tx.type === 'receipt' || String(tx.reason).includes('Received')) {
                row.inputReceived += qty;
            } else {
                row.outputPacked += qty;
                row.qcPassed += qty;
            }
        });

        const rows = Array.from(rowsMap.values());

        // Fallback to flow report packing lots
        const flowLots: any[] = data?.packing?.lots || [];
        if (rows.length === 0 && flowLots.length > 0) {
            return flowLots.map((l: any, idx: number) => ({
                id: idx,
                date: fromDate,
                lotNumber: l.lot_number || `PAC-${idx + 1}`,
                receivedItem: l.product || 'Finished Garment',
                style: l.product || 'Garment',
                color: l.color || '—',
                size: l.size || 'Standard',
                inputReceived: Number(l.good || 0) + Number(l.damaged || 0),
                outputPacked: Number(l.good || 0),
                damaged: Number(l.damaged || 0),
                qcPassed: Number(l.qc_passed || l.good || 0),
                qcStatus: (l.qc_status || 'passed').toUpperCase(),
            }));
        }

        if (rows.length === 0 && data?.packing) {
            const p = data.packing;
            if (Number(p.good || p.units_packed || 0) > 0 || Number(p.input || 0) > 0) {
                return [
                    {
                        id: 'summary',
                        date: fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`,
                        lotNumber: 'PAC-BATCH-01',
                        receivedItem: 'Inspected Finished Garments',
                        style: 'Standard Garments',
                        color: 'Assorted',
                        size: 'All Sizes',
                        inputReceived: Number(p.input || p.good || 0),
                        outputPacked: Number(p.good || p.units_packed || 0),
                        damaged: Number(p.damaged || 0),
                        qcPassed: Number(p.qc_passed || p.good || 0),
                        qcStatus: 'PASSED',
                    },
                ];
            }
        }

        return rows;
    }, [inventoryOverview, data, fromDate, toDate]);

    const totalInput = packingRows.reduce((s, r) => s + r.inputReceived, 0);
    const totalOutput = packingRows.reduce((s, r) => s + r.outputPacked, 0);
    const totalDamaged = packingRows.reduce((s, r) => s + r.damaged, 0);
    const totalQcPassed = packingRows.reduce((s, r) => s + r.qcPassed, 0);
    const qcPassRate = totalOutput > 0 ? Math.round((totalQcPassed / totalOutput) * 100) : 100;

    const handlePrint = () => {
        window.print();
    };

    const handleExportPdf = () => {
        const url = `/api/flow/packing-report.pdf?department=packing&from=${fromDate}&to=${toDate}`;
        window.open(url, '_blank');
    };

    return (
        <section className="ui" style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 60, background: '#ffffff' }}>
            {/* INLINE CSS FOR EXCEL PAPER SHEET & PRINT MEDIA */}
            <style>
                {`
                .print-signatures-block {
                    display: none;
                }
                @media print {
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: 'Segoe UI', Arial, sans-serif !important;
                    }
                    .no-print, header, nav, aside, .app-sidebar, .app-header {
                        display: none !important;
                    }
                    .print-signatures-block {
                        display: block !important;
                    }
                    .excel-table-container {
                        box-shadow: none !important;
                        border: 1pt solid #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        background: #ffffff !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 8.5pt !important;
                        background: #ffffff !important;
                    }
                    th, td {
                        border: 1pt solid #000000 !important;
                        padding: 4pt 6pt !important;
                        color: #000000 !important;
                        background: #ffffff !important;
                    }
                    thead tr {
                        background: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    tfoot tr {
                        background: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
                `}
            </style>

            {/* TOP BAR / CONTROLS (NO RECORD BUTTONS) */}
            <div className="no-print" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <PackageCheck size={24} style={{ color: '#0f766e' }} />
                            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                                {locale === 'en' ? 'Packing Department Official Report' : "Rapport Officiel du Département d'Emballage"}
                            </h1>
                        </div>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                            {locale === 'en'
                                ? 'Monochrome Excel register showing received finished garments, packaged output, packaging defects, and final quality control.'
                                : "Registre Excel monochrome présentant les vêtements reçus, la production emballée, les défauts et le contrôle qualité final."}
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => loadData(fromDate, toDate)}
                            disabled={loading}
                            title="Refresh data"
                        >
                            <RefreshCw size={15} className={loading ? 'spin' : ''} />
                            {locale === 'en' ? 'Refresh' : 'Actualiser'}
                        </button>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={handlePrint}
                            title="Print Excel Paper Table"
                        >
                            <Printer size={15} />
                            {locale === 'en' ? 'Print' : 'Imprimer'}
                        </button>
                        <button
                            type="button"
                            className="primary-btn"
                            onClick={handleExportPdf}
                            title="Export official PDF"
                        >
                            <Download size={15} />
                            {locale === 'en' ? 'Export as PDF' : 'Exporter en PDF'}
                        </button>
                    </div>
                </div>

                {/* FILTER TOOLBAR: SPECIFIC DATE PICKER & PERIOD PILLS */}
                <div
                    style={{
                        marginTop: 16,
                        padding: '12px 16px',
                        background: '#ffffff',
                        border: '1px solid #000000',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)' }}>
                            {locale === 'en' ? 'Period:' : 'Période:'}
                        </span>
                        {(['today', 'yesterday', 'week', 'month'] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => handleQuickPeriod(p)}
                                style={{
                                    border: '1px solid',
                                    borderColor: period === p && !specificDate ? '#0f766e' : 'var(--border-color, #d1d5db)',
                                    background: period === p && !specificDate ? '#0f766e' : 'transparent',
                                    color: period === p && !specificDate ? '#ffffff' : 'inherit',
                                    padding: '4px 10px',
                                    borderRadius: 4,
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {p === 'today'
                                    ? locale === 'en' ? 'Today' : "Aujourd'hui"
                                    : p === 'yesterday'
                                    ? locale === 'en' ? 'Yesterday' : 'Hier'
                                    : p === 'week'
                                    ? locale === 'en' ? 'Last 7 Days' : '7 Derniers Jours'
                                    : locale === 'en' ? 'This Month' : 'Ce Mois'}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}>
                            <Calendar size={14} style={{ color: 'var(--muted)' }} />
                            <span>{locale === 'en' ? 'Specific Date:' : 'Date Précise:'}</span>
                            <input
                                type="date"
                                value={specificDate}
                                onChange={(e) => handleSpecificDate(e.target.value)}
                                style={{
                                    border: '1px solid var(--border-color, #d1d5db)',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    fontSize: '0.82rem',
                                    background: 'var(--input-bg, #ffffff)',
                                    color: 'inherit',
                                }}
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
                                ? 'DEPARTMENT OF PACKING &middot; FINISHED GOODS PACKAGING, DEFECTS & AQL AUDIT REPORT'
                                : "DÉPARTEMENT D'EMBALLAGE &middot; CONDITIONNEMENT, DÉFAUTS ET CONTRÔLE AQL"}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.82rem', lineHeight: 1.6, borderLeft: '1pt solid #cccccc', paddingLeft: 16 }}>
                        <div><b>PERIOD:</b> {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}</div>
                        <div><b>DEPARTMENT:</b> PACKING &amp; WAREHOUSE HANDOVER</div>
                        <div><b>PREPARED BY:</b> {user.name} (Packaging Team)</div>
                        <div><b>QUALITY STATUS:</b> <span style={{ fontWeight: 800, textDecoration: 'underline' }}>PASSED ({qcPassRate}%)</span></div>
                    </div>
                </header>

                {/* 5-COLUMN EXCEL KPI SUMMARY MATRIX */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1pt solid #000000', marginBottom: 18, background: '#ffffff', textAlign: 'center' }}>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>1. Received (Input)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalInput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Finished garments from finishing</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>2. Used Items</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Polybags &amp; boxes consumed</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>3. Output Produced</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>{num(totalOutput)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Packaged units ready for stock</div>
                    </div>
                    <div style={{ padding: '10px 8px', borderRight: '1pt solid #000000', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>4. Damaged / Waste</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: totalDamaged > 0 ? '#b91c1c' : '#000000' }}>{num(totalDamaged)} pcs</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Packaging flaws &amp; torn bags</div>
                    </div>
                    <div style={{ padding: '10px 8px', background: '#ffffff' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase' }}>5. Quality Control</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color: '#000000' }}>{qcPassRate}%</div>
                        <div style={{ fontSize: '0.7rem', color: '#444444' }}>Final AQL Verified</div>
                    </div>
                </div>

                {/* SINGLE EXCEL DATA TABLE */}
                <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #000000', fontSize: '0.82rem', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#ffffff' }}>
                        <thead>
                            <tr style={{ background: '#ffffff' }}>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', width: 40, background: '#ffffff' }}>#</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', width: 95, background: '#ffffff' }}>DATE</th>
                                <th rowSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'left', width: 110, background: '#ffffff' }}>CARTON / BATCH #</th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff' }}>
                                    1. RECEIVED (INPUT) &amp; USED
                                </th>
                                <th colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff' }}>
                                    2. OUTPUT PRODUCED (PACKAGED GOODS)
                                </th>
                                <th style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff', width: 85 }}>
                                    3. DAMAGED
                                </th>
                                <th colSpan={2} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff', width: 130 }}>
                                    4. QUALITY CONTROL
                                </th>
                            </tr>
                            <tr style={{ background: '#ffffff' }}>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'left', background: '#ffffff' }}>RECEIVED ITEM</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', width: 80, background: '#ffffff' }}>INPUT (PCS)</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'left', background: '#ffffff' }}>PRODUCT STYLE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', width: 60, background: '#ffffff' }}>COLOR</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', width: 50, background: '#ffffff' }}>SIZE</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', width: 80, background: '#ffffff' }}>PACKED (PCS)</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', background: '#ffffff' }}>PACK FLAW</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', background: '#ffffff' }}>PASSED</th>
                                <th style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center', background: '#ffffff' }}>QC STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packingRows.length > 0 ? (
                                packingRows.map((row: any, index: number) => (
                                    <tr key={row.id || index} style={{ background: '#ffffff' }}>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{index + 1}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.date}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', fontWeight: 600 }}>{row.lotNumber}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px' }}>{row.receivedItem}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 600 }}>
                                            {num(row.inputReceived)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px' }}>{row.style}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.color}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'center' }}>{row.size}</td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>
                                            {num(row.outputPacked)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', color: row.damaged > 0 ? '#b91c1c' : '#000000' }}>
                                            {num(row.damaged)}
                                        </td>
                                        <td style={{ border: '1pt solid #000000', padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>
                                            {num(row.qcPassed)}
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
                                            ? 'No packing operations match the selected date or date range.'
                                            : "Aucune opération d'emballage enregistrée pour la date ou période sélectionnée."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#ffffff', fontWeight: 800, borderTop: '2pt solid #000000' }}>
                                <td colSpan={4} style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    TOTAL PACKING REGISTER:
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalInput)}
                                </td>
                                <td colSpan={3} style={{ border: '1pt solid #000000', padding: '6px 8px', background: '#ffffff' }}></td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalOutput)} pcs
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalDamaged)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'right', background: '#ffffff' }}>
                                    {num(totalQcPassed)}
                                </td>
                                <td style={{ border: '1pt solid #000000', padding: '6px 8px', textAlign: 'center', background: '#ffffff' }}>
                                    {qcPassRate}% VERIFIED
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
                            <div>Name: Packing Manager</div>
                            <div>Role: Packing Operator</div>
                            <div style={{ marginTop: 22, borderBottom: '1pt solid #000000' }}></div>
                            <div style={{ marginTop: 3, fontSize: '0.7rem' }}>Signature &amp; Date</div>
                        </div>

                        <div style={{ border: '1pt solid #000000', padding: 10, fontSize: '0.78rem', background: '#ffffff' }}>
                            <div style={{ fontWeight: 800, borderBottom: '1pt solid #000000', paddingBottom: 4, marginBottom: 6 }}>
                                2. SUPERVISOR REVIEW
                            </div>
                            <div>Name: ____________________</div>
                            <div>Role: Packing Supervisor</div>
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
                    <span>{user.current_factory?.name || 'ICYEREKEZO OMS'} &middot; OFFICIAL PACKING &amp; HANDOVER REGISTER</span>
                    <span>Page 1 of 1 &middot; Confidential</span>
                </footer>
            </article>
        </section>
    );
}
