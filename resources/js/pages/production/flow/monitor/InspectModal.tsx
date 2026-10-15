import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Locale } from '../../../../core/types';
import { STAGE_ORDER, stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotBalances, MonitorLot, StageKey } from '../types';
import { postFlow } from '../useFlowData';
import type { MonitorText } from './monitorText';

type Props = {
    lots: MonitorLot[];
    initialLot?: number;
    initialStage?: StageKey;
    locale: Locale;
    text: FlowText;
    words: MonitorText;
    balances?: LotBalances;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function InspectModal({
    lots,
    initialLot,
    initialStage,
    locale,
    text,
    words,
    balances,
    onClose,
    onDone,
}: Props) {
    const t = words.inspect;
    const [lotId, setLotId] = useState(initialLot ? String(initialLot) : '');
    const [stage, setStage] = useState<StageKey>(initialStage ?? 'sewing');
    const [inspected, setInspected] = useState('');
    const [passed, setPassed] = useState('');
    const [rejected, setRejected] = useState('');
    const [defects, setDefects] = useState('');
    const [notes, setNotes] = useState('');
    const [hold, setHold] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const lot = lots.find((row) => String(row.id) === lotId);
    const isFinal = stage === 'packing';
    const waiting = lot ? lot.stages.packing.here : 0;
    const bad = Number(rejected) || 0;
    const good = Number(passed) || 0;
    const checked = Number(inspected) || 0;
    const ready =
        (initialLot !== undefined || lot !== undefined) &&
        checked >= 1 &&
        good + bad <= checked &&
        (isFinal ? good + bad >= 1 : true) &&
        (bad === 0 || defects.trim().length > 0);

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postFlow<{ message: string }>('/api/flow/inspections', {
                lot_id: Number(lotId),
                stage,
                inspected_quantity: checked,
                passed_quantity: good,
                rejected_quantity: bad,
                defect_details: defects.trim() || null,
                notes: notes.trim() || null,
                hold: bad > 0 && hold,
            });
            onDone(result.message);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={t.title}
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {text.cancel}
                    </button>
                    <button className="primary-btn" onClick={submit} disabled={busy || !ready}>
                        {busy ? text.saving : t.save}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            <div className="ui-grid">
                <label className="ui-field">
                    {t.lot}
                    <select
                        value={lotId}
                        onChange={(event) => setLotId(event.target.value)}
                        disabled={initialLot !== undefined}
                    >
                        <option value="">{t.chooseLot}</option>
                        {initialLot !== undefined && !lot && (
                            <option value={initialLot}>#{initialLot}</option>
                        )}
                        {lots.map((row) => (
                            <option key={row.id} value={row.id}>
                                {row.lot_number} — {row.product ?? ''}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="ui-field">
                    {t.stage}
                    <select
                        value={stage}
                        onChange={(event) => setStage(event.target.value as StageKey)}
                    >
                        {STAGE_ORDER.map((key) => (
                            <option key={key} value={key}>
                                {stageLabel(key, locale)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {(lot || balances) && isFinal && (
                <span className="ui-help">
                    {t.finalHint(balances?.stages.packing.awaiting_quality ?? waiting)}
                </span>
            )}
            {!isFinal && balances && (
                <span className="ui-help">{t.stageHint(balances.stages[stage].outbox)}</span>
            )}
            <div className="ui-grid">
                <label className="ui-field">
                    {t.inspected}
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={inspected}
                        onChange={(event) => setInspected(event.target.value)}
                    />
                </label>
                <label className="ui-field">
                    {t.passed}
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={passed}
                        onChange={(event) => setPassed(event.target.value)}
                    />
                </label>
                <label className="ui-field">
                    {t.rejected}
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={rejected}
                        onChange={(event) => setRejected(event.target.value)}
                    />
                </label>
            </div>
            {bad > 0 && (
                <>
                    <label className="ui-field">
                        {t.defects}
                        <input
                            value={defects}
                            onChange={(event) => setDefects(event.target.value)}
                        />
                    </label>
                    <label className="ui-check">
                        <input
                            type="checkbox"
                            checked={hold}
                            onChange={(event) => setHold(event.target.checked)}
                        />
                        {t.hold}
                    </label>
                </>
            )}
            <label className="ui-field">
                {t.notes}
                <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                />
            </label>
        </Modal>
    );
}
