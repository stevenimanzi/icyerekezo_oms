import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Format } from '../../../../core/format';
import type { FlowText } from '../text';
import type { LotRow, StageOverview } from '../types';
import { postFlow } from '../useFlowData';

type Props = {
    lot?: LotRow;
    data: StageOverview;
    text: FlowText;
    format: Format;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function CutModal({ lot, data, text, format, onClose, onDone }: Props) {
    const t = text.cut;
    const fabrics = data.materials.filter((material) => material.on_hand > 0);
    const [product, setProduct] = useState('');
    const [color, setColor] = useState('');
    const [size, setSize] = useState('');
    const [style, setStyle] = useState('');
    const [fabricId, setFabricId] = useState('');
    const [fabricUsed, setFabricUsed] = useState('');
    const [fabricWaste, setFabricWaste] = useState('');
    const [good, setGood] = useState('');
    const [damaged, setDamaged] = useState('');
    const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const chosen = fabrics.find((fabric) => String(fabric.item_id) === fabricId);
    const fabricTotal = (Number(fabricUsed) || 0) + (Number(fabricWaste) || 0);
    const tooMuchFabric = chosen !== undefined && fabricTotal > chosen.on_hand;
    const knownProduct = data.options.products.find(
        (option) => option.name.toLowerCase() === product.trim().toLowerCase(),
    );
    const hasProduct = lot !== undefined || product.trim().length > 0;
    const ready =
        hasProduct &&
        chosen !== undefined &&
        Number(fabricUsed) > 0 &&
        Number(good) >= 1 &&
        !tooMuchFabric;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const created = await postFlow<{ lot: { lot_number: string } }>('/api/flow/cutting', {
                lot_id: lot?.id ?? null,
                product_item_id: lot ? null : (knownProduct?.id ?? null),
                product_name: lot || knownProduct ? null : product.trim(),
                style: style.trim() || null,
                color: color.trim() || null,
                size: size.trim() || null,
                fabric_item_id: Number(fabricId),
                fabric_used: Number(fabricUsed),
                fabric_waste: Number(fabricWaste) || 0,
                good_quantity: Number(good),
                damaged_quantity: Number(damaged) || 0,
                entry_date: date,
                notes: note.trim() || null,
            });
            onDone(`${created.lot.lot_number}: ${text.pieces(Number(good))}.`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={lot ? t.titleMore(lot.lot_number) : t.titleNew}
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

            {lot ? (
                <p className="ui-help" style={{ margin: 0 }}>
                    {[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')}
                </p>
            ) : (
                <>
                    <label className="ui-field">
                        {t.product}
                        <input
                            list="flow-products"
                            value={product}
                            onChange={(event) => setProduct(event.target.value)}
                            autoFocus
                        />
                        <datalist id="flow-products">
                            {data.options.products.map((option) => (
                                <option key={option.id} value={option.name} />
                            ))}
                        </datalist>
                        <span className="ui-help">{t.productHint}</span>
                    </label>
                    <div className="ui-grid">
                        <label className="ui-field">
                            {t.color}
                            <input
                                value={color}
                                onChange={(event) => setColor(event.target.value)}
                            />
                        </label>
                        <label className="ui-field">
                            {t.size}
                            <input value={size} onChange={(event) => setSize(event.target.value)} />
                        </label>
                    </div>
                    <label className="ui-field">
                        {t.style}
                        <input value={style} onChange={(event) => setStyle(event.target.value)} />
                    </label>
                </>
            )}

            <label className="ui-field">
                {t.fabric}
                <select value={fabricId} onChange={(event) => setFabricId(event.target.value)}>
                    <option value="">{t.chooseFabric}</option>
                    {fabrics.map((fabric) => (
                        <option key={fabric.item_id} value={fabric.item_id}>
                            {fabric.name} —{' '}
                            {t.onHand(format.number(fabric.on_hand), fabric.unit ?? '')}
                        </option>
                    ))}
                </select>
                {!fabrics.length && <span className="ui-help">{t.fabricNone}</span>}
            </label>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.fabricUsed}
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={fabricUsed}
                        onChange={(event) => setFabricUsed(event.target.value)}
                    />
                </label>
                <label className="ui-field">
                    {t.fabricWaste}
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={fabricWaste}
                        onChange={(event) => setFabricWaste(event.target.value)}
                    />
                </label>
            </div>
            {tooMuchFabric && chosen && (
                <div className="ui-error">
                    {t.onHand(format.number(chosen.on_hand), chosen.unit ?? '')}
                </div>
            )}
            <div className="ui-grid">
                <label className="ui-field">
                    {t.good}
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={good}
                        onChange={(event) => setGood(event.target.value)}
                    />
                </label>
                <label className="ui-field">
                    {t.damaged}
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={damaged}
                        onChange={(event) => setDamaged(event.target.value)}
                    />
                </label>
            </div>
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
        </Modal>
    );
}
