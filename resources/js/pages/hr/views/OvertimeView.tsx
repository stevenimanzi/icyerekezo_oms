import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Alerts, Empty, Kpi, PageHead, Pill, api, fmtDate, thisMonth, today, useFinanceData } from '../hrKit';

const emptyForm = () => ({ user_id: '', work_date: today(), hours: '2', reason: '' });

export default function OvertimeView() {
    const [month, setMonth] = useState(thisMonth());
    const { data, loading, error, reload } = useFinanceData<any>(`/api/hr/overtime?month=${month}`);
    const [recording, setRecording] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');
    const [failure, setFailure] = useState('');

    const requests: any[] = data?.requests || [];
    const hours = (status: string) => requests.filter((item) => item.status === status).reduce((sum, item) => sum + Number(item.hours), 0);

    const submit = async () => {
        setBusy(true);
        setFormError('');
        try {
            await api('/api/hr/overtime', {
                method: 'POST',
                body: JSON.stringify({ ...form, user_id: Number(form.user_id), hours: Number(form.hours) }),
            });
            setRecording(false);
            setForm(emptyForm());
            setSuccess('Overtime was recorded and is waiting for a decision.');
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const decide = async (item: any, decision: 'approved' | 'rejected') => {
        setFailure('');
        try {
            await api(`/api/hr/overtime/${item.id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
            setSuccess(`Overtime of ${item.user?.name} was ${decision}.`);
            reload();
        } catch (reason: any) {
            setFailure(reason.message);
        }
    };

    return (
        <section className="fb-page">
            <PageHead title="Overtime" subtitle="Record extra hours and approve them. Approved overtime is paid in the next payroll." loading={loading} onRefresh={reload}>
                <button type="button" className="primary" onClick={() => { setFormError(''); setRecording(true); }}>
                    Record overtime
                </button>
            </PageHead>
            <Alerts error={error || failure} success={success} />

            <div className="fb-kpis">
                <Kpi label="Hours waiting" value={hours('pending')} tone={hours('pending') ? 'warn' : undefined} />
                <Kpi label="Hours approved" value={hours('approved')} tone="good" />
                <Kpi label="Hours rejected" value={hours('rejected')} />
                <Kpi label="Overtime pays" value={`${data?.multiplier ?? 1.5} × the hourly rate`} />
            </div>

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Month
                        <input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
                    </label>
                </div>
                {requests.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Day</th>
                                    <th className="num">Hours</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <b>{item.user?.name}</b>
                                        </td>
                                        <td>{fmtDate(item.work_date)}</td>
                                        <td className="num">{Number(item.hours)}</td>
                                        <td>{item.reason || '—'}</td>
                                        <td>
                                            <Pill status={item.status} />
                                            {item.decider?.name && <small style={{ display: 'block' }}>by {item.decider.name}</small>}
                                            {item.payroll_run_id && <small style={{ display: 'block' }}>In payroll</small>}
                                        </td>
                                        <td>
                                            {item.status === 'pending' && (
                                                <>
                                                    <button type="button" className="fb-btn good small" onClick={() => decide(item, 'approved')}>
                                                        Approve
                                                    </button>{' '}
                                                    <button type="button" className="fb-btn danger small" onClick={() => decide(item, 'rejected')}>
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : 'No overtime in this month.'}</Empty>
                )}
            </div>

            {recording && (
                <Modal
                    title="Record overtime"
                    narrow
                    onClose={() => setRecording(false)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setRecording(false)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={submit} disabled={busy || !form.user_id || Number(form.hours) <= 0}>
                                {busy ? 'Saving…' : 'Record overtime'}
                            </button>
                        </>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <label>
                            Employee
                            <select value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}>
                                <option value="">Choose an employee</option>
                                {(data?.employees || []).map((person: any) => (
                                    <option key={person.id} value={person.id}>
                                        {person.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="two">
                            <label>
                                Day worked
                                <input type="date" max={today()} value={form.work_date} onChange={(event) => setForm({ ...form, work_date: event.target.value })} />
                            </label>
                            <label>
                                Hours
                                <input type="number" min={0.5} max={16} step={0.5} value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
                            </label>
                        </div>
                        <label>
                            Reason
                            <textarea rows={2} value={form.reason} placeholder="Why was extra work needed?" onChange={(event) => setForm({ ...form, reason: event.target.value })} />
                        </label>
                    </div>
                </Modal>
            )}
        </section>
    );
}
