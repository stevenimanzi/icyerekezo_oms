import { useMemo, useState } from 'react';
import { Ban, ShoppingCart, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '../../components/Modal';
import {
    Alerts,
    Empty,
    Kpi,
    PALETTE,
    PageHead,
    api,
    fmtDate,
    isoDate,
    methodLabel,
    money,
    monthEnd,
    monthStart,
    today,
    useDebounced,
    useFinanceData,
} from './financeKit';

type Props = {
    /** 'cashbook' shows every movement of money; 'expenses' shows only money spent. */
    view: 'cashbook' | 'expenses';
    onNavigate?: (page: string) => void;
};

type Draft = {
    direction: 'in' | 'out';
    category: string;
    description: string;
    party: string;
    amount: string;
    method: string;
    entry_date: string;
    reference: string;
};

const PERIODS = [
    { value: 'month', label: 'This month' },
    { value: 'last', label: 'Last month' },
    { value: 'year', label: 'This year' },
    { value: 'custom', label: 'Choose dates' },
];

const emptyDraft = (direction: 'in' | 'out'): Draft => ({
    direction,
    category: '',
    description: '',
    party: '',
    amount: '',
    method: 'cash',
    entry_date: today(),
    reference: '',
});

export default function FinanceBooksPage({ view, onNavigate }: Props) {
    const isExpenses = view === 'expenses';
    const [period, setPeriod] = useState('month');
    const [custom, setCustom] = useState({ from: monthStart(), to: today() });
    const [direction, setDirection] = useState<'all' | 'in' | 'out'>(isExpenses ? 'out' : 'all');
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounced(search);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [cancelling, setCancelling] = useState<any>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');

    const range = useMemo(() => {
        if (period === 'last') return { from: monthStart(-1), to: monthEnd(-1) };
        if (period === 'year') {
            const year = new Date().getFullYear();

            return { from: isoDate(new Date(year, 0, 1)), to: today() };
        }
        if (period === 'custom') return custom;

        return { from: monthStart(), to: today() };
    }, [period, custom]);

    const url = useMemo(() => {
        const query = new URLSearchParams({ from: range.from, to: range.to });
        if (direction !== 'all') query.set('direction', direction);
        if (category) query.set('category', category);
        if (debouncedSearch) query.set('search', debouncedSearch);

        return `/api/finance/books/cashbook?${query.toString()}`;
    }, [range, direction, category, debouncedSearch]);

    const { data, loading, error, reload, setError } = useFinanceData<any>(url);
    const currency = data?.currency || 'RWF';
    const summary = data?.summary;
    const purchasing = data?.purchasing;
    const rows: any[] = data?.rows || [];
    const outBreakdown: any[] = data?.out_by_category || [];
    const inBreakdown: any[] = data?.in_by_category || [];

    const allCategories = useMemo(
        () => [
            ...(data?.categories?.in || []).map((c: any) => ({ ...c, group: 'Money received' })),
            ...(data?.categories?.out || []).map((c: any) => ({ ...c, group: 'Money spent' })),
            { value: 'sales', label: 'Customer payments', group: 'From sales & purchasing' },
            { value: 'purchases', label: 'Materials & supplier payments', group: 'From sales & purchasing' },
        ],
        [data],
    );

    const formCategories = useMemo(
        () =>
            (draft?.direction === 'in' ? data?.categories?.in : data?.categories?.out)?.filter(
                (c: any) => c.value !== 'payroll',
            ) || [],
        [data, draft?.direction],
    );

    const spentOn = (key: string) =>
        outBreakdown.find((item) => item.category === key)?.amount || 0;
    const otherSpent = outBreakdown
        .filter((item) => !['payroll', 'purchases'].includes(item.category))
        .reduce((total, item) => total + item.amount, 0);

    const save = async () => {
        if (!draft) return;
        setBusy(true);
        setFormError('');
        try {
            const result: any = await api('/api/finance/books/entries', {
                method: 'POST',
                body: JSON.stringify({ ...draft, amount: Number(draft.amount) }),
            });
            setDraft(null);
            setSuccess(result.message);
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const cancelEntry = async () => {
        if (!cancelling) return;
        setBusy(true);
        setFormError('');
        try {
            const result: any = await api(`/api/finance/books/entries/${cancelling.entry_id}/void`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            });
            setCancelling(null);
            setReason('');
            setSuccess(result.message);
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const set = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

    const bars = (items: any[], tone: string) => {
        const max = Math.max(...items.map((item) => item.amount), 1);

        return items.length ? (
            <div className="fb-bars">
                {items.map((item, index) => (
                    <div className="fb-bar-row" key={item.category}>
                        <div>
                            <span>{item.label}</span>
                            <b className={tone}>{money(item.amount, currency)}</b>
                        </div>
                        <div className="fb-bar">
                            <i style={{ width: `${(item.amount / max) * 100}%`, background: PALETTE[index % PALETTE.length] }} />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <Empty>Nothing recorded in this period.</Empty>
        );
    };

    return (
        <section className="fb-page">
            <PageHead
                title={isExpenses ? 'Expenses' : 'Cash Book'}
                subtitle={
                    isExpenses
                        ? 'Everything the factory spends: staff pay, materials, utilities and running costs.'
                        : 'Every shilling in and out of the factory in one book: customer payments, supplier payments, expenses and staff pay.'
                }
                loading={loading}
                onRefresh={reload}
            >
                {data?.can_record && (
                    <>
                        <button
                            type="button"
                            className="primary"
                            onClick={() => {
                                setFormError('');
                                setDraft(emptyDraft('out'));
                            }}
                        >
                            <TrendingDown size={15} />
                            Record expense
                        </button>
                        {!isExpenses && (
                            <button
                                type="button"
                                className="good"
                                onClick={() => {
                                    setFormError('');
                                    setDraft(emptyDraft('in'));
                                }}
                            >
                                <TrendingUp size={15} />
                                Record money received
                            </button>
                        )}
                    </>
                )}
            </PageHead>

            <Alerts error={error} success={success} />

            {purchasing && (purchasing.pending_requests > 0 || purchasing.approved_requests > 0) && (
                <div className="fb-alert info">
                    <span>
                        <b>Store requests:</b> {purchasing.pending_requests} purchase request
                        {purchasing.pending_requests === 1 ? '' : 's'} waiting for approval
                        {purchasing.approved_requests > 0 &&
                            `, ${purchasing.approved_requests} approved and waiting to be ordered from a supplier`}
                        .
                    </span>
                    <button type="button" className="fb-btn primary small" onClick={() => onNavigate?.('procurement')}>
                        <ShoppingCart size={13} />
                        Open purchases
                    </button>
                </div>
            )}

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
                                <input
                                    type="date"
                                    value={custom.from}
                                    max={custom.to}
                                    onChange={(event) => setCustom({ ...custom, from: event.target.value })}
                                />
                            </label>
                            <label>
                                To
                                <input
                                    type="date"
                                    value={custom.to}
                                    min={custom.from}
                                    max={today()}
                                    onChange={(event) => setCustom({ ...custom, to: event.target.value })}
                                />
                            </label>
                        </>
                    )}
                    {!isExpenses && (
                        <label>
                            Show
                            <select value={direction} onChange={(event) => setDirection(event.target.value as any)}>
                                <option value="all">Money in and out</option>
                                <option value="in">Money in only</option>
                                <option value="out">Money out only</option>
                            </select>
                        </label>
                    )}
                    <label>
                        Category
                        <select value={category} onChange={(event) => setCategory(event.target.value)}>
                            <option value="">All categories</option>
                            {allCategories
                                .filter((item) => !isExpenses || !data?.categories?.in?.some((c: any) => c.value === item.value))
                                .map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <label className="fb-search">
                        Search
                        <Search size={14} />
                        <input
                            placeholder="Description, person, reference"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </label>
                </div>
            </div>

            {summary &&
                (isExpenses ? (
                    <div className="fb-kpis">
                        <Kpi label="Total spent" value={money(summary.money_out, currency)} hint={`${range.from} to ${range.to}`} tone="bad" />
                        <Kpi label="Staff pay" value={money(spentOn('payroll'), currency)} hint="Salaries & wages" />
                        <Kpi label="Materials & suppliers" value={money(spentOn('purchases'), currency)} hint="Paid to suppliers" />
                        <Kpi label="Running costs" value={money(otherSpent, currency)} hint="Utilities, transport, rent, repairs, other" />
                    </div>
                ) : (
                    <div className="fb-kpis">
                        <Kpi label="Opening balance" value={money(summary.opening_balance, currency)} hint={`Before ${range.from}`} />
                        <Kpi label="Money in" value={money(summary.money_in, currency)} hint="Collected + other income" tone="good" />
                        <Kpi label="Money out" value={money(summary.money_out, currency)} hint="Suppliers, staff, expenses" tone="bad" />
                        <Kpi
                            label="Closing balance"
                            value={money(summary.closing_balance, currency)}
                            hint={`Net this period ${money(summary.net, currency)}`}
                            tone={summary.closing_balance >= 0 ? 'good' : 'bad'}
                        />
                        <Kpi
                            label="Cash position today"
                            value={money(summary.cash_position, currency)}
                            hint="All recorded money, to date"
                            tone={summary.cash_position >= 0 ? 'good' : 'bad'}
                        />
                    </div>
                ))}

            {data && (
                <div className={isExpenses ? '' : 'fb-split'}>
                    <div className="fb-panel">
                        <h2>Where the money went</h2>
                        {bars(outBreakdown, 'fb-out')}
                    </div>
                    {!isExpenses && (
                        <div className="fb-panel">
                            <h2>Where the money came from</h2>
                            {bars(inBreakdown, 'fb-in')}
                        </div>
                    )}
                </div>
            )}

            <div className="fb-panel">
                <h2>
                    {isExpenses ? 'Expense list' : 'All money movements'} ({rows.length})
                </h2>
                {loading && !data ? (
                    <Empty>Loading the books…</Empty>
                ) : rows.length === 0 ? (
                    <Empty>No money movements match these filters.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Details</th>
                                    <th>Category</th>
                                    <th>Method</th>
                                    <th className="num">Money in</th>
                                    <th className="num">Money out</th>
                                    {!isExpenses && <th className="num">Balance</th>}
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.key}>
                                        <td>{fmtDate(row.date)}</td>
                                        <td>
                                            {row.description}
                                            <small>
                                                {[row.party, row.reference, row.number].filter(Boolean).join(' · ') || '—'}
                                            </small>
                                        </td>
                                        <td>
                                            <span className="fb-pill">{row.category_label}</span>
                                        </td>
                                        <td>{methodLabel(row.method)}</td>
                                        <td className="num fb-in">{row.direction === 'in' ? money(row.amount, currency) : ''}</td>
                                        <td className="num fb-out">{row.direction === 'out' ? money(row.amount, currency) : ''}</td>
                                        {!isExpenses && <td className="num">{money(row.balance, currency)}</td>}
                                        <td className="num">
                                            {row.entry_id && data?.can_record && (
                                                <button
                                                    type="button"
                                                    className="fb-btn danger small"
                                                    onClick={() => {
                                                        setFormError('');
                                                        setReason('');
                                                        setCancelling(row);
                                                    }}
                                                >
                                                    <Ban size={12} />
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {data?.truncated && <p className="fb-hint">Showing the latest 1,000 movements. Narrow the dates to see the rest.</p>}
                <p className="fb-hint">
                    Customer payments and supplier payments appear here automatically when they are recorded in Orders & Invoices or
                    Purchases, so nothing is typed twice. Staff pay is recorded on the Staff Pay page.
                </p>
            </div>

            {draft && (
                <Modal
                    title={draft.direction === 'in' ? 'Record money received' : 'Record an expense'}
                    onClose={() => setDraft(null)}
                    footer={
                        <div className="fb-modal-actions">
                            <button type="button" className="fb-btn" onClick={() => setDraft(null)}>
                                Close
                            </button>
                            <button
                                type="button"
                                className={`fb-btn ${draft.direction === 'in' ? 'good' : 'primary'}`}
                                disabled={busy || !draft.category || !draft.description || Number(draft.amount) <= 0}
                                onClick={save}
                            >
                                {busy ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <div className="fb-seg" role="group" aria-label="Money direction">
                            <button
                                type="button"
                                className={`out ${draft.direction === 'out' ? 'on' : ''}`}
                                onClick={() => set({ direction: 'out', category: '' })}
                            >
                                Money spent
                            </button>
                            <button
                                type="button"
                                className={`in ${draft.direction === 'in' ? 'on' : ''}`}
                                onClick={() => set({ direction: 'in', category: '' })}
                            >
                                Money received
                            </button>
                        </div>
                        <label>
                            Category
                            <select value={draft.category} onChange={(event) => set({ category: event.target.value })}>
                                <option value="">Choose a category</option>
                                {formCategories.map((item: any) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {draft.direction === 'out' && (
                            <p className="fb-hint">
                                Salaries are paid from the Staff Pay page, and materials from Purchases, so they stay linked to the right
                                person or order.
                            </p>
                        )}
                        <label>
                            What was it for?
                            <input
                                value={draft.description}
                                maxLength={255}
                                placeholder={draft.direction === 'in' ? 'e.g. Sale of scrap fabric' : 'e.g. Electricity bill for November'}
                                onChange={(event) => set({ description: event.target.value })}
                            />
                        </label>
                        <div className="two">
                            <label>
                                {draft.direction === 'in' ? 'Received from' : 'Paid to'}
                                <input value={draft.party} maxLength={160} onChange={(event) => set({ party: event.target.value })} />
                            </label>
                            <label>
                                Amount ({currency})
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.amount}
                                    onChange={(event) => set({ amount: event.target.value })}
                                />
                            </label>
                        </div>
                        <div className="two">
                            <label>
                                Method
                                <select value={draft.method} onChange={(event) => set({ method: event.target.value })}>
                                    {(data?.methods || []).map((method: string) => (
                                        <option key={method} value={method}>
                                            {methodLabel(method)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Date
                                <input
                                    type="date"
                                    value={draft.entry_date}
                                    max={today()}
                                    onChange={(event) => set({ entry_date: event.target.value })}
                                />
                            </label>
                        </div>
                        <label>
                            Reference (receipt or transaction number)
                            <input value={draft.reference} maxLength={120} onChange={(event) => set({ reference: event.target.value })} />
                        </label>
                    </div>
                </Modal>
            )}

            {cancelling && (
                <Modal
                    title={`Cancel ${cancelling.number || 'entry'}`}
                    narrow
                    onClose={() => setCancelling(null)}
                    footer={
                        <div className="fb-modal-actions">
                            <button type="button" className="fb-btn" onClick={() => setCancelling(null)}>
                                Keep it
                            </button>
                            <button type="button" className="fb-btn danger" disabled={busy || reason.trim().length < 3} onClick={cancelEntry}>
                                {busy ? 'Cancelling…' : 'Cancel this entry'}
                            </button>
                        </div>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <p>
                            {cancelling.description} — <b>{money(cancelling.amount, currency)}</b>
                        </p>
                        <p className="fb-hint">
                            The entry stays on record as cancelled so the books can be audited, but it no longer counts in any totals.
                        </p>
                        <label>
                            Why is it being cancelled?
                            <input value={reason} maxLength={255} onChange={(event) => setReason(event.target.value)} />
                        </label>
                    </div>
                </Modal>
            )}
        </section>
    );
}
