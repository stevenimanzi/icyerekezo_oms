import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Locale } from '../../../../core/types';
import type { FlowText } from '../text';
import type { LotRow, StageInfo } from '../types';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';

type Props = {
    lot?: LotRow;
    lots: LotRow[];
    stage: StageInfo;
    locale: Locale;
    text: FlowText;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function RecordWorkModal({ lot: given, lots, stage, locale, text, onClose, onDone }: Props) {
    const t = text.record;
    const [lotId, setLotId] = useState(() =>
        String(given?.id ?? (lots.length === 1 ? lots[0].id : '')),
    );
    const lot = given ?? lots.find((row) => String(row.id) === lotId);
    const [good, setGood] = useState('');
    const [damaged, setDamaged] = useState('');
    const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const [attempted, setAttempted] = useState(false);

    const total = (Number(good) || 0) + (Number(damaged) || 0);
    const wip = lot?.wip ?? 0;
    const tooMany = total > wip;

    const submit = async () => {
        setAttempted(true);

        if (!lot) {
            const msg = 'Please select a lot to record work for.';
            setError(msg);
            notify.warning('Lot Required', msg);
            return;
        }

        if (total < 1) {
            const msg = 'Please enter the number of pieces produced (good or damaged must be at least 1).';
            setError(msg);
            notify.warning('Quantity Required', msg);
            return;
        }

        if (tooMany) {
            const msg = `Total pieces entered (${total}) exceeds waiting WIP (${wip} pieces ready).`;
            setError(msg);
            notify.error('Exceeds WIP', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            await postJson(`/api/flow/lots/${lot.id}/entries`, {
                stage: stage.key,
                good_quantity: Number(good) || 0,
                damaged_quantity: Number(damaged) || 0,
                entry_date: date,
                notes: note.trim() || null,
            });
            const successMsg = `Work recorded for ${lot.lot_number}: ${Number(good) || 0} good pieces.`;
            notify.success('Work Recorded Successfully', successMsg);
            onDone(successMsg);
        } catch (reason: any) {
            const errorMsg = reason instanceof Error ? reason.message : (reason?.message || 'Failed to record work.');
            setError(errorMsg);
            notify.error('Recording Failed', errorMsg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${t.title(stage.label[locale])}${lot ? `: ${lot.lot_number}` : ''}`}
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
            {!given && (
                <label className="ui-field">
                    {text.work.lot}
                    <select value={lotId} onChange={(event) => setLotId(event.target.value)}>
                        <option value="">—</option>
                        {lots.map((row) => (
                            <option key={row.id} value={row.id}>
                                {[row.lot_number, row.product, row.color, row.size]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {lot && (
                <p className="ui-help" style={{ margin: 0 }}>
                    {[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')} —{' '}
                    {t.waiting(lot.wip)}
                </p>
            )}
            <div className="ui-grid">
                <label className="ui-field">
                    {t.good}
                    <input
                        type="number"
                        min={0}
                        max={wip}
                        step={1}
                        value={good}
                        onChange={(event) => setGood(event.target.value)}
                        autoFocus
                    />
                </label>
                <label className="ui-field">
                    {t.damaged}
                    <input
                        type="number"
                        min={0}
                        max={wip}
                        step={1}
                        value={damaged}
                        onChange={(event) => setDamaged(event.target.value)}
                    />
                </label>
            </div>
            {tooMany && <div className="ui-error">{t.waiting(wip)}</div>}
            <label className="ui-field">
                {t.date}
                <input
                    type="date"
                    value={date}
                    max={new Date().toLocaleDateString('en-CA')}
                    onChange={(event) => setDate(event.target.value)}
                />
            </label>
            <label className="ui-field">
                {t.note}
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {stage.next === null && <span className="ui-help">{t.packingHint}</span>}
        </Modal>
    );
}
