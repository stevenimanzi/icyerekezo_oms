import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import { postJson } from '../../../../core/liveData';
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

    const amount = Number(quantity);
    const valid = Number.isInteger(amount) && amount >= 1 && amount <= lot.ready_for_stock;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>(
                `/api/flow/lots/${lot.id}/stock-handover`,
                { quantity: amount, note: note.trim() || null },
            );
            onDone(result.message);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
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
                    <button className="primary-btn" onClick={submit} disabled={busy || !valid}>
                        {busy ? text.saving : t.confirm}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
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
