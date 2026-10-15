import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { EntryRow, StageOverview } from '../types';
import { postFlow } from '../useFlowData';

type Props = {
    data: StageOverview;
    locale: Locale;
    text: FlowText;
    format: Format;
    onChanged: (message: string) => void;
};

export function HistoryTab({ data, locale, text, format, onChanged }: Props) {
    const t = text.history;
    const [voiding, setVoiding] = useState<EntryRow | null>(null);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const voidEntry = async () => {
        if (!voiding) return;
        setBusy(true);
        setError('');
        try {
            await postFlow(`/api/flow/entries/${voiding.id}/void`, { reason: reason.trim() });
            setVoiding(null);
            setReason('');
            onChanged(t.cancelTitle);
        } catch (reasonError) {
            setError(reasonError instanceof Error ? reasonError.message : '');
        } finally {
            setBusy(false);
        }
    };

    const takeBack = async (id: number) => {
        setError('');
        try {
            await postFlow(`/api/flow/transfers/${id}/cancel`);
            onChanged(t.takeBack);
        } catch (reasonError) {
            setError(reasonError instanceof Error ? reasonError.message : '');
        }
    };

    const isCutting = data.stage.key === 'cutting';
    const canWork = data.capabilities.work;

    return (
        <>
            {error && !voiding && <div className="ui-error">{error}</div>}

            <article className="panel">
                <div className="panel-title">
                    <h2>{t.recordsTitle}</h2>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 700 }}>
                        <thead>
                            <tr>
                                <th>{t.date}</th>
                                <th>{t.lot}</th>
                                <th className="num">{t.good}</th>
                                <th className="num">{t.damaged}</th>
                                {isCutting && <th>{t.fabric}</th>}
                                <th>{t.by}</th>
                                <th>{t.note}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data.entries.length ? (
                                data.entries.map((entry) => (
                                    <tr key={entry.id} className={entry.voided ? 'ui-struck' : ''}>
                                        <td>{format.date(entry.date)}</td>
                                        <td>
                                            <b>{entry.lot_number ?? text.none}</b>
                                        </td>
                                        <td className="num">{format.whole(entry.good)}</td>
                                        <td className="num">{format.whole(entry.damaged)}</td>
                                        {isCutting && (
                                            <td>
                                                {entry.fabric ?? text.none}
                                                {entry.fabric_used > 0 && (
                                                    <small>
                                                        {format.number(entry.fabric_used)}
                                                        {entry.fabric_waste > 0
                                                            ? ` + ${format.number(entry.fabric_waste)}`
                                                            : ''}
                                                    </small>
                                                )}
                                            </td>
                                        )}
                                        <td>
                                            {entry.by ?? text.none}
                                            <small>{format.dateTime(entry.at)}</small>
                                        </td>
                                        <td>
                                            {entry.voided
                                                ? t.cancelled(entry.void_reason ?? '')
                                                : (entry.note ?? text.none)}
                                        </td>
                                        <td>
                                            {canWork && entry.can_void && !entry.voided && (
                                                <button
                                                    className="ui-link"
                                                    onClick={() => setVoiding(entry)}
                                                >
                                                    {t.cancelRecord}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={isCutting ? 8 : 7} className="empty">
                                        {t.recordsEmpty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            <article className="panel">
                <div className="panel-title">
                    <h2>{t.deliveriesTitle}</h2>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 760 }}>
                        <thead>
                            <tr>
                                <th>{t.lot}</th>
                                <th>{t.direction}</th>
                                <th className="num">{t.sentQty}</th>
                                <th className="num">{t.receivedQty}</th>
                                <th>{t.status}</th>
                                <th>{t.by}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data.transfers.length ? (
                                data.transfers.map((transfer) => {
                                    const missing =
                                        transfer.status === 'received'
                                            ? transfer.quantity_sent -
                                              (transfer.quantity_received ?? 0)
                                            : 0;

                                    return (
                                        <tr key={transfer.id}>
                                            <td>
                                                <b>{transfer.lot_number}</b>
                                                <small>
                                                    {[
                                                        transfer.product,
                                                        transfer.color,
                                                        transfer.size,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </small>
                                            </td>
                                            <td>
                                                {transfer.direction === 'in'
                                                    ? t.incoming
                                                    : t.outgoing}
                                                <small>
                                                    {stageLabel(transfer.from, locale)} →{' '}
                                                    {stageLabel(transfer.to, locale)}
                                                </small>
                                            </td>
                                            <td className="num">
                                                {format.whole(transfer.quantity_sent)}
                                            </td>
                                            <td className="num">
                                                {transfer.quantity_received === null
                                                    ? text.none
                                                    : format.whole(transfer.quantity_received)}
                                            </td>
                                            <td>
                                                <span className={`ui-chip ${transfer.status}`}>
                                                    {t.transferStatus[transfer.status]}
                                                </span>
                                                {missing > 0 && <small>{t.missing(missing)}</small>}
                                                {transfer.receive_note && (
                                                    <small>{transfer.receive_note}</small>
                                                )}
                                            </td>
                                            <td>
                                                {transfer.sent_by ?? text.none}
                                                <small>{format.dateTime(transfer.sent_at)}</small>
                                            </td>
                                            <td>
                                                {canWork &&
                                                    transfer.direction === 'out' &&
                                                    transfer.status === 'sent' && (
                                                        <button
                                                            className="ui-link"
                                                            onClick={() => takeBack(transfer.id)}
                                                        >
                                                            {t.takeBack}
                                                        </button>
                                                    )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="empty">
                                        {t.deliveriesEmpty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            {voiding && (
                <Modal
                    title={t.cancelTitle}
                    narrow
                    onClose={() => setVoiding(null)}
                    footer={
                        <>
                            <button
                                className="secondary-btn"
                                onClick={() => setVoiding(null)}
                                disabled={busy}
                            >
                                {t.keep}
                            </button>
                            <button
                                className="primary-btn"
                                onClick={voidEntry}
                                disabled={busy || reason.trim().length < 3}
                            >
                                {busy ? text.saving : t.confirmCancel}
                            </button>
                        </>
                    }
                >
                    {error && <div className="ui-error">{error}</div>}
                    <span className="ui-help">{t.cancelHint}</span>
                    <label className="ui-field">
                        {t.cancelReason}
                        <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            autoFocus
                        />
                    </label>
                </Modal>
            )}
        </>
    );
}
