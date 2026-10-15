import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../../../../components/Modal';
import { makeFormat } from '../../../../core/format';
import type { AuthUser, Locale } from '../../../../core/types';
import '../../../../components/ui.css';
import '../flow.css';
import { stageLabel } from '../stages';
import { flowText } from '../text';
import type { RequestRow, RequestsOverview } from '../types';
import { postJson, useLiveData } from '../../../../core/liveData';
import { monitorText } from '../monitor/monitorText';

type Props = { user: AuthUser; locale: Locale };
type Filter = 'pending' | 'approved' | 'rejected' | 'all';
type Decision = { row: RequestRow; kind: 'approve' | 'reject' };

const FILTERS: Filter[] = ['pending', 'approved', 'rejected', 'all'];
const NOTICE_MS = 7000;

export default function MaterialRequestsPage({ locale }: Props) {
    const text = flowText[locale];
    const words = monitorText[locale].requests;
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const [filter, setFilter] = useState<Filter>('pending');
    const [deciding, setDeciding] = useState<Decision | null>(null);
    const [warehouseId, setWarehouseId] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const {
        data,
        error: loadError,
        loading,
        reload,
    } = useLiveData<RequestsOverview>(`/api/flow/requests?status=${filter}`);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);

        return () => window.clearTimeout(timer);
    }, [notice]);

    const open = (row: RequestRow, kind: Decision['kind']) => {
        setDeciding({ row, kind });
        setWarehouseId('');
        setNote('');
        setError('');
    };

    const submit = async () => {
        if (!deciding) return;
        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/requests/${deciding.row.id}/decision`, {
                decision: deciding.kind,
                warehouse_id: warehouseId ? Number(warehouseId) : null,
                note: note.trim() || null,
            });
            setNotice(deciding.kind === 'approve' ? words.approved : words.declined);
            setDeciding(null);
            reload();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    const canApprove = Boolean(data?.capabilities.approve);

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
                </div>
            </div>

            {loadError && <div className="ui-error">{loadError}</div>}
            {notice && (
                <div className="ui-notice" role="status">
                    <span>{notice}</span>
                </div>
            )}

            <div className="ui-tabs" role="tablist">
                {FILTERS.map((key) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={filter === key}
                        className={filter === key ? 'active' : ''}
                        onClick={() => setFilter(key)}
                    >
                        {words.tabs[key]}
                    </button>
                ))}
            </div>

            <article className="panel">
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 860 }}>
                        <thead>
                            <tr>
                                <th>{words.number}</th>
                                <th>{words.team}</th>
                                <th>{words.item}</th>
                                <th className="num">{words.quantity}</th>
                                <th>{words.stock}</th>
                                <th>{words.status}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data?.requests.length ? (
                                data.requests.map((row) => {
                                    const available = (row.stock ?? []).reduce(
                                        (sum, stock) => sum + stock.available,
                                        0,
                                    );
                                    const short =
                                        row.status === 'pending' && available < row.quantity;

                                    return (
                                        <tr key={row.id}>
                                            <td>
                                                <b>{row.number}</b>
                                                <small>{row.reason}</small>
                                            </td>
                                            <td>
                                                {stageLabel(row.stage, locale)}
                                                <small>
                                                    {row.requested_by ?? text.none} ·{' '}
                                                    {format.dateTime(row.at)}
                                                </small>
                                            </td>
                                            <td>{row.item ?? text.none}</td>
                                            <td className="num">
                                                <b>{format.number(row.quantity)}</b>{' '}
                                                {row.unit ?? ''}
                                            </td>
                                            <td>
                                                {row.status === 'pending' ? (
                                                    <>
                                                        <span
                                                            className={`ui-chip ${short ? 'bad' : 'ok'}`}
                                                        >
                                                            {short
                                                                ? words.notEnough
                                                                : words.lowStock(
                                                                      format.number(available),
                                                                      row.unit ?? '',
                                                                  )}
                                                        </span>
                                                        {(row.stock ?? []).map((stock) => (
                                                            <small key={stock.warehouse_id}>
                                                                {stock.warehouse}:{' '}
                                                                {format.number(stock.available)}
                                                            </small>
                                                        ))}
                                                    </>
                                                ) : (
                                                    (row.warehouse ?? text.none)
                                                )}
                                            </td>
                                            <td>
                                                <span className={`ui-chip ${row.status}`}>
                                                    {text.materials.status_[row.status]}
                                                </span>
                                                {row.decided_by && (
                                                    <small>
                                                        {text.materials.decidedBy(row.decided_by)}
                                                    </small>
                                                )}
                                                {row.decision_note && (
                                                    <small>{row.decision_note}</small>
                                                )}
                                            </td>
                                            <td>
                                                {canApprove && row.status === 'pending' && (
                                                    <div className="ui-row-actions">
                                                        <button
                                                            className="primary-btn"
                                                            disabled={short}
                                                            onClick={() => open(row, 'approve')}
                                                        >
                                                            {words.approve}
                                                        </button>
                                                        <button
                                                            className="ui-link"
                                                            onClick={() => open(row, 'reject')}
                                                        >
                                                            {words.decline}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="empty">
                                        {data ? words.empty : text.loading}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            {deciding && (
                <Modal
                    title={
                        deciding.kind === 'approve'
                            ? words.approveTitle(deciding.row.number)
                            : words.declineTitle(deciding.row.number)
                    }
                    narrow
                    onClose={() => setDeciding(null)}
                    footer={
                        <>
                            <button
                                className="secondary-btn"
                                onClick={() => setDeciding(null)}
                                disabled={busy}
                            >
                                {text.cancel}
                            </button>
                            <button
                                className="primary-btn"
                                onClick={submit}
                                disabled={
                                    busy || (deciding.kind === 'reject' && note.trim().length < 3)
                                }
                            >
                                {busy
                                    ? text.saving
                                    : deciding.kind === 'approve'
                                      ? words.confirmApprove
                                      : words.confirmDecline}
                            </button>
                        </>
                    }
                >
                    {error && <div className="ui-error">{error}</div>}
                    <p className="ui-help" style={{ margin: 0 }}>
                        {deciding.row.item} — {format.number(deciding.row.quantity)}{' '}
                        {deciding.row.unit ?? ''}
                    </p>
                    {deciding.kind === 'approve' ? (
                        <label className="ui-field">
                            {words.warehouse}
                            <select
                                value={warehouseId}
                                onChange={(event) => setWarehouseId(event.target.value)}
                            >
                                <option value="">{words.bestWarehouse}</option>
                                {data?.warehouses.map((warehouse) => (
                                    <option key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <label className="ui-field">
                            {words.reason}
                            <input
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                autoFocus
                            />
                        </label>
                    )}
                </Modal>
            )}
        </section>
    );
}
