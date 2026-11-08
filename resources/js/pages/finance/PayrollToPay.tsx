import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { api, fmtDate, methodLabel, money, today, useFinanceData } from './financeKit';

const monthLabel = (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/**
 * Payroll that HR prepared and sent to finance. Finance pays it here; the money paid is recorded in the
 * books as "Salaries paid", so nothing is typed twice.
 */
export function PayrollToPay({ canPay, onPaid }: { canPay: boolean; onPaid: () => void }) {
    const { data, reload } = useFinanceData<any>('/api/finance/books/payroll-runs');
    const [paying, setPaying] = useState<any>(null);
    const [form, setForm] = useState({ method: 'bank_transfer', reference: '', paid_on: today() });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');

    const currency = data?.currency || 'RWF';
    const waiting: any[] = (data?.runs || []).filter((run: any) => run.status === 'submitted');
    const recent: any[] = (data?.runs || []).filter((run: any) => run.status === 'paid').slice(0, 3);

    if (!waiting.length && !recent.length && !done) return null;

    const pay = async () => {
        setBusy(true);
        setError('');
        try {
            const result: any = await api(`/api/finance/books/payroll-runs/${paying.id}/pay`, {
                method: 'POST',
                body: JSON.stringify(form),
            });
            setPaying(null);
            setDone(result.message);
            reload();
            onPaid();
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fb-panel">
            <div className="fb-panel-head">
                <h2>Salaries from HR</h2>
            </div>
            {done && <div className="fb-alert success">{done}</div>}
            {waiting.length > 0 ? (
                <div className="fb-table-wrap">
                    <table className="fb-table">
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Payroll</th>
                                <th className="num">Employees</th>
                                <th className="num">Total to pay</th>
                                <th>Sent by HR</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {waiting.map((run) => (
                                <tr key={run.id}>
                                    <td>
                                        <b>{monthLabel(run.period)}</b>
                                    </td>
                                    <td>{run.run_number}</td>
                                    <td className="num">{run.employee_count}</td>
                                    <td className="num">
                                        <b>{money(run.total_net, currency)}</b>
                                    </td>
                                    <td>{fmtDate(run.submitted_at)}</td>
                                    <td>
                                        <a className="fb-btn small" href={`/api/hr/payroll/${run.id}/payslips`}>
                                            Payslips
                                        </a>{' '}
                                        {canPay && (
                                            <button
                                                type="button"
                                                className="fb-btn primary small"
                                                onClick={() => {
                                                    setError('');
                                                    setForm({ method: 'bank_transfer', reference: run.run_number, paid_on: today() });
                                                    setPaying(run);
                                                }}
                                            >
                                                Pay salaries
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="fb-muted">No salaries are waiting. HR sends the payroll here when it is ready.</p>
            )}
            {recent.length > 0 && (
                <p className="fb-muted">
                    Recently paid:{' '}
                    {recent.map((run) => `${monthLabel(run.period)} (${money(run.total_net, currency)})`).join(' · ')}
                </p>
            )}

            {paying && (
                <Modal
                    title={`Pay salaries for ${monthLabel(paying.period)}`}
                    onClose={() => setPaying(null)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setPaying(null)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={pay} disabled={busy}>
                                {busy ? 'Saving…' : `Pay ${money(paying.total_net, currency)}`}
                            </button>
                        </>
                    }
                >
                    {error && <div className="ui-error">{error}</div>}
                    <p>
                        This pays {paying.employee_count} employees and records {money(paying.total_net, currency)} in the books as
                        Salaries paid.
                    </p>
                    <div className="ui-grid three">
                        <label className="ui-field">
                            Paid by
                            <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                                {(data?.methods || []).map((method: string) => (
                                    <option key={method} value={method}>
                                        {methodLabel(method)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="ui-field">
                            Date paid
                            <input type="date" value={form.paid_on} max={today()} onChange={(event) => setForm({ ...form, paid_on: event.target.value })} />
                        </label>
                        <label className="ui-field">
                            Bank or payment reference
                            <input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
                        </label>
                    </div>
                </Modal>
            )}
        </div>
    );
}
