import { useState } from 'react';
import { Modal } from '../../../../components/Modal';
import type { Format } from '../../../../core/format';
import type { FlowText } from '../text';
import type { LotRow, StageOverview } from '../types';
import { postJson } from '../../../../core/liveData';
import { notify } from '../../../shared/GlobalOperationToasts';

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
    const [good, setGood] = useState('');
    const [damaged, setDamaged] = useState('');
    const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const chosen = fabrics.find((fabric) => String(fabric.item_id) === fabricId);
    const fabricColor = chosen?.color ?? '';
    const fabricTotal = Number(fabricUsed) || 0;
    const tooMuchFabric = chosen !== undefined && fabricTotal > chosen.on_hand;
    const knownProduct = data.options.products.find(
        (option) => option.name.toLowerCase() === product.trim().toLowerCase(),
    );
    const hasProduct = lot !== undefined || product.trim().length > 0;

    const submit = async () => {
        setAttempted(true);

        if (!chosen) {
            const msg = 'Please choose which fabric you used.';
            setError(msg);
            notify.warning('Fabric Required', msg);
            return;
        }

        if (!hasProduct) {
            const msg = 'Please enter the "Product you are making" (for example, "School polo" or "T-Shirt") before saving.';
            setError(msg);
            notify.warning('Product Name Required', msg);
            return;
        }

        const usedAmount = Number(fabricUsed);
        if (isNaN(usedAmount) || usedAmount <= 0) {
            const msg = 'Please enter how much fabric was used (must be greater than 0 meters).';
            setError(msg);
            notify.warning('Fabric Amount Required', msg);
            return;
        }

        if (tooMuchFabric) {
            const msg = `Fabric used (${fabricTotal} m) exceeds available stock (${chosen.on_hand} m left).`;
            setError(msg);
            notify.error('Not Enough Fabric', msg);
            return;
        }

        const goodAmount = Number(good);
        if (isNaN(goodAmount) || goodAmount < 1) {
            const msg = 'Please enter the number of good pieces cut (must be at least 1 piece).';
            setError(msg);
            notify.warning('Pieces Cut Required', msg);
            return;
        }

        setBusy(true);
        setError('');
        try {
            const created = await postJson<{ lot: { lot_number: string } }>('/api/flow/cutting', {
                lot_id: lot?.id ?? null,
                product_item_id: lot ? null : (knownProduct?.id ?? null),
                product_name: lot || knownProduct ? null : product.trim(),
                style: style.trim() || null,
                color: (fabricColor || color).trim() || null,
                size: size.trim() || null,
                fabric_item_id: Number(fabricId),
                fabric_used: Number(fabricUsed),
                fabric_waste: 0,
                good_quantity: Number(good),
                damaged_quantity: Number(damaged) || 0,
                entry_date: date,
                notes: note.trim() || null,
            });
            const successMsg = `Cut saved successfully! Lot ${created.lot.lot_number}: ${Number(good)} pieces cut.`;
            notify.success('Cut Recorded Successfully', successMsg);
            onDone(successMsg);
        } catch (reason: any) {
            const errorMsg = reason instanceof Error ? reason.message : (reason?.message || 'Operation failed. Please try again.');
            setError(errorMsg);
            notify.error('Cut Recording Failed', errorMsg);
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
                    <button className="primary-btn" onClick={submit} disabled={busy}>
                        {busy ? text.saving : t.save}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error" style={{ marginBottom: 12 }}>{error}</div>}

            {tooMuchFabric && chosen && (
                <div className="ui-error" style={{ marginBottom: 12 }}>
                    ⚠️ {t.onHand(format.number(chosen.on_hand), chosen.unit ?? '')}
                </div>
            )}

            {lot && (
                <div className="panel" style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--soft)', border: '1px solid var(--line)' }}>
                    <b>{lot.lot_number}</b> &middot; {[lot.product, lot.color, lot.size].filter(Boolean).join(' · ')}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>
                {/* Column 1 */}
                <label className="ui-field">
                    <span>
                        {t.fabric} <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                    <select
                        value={fabricId}
                        onChange={(event) => setFabricId(event.target.value)}
                        style={{
                            width: '100%',
                            borderColor: attempted && !chosen ? '#dc2626' : undefined,
                            background: attempted && !chosen ? '#fef2f2' : undefined,
                        }}
                        autoFocus
                    >
                        <option value="">{t.chooseFabric}</option>
                        {fabrics.map((fabric) => (
                            <option key={fabric.item_id} value={fabric.item_id}>
                                {fabric.name}
                                {fabric.color ? ` · ${fabric.color}` : ''} —{' '}
                                {t.onHand(format.number(fabric.on_hand), fabric.unit ?? '')}
                            </option>
                        ))}
                    </select>
                    {attempted && !chosen ? (
                        <span className="ui-help" style={{ color: '#dc2626', fontWeight: 600 }}>
                            ⚠️ Fabric is required
                        </span>
                    ) : (
                        !fabrics.length && <span className="ui-help">{t.fabricNone}</span>
                    )}
                </label>

                {!lot && (
                    <>
                        {/* Column 2 */}
                        <label className="ui-field">
                            <span>
                                {t.product} <span style={{ color: '#dc2626' }}>*</span>
                            </span>
                            <input
                                list="flow-products"
                                value={product}
                                placeholder='e.g. "School polo", "T-Shirt"'
                                style={{
                                    width: '100%',
                                    borderColor: attempted && !hasProduct ? '#dc2626' : undefined,
                                    background: attempted && !hasProduct ? '#fef2f2' : undefined,
                                }}
                                onChange={(event) => setProduct(event.target.value)}
                            />
                            <datalist id="flow-products">
                                {data.options.products.map((option) => (
                                    <option key={option.id} value={option.name} />
                                ))}
                            </datalist>
                            {attempted && !hasProduct && (
                                <span className="ui-help" style={{ color: '#dc2626', fontWeight: 600 }}>
                                    ⚠️ Product name required
                                </span>
                            )}
                        </label>

                        {/* Column 3 */}
                        <label className="ui-field">
                            <span>{t.style}</span>
                            <input
                                style={{ width: '100%' }}
                                placeholder='e.g. "Slim fit", "V-neck"'
                                value={style}
                                onChange={(event) => setStyle(event.target.value)}
                            />
                        </label>

                        {/* Row 2: Colour, Size, Fabric Used */}
                        <label className={`ui-field ${fabricColor ? 'ui-auto' : ''}`}>
                            <span>{t.color}</span>
                            <input
                                style={{ width: '100%' }}
                                value={fabricColor || color}
                                readOnly={Boolean(fabricColor)}
                                placeholder={chosen ? t.colorManual : 'e.g. Navy blue'}
                                onChange={(event) => setColor(event.target.value)}
                            />
                            {fabricColor && <span className="ui-help">{t.colorAuto}</span>}
                        </label>

                        <label className="ui-field">
                            <span>{t.size}</span>
                            <input
                                style={{ width: '100%' }}
                                placeholder='e.g. M, L, 32'
                                value={size}
                                onChange={(event) => setSize(event.target.value)}
                            />
                        </label>
                    </>
                )}

                <label className="ui-field">
                    <span>
                        {t.fabricUsed} <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="number"
                            min={0}
                            step="any"
                            value={fabricUsed}
                            style={{
                                width: '100%',
                                minWidth: 0,
                                borderColor:
                                    attempted && (!Number(fabricUsed) || Number(fabricUsed) <= 0)
                                        ? '#dc2626'
                                        : undefined,
                                background:
                                    attempted && (!Number(fabricUsed) || Number(fabricUsed) <= 0)
                                        ? '#fef2f2'
                                        : undefined,
                            }}
                            onChange={(event) => setFabricUsed(event.target.value)}
                        />
                        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {chosen?.unit || 'meters'}
                        </span>
                    </div>
                    {attempted && (!Number(fabricUsed) || Number(fabricUsed) <= 0) && (
                        <span className="ui-help" style={{ color: '#dc2626', fontWeight: 600 }}>
                            ⚠️ Must be &gt; 0
                        </span>
                    )}
                </label>

                {/* Row 3: Good pieces, Damaged, Date */}
                <label className="ui-field">
                    <span>
                        {t.good} <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={good}
                        style={{
                            width: '100%',
                            borderColor:
                                attempted && (!Number(good) || Number(good) < 1)
                                    ? '#dc2626'
                                    : undefined,
                            background:
                                attempted && (!Number(good) || Number(good) < 1)
                                    ? '#fef2f2'
                                    : undefined,
                        }}
                        onChange={(event) => setGood(event.target.value)}
                    />
                    {attempted && (!Number(good) || Number(good) < 1) && (
                        <span className="ui-help" style={{ color: '#dc2626', fontWeight: 600 }}>
                            ⚠️ At least 1 piece
                        </span>
                    )}
                </label>

                <label className="ui-field">
                    <span>{t.damaged}</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={damaged}
                        style={{ width: '100%' }}
                        onChange={(event) => setDamaged(event.target.value)}
                    />
                </label>

                <label className="ui-field">
                    <span>{t.date}</span>
                    <input
                        type="date"
                        value={date}
                        max={new Date().toLocaleDateString('en-CA')}
                        style={{ width: '100%' }}
                        onChange={(event) => setDate(event.target.value)}
                    />
                </label>

                {/* Row 4: Note across all 3 columns */}
                <label className="ui-field" style={{ gridColumn: '1 / -1' }}>
                    <span>{t.note}</span>
                    <textarea rows={2} style={{ width: '100%' }} value={note} onChange={(event) => setNote(event.target.value)} />
                </label>
            </div>
        </Modal>
    );
}
