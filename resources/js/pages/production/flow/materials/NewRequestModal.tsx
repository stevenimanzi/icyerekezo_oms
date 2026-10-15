import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import { postJson } from '../../../../core/liveData';
import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { OptionItem, StageKey } from '../types';

type Props = {
    stage: StageKey;
    previous: StageKey | null;
    options: OptionItem[];
    locale: Locale;
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

type Kind = 'stage' | 'warehouse';

/** Asks the stage before for finished pieces, or the warehouse for an item from the product catalogue. */
export function NewRequestModal({
    stage,
    previous,
    options,
    locale,
    text,
    onClose,
    onDone,
}: Props) {
    const t = text.materials;
    const [kind, setKind] = useState<Kind>(previous ? 'stage' : 'warehouse');
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const pieces = kind === 'stage';
    const item = options.find((option) => String(option.id) === itemId);
    const amount = Number(quantity);
    const ready =
        (pieces ? Number.isInteger(amount) && amount > 0 : item !== undefined && amount > 0) &&
        reason.trim().length >= 3;
    const from = stageLabel(previous, locale);

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>('/api/flow/requests', {
                stage,
                source: kind,
                item_id: pieces ? null : Number(itemId),
                quantity: amount,
                reason: reason.trim(),
            });
            onDone(result.message);
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

            {previous && (
                <label className="ui-field">
                    {t.whatKind}
                    <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
                        <option value="stage">{t.kindPieces(from)}</option>
                        <option value="warehouse">{t.kindMaterial}</option>
                    </select>
                </label>
            )}

            <span className="ui-help">{pieces ? t.piecesHint(from) : t.requestHint}</span>

            {!pieces && (
                <label className="ui-field">
                    {t.requestItem}
                    <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
                        <option value="">{t.chooseItem}</option>
                        {options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                                {option.color ? ` · ${option.color}` : ''}
                                {option.unit ? ` (${option.unit})` : ''}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            <label className="ui-field">
                {pieces ? t.piecesQuantity : t.quantity}
                <input
                    type="number"
                    min={pieces ? 1 : 0}
                    step={pieces ? 1 : 'any'}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                />
                {!pieces && item?.unit && <span className="ui-help">{item.unit}</span>}
            </label>
            <label className="ui-field">
                {t.reason}
                <input
                    value={reason}
                    placeholder={pieces ? t.piecesReasonHint : t.reasonHint}
                    onChange={(event) => setReason(event.target.value)}
                />
            </label>
        </Modal>
    );
}
