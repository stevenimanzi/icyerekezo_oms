import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { FlowText } from '../text';
import type { TransferRow } from '../types';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';

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
    const [attempted, setAttempted] = useState(false);

    const qtyNum = Number(quantity);
    const short = qtyNum > 0 && qtyNum < transfer.quantity_sent;

    const submit = async () => {
        setAttempted(true);

        if (isNaN(qtyNum) || qtyNum <= 0) {
            const msg = 'Please enter a valid received quantity (must be greater than 0).';
            setError(msg);
            notify.warning('Quantity Required', msg);
            return;
        }

        if (short && note.trim().length < 3) {
            const msg = 'When receiving fewer pieces than sent, please write a note explaining why (at least 3 characters).';
            setError(msg);
            notify.warning('Note Required for Shortage', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/transfers/${transfer.id}/receive`, {
                quantity: qtyNum,
                note: note.trim() || null,
            });
            const successMsg = `Received ${qtyNum} pieces for lot ${transfer.lot_number}.`;
            notify.success('Pieces Received', successMsg);
            onDone(successMsg);
        } catch (reason: any) {
            const errorMsg = reason instanceof Error ? reason.message : (reason?.message || 'Failed to receive pieces.');
            setError(errorMsg);
            notify.error('Receiving Failed', errorMsg);
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
                        disabled={busy}
                    >
                        {busy ? text.saving : t.confirm}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error" style={{ marginBottom: 12 }}>{error}</div>}
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
