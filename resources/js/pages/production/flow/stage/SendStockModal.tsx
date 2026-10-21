import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';
import type { FlowText } from '../text';
import type { LotRow } from '../types';

type Props = {
    lot: LotRow;
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

/** Packing hands pieces that passed the final quality check to the storekeeper. */
export function SendStockModal({ lot, text, onClose, onDone }: Props) {
    const t = text.stockHandover;
    const [quantity, setQuantity] = useState(String(lot.ready_for_stock));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const amount = Number(quantity);

    const submit = async () => {
        setAttempted(true);

        if (isNaN(amount) || !Number.isInteger(amount) || amount < 1) {
            const msg = 'Please enter a valid whole number of pieces to transfer (must be at least 1).';
            setError(msg);
            notify.warning('Quantity Required', msg);
            return;
        }

        if (amount > lot.ready_for_stock) {
            const msg = `Quantity (${amount}) exceeds pieces ready for stock (${lot.ready_for_stock} ready).`;
            setError(msg);
            notify.error('Quantity Exceeded', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>(
                `/api/flow/lots/${lot.id}/stock-handover`,
                { quantity: amount, note: note.trim() || null },
            );
            const successMsg = result.message || `Handed over ${amount} pieces from lot ${lot.lot_number} to warehouse.`;
            notify.success('Handover Successful', successMsg);
            onDone(successMsg);
        } catch (reason: any) {
            const errorMsg = reason instanceof Error ? reason.message : (reason?.message || 'Handover failed.');
            setError(errorMsg);
            notify.error('Handover Failed', errorMsg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${t.title}: ${lot.lot_number}`}
            narrow
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {text.cancel}
                    </button>
                    <button className="primary-btn" onClick={submit} disabled={busy}>
                        {busy ? text.saving : t.confirm}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error" style={{ marginBottom: 12 }}>{error}</div>}
            <p className="ui-help" style={{ margin: 0 }}>
                {[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')} —{' '}
                {t.ready(lot.ready_for_stock)}
            </p>
            <label className="ui-field">
                {t.quantity}
                <input
                    type="number"
                    min={1}
                    max={lot.ready_for_stock}
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
            <span className="ui-help">{t.hint}</span>
        </Modal>
    );
}
