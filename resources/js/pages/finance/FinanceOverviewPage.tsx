import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, FileText, PackageOpen, RefreshCw, Wallet, XCircle } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

async function api(url: string, options: RequestInit = {}) {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, ...(options.headers || {}) } });
    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Finance data could not be read. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || 'Finance data could not be loaded.');
    return data;
}

const money = (value: any, currency = 'RWF') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'RWF' ? 0 : 2 }).format(Number(value || 0));
const date = (value: any) => {
    if (!value) return 'Not set';
    const parsed = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleDateString();
};
const orderStatusLabel = (value: string) => ({ pending: 'Pending', accepted: 'Accepted', partial: 'Partial delivery', delivered: 'Delivered', rejected: 'Rejected' } as Record<string, string>)[value] || String(value || '').replaceAll('_', ' ');
const orderStatusClass = (value: string) => ({ pending: 'pending', accepted: 'accepted', partial: 'partial', delivered: 'delivered', rejected: 'rejected' } as Record<string, string>)[value] || '';
const paymentStatusLabel = (value: string) => ({ unpaid: 'Unpaid', partially_paid: 'Partially paid', paid: 'Paid' } as Record<string, string>)[value] || String(value || '').replaceAll('_', ' ');
const paymentStatusClass = (value: string) => ({ unpaid: 'rejected', partially_paid: 'partial', paid: 'accepted' } as Record<string, string>)[value] || '';

export default function FinanceOverviewPage({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: (page: string) => void } = {}) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState<number | null>(null);
    const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

    const load = () => {
        setLoading(true);
        api('/api/finance/overview')
            .then((result) => { setData(result); setError(''); })
            .catch((reason: any) => setError(reason.message))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const decide = async (submissionId: number, decision: 'approved' | 'rejected') => {
        setBusy(submissionId);
        setError('');
        setSuccess('');
        try {
            await api(`/api/finance/payments/${submissionId}/decision`, {
                method: 'POST',
                body: JSON.stringify({ decision, review_note: noteDraft[submissionId] || null }),
            });
            setSuccess(decision === 'approved' ? 'Payment approved and applied to the order.' : 'Payment receipt rejected.');
            load();
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(null);
        }
    };

    const summary = data?.summary || {};
    const orders = data?.orders || [];
    const pendingReceipts = data?.pending_receipts || [];
    const currency = orders[0]?.currency_code || 'RWF';

    return (
        <section className="module-page">
            <div className="page-heading">
                <div>
                    <h1>{compact ? 'Finance dashboard' : 'Finance overview'}</h1>
                    <p>{compact ? 'A quick glance at invoicing and collections, with shortcuts to the rest of finance.' : 'Review payment receipts, mark orders paid, and see every incoming order and its status.'}</p>
                </div>
                <button className="secondary-btn" disabled={loading} onClick={load}>
                    <RefreshCw className={loading ? 'spin' : ''} size={16} />{loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <section className="department-metrics cols-4">
                <article className="department-metric panel"><span className="metric-icon blue"><Wallet /></span><div><small>Invoiced</small><strong>{money(summary.invoiced_amount, currency)}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon green"><CheckCircle2 /></span><div><small>Paid</small><strong>{money(summary.paid_amount, currency)}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon amber"><FileText /></span><div><small>Outstanding</small><strong>{money(summary.outstanding_amount, currency)}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon red"><XCircle /></span><div><small>Receipts to review</small><strong>{summary.pending_receipts || 0}</strong></div></article>
            </section>

            <article className="panel chart-panel">
                <header className="department-panel-head"><div><h2>Payments approved (7 days)</h2><p>Total receipt amount approved and applied to orders each day.</p></div></header>
                <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data?.payment_trend || []} margin={{ top: 12, right: 18, left: -18, bottom: 2 }}>
                            <defs>
                                <linearGradient id="paymentFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="var(--line)" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} formatter={(value: any) => [money(value, currency), 'Approved']} />
                            <Area type="monotone" dataKey="approved" name="Approved" stroke="#2563eb" fill="url(#paymentFill)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </article>

            {compact ? (
                <div className="department-dashboard" style={{ padding: 0 }}>
                    <div className="production-quick-actions">
                        <button onClick={() => onNavigate?.('finance')}>
                            <XCircle /><span><b>Review receipts & orders</b><small>Approve payment receipts and see every incoming order</small></span>
                        </button>
                        <button onClick={() => onNavigate?.('sales')}>
                            <PackageOpen /><span><b>Orders & invoices</b><small>View orders, upload and download invoices</small></span>
                        </button>
                        <button style={{ gridColumn: '1 / -1' }} onClick={() => onNavigate?.('finance-reports')}>
                            <Activity /><span><b>Financial reports</b><small>Generate revenue, invoice and receipt reports</small></span>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <article className="panel">
                        <header className="department-panel-head">
                            <div>
                                <h2>Payment receipts to review</h2>
                                <p>Uploaded by schools after making a payment. Approving applies the amount to the order automatically.</p>
                            </div>
                        </header>
                        {pendingReceipts.length ? (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead><tr><th>School</th><th>Order</th><th>Amount</th><th>Method</th><th>Reference</th><th>Proof</th><th>Note</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {pendingReceipts.map((item: any) => (
                                            <tr key={item.id}>
                                                <td>{item.school?.name || 'School'}</td>
                                                <td>{item.sales_document?.document_number}</td>
                                                <td>{money(item.amount, currency)}</td>
                                                <td>{item.payment_method}</td>
                                                <td>{item.payment_reference || '—'}</td>
                                                <td>{item.proof_url ? <a href={item.proof_url} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                                                <td><input placeholder="Optional note" value={noteDraft[item.id] || ''} onChange={(e) => setNoteDraft({ ...noteDraft, [item.id]: e.target.value })} style={{ width: 140, padding: 6, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel)', color: 'var(--text)' }} /></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                                                        <button className="table-action" disabled={busy === item.id} style={{ color: '#15803d' }} onClick={() => decide(item.id, 'approved')}><CheckCircle2 size={15} />Approve</button>
                                                        <button className="table-action" disabled={busy === item.id} style={{ color: '#dc2626' }} onClick={() => decide(item.id, 'rejected')}><XCircle size={15} />Reject</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <div className="empty-cell" style={{ padding: 30 }}>No payment receipts are waiting for review.</div>}
                    </article>

                    <article className="panel">
                        <header className="department-panel-head">
                            <div>
                                <h2>Incoming orders</h2>
                                <p>Every customer order and its fulfilment and payment status. Order status is read-only here.</p>
                            </div>
                        </header>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>Order</th><th>Customer / school</th><th>Order status</th><th>Payment status</th><th>Total</th><th>Paid</th><th>Date</th></tr></thead>
                                <tbody>
                                    {orders.length ? orders.map((item: any) => (
                                        <tr key={item.id}>
                                            <td>{item.document_number}</td>
                                            <td>{item.school?.name || item.customer_name || 'Customer'}</td>
                                            <td><span className={`admin-status ${orderStatusClass(item.status)}`}>{orderStatusLabel(item.status)}</span></td>
                                            <td><span className={`admin-status ${paymentStatusClass(item.payment_status)}`}>{paymentStatusLabel(item.payment_status)}</span></td>
                                            <td>{money(item.total_amount, item.currency_code || currency)}</td>
                                            <td>{money(item.paid_amount, item.currency_code || currency)}</td>
                                            <td>{date(item.document_date)}</td>
                                        </tr>
                                    )) : <tr><td className="empty-cell" colSpan={7}>No orders recorded yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </>
            )}
        </section>
    );
}
