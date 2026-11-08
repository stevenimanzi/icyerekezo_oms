import { useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Alerts, Empty, Kpi, PageHead, fmtDate, methodLabel, money, useDebounced, useFinanceData } from './financeKit';

const paymentTone = (status: string) => (status === 'paid' ? 'good' : status === 'partially_paid' ? 'warn' : 'bad');
const paymentLabel = (status: string) =>
    ({ paid: 'Paid', partially_paid: 'Part paid', unpaid: 'Unpaid' })[status as 'paid'] || status;

export default function ClientsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
    const [search, setSearch] = useState('');
    const [owing, setOwing] = useState(false);
    const [selected, setSelected] = useState<any>(null);
    const debounced = useDebounced(search);

    const query = new URLSearchParams();
    if (debounced) query.set('search', debounced);
    if (owing) query.set('owing', '1');
    const { data, loading, error, reload } = useFinanceData<any>(`/api/finance/books/clients?${query.toString()}`);
    const currency = data?.currency || 'RWF';
    const summary = data?.summary;
    const clients: any[] = data?.clients || [];

    return (
        <section className="fb-page">
            <PageHead
                title="Clients"
                subtitle="Every school and customer you sell to, what they have been billed, what they have paid and what they still owe."
                loading={loading}
                onRefresh={reload}
            >
                <button type="button" onClick={() => onNavigate?.('sales')}>
                    Open orders & invoices
                </button>
            </PageHead>
            <Alerts error={error} />

            <div className="fb-panel">
                <div className="fb-filters">
                    <label className="fb-search">
                        Find a client
                        <Search size={14} />
                        <input placeholder="School or customer name" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                    <label className="fb-check">
                        <input type="checkbox" checked={owing} onChange={(event) => setOwing(event.target.checked)} />
                        Only clients who owe money
                    </label>
                </div>
            </div>

            {summary && (
                <div className="fb-kpis">
                    <Kpi label="Clients" value={summary.clients} hint={`${summary.owing_clients} owe money`} />
                    <Kpi label="Billed" value={money(summary.billed, currency)} hint="All orders" />
                    <Kpi label="Collected" value={money(summary.paid, currency)} hint="Verified payments" tone="good" />
                    <Kpi label="Still owed" value={money(summary.balance, currency)} hint="Billed minus collected" tone={summary.balance > 0 ? 'warn' : 'good'} />
                    <Kpi label="Overdue" value={money(summary.overdue, currency)} hint="Past the due date" tone={summary.overdue > 0 ? 'bad' : 'good'} />
                </div>
            )}

            <div className="fb-panel">
                <h2>Client list ({clients.length})</h2>
                {loading && !data ? (
                    <Empty>Loading clients…</Empty>
                ) : clients.length === 0 ? (
                    <Empty>No clients match.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th className="num">Orders</th>
                                    <th className="num">Billed</th>
                                    <th className="num">Paid</th>
                                    <th className="num">Owes</th>
                                    <th className="num">Overdue</th>
                                    <th>Last order</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map((client) => (
                                    <tr key={client.key}>
                                        <td>
                                            {client.name}{' '}
                                            <span className={`fb-pill ${client.type === 'school' ? 'info' : ''}`}>
                                                {client.type === 'school' ? 'School' : 'Customer'}
                                            </span>
                                            <small>{[client.phone, client.email].filter(Boolean).join(' · ') || 'No contact saved'}</small>
                                        </td>
                                        <td className="num">{client.orders}</td>
                                        <td className="num">{money(client.billed, currency)}</td>
                                        <td className="num fb-in">{money(client.paid, currency)}</td>
                                        <td className={`num ${client.balance > 0 ? 'fb-out' : ''}`}>{money(client.balance, currency)}</td>
                                        <td className={`num ${client.overdue > 0 ? 'fb-out' : ''}`}>
                                            {client.overdue > 0 ? money(client.overdue, currency) : '—'}
                                        </td>
                                        <td>{fmtDate(client.last_order_date)}</td>
                                        <td className="num">
                                            <button type="button" className="fb-btn small" onClick={() => setSelected(client)}>
                                                <Eye size={13} />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selected && <ClientDetail client={selected} currency={currency} onClose={() => setSelected(null)} />}
        </section>
    );
}

function ClientDetail({ client, currency, onClose }: { client: any; currency: string; onClose: () => void }) {
    const query = new URLSearchParams(client.school_id ? { school_id: String(client.school_id) } : { name: client.name });
    const detail = useFinanceData<any>(`/api/finance/books/clients/detail?${query.toString()}`);

    return (
        <Modal title={client.name} onClose={onClose}>
            <div className="fb-form">
                <div className="fb-kpis">
                    <Kpi label="Billed" value={money(client.billed, currency)} />
                    <Kpi label="Paid" value={money(client.paid, currency)} tone="good" />
                    <Kpi label="Owes" value={money(client.balance, currency)} tone={client.balance > 0 ? 'warn' : 'good'} />
                </div>
                <Alerts error={detail.error} />
                <h2>Orders</h2>
                {detail.loading && !detail.data ? (
                    <Empty>Loading…</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Date</th>
                                    <th>Due</th>
                                    <th>Payment</th>
                                    <th className="num">Total</th>
                                    <th className="num">Owes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(detail.data?.documents || []).map((order: any) => (
                                    <tr key={order.document_number}>
                                        <td>
                                            {order.document_number}
                                            <small>{String(order.status).replaceAll('_', ' ')}</small>
                                        </td>
                                        <td>{fmtDate(order.document_date)}</td>
                                        <td>{fmtDate(order.due_date)}</td>
                                        <td>
                                            <span className={`fb-pill ${paymentTone(order.payment_status)}`}>{paymentLabel(order.payment_status)}</span>
                                        </td>
                                        <td className="num">{money(order.total_amount, currency)}</td>
                                        <td className={`num ${order.balance > 0 ? 'fb-out' : ''}`}>{money(order.balance, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <h2>Payments received</h2>
                {(detail.data?.payments || []).length === 0 ? (
                    <Empty>No payments yet.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Order</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="num">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detail.data.payments.map((payment: any, index: number) => (
                                    <tr key={index}>
                                        <td>{fmtDate(payment.date)}</td>
                                        <td>{payment.document_number}</td>
                                        <td>{methodLabel(payment.method)}</td>
                                        <td>{payment.reference || '—'}</td>
                                        <td className="num fb-in">{money(payment.amount, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="fb-hint">
                    Record new payments from Orders & Invoices or Money Collected; they appear here and in the Cash Book automatically.
                </p>
            </div>
        </Modal>
    );
}
