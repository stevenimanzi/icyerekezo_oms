import { useMemo, useState } from 'react';
import '../../../components/ui.css';
import { Modal } from '../../../components/Modal';
import { makeFormat } from '../../../core/format';
import { postJson, useLiveData } from '../../../core/liveData';
import type { Locale } from '../../../core/types';
import { flowText } from '../../production/flow/text';

type Handover = {
    id: number;
    lot_number: string | null;
    product: string | null;
    color: string | null;
    size: string | null;
    quantity: number;
    sent_by: string | null;
    sent_at: string | null;
};

type Response = { capabilities: { receive: boolean }; handovers: Handover[] };

const REFRESH_MS = 15000;

/** Finished goods Packing has sent: the storekeeper counts them in, and only then do they become sellable stock. Hidden when nothing waits. */
export function FinishedGoodsPanel({
    locale,
    onReceived,
}: {
    locale: Locale;
    onReceived?: () => void;
}) {
    const t = flowText[locale].stockReceive;
    const text = flowText[locale];
    const format = useMemo(() => makeFormat(locale, ''), [locale]);
    const { data, reload } = useLiveData<Response>('/api/flow/stock-handovers', REFRESH_MS);
    const [receiving, setReceiving] = useState<Handover | null>(null);
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);

    const rows = data?.handovers ?? [];
    if (!rows.length && !notice) return null;

    const open = (row: Handover) => {
        setReceiving(row);
        setQuantity(String(row.quantity));
        setNote('');
        setError('');
    };

    const submit = async () => {
        if (!receiving) return;
        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/stock-handovers/${receiving.id}/receive`, {
                quantity: Number(quantity),
                note: note.trim() || null,
            });
            setReceiving(null);
            setNotice(t.done);
            window.setTimeout(() => setNotice(''), 6000);
            reload();
            onReceived?.();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {notice && (
                <div className="ui-notice" role="status">
                    <span>{notice}</span>
                </div>
            )}
            {rows.length > 0 && (
                <article className="panel">
                    <div className="panel-title">
                        <h2>{t.title}</h2>
                    </div>
                    <p className="ui-help" style={{ margin: '0 16px 8px' }}>
                        {t.subtitle}
                    </p>
                    <div className="ui-table-wrap">
                        <table className="ui-table" style={{ minWidth: 720 }}>
                            <thead>
                                <tr>
                                    <th>{t.lot}</th>
                                    <th>{t.product}</th>
                                    <th>{t.colour}</th>
                                    <th>{t.size}</th>
                                    <th className="num">{t.sent}</th>
                                    <th>{t.sentBy}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <b>{row.lot_number}</b>
                                        </td>
                                        <td>{row.product ?? text.none}</td>
                                        <td>
                                            {row.color ? (
                                                <span className="ui-colour">{row.color}</span>
                                            ) : (
                                                text.none
                                            )}
                                        </td>
                                        <td>{row.size ?? text.none}</td>
                                        <td className="num">
                                            <b>{format.whole(row.quantity)}</b>
                                        </td>
                                        <td>
                                            {row.sent_by ?? text.none}
                                            {row.sent_at && (
                                                <small>{format.dateTime(row.sent_at)}</small>
                                            )}
                                        </td>
                                        <td>
                                            {data?.capabilities.receive && (
                                                <button
                                                    className="primary-btn"
                                                    onClick={() => open(row)}
                                                >
                                                    {t.receive}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {receiving && (
                <Modal
                    title={t.modalTitle(receiving.lot_number ?? '')}
                    narrow
                    onClose={() => setReceiving(null)}
                    footer={
                        <>
                            <button
                                className="secondary-btn"
                                onClick={() => setReceiving(null)}
                                disabled={busy}
                            >
                                {text.cancel}
                            </button>
                            <button
                                className="primary-btn"
                                onClick={submit}
                                disabled={
                                    busy ||
                                    !(
                                        Number(quantity) >= 1 &&
                                        Number(quantity) <= receiving.quantity
                                    )
                                }
                            >
                                {busy ? text.saving : t.confirm}
                            </button>
                        </>
                    }
                >
                    {error && <div className="ui-error">{error}</div>}
                    <p className="ui-help" style={{ margin: 0 }}>
                        {[receiving.product, receiving.color, receiving.size]
                            .filter(Boolean)
                            .join(' · ')}{' '}
                        — {format.whole(receiving.quantity)}
                    </p>
                    <label className="ui-field">
                        {t.quantity}
                        <input
                            type="number"
                            min={1}
                            max={receiving.quantity}
                            step={1}
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                            autoFocus
                        />
                    </label>
                    <label className="ui-field">
                        {t.note}
                        <input value={note} onChange={(event) => setNote(event.target.value)} />
                    </label>
                </Modal>
            )}
        </>
    );
}
