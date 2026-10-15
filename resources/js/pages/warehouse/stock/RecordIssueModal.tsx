import { useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal';
import type { Format } from '../../../core/format';
import { postJson } from '../../../core/liveData';
import { ItemSelect } from './ItemSelect';
import type { StockText } from './text';
import type { MovementsResponse } from './types';

type Props = {
    data: MovementsResponse;
    text: StockText;
    format: Format;
    onClose: () => void;
    onDone: (message: string) => void;
};

export function RecordIssueModal({ data, text, format, onClose, onDone }: Props) {
    const t = text.stockOut;
    const [itemId, setItemId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('used');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const reasonOptions = useMemo(() => {
        const list = Array.isArray(data.reasons) ? [...data.reasons] : [];
        if (!list.includes('cutting')) {
            list.push('cutting');
        }
        const withoutOther = list.filter((key) => key !== 'other');
        return [...withoutOther, 'other'];
    }, [data.reasons]);

    const item = data.items.find((row) => String(row.id) === itemId);
    const tooMuch = item !== undefined && Number(quantity) > item.available;
    const isOther = reason === 'other';
    const needsNote = isOther || reason === 'damaged' || reason === 'lost';
    const ready =
        item !== undefined &&
        Number(quantity) > 0 &&
        !tooMuch &&
        (!needsNote || note.trim().length >= 3);

    const submit = async () => {
        if (needsNote && note.trim().length < 3) {
            setError(isOther ? t.otherNoteHint : t.noteHint);
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>('/api/stock/issues', {
                item_id: Number(itemId),
                warehouse_id: warehouseId ? Number(warehouseId) : null,
                quantity: Number(quantity),
                reason_type: reason,
                note: note.trim() || null,
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
            title={t.recordTitle}
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
            <label className="ui-field">
                {t.item}
                <ItemSelect
                    items={data.items}
                    value={itemId}
                    text={text}
                    onChange={setItemId}
                    onlyInStock
                    describe={(row) => t.inStock(format.number(row.available), row.unit ?? '')}
                />
            </label>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.quantity}
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                    />
                    {tooMuch && item && (
                        <span className="ui-error">
                            {t.inStock(format.number(item.available), item.unit ?? '')}
                        </span>
                    )}
                </label>
                <label className="ui-field">
                    {t.warehouse}
                    <select
                        value={warehouseId}
                        onChange={(event) => setWarehouseId(event.target.value)}
                    >
                        <option value="">{t.bestWarehouse}</option>
                        {data.warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <label className="ui-field">
                {t.reason}
                <select value={reason} onChange={(event) => setReason(event.target.value)}>
                    {reasonOptions.map((key) => (
                        <option key={key} value={key}>
                            {t.reasons[key] ?? key}
                        </option>
                    ))}
                </select>
            </label>
            <label className="ui-field">
                {isOther ? t.otherReasonLabel : (needsNote ? `${t.note} *` : t.note)}
                <textarea
                    rows={2}
                    value={note}
                    placeholder={isOther ? t.otherPlaceholder : undefined}
                    onChange={(event) => setNote(event.target.value)}
                />
                {isOther && !note.trim() && (
                    <span className="ui-help" style={{ color: 'var(--amber-700, #b45309)' }}>
                        {t.otherNoteHint}
                    </span>
                )}
                {isOther && note.trim().length > 0 && note.trim().length < 3 && (
                    <span className="ui-error">{t.noteMinLength}</span>
                )}
                {!isOther && needsNote && <span className="ui-help">{t.noteHint}</span>}
            </label>
        </Modal>
    );
}
