import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Format } from '../../../../core/format';
import type { FlowText } from '../text';
import type { StageOverview } from '../types';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';

type Props = {
    data: StageOverview;
    text: FlowText;
    format: Format;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function FabricLossModal({ data, text, format, onClose, onDone }: Props) {
    const t = text.loss;
    const fabrics = data.materials.filter((material) => material.on_hand > 0);
    const [fabricId, setFabricId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const chosen = fabrics.find((fabric) => String(fabric.item_id) === fabricId);
    const tooMuch = chosen !== undefined && Number(quantity) > chosen.on_hand;

    const submit = async () => {
        setAttempted(true);

        if (!chosen) {
            const msg = 'Please choose which fabric material was damaged.';
            setError(msg);
            notify.warning('Fabric Required', msg);
            return;
        }

        const qtyNum = Number(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            const msg = 'Please enter how much fabric was damaged or lost (must be greater than 0).';
            setError(msg);
            notify.warning('Quantity Required', msg);
            return;
        }

        if (tooMuch) {
            const msg = `Damaged quantity (${qtyNum} ${chosen.unit ?? ''}) exceeds stock on hand (${chosen.on_hand} ${chosen.unit ?? ''}).`;
            setError(msg);
            notify.error('Exceeds Stock', msg);
            return;
        }

        if (reason.trim().length < 3) {
            const msg = 'Please explain the reason for the fabric damage (at least 3 characters).';
            setError(msg);
            notify.warning('Reason Required', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            await postJson('/api/flow/fabric-loss', {
                fabric_item_id: Number(fabricId),
                fabric_waste: qtyNum,
                notes: reason.trim(),
            });
            const successMsg = `Recorded fabric loss: ${chosen?.name ?? ''} (${format.number(qtyNum)} ${chosen?.unit ?? ''}).`;
            notify.success('Fabric Loss Recorded', successMsg);
            onDone(successMsg);
        } catch (reasonError: any) {
            const errorMsg = reasonError instanceof Error ? reasonError.message : (reasonError?.message || 'Failed to record fabric loss.');
            setError(errorMsg);
            notify.error('Recording Failed', errorMsg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={t.title}
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
                        {busy ? text.saving : t.save}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error" style={{ marginBottom: 12 }}>{error}</div>}
            <span className="ui-help">{fabrics.length ? t.hint : text.cut.fabricNone}</span>
            <label className="ui-field">
                {t.fabric}
                <select value={fabricId} onChange={(event) => setFabricId(event.target.value)}>
                    <option value="">{text.cut.chooseFabric}</option>
                    {fabrics.map((fabric) => (
                        <option key={fabric.item_id} value={fabric.item_id}>
                            {fabric.name} —{' '}
                            {text.cut.onHand(format.number(fabric.on_hand), fabric.unit ?? '')}
                        </option>
                    ))}
                </select>
            </label>
            <label className="ui-field">
                {t.quantity}
                <input
                    type="number"
                    min={0}
                    max={chosen?.on_hand}
                    step="any"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                />
            </label>
            <label className="ui-field">
                {t.reason}
                <input value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
        </Modal>
    );
}
