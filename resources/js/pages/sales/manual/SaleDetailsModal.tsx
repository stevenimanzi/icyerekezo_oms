import { useState } from 'react';
import { api } from '../../../core/api';
import type { Format } from '../../../core/format';
import { Modal } from '../../../components/Modal';
import { StatusChip } from './components/StatusChip';
import type { salesText } from './text';
import type { Sale } from './types';

type Props = {
    sale: Sale;
    methods: string[];
    canRecord: boolean;
    text: (typeof salesText)['en'];
    format: Format;
    onClose: () => void;
    onChanged: (message: string) => void;
};

export function SaleDetailsModal({
    sale,
    methods,
    canRecord,
    text,
    format,
    onClose,
    onChanged,
}: Props) {
    const t = text.details;
    const cancelled = sale.status === 'cancelled';
    const total = Number(sale.total_amount);
    const paid = Number(sale.paid_amount);
    const balance = Math.max(0, total - paid);
    const subtotal = total + Number(sale.discount_amount);

    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState(methods[0] ?? 'cash');
    const [reference, setReference] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const call = async (url: string, body: object, message: string) => {
        setBusy(true);
        setError('');
        try {
            await api(url, { method: 'POST', body: JSON.stringify(body) });
            onChanged(message);
        } catch (reasonError) {
            setError(reasonError instanceof Error ? reasonError.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${t.title} ${sale.document_number}`}
            onClose={onClose}
            footer={
                <>
                    <button
                        className="secondary-btn"
                        onClick={() =>
                            window.open(`/api/sales/manual/${sale.id}/receipt`, '_blank')
                        }
                    >
                        {text.form.printReceipt}
                    </button>
                    <button className="primary-btn" onClick={onClose}>
                        {t.close}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            {cancelled && sale.cancel_reason && (
                <div className="ui-error">{t.cancelledBecause(sale.cancel_reason)}</div>
            )}

            <div className="ui-facts">
                <div>
                    <small>{text.table.customer}</small>
                    <b>{sale.customer_name}</b>
                </div>
                {sale.customer_phone && (
                    <div>
                        <small>{t.phone}</small>
                        <b>{sale.customer_phone}</b>
                    </div>
                )}
                <div>
                    <small>{text.table.date}</small>
                    <b>{format.date(sale.document_date)}</b>
                </div>
                <div>
                    <small>{t.soldBy}</small>
                    <b>{sale.creator?.name ?? '—'}</b>
                </div>
                <div>
                    <small>{text.table.status}</small>
                    <b>
                        <StatusChip sale={sale} text={text} />
                    </b>
                </div>
                {sale.due_date && !cancelled && balance > 0 && (
                    <div>
                        <small>{t.due}</small>
                        <b>{format.date(sale.due_date)}</b>
                    </div>
                )}
            </div>

            {sale.notes && (
                <p className="ui-help" style={{ margin: 0 }}>
                    {t.notes}: {sale.notes}
                </p>
            )}

            <div
                className="ui-table-wrap"
                style={{ border: '1px solid var(--line)', borderRadius: 12 }}
            >
                <table className="ui-table" style={{ minWidth: 520 }}>
                    <thead>
                        <tr>
                            <th>{t.product}</th>
                            <th className="num">{t.quantity}</th>
                            <th className="num">{t.price}</th>
                            <th className="num">{t.amount}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.lines.map((line) => (
                            <tr key={line.id}>
                                <td>{line.item?.name ?? '—'}</td>
                                <td className="num">{line.quantity_ordered}</td>
                                <td className="num">{format.money(Number(line.unit_price))}</td>
                                <td className="num">
                                    <b>{format.money(Number(line.line_total))}</b>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="ui-totals">
                {Number(sale.discount_amount) > 0 && (
                    <>
                        <div>
                            <span>{text.form.subtotal}</span>
                            <span>{format.money(subtotal)}</span>
                        </div>
                        <div>
                            <span>{t.discount}</span>
                            <span>− {format.money(Number(sale.discount_amount))}</span>
                        </div>
                    </>
                )}
                <div className="grand">
                    <span>{t.total}</span>
                    <span>{format.money(total)}</span>
                </div>
                <div className="good">
                    <span>{t.paid}</span>
                    <span>{format.money(paid)}</span>
                </div>
                {!cancelled && balance > 0 && (
                    <div className="owed">
                        <span>{t.balance}</span>
                        <span>{format.money(balance)}</span>
                    </div>
                )}
            </div>

            <section className="ui-section">
                <h3>{t.payments}</h3>
                {sale.payments.length ? (
                    <ul className="ui-payments">
                        {sale.payments.map((payment) => (
                            <li key={payment.id}>
                                <span>
                                    {format.date(payment.paid_on)} ·{' '}
                                    {text.methods[payment.method] ?? payment.method}
                                    {payment.reference ? ` · ${payment.reference}` : ''}
                                </span>
                                <b>{format.money(Number(payment.amount))}</b>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <span className="ui-help">{t.noPayments}</span>
                )}
            </section>

            {canRecord && !cancelled && balance > 0 && (
                <section className="ui-section">
                    <h3>{t.addPayment}</h3>
                    <div className="ui-grid three">
                        <label className="ui-field">
                            {t.paymentAmount}
                            <input
                                type="number"
                                min={0}
                                step="any"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                            />
                        </label>
                        <label className="ui-field">
                            {text.form.method}
                            <select
                                value={method}
                                onChange={(event) => setMethod(event.target.value)}
                            >
                                {methods.map((entry) => (
                                    <option key={entry} value={entry}>
                                        {text.methods[entry] ?? entry}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="ui-field">
                            {text.form.reference}
                            <input
                                value={reference}
                                onChange={(event) => setReference(event.target.value)}
                            />
                        </label>
                    </div>
                    <div className="ui-quick">
                        <button
                            className="secondary-btn"
                            onClick={() => setAmount(String(balance))}
                        >
                            {text.form.payFull}
                        </button>
                        <button
                            className="primary-btn"
                            disabled={busy || !(Number(amount) > 0)}
                            onClick={() =>
                                call(
                                    `/api/sales/manual/${sale.id}/payments`,
                                    {
                                        amount: Number(amount),
                                        method,
                                        reference: reference.trim() || null,
                                    },
                                    t.paymentSaved,
                                )
                            }
                        >
                            {t.saveAndPay}
                        </button>
                    </div>
                </section>
            )}

            {canRecord && !cancelled && (
                <section className="ui-section">
                    {!cancelling ? (
                        <div>
                            <button className="secondary-btn" onClick={() => setCancelling(true)}>
                                {t.cancelSale}
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3>{t.cancelSale}</h3>
                            <span className="ui-help">{t.cancelHint}</span>
                            <label className="ui-field">
                                {t.reason}
                                <input
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                />
                            </label>
                            <div className="ui-quick">
                                <button
                                    className="secondary-btn"
                                    onClick={() => setCancelling(false)}
                                >
                                    {t.keep}
                                </button>
                                <button
                                    className="primary-btn"
                                    disabled={busy || reason.trim().length < 3}
                                    onClick={() =>
                                        call(
                                            `/api/sales/manual/${sale.id}/cancel`,
                                            { reason: reason.trim() },
                                            t.cancelled,
                                        )
                                    }
                                >
                                    {t.confirmCancel}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            )}
        </Modal>
    );
}
