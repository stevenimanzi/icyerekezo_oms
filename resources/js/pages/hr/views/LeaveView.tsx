import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Alerts, Empty, Kpi, PageHead, Pill, api, fmtDate, today, useFinanceData, words } from '../hrKit';

const TYPES = [
    ['annual', 'Annual leave'],
    ['sick', 'Sick leave'],
    ['maternity', 'Maternity leave'],
    ['paternity', 'Paternity leave'],
    ['unpaid', 'Unpaid leave'],
    ['other', 'Other'],
];

const emptyForm = () => ({ user_id: '', leave_type: 'annual', starts_at: today(), ends_at: today(), reason: '' });

export default function LeaveView() {
    const { data, loading, error, reload } = useFinanceData<any>('/api/hr/leave');
    const [tab, setTab] = useState<'requests' | 'balances'>('requests');
    const [filter, setFilter] = useState('pending');
    const [recording, setRecording] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [deciding, setDeciding] = useState<{ leave: any; decision: 'approved' | 'rejected' } | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');

    const requests: any[] = data?.requests || [];
    const balances: any[] = data?.balances || [];
    const shown = requests.filter((leave) => !filter || leave.status === filter);
    const count = (status: string) => requests.filter((leave) => leave.status === status).length;
    const days = Math.max(1, Math.round((new Date(form.ends_at).getTime() - new Date(form.starts_at).getTime()) / 86400000) + 1);
    const balanceOf = (userId: string) => balances.find((row) => String(row.user_id) === userId);

    const submit = async () => {
        setBusy(true);
        setFormError('');
        try {
            await api('/api/hr/leave-requests', { method: 'POST', body: JSON.stringify({ ...form, user_id: Number(form.user_id) }) });
            setRecording(false);
            setForm(emptyForm());
            setSuccess('Leave was recorded and is waiting for a decision.');
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const decide = async () => {
        if (!deciding) return;
        setBusy(true);
        setFormError('');
        try {
            await api(`/api/hr/leave-requests/${deciding.leave.id}/decision`, {
                method: 'POST',
                body: JSON.stringify({ decision: deciding.decision, review_note: note || null }),
            });
            setSuccess(`Leave for ${deciding.leave.user?.name} was ${deciding.decision}.`);
            setDeciding(null);
            setNote('');
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const chosen = balanceOf(form.user_id);

    return (
        <section className="fb-page">
            <PageHead title="Leave" subtitle="Record leave, decide requests and see who has days left." loading={loading} onRefresh={reload}>
                <button type="button" className="primary" onClick={() => { setFormError(''); setRecording(true); }}>
                    Record leave
                </button>
            </PageHead>
            <Alerts error={error} success={success} />

            <div className="fb-kpis">
                <Kpi label="Waiting for a decision" value={count('pending')} tone={count('pending') ? 'warn' : undefined} />
                <Kpi label="Approved" value={count('approved')} tone="good" />
                <Kpi label="Rejected" value={count('rejected')} />
                <Kpi label="Annual leave per person" value={`${data?.entitlement ?? 18} days`} hint={`For ${data?.year ?? ''}`} />
            </div>

            <div className="fb-seg" role="tablist">
                <button type="button" className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>
                    Requests
                </button>
                <button type="button" className={tab === 'balances' ? 'on' : ''} onClick={() => setTab('balances')}>
                    Days left
                </button>
            </div>

            {tab === 'requests' && (
                <div className="fb-panel">
                    <div className="fb-filters">
                        <label>
                            Show
                            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                                <option value="pending">Waiting for a decision</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="">All</option>
                            </select>
                        </label>
                    </div>
                    {shown.length ? (
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Type</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th className="num">Days</th>
                                        <th>Status</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.map((leave) => (
                                        <tr key={leave.id}>
                                            <td>
                                                <b>{leave.user?.name}</b>
                                                {leave.reason && <small style={{ display: 'block' }}>{leave.reason}</small>}
                                            </td>
                                            <td>{words(leave.leave_type)}</td>
                                            <td>{fmtDate(leave.starts_at)}</td>
                                            <td>{fmtDate(leave.ends_at)}</td>
                                            <td className="num">{leave.days_requested}</td>
                                            <td>
                                                <Pill status={leave.status} />
                                                {leave.reviewer?.name && <small style={{ display: 'block' }}>by {leave.reviewer.name}</small>}
                                            </td>
                                            <td>
                                                {leave.status === 'pending' && (
                                                    <>
                                                        <button type="button" className="fb-btn good small" onClick={() => { setFormError(''); setNote(''); setDeciding({ leave, decision: 'approved' }); }}>
                                                            Approve
                                                        </button>{' '}
                                                        <button type="button" className="fb-btn danger small" onClick={() => { setFormError(''); setNote(''); setDeciding({ leave, decision: 'rejected' }); }}>
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
                        <Empty>{loading ? 'Loading…' : 'No leave to show.'}</Empty>
                    )}
                </div>
            )}

            {tab === 'balances' && (
                <div className="fb-panel">
                    <h2>Annual leave in {data?.year}</h2>
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th className="num">Entitled</th>
                                    <th className="num">Taken</th>
                                    <th className="num">Left</th>
                                </tr>
                            </thead>
                            <tbody>
                                {balances.map((row) => (
                                    <tr key={row.user_id}>
                                        <td>
                                            <b>{row.name}</b>
                                        </td>
                                        <td className="num">{row.entitled}</td>
                                        <td className="num">{row.used}</td>
                                        <td className="num">
                                            <span className={`fb-pill ${row.left === 0 ? 'bad' : row.left <= 3 ? 'warn' : 'good'}`}>{row.left}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {recording && (
                <Modal
                    title="Record leave"
                    onClose={() => setRecording(false)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setRecording(false)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={submit} disabled={busy || !form.user_id}>
                                {busy ? 'Saving…' : 'Record leave'}
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
                                {balances.map((row) => (
                                    <option key={row.user_id} value={row.user_id}>
                                        {row.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Type of leave
                            <select value={form.leave_type} onChange={(event) => setForm({ ...form, leave_type: event.target.value })}>
                                {TYPES.map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="two">
                            <label>
                                From
                                <input type="date" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value, ends_at: event.target.value > form.ends_at ? event.target.value : form.ends_at })} />
                            </label>
                            <label>
                                To
                                <input type="date" value={form.ends_at} min={form.starts_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} />
                            </label>
                        </div>
                        <label>
                            Reason
                            <textarea rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
                        </label>
                        <p className="fb-hint">
                            {days} day{days === 1 ? '' : 's'} of leave.
                            {form.leave_type === 'annual' && chosen && ` ${chosen.left} annual days left this year.`}
                            {form.leave_type === 'unpaid' && ' Unpaid days are taken off the salary.'}
                        </p>
                    </div>
                </Modal>
            )}

            {deciding && (
                <Modal
                    title={deciding.decision === 'approved' ? 'Approve leave' : 'Reject leave'}
                    narrow
                    onClose={() => setDeciding(null)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setDeciding(null)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={decide} disabled={busy}>
                                {busy ? 'Saving…' : deciding.decision === 'approved' ? 'Approve' : 'Reject'}
                            </button>
                        </>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <p>
                            <b>{deciding.leave.user?.name}</b> · {words(deciding.leave.leave_type)} · {fmtDate(deciding.leave.starts_at)} to {fmtDate(deciding.leave.ends_at)} ({deciding.leave.days_requested} days)
                        </p>
                        <label>
                            Note for the employee (optional)
                            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
                        </label>
                    </div>
                </Modal>
            )}
        </section>
    );
}
