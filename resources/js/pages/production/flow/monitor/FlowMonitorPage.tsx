import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { makeFormat } from '../../../../core/format';
import type { AuthUser, Locale } from '../../../../core/types';
import '../../../../components/ui.css';
import '../flow.css';
import { FlowReportView } from '../report/FlowReportView';
import { stageLabel } from '../stages';
import { flowText } from '../text';
import type { FlowMonitor, LotBalances } from '../types';
import { useLiveData } from '../../../../core/liveData';
import { InspectModal } from './InspectModal';
import { LotDetailModal } from './LotDetailModal';
import { monitorText } from './monitorText';

type Props = { user: AuthUser; locale: Locale };
type Tab = 'monitor' | 'report';
type Status = 'open' | 'held' | 'completed' | 'all';

const STATUSES: Status[] = ['open', 'held', 'completed', 'all'];
const NOTICE_MS = 7000;
const SEARCH_DELAY_MS = 350;

export default function FlowMonitorPage({ locale }: Props) {
    const text = flowText[locale];
    const words = monitorText[locale];
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const [tab, setTab] = useState<Tab>('monitor');
    const [status, setStatus] = useState<Status>('open');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [openLot, setOpenLot] = useState<number | null>(null);
    const [inspecting, setInspecting] = useState<{ lotId?: number; balances?: LotBalances } | null>(
        null,
    );
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    const url = `/api/flow/monitor?status=${status}&q=${encodeURIComponent(query)}`;
    const { data, error, loading, reload } = useLiveData<FlowMonitor>(url);

    const changed = (message: string) => {
        setNotice(message);
        reload();
    };

    const alerts = data
        ? [
              ...data.alerts.held.map((row) => ({
                  key: `held-${row.id}`,
                  lotId: row.id,
                  message: words.alertHeld(row.lot_number, row.reason ?? ''),
              })),
              ...data.alerts.awaiting_final_check.map((row) => ({
                  key: `final-${row.id}`,
                  lotId: row.id,
                  message: words.alertFinal(row.lot_number, row.pieces),
              })),
              ...data.alerts.idle_lots.map((row) => ({
                  key: `idle-${row.id}`,
                  lotId: row.id,
                  message: words.alertIdle(row.lot_number, row.idle_days),
              })),
              ...(data.alerts.stuck_deliveries > 0
                  ? [
                        {
                            key: 'stuck',
                            lotId: null,
                            message: words.alertStuck(data.alerts.stuck_deliveries),
                        },
                    ]
                  : []),
              ...(data.alerts.missing_pieces > 0
                  ? [
                        {
                            key: 'missing',
                            lotId: null,
                            message: words.alertMissing(data.alerts.missing_pieces),
                        },
                    ]
                  : []),
          ]
        : [];

    return (
        <section className="ui">
            <div className="page-heading">
                <div>
                    <h1>{words.title}</h1>
                    <p>{words.subtitle}</p>
                </div>
                <div className="ui-actions">
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        <RefreshCw size={15} />
                        {text.refresh}
                    </button>
                    {data?.capabilities.inspect && (
                        <button className="primary-btn" onClick={() => setInspecting({})}>
                            + {words.check}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="ui-error">{error}</div>}
            {notice && (
                <div className="ui-notice" role="status">
                    <span>{notice}</span>
                </div>
            )}

            <div className="ui-tabs" role="tablist">
                {(['monitor', 'report'] as Tab[]).map((key) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        className={tab === key ? 'active' : ''}
                        onClick={() => setTab(key)}
                    >
                        {words.tabs[key]}
                    </button>
                ))}
            </div>

            {tab === 'report' && <FlowReportView locale={locale} text={text} format={format} />}

            {tab === 'monitor' && data && (
                <>
                    <div
                        className="ui-kpis six"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                    >
                        {data.flow.map((stage) => (
                            <article className="panel ui-kpi" key={stage.key}>
                                <small>{stage.label[locale]}</small>
                                <strong>{format.whole(stage.here)}</strong>
                                <div className="ui-stage-facts">
                                    <span>{words.arriving}</span>
                                    <b>{format.whole(stage.arriving)}</b>
                                    <span>{words.ready}</span>
                                    <b>{format.whole(stage.ready_to_send)}</b>
                                    <span>{words.awaiting}</span>
                                    <b>{format.whole(stage.awaiting_quality)}</b>
                                    <span>{words.damaged}</span>
                                    <b className={stage.damaged > 0 ? 'alert' : ''}>
                                        {format.whole(stage.damaged)}
                                    </b>
                                    <span>{words.rejected}</span>
                                    <b className={stage.rejected > 0 ? 'alert' : ''}>
                                        {format.whole(stage.rejected)}
                                    </b>
                                    <span>{words.shortage}</span>
                                    <b className={stage.shortage > 0 ? 'alert' : ''}>
                                        {format.whole(stage.shortage)}
                                    </b>
                                </div>
                            </article>
                        ))}
                    </div>

                    <article className="panel">
                        <div className="panel-title">
                            <h2>{words.alertsTitle}</h2>
                        </div>
                        {alerts.length ? (
                            <ul className="ui-alerts">
                                {alerts.map((alert) => (
                                    <li key={alert.key}>
                                        <span>{alert.message}</span>
                                        {alert.lotId !== null && (
                                            <button
                                                className="ui-link"
                                                onClick={() => setOpenLot(alert.lotId)}
                                            >
                                                {words.open}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="ui-empty">{words.alertsNone}</div>
                        )}
                    </article>

                    <article className="panel">
                        <div className="panel-title">
                            <h2>{words.lotsTitle}</h2>
                        </div>
                        <div className="ui-toolbar">
                            <label>
                                {words.filters.status}
                                <select
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value as Status)}
                                >
                                    {STATUSES.map((key) => (
                                        <option key={key} value={key}>
                                            {words.filters[key]}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grow">
                                <input
                                    value={search}
                                    placeholder={words.filters.search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </label>
                        </div>
                        <div className="ui-table-wrap">
                            <table className="ui-table" style={{ minWidth: 960 }}>
                                <thead>
                                    <tr>
                                        <th>{words.lot}</th>
                                        <th>{words.product}</th>
                                        {data.stages.map((stage) => (
                                            <th key={stage.key} className="num">
                                                {stageLabel(stage.key, locale)}
                                            </th>
                                        ))}
                                        <th className="num">{words.finished}</th>
                                        <th className="num">{words.damaged}</th>
                                        <th>{words.status}</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.lots.length ? (
                                        data.lots.map((lot) => (
                                            <tr key={lot.id}>
                                                <td>
                                                    <b>{lot.lot_number}</b>
                                                    <small>
                                                        {words.cut}: {format.whole(lot.cut)} ·{' '}
                                                        {words.age}: {words.days(lot.age_days)}
                                                    </small>
                                                </td>
                                                <td>
                                                    {lot.product ?? text.none}
                                                    <small>
                                                        {[lot.color, lot.size]
                                                            .filter(Boolean)
                                                            .join(' / ')}
                                                    </small>
                                                </td>
                                                {data.stages.map((stage) => (
                                                    <td key={stage.key} className="num">
                                                        {format.whole(lot.stages[stage.key].here)}
                                                        {lot.stages[stage.key].arriving > 0 && (
                                                            <small>
                                                                +
                                                                {format.whole(
                                                                    lot.stages[stage.key].arriving,
                                                                )}
                                                            </small>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="num">
                                                    <b>{format.whole(lot.finished)}</b>
                                                </td>
                                                <td className="num">
                                                    {format.whole(lot.damaged + lot.rejected)}
                                                    {lot.shortage > 0 && (
                                                        <small>
                                                            {words.shortage}:{' '}
                                                            {format.whole(lot.shortage)}
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`ui-chip ${lot.status === 'held' ? 'bad' : lot.status === 'completed' ? 'ok' : 'warn'}`}
                                                    >
                                                        {words.statusLabels[lot.status]}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="ui-link"
                                                        onClick={() => setOpenLot(lot.id)}
                                                    >
                                                        {words.open}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={data.stages.length + 5} className="empty">
                                                {words.lotsEmpty}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>

                    <article className="panel">
                        <div className="panel-title">
                            <h2>{words.checksTitle}</h2>
                        </div>
                        <div className="ui-table-wrap">
                            <table className="ui-table" style={{ minWidth: 760 }}>
                                <thead>
                                    <tr>
                                        <th>{words.number}</th>
                                        <th>{words.lot}</th>
                                        <th>{words.stage}</th>
                                        <th className="num">{words.inspected}</th>
                                        <th className="num">{words.passed}</th>
                                        <th className="num">{words.rejected}</th>
                                        <th>{words.result}</th>
                                        <th>{words.who}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.inspections.length ? (
                                        data.inspections.map((row) => (
                                            <tr key={row.id}>
                                                <td>
                                                    <b>{row.number}</b>
                                                    <small>{format.dateTime(row.at)}</small>
                                                </td>
                                                <td>{row.lot_number}</td>
                                                <td>{stageLabel(row.stage, locale)}</td>
                                                <td className="num">
                                                    {format.whole(row.inspected)}
                                                </td>
                                                <td className="num">{format.whole(row.passed)}</td>
                                                <td className="num">
                                                    {format.whole(row.rejected)}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`ui-chip ${row.result === 'passed' ? 'ok' : row.result === 'failed' ? 'bad' : 'warn'}`}
                                                    >
                                                        {words.results[row.result] ?? row.result}
                                                    </span>
                                                    {row.defects && <small>{row.defects}</small>}
                                                </td>
                                                <td>{row.who ?? text.none}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="empty">
                                                {words.checksEmpty}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </>
            )}

            {openLot !== null && data && (
                <LotDetailModal
                    lotId={openLot}
                    canInspect={data.capabilities.inspect}
                    locale={locale}
                    text={text}
                    words={words}
                    format={format}
                    onClose={() => setOpenLot(null)}
                    onInspect={(lotId, balances) => {
                        setOpenLot(null);
                        setInspecting({ lotId, balances });
                    }}
                    onChanged={changed}
                />
            )}

            {inspecting && data && (
                <InspectModal
                    lots={data.lots.filter((lot) => lot.status !== 'cancelled')}
                    initialLot={inspecting.lotId}
                    balances={inspecting.balances}
                    locale={locale}
                    text={text}
                    words={words}
                    onClose={() => setInspecting(null)}
                    onDone={(message) => {
                        setInspecting(null);
                        changed(message);
                    }}
                />
            )}
        </section>
    );
}
