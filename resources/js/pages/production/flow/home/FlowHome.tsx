import { useMemo } from 'react';
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

/** The last `count` calendar days, oldest first, as YYYY-MM-DD, so quiet days still show on the chart. */
const lastDays = (count: number) =>
    Array.from({ length: count }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (count - 1 - index));

        return date.toLocaleDateString('en-CA');
    });

const range = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 13);

    return `from=${from.toLocaleDateString('en-CA')}&to=${to.toLocaleDateString('en-CA')}`;
};

/** The home page of a stage team, production manager or quality officer: live figures from the production flow. */
export default function FlowHome({ user, locale, onNavigate, mode }: Props) {
    const text = flowText[locale];
    const words = homeText[locale];
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const period = useMemo(range, []);

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
    const overview = useLiveData<StageOverview>('/api/flow/overview', REFRESH_MS, isStageMode);
    const monitor = useLiveData<FlowMonitor>(
        '/api/flow/monitor?status=open',
        REFRESH_MS,
        mode === 'manager',
    );
    const report = useLiveData<FlowReport>(`/api/flow/report?${period}`, REFRESH_MS * 4);

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
    const recorded = new Map((report.data?.daily ?? []).map((day) => [day.day, day]));
    const chart = lastDays(14).map((date) => {
        const day = recorded.get(date);

        return {
            label: format.date(date).replace(/\s\d{4}$/, ''),
            ...Object.fromEntries(keys.map((key) => [key, day?.[key]?.good ?? 0])),
            total: day ? keys.reduce((sum, key) => sum + (day[key]?.good ?? 0) + (day[key]?.damaged ?? 0), 0) : 0,
        };
    });
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

            {error && <div className="ui-error">{error}</div>}

            {isStageMode && overview.loading && !overview.data && (
                <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)', marginBottom: 20 }}>
                    <p style={{ margin: 0 }}>{text.loading}</p>
                </div>
            )}

            {own && stage && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 8 }}>
                        {words.deptOverview} &mdash; {stageLabel(stage, locale)}
                    </div>
                    <div className="ui-kpis eight">
                        {buildKpis(stage, own, text).map((kpi) => (
                            <article
                                className={`panel ui-kpi ${kpi.alert ? 'alert' : ''}`}
                                key={kpi.label}
                            >
                                <small>{kpi.label}</small>
                                <strong>{format.whole(kpi.value)}</strong>
                            </article>
                        ))}
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
                        <h2>{words.chartTitle}</h2>
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
                                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                        interval={1}
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
                            <div className="ui-empty">{words.chartEmpty}</div>
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
        </section>
    );
}

const flowHomeTitle = (locale: Locale) =>
    locale === 'fr' ? 'Flux de production' : 'Production flow';
