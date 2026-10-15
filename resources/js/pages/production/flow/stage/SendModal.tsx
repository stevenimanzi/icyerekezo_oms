import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Locale } from '../../../../core/types';
import { stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotRow, StageInfo } from '../types';
import { postJson } from '../../../../core/liveData';

type Props = {
    lot: LotRow;
    stage: StageInfo;
    locale: Locale;
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function SendModal({ lot, stage, locale, text, onClose, onDone }: Props) {
    const t = text.send;
    const next = stageLabel(stage.next, locale);
    const [quantity, setQuantity] = useState(String(lot.outbox));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/lots/${lot.id}/send`, {
                from_stage: stage.key,
                quantity: Number(quantity),
                note: note.trim() || null,
            });
            onDone(`${lot.lot_number}: ${text.pieces(Number(quantity))} → ${next}.`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${t.title(next)}: ${lot.lot_number}`}
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
                        disabled={busy || !(Number(quantity) >= 1) || Number(quantity) > lot.outbox}
                    >
                        {busy ? text.saving : t.confirm}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            <p className="ui-help" style={{ margin: 0 }}>
                {[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')} —{' '}
                {t.ready(lot.outbox)}
            </p>
            <label className="ui-field">
                {t.quantity}
                <input
                    type="number"
                    min={1}
                    max={lot.outbox}
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
