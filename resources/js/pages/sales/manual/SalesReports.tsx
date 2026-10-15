import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { api } from '../../../core/api';
import type { Format } from '../../../core/format';
import { startPolling } from '../../../core/polling';
import type { salesText } from './text';
import type { Comparison, SalesReportData } from './types';

type Props = {
    text: (typeof salesText)['en'];
    format: Format;
};

type Preset = 'today' | 'week' | 'month' | 'thisMonth' | 'thisYear' | 'custom';

const PRESETS: Preset[] = ['today', 'week', 'month', 'thisMonth', 'thisYear', 'custom'];
const REFRESH_EVERY_MS = 60000;

const iso = (date: Date) => date.toLocaleDateString('en-CA');

function rangeFor(preset: Preset, custom: { from: string; to: string }) {
    const today = new Date();
    const daysAgo = (days: number) =>
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);

    switch (preset) {
        case 'today':
            return { from: iso(today), to: iso(today) };
        case 'week':
            return { from: iso(daysAgo(6)), to: iso(today) };
        case 'thisMonth':
            return {
                from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
                to: iso(today),
            };
        case 'thisYear':
            return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
        case 'custom':
            return custom;
        default:
            return { from: iso(daysAgo(29)), to: iso(today) };
    }
}

export function SalesReports({ text, format }: Props) {
    const t = text.reports;
    const [preset, setPreset] = useState<Preset>('month');
    const [custom, setCustom] = useState({
        from: iso(new Date(Date.now() - 29 * 86400000)),
        to: iso(new Date()),
    });
    const [data, setData] = useState<SalesReportData | null>(null);
    const [error, setError] = useState('');

    const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

    useEffect(() => {
        if (!range.from || !range.to || range.from > range.to) return;

        const load = () =>
            api<SalesReportData>(`/api/sales/manual/report?from=${range.from}&to=${range.to}`)
                .then((result) => {
                    setData(result);
                    setError('');
                })
                .catch((reason: Error) => setError(reason.message));

        load();
        const timer = startPolling(load, REFRESH_EVERY_MS);

        return () => window.clearInterval(timer);
    }, [range.from, range.to]);

    const change = (value: Comparison) =>
        value.change === null ? (
            <p>{t.noEarlier}</p>
        ) : (
            <p>
                <b className={value.change >= 0 ? 'up' : 'down'}>
                    {format.signedPercent(value.change)}
                </b>{' '}
                {t.compared}
            </p>
        );

    return (
        <>
            <div className="ms-report-controls">
                <label className="ms-field">
                    <span>{t.show}</span>
                    <select
                        value={preset}
                        onChange={(event) => setPreset(event.target.value as Preset)}
                    >
                        {PRESETS.map((key) => (
                            <option key={key} value={key}>
                                {t.periods[key]}
                            </option>
                        ))}
                    </select>
                </label>
                {preset === 'custom' && (
                    <>
                        <label className="ms-field">
                            <span>{t.from}</span>
                            <input
                                type="date"
                                value={custom.from}
                                max={custom.to}
                                onChange={(event) =>
                                    setCustom({ ...custom, from: event.target.value })
                                }
                            />
                        </label>
                        <label className="ms-field">
                            <span>{t.to}</span>
                            <input
                                type="date"
                                value={custom.to}
                                min={custom.from}
                                onChange={(event) =>
                                    setCustom({ ...custom, to: event.target.value })
                                }
                            />
                        </label>
                    </>
                )}
            </div>

            {error && <div className="ms-error">{error}</div>}
            {!data ? (
                <div className="panel ms-empty">{t.loading}</div>
            ) : (
                <>
                    <div className="ms-kpis">
                        <article className="panel ms-kpi">
                            <small>{t.kpi.revenue}</small>
                            <strong>{format.moneyShort(data.summary.revenue.current)}</strong>
                            {change(data.summary.revenue)}
                        </article>
                        <article className="panel ms-kpi">
                            <small>{t.kpi.sales}</small>
                            <strong>{format.whole(data.summary.sales.current)}</strong>
                            {change(data.summary.sales)}
                        </article>
                        <article className="panel ms-kpi">
                            <small>{t.kpi.average}</small>
                            <strong>{format.moneyShort(data.summary.average_sale.current)}</strong>
                            {change(data.summary.average_sale)}
                        </article>
                        <article className="panel ms-kpi">
                            <small>{t.kpi.items}</small>
                            <strong>{format.whole(data.summary.items_sold.current)}</strong>
                            {change(data.summary.items_sold)}
                        </article>
                        <article className="panel ms-kpi">
                            <small>{t.kpi.collected}</small>
                            <strong>{format.moneyShort(data.summary.collected)}</strong>
                            <p>{t.kpi.discounts(format.money(data.summary.discounts))}</p>
                        </article>
                        <article
                            className={`panel ms-kpi ${data.summary.outstanding > 0 ? 'alert' : ''}`}
                        >
                            <small>{t.kpi.owed}</small>
                            <strong>{format.moneyShort(data.summary.outstanding)}</strong>
                            <p>{text.kpi.owedHint}</p>
                        </article>
                    </div>

                    <article className="panel">
                        <div className="panel-title">
                            <h2>{t.trend}</h2>
                        </div>
                        <div className="ms-chart">
                            {data.trend.some((point) => point.revenue > 0) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={data.trend}
                                        margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="msTrendFill"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#2563eb"
                                                    stopOpacity={0.25}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#2563eb"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="var(--line)"
                                        />
                                        <XAxis
                                            dataKey="label"
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            width={56}
                                            tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                            tickFormatter={(value: number) => format.compact(value)}
                                        />
                                        <Tooltip
                                            formatter={(value) => format.money(Number(value))}
                                            contentStyle={{
                                                background: 'var(--panel)',
                                                border: '1px solid var(--line)',
                                                borderRadius: 10,
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="#2563eb"
                                            strokeWidth={3}
                                            fill="url(#msTrendFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="ms-empty">{t.trendEmpty}</div>
                            )}
                        </div>
                    </article>

                    <div className="ms-report-grid">
                        <Table
                            title={t.products}
                            empty={t.none}
                            heads={[t.productName, t.quantity, t.revenue]}
                            numeric={[1, 2]}
                        >
                            {data.top_products.map((row) => (
                                <tr key={row.name}>
                                    <td>{row.name}</td>
                                    <td className="num">{format.whole(row.quantity)}</td>
                                    <td className="num">
                                        <b>{format.money(row.revenue)}</b>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                        <Table
                            title={t.customers}
                            empty={t.none}
                            heads={[t.customerName, t.sales, t.revenue, t.owes]}
                            numeric={[1, 2, 3]}
                        >
                            {data.top_customers.map((row) => (
                                <tr key={row.name}>
                                    <td>{row.name}</td>
                                    <td className="num">{row.sales}</td>
                                    <td className="num">
                                        <b>{format.money(row.revenue)}</b>
                                    </td>
                                    <td className="num">
                                        {row.owes > 0 ? format.money(row.owes) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </Table>
                        <Table
                            title={t.methods}
                            empty={t.none}
                            heads={[t.method, t.payments, t.amount]}
                            numeric={[1, 2]}
                        >
                            {data.payment_methods.map((row) => (
                                <tr key={row.method}>
                                    <td>{text.methods[row.method] ?? row.method}</td>
                                    <td className="num">{row.payments}</td>
                                    <td className="num">
                                        <b>{format.money(row.amount)}</b>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                        <Table
                            title={t.sellers}
                            empty={t.none}
                            heads={[t.seller, t.sales, t.revenue]}
                            numeric={[1, 2]}
                        >
                            {data.sellers.map((row) => (
                                <tr key={row.name}>
                                    <td>{row.name}</td>
                                    <td className="num">{row.sales}</td>
                                    <td className="num">
                                        <b>{format.money(row.revenue)}</b>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </div>

                    <Table
                        title={t.debtors}
                        empty={t.debtorsEmpty}
                        heads={[t.receipt, t.customer, t.soldOn, t.dueOn, '', t.balance]}
                        numeric={[5]}
                    >
                        {data.debtors.map((row) => (
                            <tr key={row.id}>
                                <td>
                                    <b>{row.number}</b>
                                </td>
                                <td>
                                    {row.customer}
                                    {row.phone && <small>{row.phone}</small>}
                                </td>
                                <td>{format.date(row.sold_on)}</td>
                                <td>{row.due_on ? format.date(row.due_on) : '—'}</td>
                                <td>
                                    <span
                                        className={`ms-chip ${row.days_late > 0 ? 'unpaid' : 'paid'}`}
                                    >
                                        {t.late(row.days_late)}
                                    </span>
                                </td>
                                <td className="num">
                                    <b>{format.money(row.balance)}</b>
                                </td>
                            </tr>
                        ))}
                    </Table>
                </>
            )}
        </>
    );
}

type TableProps = {
    title: string;
    empty: string;
    heads: string[];
    numeric: number[];
    children: ReactNode[];
};

function Table({ title, empty, heads, numeric, children }: TableProps) {
    return (
        <article className="panel">
            <div className="panel-title">
                <h2>{title}</h2>
            </div>
            <div className="ms-table-wrap">
                <table className="ms-table" style={{ minWidth: 0 }}>
                    <thead>
                        <tr>
                            {heads.map((head, index) => (
                                <th key={index} className={numeric.includes(index) ? 'num' : ''}>
                                    {head}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {children.length ? (
                            children
                        ) : (
                            <tr>
                                <td colSpan={heads.length} className="empty">
                                    {empty}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </article>
    );
}
