import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { postJson } from '../../../core/liveData';
import type { StockText } from './text';
import type { StockAnalytics, StockRow } from './types';

type Props = {
    kind: 'move' | 'count';
    items: StockRow[];
    warehouses: StockAnalytics['warehouses'];
    text: StockText;
    onClose: () => void;
    onDone: (message: string) => void;
};

/** Move stock between warehouses, or correct a balance after counting the shelves. */
export function ManageStockModal({ kind, items, warehouses, text, onClose, onDone }: Props) {
    const t = kind === 'move' ? text.overview.move : text.overview.count;
    const [itemId, setItemId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const ready =
        itemId !== '' &&
        quantity !== '' &&
        Number(quantity) >= (kind === 'move' ? 0.0000001 : 0) &&
        reason.trim().length >= 3 &&
        (kind === 'move' ? from !== '' && to !== '' && from !== to : from !== '');

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result =
                kind === 'move'
                    ? await postJson<{ message: string }>('/api/inventory/transfers', {
                          item_id: Number(itemId),
                          from_warehouse_id: Number(from),
                          to_warehouse_id: Number(to),
                          quantity: Number(quantity),
                          reason: reason.trim(),
                      })
                    : await postJson<{ message: string }>('/api/inventory/stock-counts', {
                          item_id: Number(itemId),
                          warehouse_id: Number(from),
                          counted_quantity: Number(quantity),
                          reason: reason.trim(),
                      });
            onDone(result.message);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : '');
        } finally {
            setBusy(false);
        }
    };

    const warehouseOptions = (
        <>
            <option value="">{text.chooseWarehouse}</option>
            {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                </option>
            ))}
        </>
    );

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
                    <button className="primary-btn" onClick={submit} disabled={busy || !ready}>
                        {busy ? text.saving : t.save}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            <label className="ui-field">
                {t.item}
                <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
                    <option value="">{text.chooseItem}</option>
                    {items.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </select>
            </label>
            {kind === 'move' ? (
                <div className="ui-grid">
                    <label className="ui-field">
                        {text.overview.move.from}
                        <select value={from} onChange={(event) => setFrom(event.target.value)}>
                            {warehouseOptions}
                        </select>
                    </label>
                    <label className="ui-field">
                        {text.overview.move.to}
                        <select value={to} onChange={(event) => setTo(event.target.value)}>
                            {warehouseOptions}
                        </select>
                    </label>
                </div>
            ) : (
                <label className="ui-field">
                    {text.overview.count.warehouse}
                    <select value={from} onChange={(event) => setFrom(event.target.value)}>
                        {warehouseOptions}
                    </select>
                </label>
            )}
            <label className="ui-field">
                {kind === 'move' ? text.overview.move.quantity : text.overview.count.counted}
                <input
                    type="number"
                    min={0}
                    step="any"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                />
            </label>
            <label className="ui-field">
                {kind === 'move' ? text.overview.move.reason : text.overview.count.reason}
                <input value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
        </Modal>
    );
}
