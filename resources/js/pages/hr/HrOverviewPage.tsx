import React, { useEffect, useState } from 'react';
import { CalendarCheck, CalendarClock, GraduationCap, RefreshCw, UserCheck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

async function api(url: string, options: RequestInit = {}) {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, ...(options.headers || {}) } });
    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('HR data could not be read. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || Object.values(data.errors || {}).flat()[0] as string || 'HR data could not be loaded.');
    return data;
}
const label = (value: string) => String(value || '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const date = (value: any) => (value ? new Date(value).toLocaleDateString() : 'Not set');

export default function HrOverviewPage() {
    const [data, setData] = useState<any>(null);
    const [tab, setTab] = useState<'attendance' | 'leave' | 'training'>('attendance');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState<number | null>(null);

    const [attendanceForm, setAttendanceForm] = useState({ user_id: '', date: new Date().toISOString().slice(0, 10), status: 'present', check_in_time: '', check_out_time: '', notes: '' });
    const [leaveForm, setLeaveForm] = useState({ user_id: '', leave_type: 'annual', starts_at: '', ends_at: '', reason: '' });
    const [trainingForm, setTrainingForm] = useState({ title: '', description: '', trainer: '', scheduled_at: '', duration_hours: '2', participant_ids: [] as number[] });

    const load = () => {
        setLoading(true);
        api('/api/hr/overview').then((result) => { setData(result); setError(''); }).catch((reason: any) => setError(reason.message)).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const employees = data?.employees || [];
    const stats = data?.stats || {};

    const markAttendance = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/hr/attendance', { method: 'POST', body: JSON.stringify(attendanceForm) });
            setSuccess('Attendance recorded.');
            setAttendanceForm({ ...attendanceForm, user_id: '', notes: '' });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const submitLeave = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/hr/leave-requests', { method: 'POST', body: JSON.stringify(leaveForm) });
            setSuccess('Leave request submitted.');
            setLeaveForm({ user_id: '', leave_type: 'annual', starts_at: '', ends_at: '', reason: '' });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const decideLeave = async (id: number, decision: 'approved' | 'rejected') => {
        setBusy(id); setError(''); setSuccess('');
        try {
            await api(`/api/hr/leave-requests/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
            setSuccess(decision === 'approved' ? 'Leave approved.' : 'Leave rejected.');
            load();
        } catch (reason: any) { setError(reason.message); } finally { setBusy(null); }
    };

    const scheduleTraining = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/hr/trainings', { method: 'POST', body: JSON.stringify(trainingForm) });
            setSuccess('Training scheduled.');
            setTrainingForm({ title: '', description: '', trainer: '', scheduled_at: '', duration_hours: '2', participant_ids: [] });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const markParticipant = async (id: number, status: string) => {
        setBusy(id); setError(''); setSuccess('');
        try {
            await api(`/api/hr/training-participants/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            load();
        } catch (reason: any) { setError(reason.message); } finally { setBusy(null); }
    };

    return (
        <section className="module-page">
            <div className="page-heading">
                <div>
                    <h1>Human resources</h1>
                    <p>Track attendance, leave requests and staff training.</p>
                </div>
                <button className="secondary-btn" disabled={loading} onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <section className="department-metrics cols-4">
                <article className="department-metric panel"><span className="metric-icon green"><UserCheck /></span><div><small>Present today</small><strong>{stats.present_today || 0}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon red"><Users /></span><div><small>Absent today</small><strong>{stats.absent_today || 0}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon amber"><CalendarClock /></span><div><small>Pending leave requests</small><strong>{stats.pending_leave || 0}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon blue"><GraduationCap /></span><div><small>Upcoming trainings</small><strong>{stats.upcoming_trainings || 0}</strong></div></article>
            </section>

            <article className="panel chart-panel">
                <header className="department-panel-head"><div><h2>Attendance trend (7 days)</h2><p>Employees present versus absent each day.</p></div></header>
                <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.attendance_trend || []} margin={{ top: 12, right: 18, left: -18, bottom: 2 }}>
                            <CartesianGrid vertical={false} stroke="var(--line)" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} />
                            <Bar dataKey="present" name="Present" fill="#10b981" radius={[5, 5, 0, 0]} />
                            <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[5, 5, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </article>

            <div className="module-tabs" role="tablist">
                <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}><CalendarCheck size={15} />Attendance</button>
                <button className={tab === 'leave' ? 'active' : ''} onClick={() => setTab('leave')}><CalendarClock size={15} />Leave requests</button>
                <button className={tab === 'training' ? 'active' : ''} onClick={() => setTab('training')}><GraduationCap size={15} />Training</button>
            </div>

            {tab === 'attendance' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Record attendance</h2><p>Mark an employee present, absent, late or on leave for a date.</p></div></header>
                    <form className="admin-form" onSubmit={markAttendance}>
                        <div className="form-grid">
                            <label>Employee<select required value={attendanceForm.user_id} onChange={(e) => setAttendanceForm({ ...attendanceForm, user_id: e.target.value })}><option value="">Choose employee</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
                            <label>Date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={attendanceForm.date} onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })} /></label>
                            <label>Status<select value={attendanceForm.status} onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="on_leave">On leave</option></select></label>
                            <label>Check-in<input type="time" value={attendanceForm.check_in_time} onChange={(e) => setAttendanceForm({ ...attendanceForm, check_in_time: e.target.value })} /></label>
                            <label>Check-out<input type="time" value={attendanceForm.check_out_time} onChange={(e) => setAttendanceForm({ ...attendanceForm, check_out_time: e.target.value })} /></label>
                        </div>
                        <footer><button className="primary-btn">Save attendance</button></footer>
                    </form>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Employee</th><th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr></thead>
                            <tbody>
                                {(data?.attendance || []).length ? data.attendance.map((item: any) => (
                                    <tr key={item.id}><td>{item.user?.name}</td><td>{date(item.date)}</td><td><span className={`admin-status ${item.status === 'present' ? 'accepted' : item.status === 'absent' ? 'rejected' : 'pending'}`}>{label(item.status)}</span></td><td>{item.check_in_time || '—'}</td><td>{item.check_out_time || '—'}</td></tr>
                                )) : <tr><td className="empty-cell" colSpan={5}>No attendance recorded in the last two weeks.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {tab === 'leave' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Leave requests</h2><p>Submit a request on behalf of an employee, then approve or reject it.</p></div></header>
                    <form className="admin-form" onSubmit={submitLeave}>
                        <div className="form-grid">
                            <label>Employee<select required value={leaveForm.user_id} onChange={(e) => setLeaveForm({ ...leaveForm, user_id: e.target.value })}><option value="">Choose employee</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
                            <label>Leave type<select value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}><option value="annual">Annual</option><option value="sick">Sick</option><option value="maternity">Maternity</option><option value="paternity">Paternity</option><option value="unpaid">Unpaid</option><option value="other">Other</option></select></label>
                            <label>Starts<input required type="date" value={leaveForm.starts_at} onChange={(e) => setLeaveForm({ ...leaveForm, starts_at: e.target.value })} /></label>
                            <label>Ends<input required type="date" value={leaveForm.ends_at} onChange={(e) => setLeaveForm({ ...leaveForm, ends_at: e.target.value })} /></label>
                            <label>Reason<input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Optional" /></label>
                        </div>
                        <footer><button className="primary-btn">Submit request</button></footer>
                    </form>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {(data?.leave_requests || []).length ? data.leave_requests.map((item: any) => (
                                    <tr key={item.id}>
                                        <td>{item.user?.name}</td><td>{item.leave_type}</td><td>{date(item.starts_at)} – {date(item.ends_at)}</td><td>{item.days_requested}</td>
                                        <td><span className={`admin-status ${item.status === 'approved' ? 'accepted' : item.status === 'rejected' ? 'rejected' : 'pending'}`}>{label(item.status)}</span></td>
                                        <td>{item.status === 'pending' ? (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                                                <button className="table-action" disabled={busy === item.id} style={{ color: '#15803d' }} onClick={() => decideLeave(item.id, 'approved')}>Approve</button>
                                                <button className="table-action" disabled={busy === item.id} style={{ color: '#dc2626' }} onClick={() => decideLeave(item.id, 'rejected')}>Reject</button>
                                            </div>
                                        ) : (item.reviewer?.name || '—')}</td>
                                    </tr>
                                )) : <tr><td className="empty-cell" colSpan={6}>No leave requests yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {tab === 'training' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Training sessions</h2><p>Schedule a session and track who attended and was certified.</p></div></header>
                    <form className="admin-form" onSubmit={scheduleTraining}>
                        <div className="form-grid">
                            <label>Title<input required value={trainingForm.title} onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })} placeholder="e.g. Fire safety refresher" /></label>
                            <label>Trainer<input value={trainingForm.trainer} onChange={(e) => setTrainingForm({ ...trainingForm, trainer: e.target.value })} placeholder="Optional" /></label>
                            <label>Date<input required type="date" value={trainingForm.scheduled_at} onChange={(e) => setTrainingForm({ ...trainingForm, scheduled_at: e.target.value })} /></label>
                            <label>Duration (hours)<input required type="number" min={0.5} step={0.5} value={trainingForm.duration_hours} onChange={(e) => setTrainingForm({ ...trainingForm, duration_hours: e.target.value })} /></label>
                            <label style={{ gridColumn: '1 / -1' }}>Description<input value={trainingForm.description} onChange={(e) => setTrainingForm({ ...trainingForm, description: e.target.value })} placeholder="Optional" /></label>
                            <label style={{ gridColumn: '1 / -1' }}>Participants
                                <select multiple value={trainingForm.participant_ids.map(String)} onChange={(e) => setTrainingForm({ ...trainingForm, participant_ids: Array.from(e.target.selectedOptions).map((o) => Number(o.value)) })} style={{ minHeight: 90 }}>
                                    {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                </select>
                            </label>
                        </div>
                        <footer><button className="primary-btn">Schedule training</button></footer>
                    </form>
                    <div className="notification-page">
                        {(data?.trainings || []).length ? data.trainings.map((training: any) => (
                            <article className="panel" key={training.id}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3>{training.title}</h3><span className="admin-status pending">{label(training.status)}</span></div>
                                    <p>{training.description || 'No description.'} · {training.trainer || 'No trainer set'} · {date(training.scheduled_at)} · {training.duration_hours}h</p>
                                    {training.participants?.length ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                            {training.participants.map((p: any) => (
                                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 20, fontSize: 12 }}>
                                                    {p.user?.name}
                                                    <select value={p.status} disabled={busy === p.id} onChange={(e) => markParticipant(p.id, e.target.value)} style={{ border: 0, background: 'transparent', fontSize: 11 }}>
                                                        <option value="registered">Registered</option><option value="attended">Attended</option><option value="absent">Absent</option><option value="completed">Completed</option>
                                                    </select>
                                                </label>
                                            ))}
                                        </div>
                                    ) : <small>No participants added.</small>}
                                </div>
                            </article>
                        )) : <div className="panel empty-state"><span><GraduationCap size={28} /></span><h3>No trainings scheduled</h3><p>Schedule one above to get started.</p></div>}
                    </div>
                </article>
            )}
        </section>
    );
}
