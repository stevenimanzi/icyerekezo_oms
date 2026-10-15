import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { postJson } from '../../../core/liveData';
import { AddSupplierModal } from './AddSupplierModal';
import { ItemSelect } from './ItemSelect';
import type { StockText } from './text';
import type { MovementsResponse, SupplierOption } from './types';

type Props = {
    data: MovementsResponse;
    text: StockText;
    onClose: () => void;
    onDone: (message: string) => void;
};

const today = () => new Date().toLocaleDateString('en-CA');

export function RecordReceiptModal({ data, text, onClose, onDone }: Props) {
    const t = text.stockIn;
    const [itemId, setItemId] = useState('');
    const [warehouseId, setWarehouseId] = useState(
        data.warehouses.length === 1 ? String(data.warehouses[0].id) : '',
    );
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [added, setAdded] = useState<SupplierOption[]>([]);
    const [addingSupplier, setAddingSupplier] = useState(false);
    const [reference, setReference] = useState('');
    const [receivedOn, setReceivedOn] = useState(today());
    const [batch, setBatch] = useState('');
    const [expiry, setExpiry] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const suppliers = [
        ...data.suppliers,
        ...added.filter((extra) => !data.suppliers.some((known) => known.id === extra.id)),
    ];
    const item = data.items.find((row) => String(row.id) === itemId);
    const ready =
        item !== undefined &&
        warehouseId !== '' &&
        supplierId !== '' &&
        Number(quantity) > 0 &&
        (!item.batch_tracked || batch.trim() !== '') &&
        (!item.expiry_tracked || expiry !== '');

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ message: string }>('/api/stock/receipts', {
                item_id: Number(itemId),
                warehouse_id: Number(warehouseId),
                quantity: Number(quantity),
                unit_cost: cost === '' ? null : Number(cost),
                supplier_id: Number(supplierId),
                reference: reference.trim() || null,
                received_on: receivedOn,
                batch_number: item?.batch_tracked ? batch.trim() : null,
                expires_on: expiry || null,
                note: note.trim() || null,
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
                <ItemSelect items={data.items} value={itemId} text={text} onChange={setItemId} />
            </label>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.warehouse}
                    <select
                        value={warehouseId}
                        onChange={(event) => setWarehouseId(event.target.value)}
                    >
                        <option value="">{text.chooseWarehouse}</option>
                        {data.warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="ui-field">
                    {t.quantity}
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                    />
                    {item?.unit && <span className="ui-help">{item.unit}</span>}
                </label>
            </div>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.cost}
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={cost}
                        placeholder={item ? String(item.cost) : ''}
                        onChange={(event) => setCost(event.target.value)}
                    />
                    <span className="ui-help">{t.costHint}</span>
                </label>
                <label className="ui-field">
                    {t.date}
                    <input
                        type="date"
                        value={receivedOn}
                        max={today()}
                        onChange={(event) => setReceivedOn(event.target.value)}
                    />
                </label>
            </div>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.supplier}
                    <select
                        value={supplierId}
                        onChange={(event) => setSupplierId(event.target.value)}
                    >
                        <option value="">{t.chooseSupplier}</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                                {supplier.phone ? ` — ${supplier.phone}` : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="ui-link"
                        onClick={() => setAddingSupplier(true)}
                    >
                        {t.newSupplier}
                    </button>
                    {!suppliers.length && <span className="ui-help">{t.noSuppliers}</span>}
                </label>
                <label className="ui-field">
                    {t.reference}
                    <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                    />
                </label>
            </div>
            {item?.batch_tracked && (
                <div className="ui-grid">
                    <label className="ui-field">
                        {t.batch}
                        <input value={batch} onChange={(event) => setBatch(event.target.value)} />
                    </label>
                    {item.expiry_tracked && (
                        <label className="ui-field">
                            {t.expiry}
                            <input
                                type="date"
                                value={expiry}
                                min={today()}
                                onChange={(event) => setExpiry(event.target.value)}
                            />
                        </label>
                    )}
                </div>
            )}
            <label className="ui-field">
                {t.note}
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {addingSupplier && (
                <AddSupplierModal
                    text={text}
                    onClose={() => setAddingSupplier(false)}
                    onSaved={(supplier) => {
                        setAdded([...added, supplier]);
                        setSupplierId(String(supplier.id));
                        setAddingSupplier(false);
                    }}
                />
            )}
        </Modal>
    );
}
