import { useMemo, useState } from 'react';
import { Banknote, Search } from 'lucide-react';
import { Modal } from '../../components/Modal';
import {
    Alerts,
    Empty,
    Kpi,
    PageHead,
    api,
    fmtDate,
    methodLabel,
    money,
    monthName,
    thisMonth,
    today,
    useFinanceData,
} from './financeKit';

type PayDraft = {
    employee: any;
    amount: string;
    method: string;
    entry_date: string;
    reference: string;
    description: string;
    confirm_duplicate: boolean;
};

export default function PayrollPage() {
    const [month, setMonth] = useState(thisMonth());
    const [search, setSearch] = useState('');
    const [unpaidOnly, setUnpaidOnly] = useState(false);
    const [draft, setDraft] = useState<PayDraft | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [duplicate, setDuplicate] = useState(false);
    const [success, setSuccess] = useState('');

    const { data, loading, error, reload } = useFinanceData<any>(`/api/finance/books/payroll?month=${month}`);
    const currency = data?.currency || 'RWF';
    const summary = data?.summary;

    const employees: any[] = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return (data?.employees || []).filter((employee: any) => {
            if (unpaidOnly && employee.paid_this_month > 0) return false;
            if (!needle) return true;

            return [employee.name, employee.email, employee.role, employee.job_title, employee.department]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [data, search, unpaidOnly]);

    const openPay = (employee: any) => {
        setFormError('');
        setDuplicate(false);
        setDraft({
            employee,
            amount: employee.last_amount ? String(employee.last_amount) : '',
            method: 'bank_transfer',
            entry_date: today(),
            reference: '',
            description: `Salary for ${monthName(month)}`,
            confirm_duplicate: false,
        });
    };

    const pay = async (confirmDuplicate = false) => {
        if (!draft) return;
        setBusy(true);
        setFormError('');
        try {
            const result: any = await api('/api/finance/books/entries', {
                method: 'POST',
                body: JSON.stringify({
                    direction: 'out',
                    category: 'payroll',
                    description: draft.description,
                    amount: Number(draft.amount),
                    method: draft.method,
                    entry_date: draft.entry_date,
                    reference: draft.reference || null,
                    employee_id: draft.employee.id,
                    period: month,
                    confirm_duplicate: confirmDuplicate,
                }),
            });
            setDraft(null);
            setSuccess(`${draft.employee.name} paid for ${monthName(month)}. ${result.message}`);
            reload();
        } catch (reason: any) {
            if (reason.status === 409 && reason.payload?.duplicate) setDuplicate(true);
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const patch = (values: Partial<PayDraft>) => setDraft((current) => (current ? { ...current, ...values } : current));

    return (
        <section className="fb-page">
            <PageHead
                title="Staff Pay"
                subtitle="Pay employees, see who is still unpaid this month, and keep a record of every salary payment. Each payment also appears in the Cash Book and Expenses."
                loading={loading}
                onRefresh={reload}
            />
            <Alerts error={error} success={success} />

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Pay month
                        <input type="month" value={month} max={thisMonth()} onChange={(event) => event.target.value && setMonth(event.target.value)} />
                    </label>
                    <label className="fb-search">
                        Find employee
                        <Search size={14} />
                        <input placeholder="Name, role or department" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                    <label className="fb-check">
                        <input type="checkbox" checked={unpaidOnly} onChange={(event) => setUnpaidOnly(event.target.checked)} />
                        Only show unpaid
                    </label>
                </div>
            </div>

            {summary && (
                <div className="fb-kpis">
                    <Kpi label="Employees" value={summary.employees} hint="Active on this factory" />
                    <Kpi label={`Paid for ${monthName(month)}`} value={summary.paid_count} hint="Employees paid" tone="good" />
                    <Kpi label="Not yet paid" value={summary.unpaid_count} hint="Still waiting for this month" tone={summary.unpaid_count > 0 ? 'warn' : 'good'} />
                    <Kpi label="Total paid" value={money(summary.month_total, currency)} hint={monthName(month)} />
                </div>
            )}

            <div className="fb-panel">
                <h2>Employees ({employees.length})</h2>
                {loading && !data ? (
                    <Empty>Loading staff…</Empty>
                ) : employees.length === 0 ? (
                    <Empty>No employees match.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Role</th>
                                    <th>Last payment</th>
                                    <th>{monthName(month)}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td>
                                            {employee.name}
                                            <small>{employee.email}</small>
                                        </td>
                                        <td>
                                            {employee.role || '—'}
                                            <small>{[employee.job_title, employee.department].filter(Boolean).join(' · ')}</small>
                                        </td>
                                        <td>
                                            {employee.last_amount ? money(employee.last_amount, currency) : '—'}
                                            <small>{employee.last_period ? `${monthName(employee.last_period)} · paid ${fmtDate(employee.last_paid_on)}` : 'Never paid'}</small>
                                        </td>
                                        <td>
                                            {employee.paid_this_month > 0 ? (
                                                <span className="fb-pill good">Paid {money(employee.paid_this_month, currency)}</span>
                                            ) : (
                                                <span className="fb-pill warn">Not paid</span>
                                            )}
                                        </td>
                                        <td className="num">
                                            {data?.can_record && (
                                                <button type="button" className={`fb-btn small ${employee.paid_this_month > 0 ? '' : 'primary'}`} onClick={() => openPay(employee)}>
                                                    <Banknote size={13} />
                                                    {employee.paid_this_month > 0 ? 'Pay again' : 'Pay'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="fb-panel">
                <h2>Recent salary payments</h2>
                {(data?.history || []).length === 0 ? (
                    <Empty>No salary has been recorded yet.</Empty>
                ) : (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Paid on</th>
                                    <th>Employee</th>
                                    <th>For month</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="num">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.history.map((payment: any) => (
                                    <tr key={payment.id}>
                                        <td>{fmtDate(payment.entry_date)}</td>
                                        <td>
                                            {payment.employee}
                                            <small>{payment.entry_number}</small>
                                        </td>
                                        <td>{monthName(payment.period)}</td>
                                        <td>{methodLabel(payment.method)}</td>
                                        <td>{payment.reference || '—'}</td>
                                        <td className="num fb-out">{money(payment.amount, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="fb-hint">To undo a payment made by mistake, cancel it from the Cash Book or Expenses page.</p>
            </div>

            {draft && (
                <Modal
                    title={`Pay ${draft.employee.name}`}
                    onClose={() => setDraft(null)}
                    footer={
                        <div className="fb-modal-actions">
                            <button type="button" className="fb-btn" onClick={() => setDraft(null)}>
                                Close
                            </button>
                            {duplicate ? (
                                <button type="button" className="fb-btn primary" disabled={busy} onClick={() => pay(true)}>
                                    {busy ? 'Saving…' : 'Yes, pay again'}
                                </button>
                            ) : (
                                <button type="button" className="fb-btn primary" disabled={busy || Number(draft.amount) <= 0} onClick={() => pay(false)}>
                                    {busy ? 'Saving…' : 'Record payment'}
                                </button>
                            )}
                        </div>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className={`fb-alert ${duplicate ? 'info' : 'error'}`}>{formError}</div>}
                        <p className="fb-hint">
                            Pay month: <b>{monthName(month)}</b>
                        </p>
                        <div className="two">
                            <label>
                                Amount ({currency})
                                <input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => patch({ amount: event.target.value })} />
                            </label>
                            <label>
                                Paid on
                                <input type="date" value={draft.entry_date} max={today()} onChange={(event) => patch({ entry_date: event.target.value })} />
                            </label>
                        </div>
                        <div className="two">
                            <label>
                                Method
                                <select value={draft.method} onChange={(event) => patch({ method: event.target.value })}>
                                    {(data?.methods || []).map((method: string) => (
                                        <option key={method} value={method}>
                                            {methodLabel(method)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Reference
                                <input value={draft.reference} maxLength={120} placeholder="Transfer or receipt number" onChange={(event) => patch({ reference: event.target.value })} />
                            </label>
                        </div>
                        <label>
                            Note
                            <input value={draft.description} maxLength={255} onChange={(event) => patch({ description: event.target.value })} />
                        </label>
                    </div>
                </Modal>
            )}
        </section>
    );
}
