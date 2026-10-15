import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { FlowText } from '../text';
import type { TransferRow } from '../types';
import { postJson } from '../../../../core/liveData';

type Props = {
    transfer: TransferRow;
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function ReceiveModal({ transfer, text, onClose, onDone }: Props) {
    const t = text.receive;
    const [quantity, setQuantity] = useState(String(transfer.quantity_sent));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const short = Number(quantity) > 0 && Number(quantity) < transfer.quantity_sent;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/transfers/${transfer.id}/receive`, {
                quantity: Number(quantity),
                note: note.trim() || null,
            });
            onDone(`${transfer.lot_number}: ${text.pieces(Number(quantity))}.`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${t.title}: ${transfer.lot_number}`}
            narrow
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {text.cancel}
                    </button>
                    <button
                        className="primary-btn"
                        onClick={submit}
                        disabled={
                            busy || !(Number(quantity) > 0) || (short && note.trim().length < 3)
                        }
                    >
                        {busy ? text.saving : t.confirm}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            <p className="ui-help" style={{ margin: 0 }}>
                {t.sent(transfer.quantity_sent, transfer.sent_by ?? '')}
            </p>
            <label className="ui-field">
                {t.quantity}
                <input
                    type="number"
                    min={1}
                    max={transfer.quantity_sent}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                />
            </label>
            {short && (
                <label className="ui-field">
                    {t.shortNote}
                    <input value={note} onChange={(event) => setNote(event.target.value)} />
                    <span className="ui-help">{t.shortHint}</span>
                </label>
            )}
        </Modal>
    );
}
