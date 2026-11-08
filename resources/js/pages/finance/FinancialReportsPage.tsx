import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ExportButtons } from '../../components/ExportButtons';
import type { ExportColumn, ExportDoc } from '../../core/exportDocument';

const csrf = () =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function api(url: string) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
    });
    const text = await response.text();
    let data: any;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The report could not be shown. Please try again.');
    }
    if (!response.ok) throw new Error(data.message || 'We could not load the report. Please try again.');
    return data;
}

const REPORT_TYPES = [
    { value: 'revenue', label: 'Full summary (sales and money)' },
    { value: 'invoices', label: 'List of invoices' },
    { value: 'receipts', label: 'Money received from customers' },
    { value: 'aging', label: 'Unpaid invoices and how old they are' },
    { value: 'cashbook', label: 'Cash book (all money in and out)' },
    { value: 'expenses', label: 'Expenses and salaries paid' },
];
const PERIODS = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'quarter', label: 'This quarter' },
    { value: 'year', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
];

type Cell = string | number | null | undefined;
type Block = { heading: string; columns: ExportColumn[]; rows: Cell[][]; totals?: Cell[] };

const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Same period rules as the server, so both halves of the summary cover the same days. */
function rangeFor(period: string, from: string, to: string): [string, string] {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'custom') return [from, to];
    if (period === 'today') return [iso(day), iso(day)];
    if (period === 'week') {
        const start = new Date(day);
        start.setDate(day.getDate() - ((day.getDay() + 6) % 7));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return [iso(start), iso(end)];
    }
    if (period === 'quarter') {
        const q = Math.floor(day.getMonth() / 3) * 3;
        return [iso(new Date(day.getFullYear(), q, 1)), iso(new Date(day.getFullYear(), q + 3, 0))];
    }
    if (period === 'year') return [`${day.getFullYear()}-01-01`, `${day.getFullYear()}-12-31`];
    return [iso(new Date(day.getFullYear(), day.getMonth(), 1)), iso(new Date(day.getFullYear(), day.getMonth() + 1, 0))];
}

const col = (label: string, kind: ExportColumn['kind'] = 'text'): ExportColumn => ({ label, kind });
const sum = (rows: any[], pick: (row: any) => number) => rows.reduce((total, row) => total + Number(pick(row) || 0), 0);

export default function FinancialReportsPage() {
    const today = new Date().toISOString().slice(0, 10);
    const searchParams = new URLSearchParams(window.location.search);
    const [filters, setFilters] = useState({
        type: searchParams.get('type') || 'revenue',
        period: searchParams.get('period') || 'month',
        from: searchParams.get('from') || today,
        to: searchParams.get('to') || today,
    });
    const [sales, setSales] = useState<any>(null);
    const [books, setBooks] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    type: filters.type,
                    period: filters.period,
                    ...(filters.period === 'custom' ? { from: filters.from, to: filters.to } : {}),
                });
                window.history.replaceState(null, '', `?${params.toString()}`);
                const [from, to] = rangeFor(filters.period, filters.from, filters.to);
                const needSales = !['cashbook', 'expenses'].includes(filters.type);
                const needBooks = ['revenue', 'cashbook', 'expenses'].includes(filters.type);
                const bookParams = new URLSearchParams({
                    from,
                    to,
                    ...(filters.type === 'expenses' ? { direction: 'out' } : {}),
                });
                const [salesResult, booksResult] = await Promise.all([
                    needSales ? api(`/api/finance/report?${params.toString()}`) : null,
                    needBooks ? api(`/api/finance/books/cashbook?${bookParams.toString()}`) : null,
                ]);
                if (active) {
                    setSales(salesResult);
                    setBooks(booksResult);
                    setError('');
                }
            } catch (reason: any) {
                if (active) setError(reason.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        const wait = window.setTimeout(load, 150);
        return () => {
            active = false;
            window.clearTimeout(wait);
        };
    }, [filters.type, filters.period, filters.from, filters.to]);

    const currency = books?.currency || 'RWF';
    const money = (value: any, code = currency) =>
        new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: code,
            maximumFractionDigits: code === 'RWF' ? 0 : 2,
        }).format(Number(value || 0));
    const number = (value: any) => Number(value || 0).toLocaleString();
    const words = (value: any) => String(value || '').replaceAll('_', ' ');

    const bookOnly = filters.type === 'cashbook' || filters.type === 'expenses';
    const loaded = bookOnly ? books : sales;

    const view = useMemo(() => {
        if (!loaded) return null;
        const ss = sales?.summary || {};
        const bs = books?.summary || {};
        const typeLabel = REPORT_TYPES.find((t) => t.value === filters.type)?.label || 'Report';
        const from = sales?.report?.from || books?.period?.from;
        const to = sales?.report?.to || books?.period?.to;
        const kpis: { label: string; value: string }[] = [];
        const blocks: Block[] = [];

        const salesKpis = () =>
            kpis.push(
                { label: 'Invoiced', value: money(ss.invoiced_amount) },
                { label: 'Collected', value: money(ss.collected_amount) },
                { label: 'Still to collect', value: money(ss.outstanding_amount) },
                { label: 'Orders', value: number(ss.orders_count) },
                { label: 'Overdue invoices', value: number(ss.overdue_count) },
            );
        const moneyKpis = () =>
            kpis.push(
                { label: 'Money in', value: money(bs.money_in) },
                { label: 'Money out', value: money(bs.money_out) },
                { label: 'Difference', value: money(bs.net) },
                { label: 'Balance at start', value: money(bs.opening_balance) },
                { label: 'Balance at end', value: money(bs.closing_balance) },
            );

        if (filters.type === 'revenue') {
            salesKpis();
            moneyKpis();
            const trend: any[] = sales.trend || [];
            blocks.push({
                heading: 'Invoiced and collected',
                columns: [col('Day or month'), col('Invoiced', 'money'), col('Collected', 'money')],
                rows: trend.map((r) => [r.label, r.invoiced, r.collected]),
                totals: ['Total', sum(trend, (r) => r.invoiced), sum(trend, (r) => r.collected)],
            });
            blocks.push({
                heading: 'Where the money came from',
                columns: [col('Type'), col('Times', 'number'), col('Amount', 'money')],
                rows: (books.in_by_category || []).map((r: any) => [r.label, r.count, r.amount]),
                totals: ['Total money in', null, bs.money_in],
            });
            blocks.push({
                heading: 'Where the money went (salaries paid included)',
                columns: [col('Type'), col('Times', 'number'), col('Amount', 'money')],
                rows: (books.out_by_category || []).map((r: any) => [r.label, r.count, r.amount]),
                totals: ['Total money out', null, bs.money_out],
            });
        } else if (filters.type === 'invoices') {
            salesKpis();
            const list: any[] = sales.rows || [];
            blocks.push({
                heading: 'Invoices',
                columns: [col('Number'), col('Customer'), col('Date', 'date'), col('Due', 'date'), col('Payment'), col('Total', 'money'), col('Paid', 'money'), col('Balance', 'money'), col('Invoice file')],
                rows: list.map((r) => [r.document_number, r.customer_name, r.document_date, r.due_date, words(r.payment_status), r.total_amount, r.paid_amount, r.balance, r.invoice_uploaded ? 'Uploaded' : 'Not uploaded']),
                totals: ['Total', null, null, null, null, sum(list, (r) => r.total_amount), sum(list, (r) => r.paid_amount), sum(list, (r) => r.balance), null],
            });
        } else if (filters.type === 'receipts') {
            salesKpis();
            const list: any[] = sales.rows || [];
            blocks.push({
                heading: 'Money received from customers',
                columns: [col('Date', 'date'), col('Customer'), col('Order'), col('Paid by'), col('Reference'), col('Amount', 'money'), col('Recorded by')],
                rows: list.map((r) => [r.reviewed_at, r.customer_name, r.document_number, words(r.payment_method), r.payment_reference, r.amount, r.reviewer]),
                totals: ['Total', null, null, null, null, sum(list, (r) => r.amount), null],
            });
        } else if (filters.type === 'aging') {
            salesKpis();
            const list: any[] = sales.rows || [];
            blocks.push({
                heading: 'Unpaid invoices',
                columns: [col('Number'), col('Customer'), col('Due', 'date'), col('Balance', 'money'), col('Status')],
                rows: list.map((r) => [r.document_number, r.customer_name, r.due_date, r.balance, r.days_overdue > 0 ? `${r.days_overdue} days late` : 'Not due yet']),
                totals: ['Total', null, null, sum(list, (r) => r.balance), null],
            });
        } else if (filters.type === 'cashbook') {
            moneyKpis();
            const list: any[] = [...(books.rows || [])].reverse();
            blocks.push({
                heading: 'Every money movement',
                columns: [col('Date', 'date'), col('Type'), col('Details'), col('Name'), col('Paid by'), col('Reference'), col('Money in', 'money'), col('Money out', 'money'), col('Balance', 'money')],
                rows: list.map((r) => [r.date, r.category_label, r.description, r.party || '', words(r.method), r.reference || '', r.direction === 'in' ? r.amount : null, r.direction === 'out' ? r.amount : null, r.balance]),
                totals: ['Total', null, null, null, null, null, bs.money_in, bs.money_out, null],
            });
        } else {
            kpis.push(
                { label: 'Expenses and salaries paid', value: money(bs.money_out) },
                { label: 'Money in (same dates)', value: money(bs.money_in) },
            );
            blocks.push({
                heading: 'By type',
                columns: [col('Type'), col('Times', 'number'), col('Amount', 'money')],
                rows: (books.out_by_category || []).map((r: any) => [r.label, r.count, r.amount]),
                totals: ['Total', null, bs.money_out],
            });
            const list: any[] = books.rows || [];
            blocks.push({
                heading: 'Every payment out',
                columns: [col('Date', 'date'), col('Type'), col('Details'), col('Paid to'), col('Paid by'), col('Reference'), col('Amount', 'money')],
                rows: list.map((r) => [r.date, r.category_label, r.description, r.party || '', words(r.method), r.reference || '', r.amount]),
                totals: ['Total', null, null, null, null, null, bs.money_out],
            });
        }

        return { typeLabel, from, to, kpis, blocks };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, filters.type, sales, books]);

    const exportDoc = (): ExportDoc | null =>
        view && {
            title: view.typeLabel,
            subtitle: `From ${view.from} to ${view.to}`,
            summary: view.kpis,
            tables: view.blocks.map((b) => ({ heading: b.heading, columns: b.columns, rows: b.rows, totals: b.totals })),
        };

    const show = (column: ExportColumn, value: Cell) => {
        if (value === null || value === undefined || value === '') return '—';
        if (column.kind === 'money') return money(value);
        if (column.kind === 'number') return number(value);
        return String(value);
    };
    const align = (column: ExportColumn) =>
        column.kind === 'money' || column.kind === 'number' ? 'num' : column.kind === 'date' ? 'nowrap' : '';

    return (
        <section className="module-page report-page dept-report">
            <header className="dept-report-head">
                <div>
                    <h1>Finance and sales report</h1>
                    <p>
                        Everything finance and sales need in one place: sales, money received, unpaid
                        invoices, the cash book, expenses and salaries paid. Download it as a PDF or Excel
                        file.
                    </p>
                </div>
                <div className="dept-report-actions no-print">
                    <button className="secondary-btn" disabled={loading} onClick={() => setFilters({ ...filters })}>
                        <RefreshCw className={loading ? 'spin' : ''} size={16} />
                        Refresh
                    </button>
                    <ExportButtons doc={exportDoc} disabled={!view || loading} />
                </div>
            </header>

            {error && <div className="admin-alert error">{error}</div>}

            <div className="data-filters no-print">
                <label>
                    Report
                    <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                        {REPORT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Period
                    <select value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value })}>
                        {PERIODS.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </label>
                {filters.period === 'custom' && (
                    <>
                        <label>
                            From
                            <input type="date" value={filters.from} max={filters.to} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
                        </label>
                        <label>
                            To
                            <input type="date" value={filters.to} min={filters.from} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
                        </label>
                    </>
                )}
            </div>

            {view && (
                <>
                    <div className="ui-kpis">
                        {view.kpis.map((item) => (
                            <article className="ui-kpi" key={item.label}>
                                <small>{item.label}</small>
                                <strong>{item.value}</strong>
                            </article>
                        ))}
                    </div>

                    {view.blocks.map((block) => (
                        <article className="panel dept-report-table" key={block.heading}>
                            <h2 className="dept-report-subtitle">{block.heading}</h2>
                            <div className="admin-table-wrap">
                                <table className="admin-table wrap-cells">
                                    <thead>
                                        <tr>
                                            {block.columns.map((column) => (
                                                <th key={column.label} className={align(column)}>
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {block.rows.length ? (
                                            block.rows.map((row, index) => (
                                                <tr key={index}>
                                                    {block.columns.map((column, c) => (
                                                        <td key={c} className={align(column)}>
                                                            {show(column, row[c])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={block.columns.length} className="empty-cell">
                                                    Nothing was found for these dates.
                                                </td>
                                            </tr>
                                        )}
                                        {block.totals && block.rows.length > 0 && (
                                            <tr className="total-row">
                                                {block.columns.map((column, c) => {
                                                    const value = block.totals?.[c];
                                                    return (
                                                        <td key={c} className={align(column)}>
                                                            <b>{value === null || value === undefined ? '' : show(column, value)}</b>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    ))}
                </>
            )}
        </section>
    );
}
