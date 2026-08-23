import React, { useEffect, useState } from 'react';
import { FileText, Printer, RefreshCw } from 'lucide-react';

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function api(url: string) {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() } });
    const text = await response.text();
    let data: any;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The report service returned an invalid response.');
    }
    if (!response.ok) throw new Error(data.message || 'Unable to load the report.');
    return data;
}

const money = (value: any, currency = 'RWF') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'RWF' ? 0 : 2 }).format(Number(value || 0));
const number = (value: any) => Number(value || 0).toLocaleString();
const date = (value: any) => (value ? new Date(value).toLocaleDateString() : '—');

const REPORT_TYPES = [
    { value: 'revenue', label: 'Revenue & collections summary' },
    { value: 'invoices', label: 'Invoice register' },
    { value: 'receipts', label: 'Cash receipts book' },
    { value: 'aging', label: 'Outstanding & aging report' },
];
const PERIODS = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'quarter', label: 'This quarter' },
    { value: 'year', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
];

function Table({ title, headers, rows, empty }: any) {
    return (
        <section className="report-section">
            <h2>{title}</h2>
            <table>
                <thead>
                    <tr>{headers.map((header: string) => <th key={header}>{header}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.length ? rows.map((row: any[], index: number) => (
                        <tr key={index}>{row.map((cell: any, cellIndex: number) => <td key={cellIndex}>{cell}</td>)}</tr>
                    )) : (
                        <tr><td colSpan={headers.length}>{empty || 'No records for this period.'}</td></tr>
                    )}
                </tbody>
            </table>
        </section>
    );
}

export default function FinancialReportsPage() {
    const today = new Date().toISOString().slice(0, 10);
    const searchParams = new URLSearchParams(window.location.search);
    const [filters, setFilters] = useState({
        type: searchParams.get('type') || 'revenue',
        period: searchParams.get('period') || 'month',
        from: searchParams.get('from') || today,
        to: searchParams.get('to') || today,
    });
    const [data, setData] = useState<any>(null);
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
                const result = await api(`/api/finance/report?${params.toString()}`);
                if (active) {
                    setData(result);
                    setError('');
                }
            } catch (reason: any) {
                if (active) setError(reason.message);
            } finally {
                if (active) setLoading(false);
            }
        };
        const wait = window.setTimeout(load, 150);
        return () => { active = false; window.clearTimeout(wait); };
    }, [filters.type, filters.period, filters.from, filters.to]);

    const summary = data?.summary || {};

    return (
        <section className="module-page report-page">
            <div className="no-print">
                <div className="module-hero">
                    <div className="module-title">
                        <span><FileText /></span>
                        <div>
                            <div className="eyebrow"><i />FINANCE</div>
                            <h1>Financial reports</h1>
                            <p>Generate the books and reports finance needs to run the factory — revenue and collections, the invoice register, the cash receipts book, and outstanding balances.</p>
                        </div>
                    </div>
                    <div className="workflow-actions report-action-row">
                        <button className="secondary-btn" disabled={loading} onClick={() => setFilters({ ...filters })}><RefreshCw className={loading ? 'spin' : ''} size={16} />Refresh</button>
                        <button className="primary-btn" disabled={!data} onClick={() => window.print()}><Printer size={17} />Print report</button>
                    </div>
                </div>
                {error && <div className="admin-alert error">{error}</div>}
                <div className="panel report-filters">
                    <label>
                        Report type
                        <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                            {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </label>
                    <label>
                        Report period
                        <select value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value })}>
                            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </label>
                    {filters.period === 'custom' && (
                        <>
                            <label>From<input type="date" value={filters.from} max={filters.to} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
                            <label>To<input type="date" value={filters.to} min={filters.from} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
                        </>
                    )}
                </div>
            </div>

            {data && (
                <article className="report-document report-landscape">
                    <style>{'@media print{@page{size:A4 landscape;margin:10mm}}'}</style>
                    <header>
                        <div>
                            <h1>{data.factory.name}</h1>
                            <p>{data.factory.industry}</p>
                        </div>
                        <div>
                            <b>{data.report.type_label.toUpperCase()}</b>
                            <span>{data.report.from} to {data.report.to}</span>
                        </div>
                    </header>
                    <section className="report-meta">
                        <span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span>
                        <span>Prepared by: {data.report.generated_by}</span>
                        <span>Scope: Finance</span>
                    </section>

                    <div className="finance-report-summary">
                        <div><span>Invoiced</span><b>{money(summary.invoiced_amount)}</b></div>
                        <div><span>Collected</span><b>{money(summary.collected_amount)}</b></div>
                        <div><span>Outstanding</span><b>{money(summary.outstanding_amount)}</b></div>
                        <div><span>Orders</span><b>{number(summary.orders_count)}</b></div>
                        <div><span>Receipts</span><b>{number(summary.receipts_count)}</b></div>
                        <div><span>Overdue</span><b>{number(summary.overdue_count)}</b></div>
                    </div>

                    {data.report.type === 'revenue' && (
                        <Table
                            title="Invoiced vs collected"
                            headers={['Period', 'Invoiced', 'Collected']}
                            rows={(data.trend || []).map((row: any) => [row.label, money(row.invoiced), money(row.collected)])}
                        />
                    )}

                    {data.report.type === 'invoices' && (
                        <Table
                            title="Invoice register"
                            headers={['Order number', 'Customer', 'Date', 'Due', 'Payment status', 'Total', 'Paid', 'Balance', 'Invoice']}
                            rows={(data.rows || []).map((row: any) => [
                                row.document_number, row.customer_name, date(row.document_date), date(row.due_date),
                                String(row.payment_status || '').replaceAll('_', ' '),
                                money(row.total_amount, row.currency_code), money(row.paid_amount, row.currency_code), money(row.balance, row.currency_code),
                                row.invoice_uploaded ? 'Uploaded' : 'Not uploaded',
                            ])}
                        />
                    )}

                    {data.report.type === 'receipts' && (
                        <Table
                            title="Cash receipts book"
                            headers={['Date', 'Customer', 'Order number', 'Method', 'Reference', 'Amount', 'Approved by']}
                            rows={(data.rows || []).map((row: any) => [
                                date(row.reviewed_at), row.customer_name || '—', row.document_number || '—',
                                row.payment_method || '—', row.payment_reference || '—', money(row.amount), row.reviewer || '—',
                            ])}
                        />
                    )}

                    {data.report.type === 'aging' && (
                        <Table
                            title="Outstanding & aging"
                            headers={['Order number', 'Customer', 'Due date', 'Balance', 'Days overdue']}
                            rows={(data.rows || []).map((row: any) => [
                                row.document_number, row.customer_name, date(row.due_date),
                                money(row.balance, row.currency_code), row.days_overdue > 0 ? `${row.days_overdue} days` : 'Not yet due',
                            ])}
                        />
                    )}

                    <footer>{data.factory.name} · Generated by ICYEREKEZO OMS · {new Date(data.report.generated_at).toLocaleDateString()}</footer>
                </article>
            )}
        </section>
    );
}
