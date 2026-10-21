import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import '../../../../components/ui.css';
import { makeFormat } from '../../../../core/format';
import { useLiveData } from '../../../../core/liveData';
import type { AuthUser, Locale } from '../../../../core/types';
import '../flow.css';
import { buildKpis } from '../stage/kpis';
import { STAGE_ORDER, stageLabel } from '../stages';
import { flowText } from '../text';
import type { FlowMonitor, FlowReport, StageKey, StageOverview } from '../types';
import { homeText } from './homeText';

type Props = {
    user: AuthUser;
    locale: Locale;
    onNavigate: (page: string) => void;
    mode: 'stage' | 'manager';
};

const STAGE_PAGE: Record<StageKey, string> = {
    cutting: 'cutting-workspace',
    sewing: 'sewing-workspace',
    finishing: 'finishing-workspace',
    packing: 'packing-workspace',
};

const REFRESH_MS = 15000;
const COLOURS: Record<StageKey, string> = {
    cutting: '#5FA02A',
    sewing: '#C55A11',
    finishing: '#8F3EC4',
    packing: '#0070C0',
};

/** The home page of a stage team, production manager or quality officer: live figures from the production flow. */
export default function FlowHome({ user, locale, onNavigate, mode }: Props) {
    const text = flowText[locale];
    const words = homeText[locale];
    const format = useMemo(() => makeFormat(locale, ''), [locale]);

    const [filterPeriod, setFilterPeriod] = useState<string>('daily');
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const { computedFrom, computedTo, chartFrom, chartTo, rangeLabel } = useMemo(() => {
        const today = new Date();
        const formatDate = (d: Date) => d.toLocaleDateString('en-CA');

        if (filterPeriod === 'daily') {
            const d = formatDate(today);
            const from14 = new Date(today);
            from14.setDate(today.getDate() - 13);
            return {
                computedFrom: d,
                computedTo: d,
                chartFrom: formatDate(from14),
                chartTo: d,
                rangeLabel: locale === 'fr' ? "Aujourd'hui" : 'Today',
            };
        }
        if (filterPeriod === 'weekly') {
            const from = new Date();
            from.setDate(today.getDate() - 6);
            const dFrom = formatDate(from);
            const dTo = formatDate(today);
            return {
                computedFrom: dFrom,
                computedTo: dTo,
                chartFrom: dFrom,
                chartTo: dTo,
                rangeLabel: locale === 'fr' ? 'Cette semaine' : 'This Week',
            };
        }
        if (filterPeriod === 'monthly') {
            const from = new Date(today.getFullYear(), today.getMonth(), 1);
            const dFrom = formatDate(from);
            const dTo = formatDate(today);
            return {
                computedFrom: dFrom,
                computedTo: dTo,
                chartFrom: dFrom,
                chartTo: dTo,
                rangeLabel: locale === 'fr' ? 'Ce mois-ci' : 'This Month',
            };
        }
        if (filterPeriod === 'yearly' || filterPeriod === 'anualy') {
            const from = new Date(today.getFullYear(), 0, 1);
            const dFrom = formatDate(from);
            const dTo = formatDate(today);
            return {
                computedFrom: dFrom,
                computedTo: dTo,
                chartFrom: dFrom,
                chartTo: dTo,
                rangeLabel: locale === 'fr' ? 'Cette année' : 'This Year',
            };
        }
        // Custom
        const cTo = endDate || startDate;
        return {
            computedFrom: startDate,
            computedTo: cTo,
            chartFrom: startDate,
            chartTo: cTo,
            rangeLabel: `${startDate} ~ ${cTo}`,
        };
    }, [filterPeriod, startDate, endDate, locale]);

    const defaultStage: StageKey | undefined =
        user.workspace === 'cutting' || user.roles?.some((r) => r.slug === 'cutting-operator')
            ? 'cutting'
            : user.workspace === 'sewing' || user.roles?.some((r) => r.slug === 'sewing-operator')
              ? 'sewing'
              : user.workspace === 'finishing' || user.roles?.some((r) => r.slug === 'finishing-manager')
                ? 'finishing'
                : user.workspace === 'packing' ||
                    user.workspace === 'packaging' ||
                    user.roles?.some(
                        (r) => r.slug === 'packing-manager' || r.slug === 'packaging-operator',
                    )
                  ? 'packing'
                  : undefined;

    const isStageMode = mode === 'stage';

    const overviewUrl = useMemo(
        () => `/api/flow/overview?period=${filterPeriod}&from=${computedFrom}&to=${computedTo}`,
        [filterPeriod, computedFrom, computedTo],
    );

    const reportUrl = useMemo(
        () => `/api/flow/report?from=${chartFrom}&to=${chartTo}`,
        [chartFrom, chartTo],
    );

    const overview = useLiveData<StageOverview>(overviewUrl, REFRESH_MS, isStageMode);
    const monitor = useLiveData<FlowMonitor>(
        '/api/flow/monitor?status=open',
        REFRESH_MS,
        mode === 'manager',
    );
    const report = useLiveData<FlowReport>(reportUrl, REFRESH_MS * 4);

    const stage = isStageMode ? (overview.data?.stage.key || defaultStage) : null;
    const own = isStageMode ? overview.data : null;
    const error = overview.error || monitor.error || report.error;

    const attention: string[] = [];
    if (own) {
        const summary = own.summary;
        if (summary.incoming > 0) attention.push(words.alertArriving(own.incoming.length));
        const waiting = own.requests.filter((request) => request.status === 'pending');
        const asked = waiting.filter((request) => request.from_stage === own.stage.key).length;
        if (asked > 0) attention.push(words.alertAsked(asked));
        const pending = waiting.length - asked;
        if (pending > 0) attention.push(words.alertRequests(pending));
        const held = own.lots.filter((lot) => lot.held).length;
        if (held > 0) attention.push(words.alertHeld(held));
    } else if (monitor.data) {
        const alerts = monitor.data.alerts;
        if (alerts.held.length) attention.push(words.alertHeld(alerts.held.length));
        const waiting = alerts.awaiting_final_check.reduce((sum, lot) => sum + lot.pieces, 0);
        if (waiting) attention.push(words.alertFinal(waiting));
        if (alerts.stuck_deliveries) attention.push(words.alertStuck(alerts.stuck_deliveries));
        if (alerts.missing_pieces) attention.push(words.alertMissing(alerts.missing_pieces));
    }

    // Isolate chart keys: stage dashboards must ONLY show their own stage, never other departments
    const keys: StageKey[] = isStageMode ? (stage ? [stage] : []) : STAGE_ORDER;
    const recorded = useMemo(() => new Map((report.data?.daily ?? []).map((day) => [day.day, day])), [report.data]);

    const isYearly = filterPeriod === 'yearly' || filterPeriod === 'anualy';

    const chart = useMemo(() => {
        if (isYearly) {
            const year = new Date(chartTo).getFullYear();
            const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthNamesFr = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
            const monthNames = locale === 'fr' ? monthNamesFr : monthNamesEn;

            return Array.from({ length: 12 }, (_, monthIdx) => {
                const monthStr = String(monthIdx + 1).padStart(2, '0');
                const prefix = `${year}-${monthStr}`;

                const stageTotals: Record<string, number> = {};
                let monthTotal = 0;

                keys.forEach((key) => {
                    stageTotals[key] = 0;
                });

                (report.data?.daily ?? []).forEach((d) => {
                    if (d.day.startsWith(prefix)) {
                        keys.forEach((key) => {
                            const good = d[key]?.good ?? 0;
                            const damaged = d[key]?.damaged ?? 0;
                            stageTotals[key] += good;
                            monthTotal += good + damaged;
                        });
                    }
                });

                return {
                    label: monthNames[monthIdx],
                    ...stageTotals,
                    total: monthTotal,
                };
            });
        }

        if (filterPeriod === 'monthly') {
            const start = new Date(chartFrom);
            const end = new Date(chartTo);
            const dates: string[] = [];
            const cur = new Date(start);

            while (cur <= end) {
                dates.push(cur.toLocaleDateString('en-CA'));
                cur.setDate(cur.getDate() + 1);
            }

            return dates.map((date) => {
                const day = recorded.get(date);
                const dayNum = parseInt(date.split('-')[2], 10);
                return {
                    label: String(dayNum),
                    fullDate: format.date(date),
                    ...Object.fromEntries(keys.map((key) => [key, day?.[key]?.good ?? 0])),
                    total: day ? keys.reduce((sum, key) => sum + (day[key]?.good ?? 0) + (day[key]?.damaged ?? 0), 0) : 0,
                };
            });
        }

        if (filterPeriod === 'weekly') {
            const start = new Date(chartFrom);
            const end = new Date(chartTo);
            const dates: string[] = [];
            const cur = new Date(start);

            while (cur <= end) {
                dates.push(cur.toLocaleDateString('en-CA'));
                cur.setDate(cur.getDate() + 1);
            }

            return dates.map((date) => {
                const day = recorded.get(date);
                const d = new Date(date + 'T00:00:00');
                const weekday = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' });
                const dayNum = d.getDate();
                return {
                    label: `${weekday} ${dayNum}`,
                    fullDate: format.date(date),
                    ...Object.fromEntries(keys.map((key) => [key, day?.[key]?.good ?? 0])),
                    total: day ? keys.reduce((sum, key) => sum + (day[key]?.good ?? 0) + (day[key]?.damaged ?? 0), 0) : 0,
                };
            });
        }

        if (filterPeriod === 'daily') {
            const dates: string[] = [];
            const end = new Date(chartTo);
            for (let i = 13; i >= 0; i--) {
                const d = new Date(end);
                d.setDate(end.getDate() - i);
                dates.push(d.toLocaleDateString('en-CA'));
            }

            return dates.map((date) => {
                const day = recorded.get(date);
                const d = new Date(date + 'T00:00:00');
                const dayNum = d.getDate();
                const monthShort = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
                return {
                    label: `${dayNum} ${monthShort}`,
                    fullDate: format.date(date),
                    ...Object.fromEntries(keys.map((key) => [key, day?.[key]?.good ?? 0])),
                    total: day ? keys.reduce((sum, key) => sum + (day[key]?.good ?? 0) + (day[key]?.damaged ?? 0), 0) : 0,
                };
            });
        }

        // Custom
        const start = new Date(chartFrom);
        const end = new Date(chartTo);
        const dates: string[] = [];
        const cur = new Date(start);

        if (end < cur) {
            dates.push(cur.toLocaleDateString('en-CA'));
        } else {
            let count = 0;
            while (cur <= end && count <= 90) {
                dates.push(cur.toLocaleDateString('en-CA'));
                cur.setDate(cur.getDate() + 1);
                count++;
            }
        }

        const isShort = dates.length <= 14;
        return dates.map((date) => {
            const day = recorded.get(date);
            const d = new Date(date + 'T00:00:00');
            const dayNum = d.getDate();
            const monthShort = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
            return {
                label: isShort ? `${dayNum} ${monthShort}` : String(dayNum),
                fullDate: format.date(date),
                ...Object.fromEntries(keys.map((key) => [key, day?.[key]?.good ?? 0])),
                total: day ? keys.reduce((sum, key) => sum + (day[key]?.good ?? 0) + (day[key]?.damaged ?? 0), 0) : 0,
            };
        });
    }, [isYearly, chartFrom, chartTo, keys, report.data, locale, format, recorded, filterPeriod]);

    const hasChart = chart.some((day) => day.total > 0);

    return (
        <section className="ui">
            <div className="page-heading">
                <div>
                    <h1>
                        {isStageMode && stage ? stageLabel(stage, locale) : flowHomeTitle(locale)}
                    </h1>
                    <p>{words.hello(user.name)}</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div
                        style={{
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                            background: 'var(--panel)',
                            padding: '4px 8px',
                            borderRadius: '10px',
                            border: '1px solid var(--line)',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                        }}
                    >
                        <select
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                padding: '6px 8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: 'var(--text)',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="daily">{locale === 'fr' ? "Quotidien (Aujourd'hui)" : 'Daily (Today)'}</option>
                            <option value="weekly">{locale === 'fr' ? 'Hebdomadaire (Cette semaine)' : 'Weekly (This Week)'}</option>
                            <option value="monthly">{locale === 'fr' ? 'Mensuel (Ce mois-ci)' : 'Monthly (This Month)'}</option>
                            <option value="yearly">{locale === 'fr' ? 'Annuel (Cette année)' : 'Annually (This Year)'}</option>
                            <option value="custom">{locale === 'fr' ? 'Période personnalisée' : 'Custom Period'}</option>
                        </select>

                        {filterPeriod === 'custom' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{
                                        border: '1px solid var(--line)',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        background: 'var(--soft)',
                                    }}
                                />
                                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>&rarr;</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{
                                        border: '1px solid var(--line)',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        background: 'var(--soft)',
                                    }}
                                />
                            </div>
                        )}

                        <div style={{ width: '1px', height: '20px', background: 'var(--line)', margin: '0 2px' }} />

                        <button
                            title={locale === 'fr' ? 'Actualiser les données' : 'Refresh live figures'}
                            onClick={() => {
                                overview.reload();
                                report.reload();
                                if (mode === 'manager') monitor.reload();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#eef2ff',
                                color: '#4f46e5',
                                cursor: 'pointer',
                            }}
                        >
                            <RefreshCw size={14} className={overview.loading || report.loading ? 'spin' : ''} />
                        </button>
                    </div>

                    <div className="ui-actions">
                        {isStageMode && stage && (
                            <button
                                className="primary-btn"
                                onClick={() => onNavigate(STAGE_PAGE[stage])}
                            >
                                {words.openStage}
                            </button>
                        )}
                        {!isStageMode && (
                            <button
                                className="primary-btn"
                                onClick={() => onNavigate('production-flow')}
                            >
                                {words.openFlow}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="ui-error">{error}</div>}

            {isStageMode && overview.loading && !overview.data && (
                <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)', marginBottom: 20 }}>
                    <p style={{ margin: 0 }}>{text.loading}</p>
                </div>
            )}

            {own && stage && (
                <div style={{ marginBottom: 24 }}>
                    <div className="ui-kpis eight">
                        {buildKpis(stage, own, text).map((kpi) => {
                            let lbl = kpi.label;
                            if (filterPeriod !== 'daily') {
                                if (lbl.toLowerCase().includes('today')) {
                                    lbl = lbl.replace(/today/gi, rangeLabel);
                                } else if (lbl.toLowerCase().includes("aujourd'hui")) {
                                    lbl = lbl.replace(/aujourd'hui/gi, rangeLabel);
                                }
                            }
                            return (
                                <article
                                    className={`panel ui-kpi ${kpi.alert ? 'alert' : ''}`}
                                    key={kpi.label}
                                >
                                    <small>{lbl}</small>
                                    <strong>{format.whole(kpi.value)}</strong>
                                </article>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Whole project stage cards: ONLY shown for production manager, never on stage dashboards */}
            {mode === 'manager' && monitor.data && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#4f46e5', marginBottom: 8 }}>
                        {words.wholeProject} &mdash; {words.stageCards}
                    </div>
                    <div
                        className="ui-kpis"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                    >
                        {monitor.data.flow.map((row) => (
                            <article className="panel ui-kpi" key={row.key}>
                                <small>{row.label[locale]}</small>
                                <strong>{format.whole(row.here)}</strong>
                                <div className="ui-stage-facts">
                                    <span>{words.arriving} (Input)</span>
                                    <b>{format.whole(row.arriving)}</b>
                                    <span>{words.ready} (Output)</span>
                                    <b>{format.whole(row.ready_to_send)}</b>
                                    <span>{words.waitingQuality}</span>
                                    <b>{format.whole(row.awaiting_quality)}</b>
                                    <span>{words.damaged}</span>
                                    <b className={row.damaged > 0 ? 'alert' : ''}>
                                        {format.whole(row.damaged)}
                                    </b>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            <div className="ui-report-grid">
                <article className="panel">
                    <div className="panel-title">
                        <h2>
                            {filterPeriod === 'daily'
                                ? (locale === 'fr' ? 'Pièces terminées (14 derniers jours)' : 'Pieces finished (Last 14 days)')
                                : (locale === 'fr' ? `Pièces terminées (${rangeLabel})` : `Pieces finished (${rangeLabel})`)}
                        </h2>
                    </div>
                    <div className="ui-chart compact">
                        {hasChart ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chart}
                                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                        stroke="var(--line)"
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'var(--muted)', fontSize: 11 }}
                                        interval={isYearly ? 0 : filterPeriod === 'monthly' ? (chart.length > 25 ? 1 : 0) : filterPeriod === 'daily' ? 1 : 0}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={44}
                                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--panel)',
                                            border: '1px solid var(--line)',
                                            borderRadius: 10,
                                        }}
                                        labelFormatter={(value, payload) => {
                                            return payload?.[0]?.payload?.fullDate || value;
                                        }}
                                    />
                                    {keys.map((key) => (
                                        <Bar
                                            key={key}
                                            dataKey={key}
                                            name={stageLabel(key, locale)}
                                            fill={COLOURS[key]}
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={keys.length > 1 ? 14 : 26}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="ui-empty">
                                {locale === 'fr'
                                    ? 'Aucun travail enregistré pour cette période.'
                                    : 'No work was recorded for this period.'}
                            </div>
                        )}
                    </div>
                </article>

                <article className="panel">
                    <div className="panel-title">
                        <h2>{words.attention}</h2>
                    </div>
                    {attention.length ? (
                        <ul className="ui-alerts">
                            {attention.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="ui-empty">{words.allClear}</div>
                    )}
                </article>
            </div>

            {/* Department Operational Overview Register Table (Same identity and classes as Cutting table) */}
            {own && stage && (
                <article className="panel" style={{ marginTop: 24 }}>
                    <div className="panel-title">
                        <h2>{stageLabel(stage, locale)} &mdash; {locale === 'fr' ? 'Bilan opérationnel' : 'Operational Overview'}</h2>
                        <span className="ui-chip ok" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                            {rangeLabel}
                        </span>
                    </div>

                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ width: '100%', minWidth: 0, tableLayout: 'auto' }}>
                            <thead>
                                <tr>
                                    <th>{locale === 'fr' ? 'Département' : 'Department'}</th>
                                    <th className="num">{locale === 'fr' ? '1. Entrants' : '1. Input'}</th>
                                    <th className="num">{locale === 'fr' ? '2. En cours' : '2. In Progress'}</th>
                                    <th className="num">{locale === 'fr' ? '3. Sortie' : '3. Output'}</th>
                                    <th className="num">{locale === 'fr' ? '4. Défauts' : '4. Damaged'}</th>
                                    <th>{locale === 'fr' ? '5. Qualité' : '5. QC Status'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <b>{stageLabel(stage, locale)}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b>{format.whole(own.summary.incoming)}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b style={{ color: 'var(--brand)' }}>{format.whole(own.summary.in_work)}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b style={{ color: 'var(--ui-good, #16a34a)' }}>{format.whole(own.summary.done_today)}</b>
                                    </td>
                                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                        <b className={own.summary.damaged_today > 0 ? 'alert' : ''}>
                                            {format.whole(own.summary.damaged_today)}
                                        </b>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <span className={`ui-chip ${own.summary.damaged_today === 0 ? 'ok' : 'warn'}`}>
                                            {own.summary.damaged_today === 0 ? '✓ PASSED' : (locale === 'fr' ? 'AUDITÉ' : 'AUDITED')}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {/* Whole Project Operational Register Table (For manager mode) */}
            {mode === 'manager' && monitor.data && (
                <article className="panel" style={{ marginTop: 24 }}>
                    <div className="panel-title">
                        <h2>{locale === 'fr' ? 'Bilan opérationnel des départements' : 'Department Operational Overview'}</h2>
                        <span className="ui-chip ok" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                            {rangeLabel}
                        </span>
                    </div>

                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ width: '100%', minWidth: 0, tableLayout: 'auto' }}>
                            <thead>
                                <tr>
                                    <th>{locale === 'fr' ? 'Département' : 'Department'}</th>
                                    <th className="num">{locale === 'fr' ? '1. Entrants' : '1. Input'}</th>
                                    <th className="num">{locale === 'fr' ? '2. En cours' : '2. In Progress'}</th>
                                    <th className="num">{locale === 'fr' ? '3. Sortie' : '3. Output'}</th>
                                    <th className="num">{locale === 'fr' ? '4. Défauts' : '4. Damaged'}</th>
                                    <th>{locale === 'fr' ? '5. Qualité' : '5. QC Status'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monitor.data.flow.map((row) => (
                                    <tr key={row.key}>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <b>{row.label[locale]}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b>{format.whole(row.arriving)}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b style={{ color: 'var(--brand)' }}>{format.whole(row.here)}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b style={{ color: 'var(--ui-good, #16a34a)' }}>{format.whole(row.ready_to_send)}</b>
                                        </td>
                                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                                            <b className={row.damaged > 0 ? 'alert' : ''}>
                                                {format.whole(row.damaged)}
                                            </b>
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <span className={`ui-chip ${row.damaged === 0 ? 'ok' : 'warn'}`}>
                                                {row.damaged === 0 ? '✓ PASSED' : (locale === 'fr' ? 'AUDITÉ' : 'AUDITED')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}
        </section>
    );
}

const flowHomeTitle = (locale: Locale) =>
    locale === 'fr' ? 'Flux de production' : 'Production flow';
