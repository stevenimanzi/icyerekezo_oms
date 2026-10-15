import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import { postJson } from '../../../../core/liveData';
import type { FlowText } from '../text';
import type { OptionItem, StageKey } from '../types';

type Props = {
    stage: StageKey;
    options: OptionItem[];
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

/** Asks the warehouse for an item from the product catalogue. */
export function NewRequestModal({ stage, options, text, onClose, onDone }: Props) {
    const t = text.materials;
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const item = options.find((option) => String(option.id) === itemId);
    const ready = item !== undefined && Number(quantity) > 0 && reason.trim().length >= 3;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ request: { request_number: string } }>(
                '/api/flow/requests',
                {
                    stage,
                    item_id: Number(itemId),
                    quantity: Number(quantity),
                    reason: reason.trim(),
                },
            );
            onDone(t.sent(result.request.request_number));
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={t.requestTitle}
            narrow
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {text.cancel}
                    </button>
                    <button className="primary-btn" onClick={submit} disabled={busy || !ready}>
                        {busy ? text.saving : t.send}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            <span className="ui-help">{t.requestHint}</span>
            <label className="ui-field">
                {t.requestItem}
                <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
                    <option value="">{t.chooseItem}</option>
                    {options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name}
                            {option.unit ? ` (${option.unit})` : ''}
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
                {item?.unit && <span className="ui-help">{item.unit}</span>}
            </label>
            <label className="ui-field">
                {t.reason}
                <input
                    value={reason}
                    placeholder={t.reasonHint}
                    onChange={(event) => setReason(event.target.value)}
                />
            </label>
        </Modal>
    );
}
