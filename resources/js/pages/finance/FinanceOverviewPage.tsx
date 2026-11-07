import React, { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    Download,
    Eye,
    FileText,
    Package,
    RefreshCw,
    Search,
    TrendingUp,
    Wallet,
    XCircle,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

async function api(url: string, options: RequestInit = {}) {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf,
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Finance & Sales data could not be read. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || 'Finance & Sales data could not be loaded.');
    return data;
}

const money = (value: any, currency = 'RWF') =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'RWF' ? 0 : 2,
    }).format(Number(value || 0));

const date = (value: any) => {
    if (!value) return 'Not set';
    const parsed = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleDateString();
};

const orderStatusLabel = (value: string) =>
    (
        ({
            pending: 'Pending',
            accepted: 'Accepted',
            partial: 'Partial delivery',
            delivered: 'Delivered',
            rejected: 'Rejected',
        }) as Record<string, string>
    )[value] || String(value || '').replaceAll('_', ' ');

export default function FinanceOverviewPage({
    onNavigate,
}: { compact?: boolean; onNavigate?: (page: string) => void } = {}) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState<number | null>(null);
    const [orderBusy, setOrderBusy] = useState<number | null>(null);
    const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

    // Tabs: 'orders' | 'receipts' | 'history'
    const [activeTab, setActiveTab] = useState<'orders' | 'receipts' | 'history'>('orders');

    // Chart metric tab: 'approved' (Collections) | 'orders' (Order volume)
    const [chartMetric, setChartMetric] = useState<'approved' | 'orders'>('approved');

    // Filters for orders table
    const [searchOrder, setSearchOrder] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');

    const load = () => {
        setLoading(true);
        api('/api/finance/overview')
            .then((result) => {
                setData(result);
                setError('');
            })
            .catch((reason: any) => setError(reason.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    // Payment receipt review decision
    const decideReceipt = async (submissionId: number, decision: 'approved' | 'rejected') => {
        setBusy(submissionId);
        setError('');
        setSuccess('');
        try {
            await api(`/api/finance/payments/${submissionId}/decision`, {
                method: 'POST',
                body: JSON.stringify({ decision, review_note: noteDraft[submissionId] || null }),
            });
            setSuccess(
                decision === 'approved'
                    ? 'Payment verified and credited to customer order.'
                    : 'Payment receipt rejected.',
            );
            load();
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(null);
        }
    };

    // Customer order review decision
    const decideOrder = async (orderId: number, decision: 'accept' | 'reject') => {
        setOrderBusy(orderId);
        setError('');
        setSuccess('');
        try {
            await api(`/api/sales/orders/${orderId}/decision`, {
                method: 'PATCH',
                body: JSON.stringify({
                    decision,
                    reason: decision === 'reject' ? 'Declined by Finance & Sales Manager' : null,
                }),
            });
            setSuccess(decision === 'accept' ? 'Customer order accepted.' : 'Customer order rejected.');
            load();
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setOrderBusy(null);
        }
    };

    const summary = data?.summary || {};
    const orders = data?.orders || [];
    const pendingReceipts = data?.pending_receipts || [];
    const recentDecisions = data?.recent_decisions || [];
    const paymentTrend = data?.payment_trend || [];
    const currency = orders[0]?.currency_code || 'RWF';

    const filteredOrders = useMemo(() => {
        return orders.filter((o: any) => {
            if (searchOrder) {
                const term = searchOrder.toLowerCase();
                const matchDoc = (o.document_number || '').toLowerCase().includes(term);
                const matchCustomer = (o.customer_name || '').toLowerCase().includes(term);
                const matchSchool = (o.school?.name || '').toLowerCase().includes(term);
                if (!matchDoc && !matchCustomer && !matchSchool) return false;
            }
            if (statusFilter !== 'all' && o.status !== statusFilter) return false;
            if (paymentFilter !== 'all' && o.payment_status !== paymentFilter) return false;
            return true;
        });
    }, [orders, searchOrder, statusFilter, paymentFilter]);

    const chartTotal = paymentTrend.reduce(
        (sum: number, pt: any) => sum + (chartMetric === 'approved' ? (pt.approved || 0) : (pt.orders || 0)),
        0,
    );

    return (
        <section className="module-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Heading */}
            <div className="page-heading" style={{ margin: 0 }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>
                        Finance & Sales Dashboard
                    </h1>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
                        Unified real-time financial collections, revenue oversight, incoming sales orders, and receipt verification.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="secondary-btn" disabled={loading} onClick={load}>
                        <RefreshCw className={loading ? 'spin' : ''} size={15} />
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                    {onNavigate && (
                        <button className="primary-btn" onClick={() => onNavigate('sales')}>
                            <Package size={15} />
                            Orders & Sales
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            {/* Row 1: Unified High-Performance 5 KPI Cards */}
            <section
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                }}
            >
                <article className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <small style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'block' }}>
                        SALES INVOICED
                    </small>
                    <strong style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', display: 'block', margin: '4px 0 2px 0' }}>
                        {money(summary.invoiced_amount, currency)}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Total billed across orders
                    </span>
                </article>

                <article className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <small style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, display: 'block' }}>
                        CASH COLLECTED / PAID
                    </small>
                    <strong style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', display: 'block', margin: '4px 0 2px 0' }}>
                        {money(summary.paid_amount, currency)}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Verified customer payments
                    </span>
                </article>

                <article className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <small style={{ fontSize: '12px', color: '#b45309', fontWeight: 600, display: 'block' }}>
                        OUTSTANDING RECEIVABLES
                    </small>
                    <strong style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', display: 'block', margin: '4px 0 2px 0' }}>
                        {money(summary.outstanding_amount, currency)}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Remaining to be collected
                    </span>
                </article>

                <article className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <small style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, display: 'block' }}>
                        CUSTOMER ORDERS
                    </small>
                    <strong style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', display: 'block', margin: '4px 0 2px 0' }}>
                        {summary.orders_count || 0}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {summary.pending_orders || 0} pending · {summary.delivered_orders || 0} delivered
                    </span>
                </article>

                <article
                    className="panel"
                    style={{
                        padding: '16px 20px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: (summary.pending_receipts || 0) > 0 ? '#fffbeb' : '#ffffff',
                    }}
                >
                    <small style={{ fontSize: '12px', color: (summary.pending_receipts || 0) > 0 ? '#b45309' : '#64748b', fontWeight: 600, display: 'block' }}>
                        RECEIPTS TO VERIFY
                    </small>
                    <strong style={{ fontSize: '22px', fontWeight: 800, color: (summary.pending_receipts || 0) > 0 ? '#b45309' : '#0f172a', display: 'block', margin: '4px 0 2px 0' }}>
                        {summary.pending_receipts || 0}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Payment proof waiting approval
                    </span>
                </article>
            </section>

            {/* Row 2: Developed Full-Width Trend Chart */}
            <article className="panel" style={{ padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                    <div>
                        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                            {chartMetric === 'approved' ? 'Verified Cash Collections Trend (7 Days)' : 'Incoming Customer Orders Volume (7 Days)'}
                        </h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                            Total for this period: <b style={{ color: '#0f172a' }}>{chartMetric === 'approved' ? money(chartTotal, currency) : `${chartTotal} orders`}</b>
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setChartMetric('approved')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: chartMetric === 'approved' ? '#2563eb' : '#e2e8f0',
                                background: chartMetric === 'approved' ? '#eff6ff' : '#ffffff',
                                color: chartMetric === 'approved' ? '#2563eb' : '#64748b',
                                fontWeight: 600,
                                fontSize: '12.5px',
                                cursor: 'pointer',
                            }}
                        >
                            Collections (RWF)
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartMetric('orders')}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: chartMetric === 'orders' ? '#2563eb' : '#e2e8f0',
                                background: chartMetric === 'orders' ? '#eff6ff' : '#ffffff',
                                color: chartMetric === 'orders' ? '#2563eb' : '#64748b',
                                fontWeight: 600,
                                fontSize: '12.5px',
                                cursor: 'pointer',
                            }}
                        >
                            Daily Orders
                        </button>
                    </div>
                </div>

                {/* Explanatory Banner */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        marginBottom: '16px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#1e40af',
                    }}
                >
                    <span style={{ width: '16px', height: '3px', background: '#2563eb', borderRadius: '2px', display: 'inline-block' }} />
                    <span>
                        {chartMetric === 'approved'
                            ? 'Blue line represents total verified customer payments (RWF) approved and credited to orders each day.'
                            : 'Blue line represents total count of customer and school purchase orders received each day.'}
                    </span>
                </div>

                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={paymentTrend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="finSalesFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line, #e2e8f0)" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={60}
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                tickFormatter={(val: number) => (chartMetric === 'approved' ? `${Math.round(val / 1000)}k` : String(val))}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    fontSize: '12px',
                                }}
                                formatter={(value: any) => [
                                    chartMetric === 'approved' ? money(value, currency) : `${value} orders`,
                                    chartMetric === 'approved' ? 'Verified Collection' : 'Orders Received',
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey={chartMetric}
                                stroke="#2563eb"
                                strokeWidth={3}
                                fill="url(#finSalesFill)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </article>

            {/* Row 3: Dual Operational Workspaces (Tabbed Navigation) */}
            <article className="panel" style={{ padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: '12px',
                        marginBottom: '16px',
                    }}
                >
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('orders')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === 'orders' ? '#2563eb' : 'transparent',
                                color: activeTab === 'orders' ? '#ffffff' : '#64748b',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <TrendingUp size={15} />
                            Customer Orders & Invoices
                            <span
                                style={{
                                    fontSize: '11px',
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    background: activeTab === 'orders' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                                    color: activeTab === 'orders' ? '#ffffff' : '#0f172a',
                                }}
                            >
                                {orders.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('receipts')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === 'receipts' ? '#2563eb' : 'transparent',
                                color: activeTab === 'receipts' ? '#ffffff' : '#64748b',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <Wallet size={15} />
                            Payment Receipts to Verify
                            {pendingReceipts.length > 0 && (
                                <span
                                    style={{
                                        fontSize: '11px',
                                        padding: '2px 7px',
                                        borderRadius: '10px',
                                        background: activeTab === 'receipts' ? '#ef4444' : '#fee2e2',
                                        color: activeTab === 'receipts' ? '#ffffff' : '#dc2626',
                                        fontWeight: 800,
                                    }}
                                >
                                    {pendingReceipts.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('history')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: activeTab === 'history' ? '#2563eb' : 'transparent',
                                color: activeTab === 'history' ? '#ffffff' : '#64748b',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            Verified History ({recentDecisions.length})
                        </button>
                    </div>

                    {activeTab === 'orders' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                                <input
                                    placeholder="Search order or school..."
                                    value={searchOrder}
                                    onChange={(e) => setSearchOrder(e.target.value)}
                                    style={{
                                        padding: '6px 10px 6px 30px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        width: '210px',
                                    }}
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    fontSize: '12.5px',
                                    background: '#ffffff',
                                }}
                            >
                                <option value="all">All Order Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="accepted">Accepted</option>
                                <option value="delivered">Delivered</option>
                                <option value="rejected">Rejected</option>
                            </select>

                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    fontSize: '12.5px',
                                    background: '#ffffff',
                                }}
                            >
                                <option value="all">All Payment Statuses</option>
                                <option value="unpaid">Unpaid</option>
                                <option value="partially_paid">Partially paid</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Tab 1 Content: Customer Orders Table */}
                {activeTab === 'orders' && (
                    <div className="ui-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="ui-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>ORDER #</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>CUSTOMER / SCHOOL</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>ORDER STATUS</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>PAYMENT STATUS</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>TOTAL AMOUNT</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>PAID</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>BALANCE DUE</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>DATE</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.length ? (
                                    filteredOrders.map((item: any) => {
                                        const balance = Math.max(0, Number(item.total_amount || 0) - Number(item.paid_amount || 0));
                                        const isPaid = item.payment_status === 'paid' || balance === 0;
                                        const isPartial = item.payment_status === 'partially_paid' || (Number(item.paid_amount || 0) > 0 && !isPaid);

                                        return (
                                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                                                    {item.document_number}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#1e293b' }}>
                                                    {item.school?.name || item.customer_name || 'Direct Customer'}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            padding: '3px 8px',
                                                            borderRadius: '6px',
                                                            background:
                                                                item.status === 'delivered'
                                                                    ? '#dcfce7'
                                                                    : item.status === 'accepted'
                                                                      ? '#eff6ff'
                                                                      : item.status === 'rejected'
                                                                        ? '#fee2e2'
                                                                        : '#fef3c7',
                                                            color:
                                                                item.status === 'delivered'
                                                                    ? '#15803d'
                                                                    : item.status === 'accepted'
                                                                      ? '#2563eb'
                                                                      : item.status === 'rejected'
                                                                        ? '#b91c1c'
                                                                        : '#b45309',
                                                        }}
                                                    >
                                                        {orderStatusLabel(item.status)}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            padding: '3px 8px',
                                                            borderRadius: '6px',
                                                            background: isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2',
                                                            color: isPaid ? '#15803d' : isPartial ? '#b45309' : '#b91c1c',
                                                            border: `1px solid ${isPaid ? '#86efac' : isPartial ? '#fde68a' : '#fca5a5'}`,
                                                        }}
                                                    >
                                                        {isPaid ? '✓ PAID' : isPartial ? 'PARTIALLY PAID' : 'UNPAID'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                                                    {money(item.total_amount, item.currency_code || currency)}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#15803d' }}>
                                                    {money(item.paid_amount, item.currency_code || currency)}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: balance > 0 ? '#dc2626' : '#15803d' }}>
                                                    {money(balance, item.currency_code || currency)}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>
                                                    {date(item.document_date)}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        {item.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    disabled={orderBusy === item.id}
                                                                    title="Accept Order"
                                                                    onClick={() => decideOrder(item.id, 'accept')}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '5px',
                                                                        border: '1px solid #86efac',
                                                                        background: '#dcfce7',
                                                                        color: '#15803d',
                                                                        fontSize: '11px',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                    }}
                                                                >
                                                                    <CheckCircle2 size={13} />
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={orderBusy === item.id}
                                                                    title="Reject Order"
                                                                    onClick={() => decideOrder(item.id, 'reject')}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '5px',
                                                                        border: '1px solid #fca5a5',
                                                                        background: '#fee2e2',
                                                                        color: '#dc2626',
                                                                        fontSize: '11px',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                    }}
                                                                >
                                                                    <XCircle size={13} />
                                                                    Reject
                                                                </button>
                                                            </>
                                                        )}
                                                        <a
                                                            href={`/api/sales/orders/${item.id}/pdf`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="Download Order Invoice PDF"
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #cbd5e1',
                                                                background: '#ffffff',
                                                                color: '#2563eb',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                textDecoration: 'none',
                                                            }}
                                                        >
                                                            <Download size={14} />
                                                        </a>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                                            No customer orders match your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 2 Content: Payment Receipts Verification */}
                {activeTab === 'receipts' && (
                    <div>
                        <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
                            Customer and school submitted payment receipts. Verifying and approving automatically updates the target order balance.
                        </div>

                        {pendingReceipts.length ? (
                            <div className="ui-table-wrap" style={{ overflowX: 'auto' }}>
                                <table className="ui-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>SCHOOL / CUSTOMER</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>TARGET ORDER</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>AMOUNT PAID</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>METHOD & REFERENCE</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>PROOF DOCUMENT</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>REVIEW NOTE</th>
                                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>DECISION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingReceipts.map((item: any) => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                                                    {item.school?.name || 'Customer'}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <b>{item.sales_document?.document_number || `Order #${item.sales_document_id}`}</b>
                                                    <br />
                                                    <small style={{ color: '#64748b' }}>
                                                        Total: {money(item.sales_document?.total_amount, currency)}
                                                    </small>
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: '#15803d', fontSize: '14px' }}>
                                                    {money(item.amount, currency)}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <span style={{ fontWeight: 600 }}>{item.payment_method}</span>
                                                    <br />
                                                    <small style={{ color: '#64748b' }}>Ref: {item.payment_reference || '—'}</small>
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    {item.proof_url ? (
                                                        <a
                                                            href={item.proof_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{
                                                                padding: '4px 10px',
                                                                borderRadius: '5px',
                                                                border: '1px solid #cbd5e1',
                                                                background: '#ffffff',
                                                                color: '#2563eb',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                textDecoration: 'none',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                            }}
                                                        >
                                                            <Eye size={13} />
                                                            View Proof
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>No file attached</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <input
                                                        placeholder="Optional audit comment..."
                                                        value={noteDraft[item.id] || ''}
                                                        onChange={(e) => setNoteDraft({ ...noteDraft, [item.id]: e.target.value })}
                                                        style={{
                                                            width: '180px',
                                                            padding: '5px 8px',
                                                            border: '1px solid #cbd5e1',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            type="button"
                                                            disabled={busy === item.id}
                                                            onClick={() => decideReceipt(item.id, 'approved')}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #15803d',
                                                                background: '#16a34a',
                                                                color: '#ffffff',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                            }}
                                                        >
                                                            <CheckCircle2 size={14} />
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy === item.id}
                                                            onClick={() => decideReceipt(item.id, 'rejected')}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #b91c1c',
                                                                background: '#dc2626',
                                                                color: '#ffffff',
                                                                fontSize: '12px',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                            }}
                                                        >
                                                            <XCircle size={14} />
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                                ✓ All customer payment receipts have been reviewed. No submissions are pending verification.
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 3 Content: Verified Receipts History */}
                {activeTab === 'history' && (
                    <div className="ui-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="ui-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>SCHOOL / CUSTOMER</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>ORDER #</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>AMOUNT</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>DECISION</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>REVIEWED BY</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>DATE</th>
                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#475569' }}>NOTE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentDecisions.length ? (
                                    recentDecisions.map((dec: any) => (
                                        <tr key={dec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 600 }}>
                                                {dec.school?.name || 'Customer'}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                {dec.sales_document?.document_number || `Order #${dec.sales_document_id}`}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700 }}>
                                                {money(dec.amount, currency)}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                                                <span
                                                    style={{
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: dec.status === 'approved' ? '#dcfce7' : '#fee2e2',
                                                        color: dec.status === 'approved' ? '#15803d' : '#b91c1c',
                                                        border: `1px solid ${dec.status === 'approved' ? '#86efac' : '#fca5a5'}`,
                                                    }}
                                                >
                                                    {dec.status === 'approved' ? '✓ APPROVED' : '✗ REJECTED'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#475569' }}>
                                                {dec.reviewer?.name || 'Finance Staff'}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>
                                                {date(dec.reviewed_at)}
                                            </td>
                                            <td style={{ textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>
                                                {dec.review_note || '—'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                            No recent decision records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </article>
        </section>
    );
}
