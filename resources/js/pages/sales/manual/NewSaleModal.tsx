import { useMemo, useState } from 'react';
import { api } from '../../../core/api';
import type { Format } from '../../../core/format';
import { Modal } from './components/Modal';
import type { salesText } from './text';
import type { Sale, SaleFormOptions } from './types';

type Props = {
    options: SaleFormOptions;
    text: (typeof salesText)['en'];
    format: Format;
    onClose: () => void;
    onSaved: (sale: Sale) => void;
};

type Line = { key: number; item_id: string; quantity: string; unit_price: string };

const emptyLine = (key: number): Line => ({ key, item_id: '', quantity: '1', unit_price: '' });

export function NewSaleModal({ options, text, format, onClose, onSaved }: Props) {
    const t = text.form;
    const [customer, setCustomer] = useState('');
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [lines, setLines] = useState<Line[]>([emptyLine(1)]);
    const [discount, setDiscount] = useState('');
    const [paid, setPaid] = useState('');
    const [method, setMethod] = useState(options.payment_methods[0] ?? 'cash');
    const [reference, setReference] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [deductStock, setDeductStock] = useState(true);
    const [warehouseId, setWarehouseId] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const items = useMemo(() => new Map(options.items.map((item) => [String(item.id), item])), [options.items]);

    const lineAmount = (line: Line) => Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unit_price) || 0);
    const subtotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
    const discountValue = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    const total = Math.max(0, subtotal - discountValue);
    const paidValue = Math.min(Math.max(0, Number(paid) || 0), total);
    const balance = total - paidValue;
    const ready = lines.some((line) => line.item_id && Number(line.quantity) > 0);

    const changeLine = (key: number, changes: Partial<Line>) =>
        setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));

    const chooseProduct = (key: number, itemId: string) => {
        const item = items.get(itemId);
        const price = item && Number(item.last_price) > 0 ? String(Number(item.last_price)) : '';
        changeLine(key, { item_id: itemId, ...(price ? { unit_price: price } : {}) });
    };

    const chooseCustomer = (value: string) => {
        setCustomer(value);
        const known = options.customers.find((entry) => entry.name.toLowerCase() === value.toLowerCase());
        if (known?.phone && !phone) setPhone(known.phone);
    };

    const submit = async () => {
        setError('');
        if (!ready) {
            setError(t.needProduct);
            return;
        }

        setBusy(true);
        try {
            const response = await api<{ sale: Sale }>('/api/sales/manual', {
                method: 'POST',
                body: JSON.stringify({
                    customer_name: customer.trim() || t.walkIn,
                    customer_phone: phone.trim() || null,
                    sale_date: date,
                    lines: lines
                        .filter((line) => line.item_id && Number(line.quantity) > 0)
                        .map((line) => ({
                            item_id: Number(line.item_id),
                            quantity: Math.floor(Number(line.quantity)),
                            unit_price: Number(line.unit_price) || 0,
                        })),
                    discount_amount: discountValue || 0,
                    paid_amount: paidValue || 0,
                    payment_method: paidValue > 0 ? method : null,
                    payment_reference: paidValue > 0 && reference.trim() ? reference.trim() : null,
                    due_date: balance > 0 && dueDate ? dueDate : null,
                    deduct_stock: deductStock,
                    warehouse_id: deductStock && warehouseId ? Number(warehouseId) : null,
                    notes: notes.trim() || null,
                }),
            });
            onSaved(response.sale);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not save this sale.');
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
                        {t.cancel}
                    </button>
                    <button className="primary-btn" onClick={submit} disabled={busy || !options.items.length}>
                        {busy ? t.saving : t.save}
                    </button>
                </>
            }
        >
            {error && <div className="ms-error">{error}</div>}

            {!options.items.length ? (
                <div className="ms-error">{t.noProducts}</div>
            ) : (
                <>
                    <div className="ms-grid three">
                        <label className="ms-field">
                            {t.customer}
                            <input
                                list="ms-customers"
                                value={customer}
                                placeholder={t.walkIn}
                                onChange={(event) => chooseCustomer(event.target.value)}
                            />
                            <datalist id="ms-customers">
                                {options.customers.map((entry) => (
                                    <option key={entry.name} value={entry.name} />
                                ))}
                            </datalist>
                            <span className="ms-help">{t.customerHint}</span>
                        </label>
                        <label className="ms-field">
                            {t.phone}
                            <input value={phone} inputMode="tel" onChange={(event) => setPhone(event.target.value)} />
                        </label>
                        <label className="ms-field">
                            {t.date}
                            <input
                                type="date"
                                value={date}
                                max={new Date().toISOString().slice(0, 10)}
                                onChange={(event) => setDate(event.target.value)}
                            />
                        </label>
                    </div>

                    <section className="ms-section">
                        <h3>{t.products}</h3>
                        <div className="ms-line ms-line-head">
                            <span>{t.product}</span>
                            <span>{t.quantity}</span>
                            <span>{t.price}</span>
                            <span style={{ textAlign: 'right' }}>{t.amount}</span>
                            <span />
                        </div>
                        {lines.map((line) => {
                            const item = items.get(line.item_id);

                            return (
                                <div className="ms-line" key={line.key}>
                                    <label className="ms-field">
                                        <select value={line.item_id} onChange={(event) => chooseProduct(line.key, event.target.value)}>
                                            <option value="">{t.chooseProduct}</option>
                                            {options.items.map((option) => (
                                                <option key={option.id} value={option.id}>
                                                    {option.name} ({format.number(Number(option.on_hand))} {t.inStock})
                                                </option>
                                            ))}
                                        </select>
                                        {item && Number(line.quantity) > Number(item.on_hand) && deductStock && item.type !== 'service' && (
                                            <span className="ms-help" style={{ color: 'var(--ms-bad)' }}>
                                                {format.number(Number(item.on_hand))} {t.inStock}
                                            </span>
                                        )}
                                    </label>
                                    <label className="ms-field">
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            value={line.quantity}
                                            onChange={(event) => changeLine(line.key, { quantity: event.target.value })}
                                        />
                                    </label>
                                    <label className="ms-field">
                                        <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            inputMode="decimal"
                                            value={line.unit_price}
                                            onChange={(event) => changeLine(line.key, { unit_price: event.target.value })}
                                        />
                                    </label>
                                    <div className="amount">{format.money(lineAmount(line))}</div>
                                    <button
                                        type="button"
                                        className="remove"
                                        aria-label={t.remove}
                                        title={t.remove}
                                        disabled={lines.length === 1}
                                        onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                        <div>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => setLines((current) => [...current, emptyLine(Math.max(...current.map((l) => l.key)) + 1)])}
                            >
                                + {t.addProduct}
                            </button>
                        </div>
                    </section>

                    <div className="ms-grid">
                        <section className="ms-section">
                            <h3>{t.payment}</h3>
                            <label className="ms-field">
                                {t.discount}
                                <input type="number" min={0} step="any" value={discount} onChange={(event) => setDiscount(event.target.value)} />
                            </label>
                            <label className="ms-field">
                                {t.paidNow}
                                <input type="number" min={0} step="any" value={paid} onChange={(event) => setPaid(event.target.value)} />
                            </label>
                            <div className="ms-quick">
                                <button type="button" className="secondary-btn" onClick={() => setPaid(String(total))}>
                                    {t.payFull}
                                </button>
                                <button type="button" className="secondary-btn" onClick={() => setPaid('')}>
                                    {t.payLater}
                                </button>
                            </div>
                            {paidValue > 0 && (
                                <>
                                    <label className="ms-field">
                                        {t.method}
                                        <select value={method} onChange={(event) => setMethod(event.target.value)}>
                                            {options.payment_methods.map((entry) => (
                                                <option key={entry} value={entry}>
                                                    {text.methods[entry] ?? entry}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="ms-field">
                                        {t.reference}
                                        <input value={reference} placeholder={t.reference_hint} onChange={(event) => setReference(event.target.value)} />
                                    </label>
                                </>
                            )}
                            {balance > 0 && (
                                <label className="ms-field">
                                    {t.dueDate}
                                    <input type="date" value={dueDate} min={date} onChange={(event) => setDueDate(event.target.value)} />
                                </label>
                            )}
                        </section>

                        <section className="ms-section">
                            <h3>{t.subtotal}</h3>
                            <div className="ms-totals">
                                <div>
                                    <span>{t.subtotal}</span>
                                    <span>{format.money(subtotal)}</span>
                                </div>
                                {discountValue > 0 && (
                                    <div>
                                        <span>{t.discount}</span>
                                        <span>− {format.money(discountValue)}</span>
                                    </div>
                                )}
                                <div className="grand">
                                    <span>{t.total}</span>
                                    <span>{format.money(total)}</span>
                                </div>
                                <div className="good">
                                    <span>{t.paidNow}</span>
                                    <span>{format.money(paidValue)}</span>
                                </div>
                                {balance > 0 && (
                                    <div className="owed">
                                        <span>{t.balanceLeft(format.money(balance))}</span>
                                    </div>
                                )}
                            </div>
                            <label className="ms-check">
                                <input type="checkbox" checked={deductStock} onChange={(event) => setDeductStock(event.target.checked)} />
                                <span>
                                    {t.takeFromStock}
                                    <span className="ms-help" style={{ display: 'block' }}>
                                        {t.takeFromStockHint}
                                    </span>
                                </span>
                            </label>
                            {deductStock && options.warehouses.length > 1 && (
                                <label className="ms-field">
                                    {t.warehouse}
                                    <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                                        <option value="">{t.automatic}</option>
                                        {options.warehouses.map((warehouse) => (
                                            <option key={warehouse.id} value={warehouse.id}>
                                                {warehouse.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <label className="ms-field">
                                {t.notes}
                                <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
                            </label>
                        </section>
                    </div>
                </>
            )}
        </Modal>
    );
}
