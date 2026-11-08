import React, { useEffect, useMemo, useState } from 'react';
import { ExportButtons } from '../../components/ExportButtons';
import type { ExportDoc } from '../../core/exportDocument';

type Column = { key: string; label: string; kind: 'text' | 'money' | 'number' | 'date' };
type Kpi = { label: string; value: number; kind: 'money' | 'number' | 'percent' };
type Report = {
    title: string;
    intro: string;
    currency: string;
    period: { from: string; to: string };
    kpis: Kpi[];
    columns: Column[];
    rows: Record<string, any>[];
    extra_tables?: { heading: string; columns: Column[]; rows: Record<string, any>[] }[];
    statuses: { value: string; label: string }[];
    status_label?: string;
    search_hint?: string;
    limit: number;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (days: number) => iso(new Date(Date.now() - days * 86400000));

async function load(params: URLSearchParams): Promise<Report> {
    const response = await fetch(`/api/reports/department?${params.toString()}`, {
        headers: { Accept: 'application/json' },
    });
    const text = await response.text();
    let data: any = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The report could not be loaded. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || 'The report could not be loaded.');

    return data;
}

/** The report for the signed-in user's own department. The server decides which one it is. */
export default function DepartmentReportPage({ department }: { department?: string } = {}) {
    const [from, setFrom] = useState(daysAgo(29));
    const [to, setTo] = useState(iso(new Date()));
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const query = new URLSearchParams({ from, to, search, status });
                if (department) query.set('department', department);
                const data = await load(query);
                if (active) {
                    setReport(data);
                    setError('');
                }
            } catch (reason: any) {
                if (active) setError(reason.message);
            } finally {
                if (active) setLoading(false);
            }
        }, 250);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [from, to, search, status, department]);

    const format = useMemo(() => {
        const currency = report?.currency || 'RWF';
        const money = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: currency === 'RWF' ? 0 : 2,
        });

        return {
            money: (value: any) => money.format(Number(value || 0)),
            number: (value: any) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
            date: (value: any) => (value ? new Date(value).toLocaleDateString() : '—'),
        };
    }, [report?.currency]);

    const show = (column: Column, row: Record<string, any>) => {
        const value = row[column.key];
        if (column.kind === 'money') return format.money(value);
        if (column.kind === 'number') return format.number(value);
        if (column.kind === 'date') return format.date(value);

        return value === null || value === undefined || value === '' ? '—' : String(value);
    };

    // Numbers, dates and reference codes stay on one line; everything else wraps.
    const cellClass = (column: Column) =>
        column.kind === 'money' || column.kind === 'number'
            ? 'num'
            : column.kind === 'date' || column.key === 'number'
              ? 'nowrap'
              : '';

    const kpi = (item: Kpi) =>
        item.kind === 'money'
            ? format.money(item.value)
            : item.kind === 'percent'
              ? `${format.number(item.value)}%`
              : format.number(item.value);

    const exportDoc = (): ExportDoc | null => {
        if (!report) return null;
        const table = (heading: string, columns: Column[], rows: Record<string, any>[]) => ({
            heading,
            columns: columns.map((column) => ({ label: column.label, kind: column.kind })),
            rows: rows.map((row) => columns.map((column) => row[column.key])),
        });

        return {
            title: report.title,
            subtitle: `From ${from} to ${to}${status ? ` · ${status}` : ''}${search ? ` · "${search}"` : ''}`,
            summary: report.kpis.map((item) => ({ label: item.label, value: kpi(item) })),
            tables: [
                table('Details', report.columns, report.rows),
                ...(report.extra_tables || [])
                    .filter((extra) => extra.rows.length)
                    .map((extra) => table(extra.heading, extra.columns, extra.rows)),
            ],
        };
    };

    const setRange = (start: string) => {
        setFrom(start);
        setTo(iso(new Date()));
    };

    return (
        <section className="dept-report">
            <header className="dept-report-head">
                <div>
                    <h1>{report?.title || 'Report'}</h1>
                    <p>{report?.intro || 'Loading your department report…'}</p>
                </div>
                <div className="dept-report-actions no-print">
                    <ExportButtons doc={exportDoc} disabled={!report} />
                </div>
            </header>

            <div className="data-filters no-print">
                <label>
                    From
                    <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label>
                    To
                    <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                </label>
                <div className="data-filters-quick" role="group" aria-label="Quick dates">
                    <button type="button" onClick={() => setRange(iso(new Date()))}>
                        Today
                    </button>
                    <button type="button" onClick={() => setRange(daysAgo(6))}>
                        Last 7 days
                    </button>
                    <button type="button" onClick={() => setRange(daysAgo(29))}>
                        Last 30 days
                    </button>
                    <button type="button" onClick={() => setRange(`${new Date().getFullYear()}-01-01`)}>
                        This year
                    </button>
                </div>
                {report && report.statuses.length > 0 && (
                    <label>
                        {report.status_label || 'Status'}
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="">All</option>
                            {report.statuses.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <label className="data-filters-search">
                    Search
                    <input
                        type="search"
                        value={search}
                        placeholder={report?.search_hint || 'Type to search'}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
            </div>

            {error && <div className="alert error">{error}</div>}

            {report && (
                <>
                    <div className="ui-kpis">
                        {report.kpis.map((item) => (
                            <article className="ui-kpi" key={item.label}>
                                <small>{item.label}</small>
                                <strong>{kpi(item)}</strong>
                            </article>
                        ))}
                    </div>

                    <article className="panel dept-report-table">
                        <div className="admin-table-wrap">
                            <table className="admin-table wrap-cells">
                                <thead>
                                    <tr>
                                        {report.columns.map((column) => (
                                            <th key={column.key} className={cellClass(column)}>
                                                {column.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.rows.length ? (
                                        report.rows.map((row, index) => (
                                            <tr key={index}>
                                                {report.columns.map((column) => (
                                                    <td key={column.key} className={cellClass(column)}>
                                                        {show(column, row)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={report.columns.length} className="empty-cell">
                                                {loading ? 'Loading…' : 'Nothing was found for these dates and filters.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <footer className="dept-report-foot">
                            Showing {report.rows.length} {report.rows.length === 1 ? 'row' : 'rows'}
                            {report.rows.length >= report.limit
                                ? `. Only the first ${report.limit} are shown — use the filters to narrow the list.`
                                : '.'}
                        </footer>
                    </article>

                    {(report.extra_tables || [])
                        .filter((extra) => extra.rows.length)
                        .map((extra) => (
                            <article className="panel dept-report-table" key={extra.heading}>
                                <h2 className="dept-report-subtitle">{extra.heading}</h2>
                                <div className="admin-table-wrap">
                                    <table className="admin-table wrap-cells">
                                        <thead>
                                            <tr>
                                                {extra.columns.map((column) => (
                                                    <th key={column.key} className={cellClass(column)}>
                                                        {column.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {extra.rows.map((row, index) => (
                                                <tr key={index}>
                                                    {extra.columns.map((column) => (
                                                        <td key={column.key} className={cellClass(column)}>
                                                            {show(column, row)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
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
