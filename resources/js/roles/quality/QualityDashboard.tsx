import { useCallback, useEffect, useState } from 'react';
import {
    ClipboardCheck,
    Plus,
    RefreshCw,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { AuthUser, Locale } from '../../core/types';
import { api } from '../../core/api';
import '../../components/ui.css';
import { InspectModal } from '../../pages/production/flow/monitor/InspectModal';
import { flowText } from '../../pages/production/flow/text';
import { monitorText } from '../../pages/production/flow/monitor/monitorText';

type Props = {
    user: AuthUser;
    locale?: Locale;
    onNavigate?: (page: string) => void;
};

export default function QualityDashboard({ user, locale = 'en', onNavigate }: Props) {
    const isFr = locale === 'fr';
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [inspectTarget, setInspectTarget] = useState<{
        lotId?: number;
        stage?: any;
        quantity?: number;
    } | null>(null);

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await api('/api/quality/dashboard');
            setData(res);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to load quality dashboard data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const metrics = data?.metrics || {};
    const stages = data?.stages || [];
    const trend = data?.trend || [];
    const pendingQueue = data?.pending_queue || [];
    const recentInspections = data?.recent_inspections || [];
    const lots = data?.lots || [];

    const passRate = Number(metrics.pass_rate ?? 100);

    return (
        <section className="module-page">
            <div className="module-hero">
                <div className="module-title">
                    <span>
                        <ClipboardCheck />
                    </span>
                    <div>
                        <div className="eyebrow">
                            <i></i>{isFr ? 'CONTRÔLE QUALITÉ' : 'QUALITY CONTROL'}
                        </div>
                        <h1>{isFr ? 'Tableau de bord qualité' : 'Quality dashboard'}</h1>
                        <p>
                            {isFr
                                ? 'Vue d’ensemble des inspections qualité, pièces en attente de validation et historique des contrôles.'
                                : 'Overview of quality inspections, pieces awaiting approval across stages, and audit history.'}
                        </p>
                    </div>
                </div>
                <div className="workflow-actions">
                    <button
                        className="secondary-btn"
                        disabled={loading || refreshing}
                        onClick={() => loadData(true)}
                    >
                        <RefreshCw className={refreshing ? 'spin' : ''} size={16} />
                        {refreshing ? (isFr ? 'Actualisation…' : 'Refreshing…') : (isFr ? 'Actualiser' : 'Refresh')}
                    </button>
                    {data?.capabilities?.inspect && (
                        <button
                            className="primary-btn"
                            onClick={() => setInspectTarget({})}
                        >
                            <Plus size={16} />
                            {isFr ? 'Nouvelle inspection' : 'New inspection'}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            {/* Standard KPI Cards identical to QualityControlPage (No Icons) */}
            <div className="quality-metrics">
                <article className="panel quality-kpi">
                    <div>
                        <small>{isFr ? 'En attente' : 'Pending'}</small>
                        <b>{Number(metrics.total_awaiting_qc ?? metrics.pending ?? 0).toLocaleString()}</b>
                    </div>
                </article>
                <article className="panel quality-kpi">
                    <div>
                        <small>{isFr ? 'Validé ce mois' : 'Passed this month'}</small>
                        <b>{Number(metrics.inspected_month ?? metrics.passed ?? 0).toLocaleString()}</b>
                    </div>
                </article>
                <article className="panel quality-kpi">
                    <div>
                        <small>{isFr ? 'Rejeté ce mois' : 'Failed this month'}</small>
                        <b>{Number(metrics.rejected_month ?? metrics.failed ?? 0).toLocaleString()}</b>
                    </div>
                </article>
                <article className="panel quality-kpi">
                    <div>
                        <small>{isFr ? 'Taux de conformité' : 'Pass rate'}</small>
                        <b>{passRate.toFixed(1)}%</b>
                    </div>
                </article>
            </div>

            {/* Analytics Charts (Pass/Defect Rate & Inspection Trend Side-by-Side) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px', marginTop: '20px' }}>
                {/* Department Quality Performance Chart */}
                <article className="panel chart-panel" style={{ margin: 0 }}>
                    <header className="department-panel-head">
                        <div>
                            <h2>{isFr ? 'Taux de conformité et de défauts par département' : 'Department Pass Rate & Defect Rate'}</h2>
                            <p>{isFr ? 'Taux de conformité et de défauts pour chaque étape.' : 'Pass rates and defect rates across production departments.'}</p>
                        </div>
                    </header>
                    <div className="chart-wrap" style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stages.length ? stages : [
                                    { name: 'Cutting', pass_rate: 100, defect_rate: 0 },
                                    { name: 'Sewing', pass_rate: 100, defect_rate: 0 },
                                    { name: 'Finishing', pass_rate: 100, defect_rate: 0 },
                                    { name: 'Packing', pass_rate: 100, defect_rate: 0 },
                                ]}
                                margin={{ top: 16, right: 18, left: -10, bottom: 4 }}
                                barGap={4}
                            >
                                <CartesianGrid vertical={false} stroke="var(--line, #e2e8f0)" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: '12px' }} />
                                <YAxis
                                    domain={[0, 100]}
                                    unit="%"
                                    tickLine={false}
                                    axisLine={false}
                                    style={{ fontSize: '11px' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--panel, #ffffff)',
                                        border: '1px solid var(--line, #e2e8f0)',
                                        borderRadius: 8,
                                        fontSize: '12px',
                                    }}
                                    formatter={(val: any, name: any) => [`${val}%`, name]}
                                />
                                <Legend />
                                <Bar
                                    dataKey="pass_rate"
                                    name={isFr ? 'Taux de conformité (%)' : 'Pass Rate (%)'}
                                    fill="#059669"
                                    barSize={16}
                                    radius={[3, 3, 0, 0]}
                                />
                                <Bar
                                    dataKey="defect_rate"
                                    name={isFr ? 'Taux de défauts (%)' : 'Defect Rate (%)'}
                                    fill="#dc2626"
                                    barSize={16}
                                    radius={[3, 3, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                {/* 14-Day Quality & Defect Trend Chart */}
                <article className="panel chart-panel" style={{ margin: 0 }}>
                    <header className="department-panel-head">
                        <div>
                            <h2>{isFr ? 'Tendance des contrôles (14 jours)' : 'Quality Inspection Trend (14 Days)'}</h2>
                            <p>{isFr ? 'Volume quotidien de pièces inspectées et défectueuses.' : 'Daily volume of pieces passed vs rejected across the plant.'}</p>
                        </div>
                    </header>
                    <div className="chart-wrap" style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend} margin={{ top: 16, right: 18, left: -18, bottom: 4 }}>
                                <defs>
                                    <linearGradient id="passedFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="rejectedFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="var(--line, #e2e8f0)" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: '11px' }} />
                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} style={{ fontSize: '11px' }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--panel, #ffffff)',
                                        border: '1px solid var(--line, #e2e8f0)',
                                        borderRadius: 8,
                                        fontSize: '12px',
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="passed"
                                    name={isFr ? 'Conforme / Validé' : 'Passed Units'}
                                    stroke="#059669"
                                    fill="url(#passedFill)"
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="rejected"
                                    name={isFr ? 'Rebuts / Défauts' : 'Rejected / Defects'}
                                    stroke="#dc2626"
                                    fill="url(#rejectedFill)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </article>
            </div>

            {/* Pieces awaiting quality control table */}
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>{isFr ? 'Lot en attente de contrôle qualité' : 'Batch / Lot awaiting quality control'}</th>
                            <th>{isFr ? 'Article' : 'Item / Product'}</th>
                            <th>{isFr ? 'Étape' : 'Stage'}</th>
                            <th>{isFr ? 'Quantité' : 'Quantity'}</th>
                            <th>{isFr ? 'Action' : 'Action'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingQueue.length ? (
                            pendingQueue.map((item: any, idx: number) => (
                                <tr key={`${item.lot_id}-${item.stage}-${idx}`}>
                                    <td>
                                        <b>{item.lot_number}</b>
                                    </td>
                                    <td>{item.product}</td>
                                    <td>{item.stage_label || item.stage}</td>
                                    <td>{Number(item.quantity_waiting || 0).toLocaleString()}</td>
                                    <td>
                                        {data?.capabilities?.inspect ? (
                                            <button
                                                className="table-action"
                                                onClick={() => setInspectTarget({ lotId: item.lot_id, stage: item.stage, quantity: item.quantity_waiting })}
                                            >
                                                {isFr ? 'Inspecter' : 'Inspect'}
                                            </button>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="empty-cell">
                                    {isFr
                                        ? 'Aucune pièce en attente de contrôle qualité.'
                                        : 'No pieces are waiting on quality control.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Recent Quality Inspections Audit Table */}
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>{isFr ? 'Inspection' : 'Inspection'}</th>
                            <th>{isFr ? 'Commande / Lot' : 'Order / Item'}</th>
                            <th>{isFr ? 'Étape' : 'Stage'}</th>
                            <th>{isFr ? 'Quantités (Inspecté / Rejeté)' : 'Quantities (Inspected / Rejected)'}</th>
                            <th>{isFr ? 'Résultat' : 'Result'}</th>
                            <th>{isFr ? 'Inspecteur' : 'Inspector'}</th>
                            <th>{isFr ? 'Détails des défauts' : 'Defect details'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentInspections.length ? (
                            recentInspections.map((row: any) => (
                                <tr key={row.id}>
                                    <td>
                                        <b>{row.inspection_number}</b>
                                    </td>
                                    <td>{row.target}</td>
                                    <td>{row.stage}</td>
                                    <td>
                                        {Number(row.inspected_quantity || 0).toLocaleString()}{' '}
                                        {Number(row.rejected_quantity || 0) > 0 ? (
                                            <span style={{ color: 'var(--ui-bad, #dc2626)' }}>
                                                ({Number(row.rejected_quantity).toLocaleString()} rejected)
                                            </span>
                                        ) : null}
                                    </td>
                                    <td>
                                        <span className={`admin-status ${row.result === 'passed' ? 'success' : row.result === 'failed' ? 'danger' : 'warning'}`}>
                                            {row.result}
                                        </span>
                                    </td>
                                    <td>{row.inspector}</td>
                                    <td>{row.defect_details || '—'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="empty-cell">
                                    {isFr ? 'Aucune inspection enregistrée.' : 'No inspections recorded yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Inspect Modal Trigger */}
            {inspectTarget && (
                <InspectModal
                    key={`${inspectTarget.lotId ?? 'new'}-${inspectTarget.stage ?? 'any'}`}
                    lots={lots}
                    initialLot={inspectTarget.lotId}
                    initialStage={inspectTarget.stage}
                    initialQuantity={inspectTarget.quantity}
                    locale={locale}
                    text={flowText[locale] || flowText.en}
                    words={monitorText[locale] || monitorText.en}
                    onClose={() => setInspectTarget(null)}
                    onDone={(msg) => {
                        setSuccess(msg);
                        setInspectTarget(null);
                        loadData(true);
                    }}
                />
            )}
        </section>
    );
}
