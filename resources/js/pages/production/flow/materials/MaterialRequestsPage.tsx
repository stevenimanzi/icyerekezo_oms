import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import '../../../../components/ui.css';
import { makeFormat } from '../../../../core/format';
import { postJson, useLiveData } from '../../../../core/liveData';
import type { AuthUser, Locale } from '../../../../core/types';
import '../flow.css';
import { flowText } from '../text';
import type { RequestsOverview, StageKey } from '../types';
import { NewRequestModal } from './NewRequestModal';

type Props = { user: AuthUser; locale: Locale; stage: StageKey };
type Status = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';

const STATUSES: Status[] = ['all', 'pending', 'approved', 'rejected', 'cancelled'];
const NOTICE_MS = 7000;
const SEARCH_DELAY_MS = 350;

/** A team's material requests to the warehouse: ask for something new and follow every earlier request. */
export default function MaterialRequestsPage({ locale, stage }: Props) {
    const text = flowText[locale];
    const copy = text.requestsPage;
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const [status, setStatus] = useState<Status>('all');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [creating, setCreating] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    const params = new URLSearchParams({ stage, status });
    if (query) params.set('q', query);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const {
        data,
        error: loadError,
        loading,
        reload,
    } = useLiveData<RequestsOverview>(`/api/flow/requests?${params.toString()}`);

    const filtered = status !== 'all' || query !== '' || from !== '' || to !== '';
    const counts = data?.counts;

    const cancel = async (id: number) => {
        setError('');
        try {
            await postJson(`/api/flow/requests/${id}/cancel`);
            setNotice(text.materials.status_.cancelled);
            reload();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        }
    };

    const kpis = counts
        ? [
              { label: copy.kpiWaiting, value: counts.pending },
              { label: copy.kpiApproved, value: counts.approved },
              { label: copy.kpiDeclined, value: counts.rejected, alert: counts.rejected > 0 },
              { label: copy.kpiAll, value: counts.all },
          ]
        : [];

    return (
        <section className="ui">
            <div className="page-heading">
                <div>
                    <h1>{copy.title}</h1>
                    <p>{copy.subtitle}</p>
                </div>
                <div className="ui-actions">
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        <RefreshCw size={15} />
                        {text.refresh}
                    </button>
                    {data?.capabilities.request && (
                        <button className="primary-btn" onClick={() => setCreating(true)}>
                            + {copy.newRequest}
                        </button>
                    )}
                </div>
            </div>

            {(loadError || error) && <div className="ui-error">{loadError || error}</div>}
            {notice && (
                <div className="ui-notice" role="status">
                    <span>{notice}</span>
                </div>
            )}

            <div className="ui-kpis">
                {kpis.map((kpi) => (
                    <article className={`panel ui-kpi ${kpi.alert ? 'alert' : ''}`} key={kpi.label}>
                        <small>{kpi.label}</small>
                        <strong>{format.whole(kpi.value)}</strong>
                    </article>
                ))}
            </div>

            <article className="panel">
                <div className="ui-toolbar">
                    <label>
                        {copy.status}
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value as Status)}
                        >
                            {STATUSES.map((key) => (
                                <option key={key} value={key}>
                                    {key === 'all' ? copy.allStatuses : text.materials.status_[key]}
                                    {counts ? ` (${counts[key]})` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        {copy.from}
                        <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(event) => setFrom(event.target.value)}
                        />
                    </label>
                    <label>
                        {copy.to}
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(event) => setTo(event.target.value)}
                        />
                    </label>
                    <label className="grow">
                        <input
                            value={search}
                            placeholder={copy.search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </label>
                    {filtered && (
                        <button
                            className="secondary-btn"
                            onClick={() => {
                                setStatus('all');
                                setSearch('');
                                setFrom('');
                                setTo('');
                            }}
                        >
                            {copy.clear}
                        </button>
                    )}
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 860 }}>
                        <thead>
                            <tr>
                                <th>{text.materials.number}</th>
                                <th>{copy.item}</th>
                                <th className="num">{copy.quantity}</th>
                                <th>{copy.reason}</th>
                                <th>{copy.status}</th>
                                <th>{copy.answer}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data?.requests.length ? (
                                data.requests.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <b>{row.number}</b>
                                            <small>
                                                {format.dateTime(row.at)} ·{' '}
                                                {row.requested_by ?? text.none}
                                            </small>
                                        </td>
                                        <td>{row.item ?? text.none}</td>
                                        <td className="num">
                                            <b>{format.number(row.quantity)}</b> {row.unit ?? ''}
                                        </td>
                                        <td>{row.reason}</td>
                                        <td>
                                            <span className={`ui-chip ${row.status}`}>
                                                {text.materials.status_[row.status]}
                                            </span>
                                        </td>
                                        <td>
                                            {row.status === 'pending' ? (
                                                <small>{copy.waitingAnswer}</small>
                                            ) : (
                                                <>
                                                    {row.decided_by
                                                        ? text.materials.decidedBy(row.decided_by)
                                                        : text.none}
                                                    {row.decided_at && (
                                                        <small>
                                                            {format.dateTime(row.decided_at)}
                                                        </small>
                                                    )}
                                                    {row.status === 'approved' && row.warehouse && (
                                                        <small>
                                                            {copy.takenFrom(row.warehouse)}
                                                        </small>
                                                    )}
                                                    {row.decision_note && (
                                                        <small>{row.decision_note}</small>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td>
                                            {row.status === 'pending' && row.own && (
                                                <button
                                                    className="ui-link"
                                                    onClick={() => cancel(row.id)}
                                                >
                                                    {text.materials.cancel}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="empty">
                                        {!data
                                            ? text.loading
                                            : filtered
                                              ? copy.empty
                                              : copy.emptyFirst}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            {creating && data && (
                <NewRequestModal
                    stage={stage}
                    options={data.options}
                    text={text}
                    onClose={() => setCreating(false)}
                    onDone={(message) => {
                        setCreating(false);
                        setNotice(message);
                        reload();
                    }}
                />
            )}
        </section>
    );
}
