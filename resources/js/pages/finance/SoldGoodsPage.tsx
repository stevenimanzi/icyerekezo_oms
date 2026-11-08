import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import {
    Alerts,
    Empty,
    Kpi,
    PageHead,
    fmtDate,
    isoDate,
    money,
    monthStart,
    number,
    today,
    useFinanceData,
} from './financeKit';

const PERIODS = [
    { value: 'month', label: 'This month' },
    { value: 'quarter', label: 'Last 3 months' },
    { value: 'year', label: 'This year' },
    { value: 'all', label: 'Everything' },
    { value: 'custom', label: 'Choose dates' },
];

const SHIPMENT_STATUS: Record<string, { label: string; tone: string }> = {
    planned: { label: 'Planned', tone: '' },
    ready: { label: 'Ready to go', tone: 'info' },
    in_transit: { label: 'On the road', tone: 'warn' },
    delivered: { label: 'Delivered', tone: 'good' },
};

export default function SoldGoodsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
    const [period, setPeriod] = useState('month');
    const [custom, setCustom] = useState({ from: monthStart(), to: today() });

    const range = useMemo(() => {
        const now = new Date();
        if (period === 'quarter') return { from: isoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: today() };
        if (period === 'year') return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: today() };
        if (period === 'all') return { from: '2020-01-01', to: today() };
        if (period === 'custom') return custom;

        return { from: monthStart(), to: today() };
    }, [period, custom]);

    const { data, loading, error, reload } = useFinanceData<any>(
        `/api/finance/books/sold-goods?from=${range.from}&to=${range.to}`,
    );
    const currency = data?.currency || 'RWF';
    const summary = data?.summary;
    const products: any[] = data?.products || [];
    const shipments: any[] = data?.shipments || [];
    const hasPrices = products.some((product) => product.revenue > 0);

    return (
        <section className="fb-page">
            <PageHead
                title="Goods Sold & Delivered"
                subtitle="What was sold from stock, what logistics has delivered to clients, and what is still on the way."
                loading={loading}
                onRefresh={reload}
            >
                <button type="button" onClick={() => onNavigate?.('inventory')}>
                    <Boxes size={14} />
                    Check stock
                </button>
            </PageHead>
            <Alerts error={error} />

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Period
                        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                            {PERIODS.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {period === 'custom' && (
                        <>
                            <label>
                                From
                                <input type="date" value={custom.from} max={custom.to} onChange={(event) => setCustom({ ...custom, from: event.target.value })} />
                            </label>
                            <label>
                                To
                                <input type="date" value={custom.to} min={custom.from} max={today()} onChange={(event) => setCustom({ ...custom, to: event.target.value })} />
                            </label>
                        </>
                    )}
                </div>
            </div>

            {summary && (
                <div className="fb-kpis">
                    <Kpi label="Orders sold" value={number(summary.orders)} hint={`${money(summary.orders_value, currency)} billed`} />
                    <Kpi label="Units delivered" value={number(summary.units_sold)} hint="Taken out of stock and handed over" tone="good" />
                    <Kpi label="Delivered by logistics" value={number(summary.units_by_logistics)} hint={`${summary.shipments_delivered} shipments completed`} />
                    <Kpi label="On the road / planned" value={number(summary.shipments_open)} hint="Shipments not yet delivered" tone={summary.shipments_open > 0 ? 'warn' : undefined} />
                    <Kpi label="Orders awaiting delivery" value={number(summary.orders_awaiting_delivery)} hint="Accepted, not fully delivered" tone={summary.orders_awaiting_delivery > 0 ? 'warn' : 'good'} />
                </div>
            )}

            <div className="fb-panel">
                <h2>Products sold ({products.length})</h2>
                {loading && !data ? (
                    <Empty>Loading sales…</Empty>
                ) : products.length === 0 ? (
                    <Empty>No goods were sold in this period.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th className="num">Ordered</th>
                                    <th className="num">Packed</th>
                                    <th className="num">Delivered</th>
                                    <th className="num">Via logistics</th>
                                    <th className="num">Sales value</th>
                                    <th className="num">In stock now</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product, index) => (
                                    <tr key={`${product.item_id}-${index}`}>
                                        <td>
                                            {product.name}
                                            <small>{[product.sku, product.unit].filter(Boolean).join(' · ')}</small>
                                        </td>
                                        <td className="num">{number(product.ordered)}</td>
                                        <td className="num">{number(product.packed)}</td>
                                        <td className="num fb-in">{number(product.delivered)}</td>
                                        <td className="num">{number(product.by_logistics)}</td>
                                        <td className="num">{product.revenue > 0 ? money(product.revenue, currency) : '—'}</td>
                                        <td className="num">
                                            {product.in_stock === null ? (
                                                '—'
                                            ) : (
                                                <span className={`fb-pill ${product.in_stock <= 0 ? 'bad' : product.in_stock < product.ordered - product.delivered ? 'warn' : 'good'}`}>
                                                    {number(product.in_stock)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!hasPrices && products.length > 0 && (
                    <p className="fb-hint">
                        Sales value shows “—” where the order lines carry no unit price (for example school garment orders priced as a whole).
                        The order total above is still counted in “billed”.
                    </p>
                )}
                <p className="fb-hint">
                    Delivered quantities come from Orders & Invoices and from logistics when a shipment is confirmed delivered. Stock is
                    reduced at the moment of sale, and a sale is refused if the warehouse does not hold enough.
                </p>
            </div>

            <div className="fb-panel">
                <h2>Shipments ({shipments.length})</h2>
                {shipments.length === 0 ? (
                    <Empty>No shipments have been recorded by logistics yet.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Shipment</th>
                                    <th>Client</th>
                                    <th>Order</th>
                                    <th>Status</th>
                                    <th className="num">Packages</th>
                                    <th>Dispatched</th>
                                    <th>Delivered</th>
                                    <th className="num">Client still owes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shipments.map((shipment) => {
                                    const status = SHIPMENT_STATUS[shipment.status] || { label: String(shipment.status).replaceAll('_', ' '), tone: '' };

                                    return (
                                        <tr key={shipment.shipment_number}>
                                            <td>{shipment.shipment_number}</td>
                                            <td>
                                                {shipment.customer_name || '—'}
                                                <small>{shipment.destination}</small>
                                            </td>
                                            <td>{shipment.document_number || '—'}</td>
                                            <td>
                                                <span className={`fb-pill ${status.tone}`}>{status.label}</span>
                                            </td>
                                            <td className="num">{shipment.packages}</td>
                                            <td>{fmtDate(shipment.dispatched_at)}</td>
                                            <td>{fmtDate(shipment.delivered_at)}</td>
                                            <td className={`num ${shipment.balance > 0 ? 'fb-out' : ''}`}>
                                                {shipment.balance === null ? '—' : money(shipment.balance, currency)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
