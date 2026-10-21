import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import '../../../../components/ui.css';
import type { Locale } from '../../../../core/types';
import { STAGE_ORDER, stageLabel } from '../stages';
import type { FlowText } from '../text';
import type { LotBalances, MonitorLot, StageKey } from '../types';
import { postJson } from '../../../../core/liveData';
import type { MonitorText } from './monitorText';

type Props = {
    lots: Array<{ id: number; lot_number: string; product?: string | null; stages?: any; awaiting_quality?: number }>;
    initialLot?: number;
    initialStage?: StageKey;
    initialQuantity?: number;
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
    initialQuantity,
    locale,
    text,
    words,
    balances,
    onClose,
    onDone,
}: Props) {
    const t = words.inspect;
    const [lotId, setLotId] = useState(initialLot ? String(initialLot) : '');
    const [stage, setStage] = useState<StageKey>(initialStage ?? 'cutting');
    const [inspected, setInspected] = useState(initialQuantity !== undefined && initialQuantity > 0 ? String(initialQuantity) : '');
    const [passed, setPassed] = useState(initialQuantity !== undefined && initialQuantity > 0 ? String(initialQuantity) : '');
    const [rejected, setRejected] = useState('0');
    const [defects, setDefects] = useState('');
    const [notes, setNotes] = useState('');
    const [hold, setHold] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const lot = lots.find((row) => String(row.id) === lotId);
    const isFinal = stage === 'packing';
    const waiting = initialQuantity ?? (lot
        ? lot.stages && lot.stages[stage]
            ? lot.stages[stage].awaiting_quality ?? lot.stages[stage].here ?? 0
            : typeof (lot as any).awaiting_quality === 'number'
              ? (lot as any).awaiting_quality
              : 0
        : 0);
    const bad = Number(rejected) || 0;
    const good = Number(passed) || 0;
    const checked = Number(inspected) || 0;
    const ready =
        (initialLot !== undefined || lot !== undefined) &&
        checked >= 1 &&
        good + bad <= checked &&
        good + bad >= 1 &&
        (bad === 0 || defects.trim().length > 0);

    const handleInspectedChange = (val: string) => {
        setInspected(val);
        const n = Number(val) || 0;
        const r = Number(rejected) || 0;
        setPassed(String(Math.max(0, n - r)));
    };

    const handleRejectedChange = (val: string) => {
        setRejected(val);
        const r = Number(val) || 0;
        const n = Number(inspected) || 0;
        if (n > 0) {
            setPassed(String(Math.max(0, n - r)));
        }
    };

    const handlePassedChange = (val: string) => {
        setPassed(val);
        const p = Number(val) || 0;
        const n = Number(inspected) || 0;
        if (n > 0) {
            setRejected(String(Math.max(0, n - p)));
        }
    };

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>('/api/flow/inspections', {
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
            setError(reason instanceof Error ? reason.message : 'Inspection submission failed');
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
            <div
                style={{
                    background: 'color-mix(in srgb, var(--brand, #2563eb) 8%, var(--panel, #ffffff))',
                    border: '1px solid color-mix(in srgb, var(--brand, #2563eb) 25%, transparent)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--brand, #2563eb)',
                    lineHeight: 1.5,
                    fontWeight: 500,
                }}
            >
                {isFinal
                    ? t.finalHint(balances?.stages.packing.awaiting_quality ?? waiting)
                    : `${balances?.stages[stage]?.awaiting_quality ?? waiting} ${locale === 'en' ? 'finished pieces are waiting for quality inspection at this stage. Only passed pieces can be sent to the next stage.' : 'pièces terminées attendent le contrôle qualité à cette étape. Seules les pièces validées pourront être transférées.'}`}
            </div>
            <div className="ui-grid three">
                <label className="ui-field">
                    <span>{t.inspected}</span>
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={inspected}
                        onChange={(event) => handleInspectedChange(event.target.value)}
                        placeholder="0"
                    />
                </label>
                <label className="ui-field">
                    <span style={{ color: '#059669' }}>{t.passed}</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={passed}
                        onChange={(event) => handlePassedChange(event.target.value)}
                        placeholder="0"
                        style={{ borderColor: Number(passed) > 0 ? '#059669' : undefined }}
                    />
                </label>
                <label className="ui-field">
                    <span style={{ color: Number(rejected) > 0 ? '#dc2626' : undefined }}>{t.rejected}</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={rejected}
                        onChange={(event) => handleRejectedChange(event.target.value)}
                        placeholder="0"
                        style={{
                            borderColor: Number(rejected) > 0 ? '#dc2626' : undefined,
                            background: Number(rejected) > 0 ? 'color-mix(in srgb, #dc2626 5%, var(--panel, #fff))' : undefined,
                        }}
                    />
                </label>
            </div>
            {bad > 0 && (
                <div
                    style={{
                        background: 'color-mix(in srgb, #dc2626 6%, var(--panel, #ffffff))',
                        border: '1px solid color-mix(in srgb, #dc2626 25%, transparent)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                    }}
                >
                    <label className="ui-field" style={{ margin: 0 }}>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{t.defects} *</span>
                        <input
                            value={defects}
                            onChange={(event) => setDefects(event.target.value)}
                            placeholder={locale === 'fr' ? 'Précisez la nature des défauts...' : 'Explain what failed quality control...'}
                            style={{ borderColor: '#dc2626' }}
                        />
                    </label>
                    <label className="ui-check" style={{ margin: 0 }}>
                        <input
                            type="checkbox"
                            checked={hold}
                            onChange={(event) => setHold(event.target.checked)}
                        />
                        <span>{t.hold}</span>
                    </label>
                </div>
            )}
            <label className="ui-field">
                <span>{t.notes}</span>
                <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={locale === 'fr' ? 'Remarques ou observations complémentaires...' : 'Optional inspection observations...'}
                />
            </label>
        </Modal>
    );
}
