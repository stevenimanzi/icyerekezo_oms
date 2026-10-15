import { useState } from 'react';
import type { Format } from '../../../../core/format';
import type { Locale } from '../../../../core/types';
import type { FlowText } from '../text';
import type { StageOverview } from '../types';
import { postJson } from '../../../../core/liveData';

type Props = {
    data: StageOverview;
    locale: Locale;
    text: FlowText;
    format: Format;
    onChanged: (message: string) => void;
};

export function MaterialsTab({ data, text, format, onChanged }: Props) {
    const t = text.materials;
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const request = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ request: { request_number: string } }>(
                '/api/flow/requests',
                {
                    stage: data.stage.key,
                    item_id: Number(itemId),
                    quantity: Number(quantity),
                    reason: reason.trim(),
                },
            );
            setItemId('');
            setQuantity('');
            setReason('');
            onChanged(t.sent(result.request.request_number));
        } catch (reasonError) {
            setError(reasonError instanceof Error ? reasonError.message : '');
        } finally {
            setBusy(false);
        }
    };

    const cancel = async (id: number) => {
        setError('');
        try {
            await postJson(`/api/flow/requests/${id}/cancel`);
            onChanged(t.status_.cancelled);
        } catch (reasonError) {
            setError(reasonError instanceof Error ? reasonError.message : '');
        }
    };

    const canAsk = data.capabilities.work;

    return (
        <>
            {error && <div className="ui-error">{error}</div>}

            <div className="ui-report-grid">
                <article className="panel">
                    <div className="panel-title">
                        <h2>{t.onHandTitle}</h2>
                    </div>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 420 }}>
                            <thead>
                                <tr>
                                    <th>{t.item}</th>
                                    <th className="num">{t.issued}</th>
                                    <th className="num">{t.used}</th>
                                    <th className="num">{t.left}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.materials.length ? (
                                    data.materials.map((material) => (
                                        <tr key={material.item_id}>
                                            <td>
                                                <b>{material.name}</b>
                                                <small>{material.unit ?? text.none}</small>
                                            </td>
                                            <td className="num">
                                                {format.number(material.issued)}
                                            </td>
                                            <td className="num">{format.number(material.used)}</td>
                                            <td className="num">
                                                <b>{format.number(material.on_hand)}</b>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="empty">
                                            {t.onHandEmpty}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>

                {canAsk && (
                    <article className="panel">
                        <div className="panel-title">
                            <h2>{t.requestTitle}</h2>
                        </div>
                        <div className="ui-dialog-body">
                            <span className="ui-help">{t.requestHint}</span>
                            <label className="ui-field">
                                {t.requestItem}
                                <select
                                    value={itemId}
                                    onChange={(event) => setItemId(event.target.value)}
                                >
                                    <option value="">{t.chooseItem}</option>
                                    {data.options.requestable.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                            {item.unit ? ` (${item.unit})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="ui-field">
                                {t.quantity}
                                <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={quantity}
                                    onChange={(event) => setQuantity(event.target.value)}
                                />
                            </label>
                            <label className="ui-field">
                                {t.reason}
                                <input
                                    value={reason}
                                    placeholder={t.reasonHint}
                                    onChange={(event) => setReason(event.target.value)}
                                />
                            </label>
                            <button
                                className="primary-btn"
                                onClick={request}
                                disabled={
                                    busy ||
                                    !itemId ||
                                    !(Number(quantity) > 0) ||
                                    reason.trim().length < 3
                                }
                            >
                                {busy ? text.saving : t.send}
                            </button>
                        </div>
                    </article>
                )}
            </div>

            <article className="panel">
                <div className="panel-title">
                    <h2>{t.listTitle}</h2>
                </div>
                <div className="ui-table-wrap">
                    <table className="ui-table" style={{ minWidth: 640 }}>
                        <thead>
                            <tr>
                                <th>{t.number}</th>
                                <th>{t.item}</th>
                                <th className="num">{t.quantity}</th>
                                <th>{t.status}</th>
                                <th>{t.when}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data.requests.length ? (
                                data.requests.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <b>{row.number}</b>
                                            <small>{row.reason}</small>
                                        </td>
                                        <td>{row.item ?? text.none}</td>
                                        <td className="num">
                                            {format.number(row.quantity)} {row.unit ?? ''}
                                        </td>
                                        <td>
                                            <span className={`ui-chip ${row.status}`}>
                                                {t.status_[row.status]}
                                            </span>
                                            {row.decided_by && (
                                                <small>{t.decidedBy(row.decided_by)}</small>
                                            )}
                                            {row.decision_note && (
                                                <small>{row.decision_note}</small>
                                            )}
                                        </td>
                                        <td>{format.dateTime(row.at)}</td>
                                        <td>
                                            {row.status === 'pending' && row.own && (
                                                <button
                                                    className="ui-link"
                                                    onClick={() => cancel(row.id)}
                                                >
                                                    {t.cancel}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="empty">
                                        {t.listEmpty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>
        </>
    );
}
