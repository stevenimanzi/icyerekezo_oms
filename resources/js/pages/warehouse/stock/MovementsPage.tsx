import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import '../../../components/ui.css';
import { makeFormat } from '../../../core/format';
import { useLiveData } from '../../../core/liveData';
import type { AuthUser, Locale } from '../../../core/types';
import { RecordIssueModal } from './RecordIssueModal';
import { RecordReceiptModal } from './RecordReceiptModal';
import { stockText } from './text';
import type { MovementsResponse } from './types';

type Props = {
    user: AuthUser;
    locale: Locale;
    direction: 'in' | 'out';
    tabs?: ReactNode;
    alternate?: ReactNode;
};

const PERIODS = [7, 30, 90] as const;
const NOTICE_MS = 7000;
const SEARCH_DELAY_MS = 350;

const isoDay = (date: Date) => date.toLocaleDateString('en-CA');

/** One page for stock in and stock out: figures, filters, history and the form to record a new movement. */
export default function MovementsPage({ user, locale, direction, tabs, alternate }: Props) {
    const text = stockText[locale];
    const copy = direction === 'in' ? text.stockIn : text.stockOut;
    const format = useMemo(
        () => makeFormat(locale, user.current_factory?.currency_code ?? ''),
        [locale, user],
    );
    const [days, setDays] = useState<number>(30);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQuery(search.trim());
            setPage(1);
        }, SEARCH_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    const range = useMemo(() => {
        const start = new Date();
        start.setDate(start.getDate() - (days - 1));

        return { from: isoDay(start), to: isoDay(new Date()) };
    }, [days]);

    const url = `/api/stock/movements?direction=${direction}&from=${range.from}&to=${range.to}&q=${encodeURIComponent(query)}&page=${page}`;
    const { data, error, loading, reload } = useLiveData<MovementsResponse>(url);

    const permission = direction === 'in' ? 'inventory.receive' : 'inventory.issue';
    const canRecord = user.permissions.includes('*') || user.permissions.includes(permission);
    const typeLabels = copy.typeLabels;

    const done = (message: string) => {
        setModal(false);
        setNotice(message);
        reload();
    };

    const kpis = data
        ? [
              { label: copy.kpiToday, value: format.whole(data.summary.today) },
              { label: copy.kpiEntries, value: format.whole(data.summary.entries) },
              { label: copy.kpiItems, value: format.whole(data.summary.items) },
              { label: copy.kpiValue, value: format.money(data.summary.value) },
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
                    {canRecord && (
                        <button
                            className="primary-btn"
                            onClick={() => setModal(true)}
                            disabled={!data}
                        >
                            + {copy.record}
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

            {tabs}

            {alternate ?? (
                <>
                    <div className="ui-kpis">
                        {kpis.map((kpi) => (
                            <article className="panel ui-kpi" key={kpi.label}>
                                <small>{kpi.label}</small>
                                <strong>{kpi.value}</strong>
                            </article>
                        ))}
                    </div>

                    <article className="panel">
                        <div className="ui-toolbar">
                            <label>
                                {text.filters.period}
                                <select
                                    value={days}
                                    onChange={(event) => {
                                        setDays(Number(event.target.value));
                                        setPage(1);
                                    }}
                                >
                                    {PERIODS.map((value) => (
                                        <option key={value} value={value}>
                                            {value === 7
                                                ? text.filters.last7
                                                : value === 30
                                                  ? text.filters.last30
                                                  : text.filters.last90}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grow">
                                <input
                                    value={search}
                                    placeholder={text.filters.search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </label>
                        </div>
                        <div className="ui-table-wrap">
                            <table className="ui-table" style={{ minWidth: 860 }}>
                                <thead>
                                    <tr>
                                        <th>{text.table.date}</th>
                                        <th>{text.table.item}</th>
                                        <th>{text.table.type}</th>
                                        <th className="num">{text.table.quantity}</th>
                                        <th className="num">{text.table.value}</th>
                                        <th>{text.table.warehouse}</th>
                                        <th>{text.table.details}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.movements.data.length ? (
                                        data.movements.data.map((row) => (
                                            <tr key={row.id}>
                                                <td>
                                                    {format.dateTime(row.at)}
                                                    <small>{row.by ?? text.none}</small>
                                                </td>
                                                <td>
                                                    <b>{row.item ?? text.none}</b>
                                                    <small>
                                                        {row.color && (
                                                            <span className="ui-colour">
                                                                {row.color}
                                                            </span>
                                                        )}{' '}
                                                        {row.sku}
                                                    </small>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`ui-chip ${direction === 'in' ? 'ok' : row.type === 'waste' ? 'bad' : 'warn'}`}
                                                    >
                                                        {typeLabels[row.type] ?? row.type}
                                                    </span>
                                                </td>
                                                <td className="num">
                                                    <b>{format.number(row.quantity)}</b>{' '}
                                                    {row.unit ?? ''}
                                                </td>
                                                <td className="num">{format.money(row.value)}</td>
                                                <td>{row.warehouse ?? text.none}</td>
                                                <td>
                                                    {row.supplier && (
                                                        <b>{text.stockIn.from(row.supplier)}</b>
                                                    )}
                                                    {row.supplier ? (
                                                        <small>{row.note}</small>
                                                    ) : (
                                                        (row.note ?? text.none)
                                                    )}
                                                    {row.batch && (
                                                        <small>
                                                            {text.table.batch}: {row.batch}
                                                            {row.expires_on
                                                                ? ` · ${text.table.expires} ${format.date(row.expires_on)}`
                                                                : ''}
                                                        </small>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="empty">
                                                {data ? copy.empty : text.loading}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {data && data.movements.last_page > 1 && (
                            <div className="ui-pager">
                                <button
                                    className="secondary-btn"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    {text.previous}
                                </button>
                                <span>
                                    {text.pageOf(
                                        data.movements.current_page,
                                        data.movements.last_page,
                                    )}
                                </span>
                                <button
                                    className="secondary-btn"
                                    disabled={page >= data.movements.last_page}
                                    onClick={() => setPage(page + 1)}
                                >
                                    {text.next}
                                </button>
                            </div>
                        )}
                    </article>
                </>
            )}

            {modal && data && direction === 'in' && (
                <RecordReceiptModal
                    data={data}
                    text={text}
                    onClose={() => setModal(false)}
                    onDone={done}
                />
            )}
            {modal && data && direction === 'out' && (
                <RecordIssueModal
                    data={data}
                    text={text}
                    format={format}
                    onClose={() => setModal(false)}
                    onDone={done}
                />
            )}
        </section>
    );
}
