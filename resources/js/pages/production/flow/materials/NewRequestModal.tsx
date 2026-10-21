import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';
import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { OptionItem, PieceLot, StageKey } from '../types';

type Props = {
    stage: StageKey;
    previous: StageKey | null;
    options: OptionItem[];
    lots: PieceLot[];
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
    lots,
    locale,
    text,
    onClose,
    onDone,
}: Props) {
    const t = text.materials;
    const hasMaterials = options.length > 0;
    const [kind, setKind] = useState<Kind>(previous ? 'stage' : 'warehouse');
    const [itemId, setItemId] = useState('');
    const [lotId, setLotId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const pieces = kind === 'stage';
    const item = options.find((option) => String(option.id) === itemId);
    const amount = Number(quantity);
    const lot = lots.find((row) => String(row.id) === lotId);
    const from = stageLabel(previous, locale);

    const submit = async () => {
        setAttempted(true);

        if (pieces) {
            if (!lot) {
                const msg = 'Please choose which lot to request pieces from.';
                setError(msg);
                notify.warning('Lot Required', msg);
                return;
            }
            if (isNaN(amount) || !Number.isInteger(amount) || amount < 1) {
                const msg = 'Please enter a valid whole number of pieces (at least 1).';
                setError(msg);
                notify.warning('Quantity Required', msg);
                return;
            }
            if (amount > lot.ready) {
                const msg = `Requested pieces (${amount}) exceeds pieces ready at ${from} (${lot.ready} ready).`;
                setError(msg);
                notify.error('Quantity Exceeded', msg);
                return;
            }
        } else {
            if (!item) {
                const msg = 'Please select which material you are requesting from the warehouse.';
                setError(msg);
                notify.warning('Material Selection Required', msg);
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                const msg = 'Please enter the quantity needed (greater than 0).';
                setError(msg);
                notify.warning('Quantity Required', msg);
                return;
            }
        }

        if (reason.trim().length < 3) {
            const msg = 'Please explain why you need this material/pieces (at least 3 characters).';
            setError(msg);
            notify.warning('Reason Required', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>('/api/flow/requests', {
                stage,
                source: kind,
                item_id: pieces ? null : Number(itemId),
                lot_id: pieces ? Number(lotId) : null,
                quantity: amount,
                reason: reason.trim(),
            });
            const successMsg = result.message || 'Material request submitted successfully.';
            notify.success('Request Submitted', successMsg);
            onDone(successMsg);
        } catch (failure: any) {
            const errorMsg = failure instanceof Error ? failure.message : (failure?.message || 'Failed to submit request.');
            setError(errorMsg);
            notify.error('Request Failed', errorMsg);
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
                    <button className="primary-btn" onClick={submit} disabled={busy}>
                        {busy ? text.saving : t.send}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error" style={{ marginBottom: 12 }}>{error}</div>}

            {previous && hasMaterials && (
                <label className="ui-field">
                    {t.whatKind}
                    <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
                        <option value="stage">{t.kindPieces(from)}</option>
                        <option value="warehouse">{t.kindMaterial}</option>
                    </select>
                </label>
            )}

            <span className="ui-help">{pieces ? t.piecesHint(from) : t.requestHint}</span>

            {pieces && (
                <label className="ui-field">
                    {t.lot}
                    <select value={lotId} onChange={(event) => setLotId(event.target.value)}>
                        <option value="">{lots.length ? t.chooseItem : t.noCutItems}</option>
                        {lots.map((row) => (
                            <option key={row.id} value={row.id}>
                                {t.lotOption(row)}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            {!pieces && !hasMaterials && <div className="ui-empty">{t.noMaterials}</div>}

            {!pieces && hasMaterials && (
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
                    max={pieces ? lot?.ready : undefined}
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
