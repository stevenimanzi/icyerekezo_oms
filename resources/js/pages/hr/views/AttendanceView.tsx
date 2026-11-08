import { useEffect, useState } from 'react';
import { Alerts, Empty, Kpi, PageHead, api, fmtDate, monthName, thisMonth, today, useFinanceData } from '../hrKit';

type Row = {
    user_id: number;
    name: string;
    job_title?: string | null;
    department?: string | null;
    status: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    notes: string | null;
    saved: boolean;
    on_approved_leave: boolean;
};

const OPTIONS = [
    ['present', 'Present'],
    ['late', 'Late'],
    ['absent', 'Absent'],
    ['on_leave', 'On leave'],
];

export default function AttendanceView() {
    const [tab, setTab] = useState<'register' | 'summary'>('register');
    const [date, setDate] = useState(today());
    const [month, setMonth] = useState(thisMonth());
    const register = useFinanceData<any>(`/api/hr/attendance-register?date=${date}`);
    const summary = useFinanceData<any>(`/api/hr/attendance-summary?month=${month}`);
    const [rows, setRows] = useState<Row[]>([]);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        setRows(register.data?.rows || []);
        setDirty(false);
    }, [register.data]);

    const change = (id: number, patch: Partial<Row>) => {
        setRows((current) => current.map((row) => (row.user_id === id ? { ...row, ...patch } : row)));
        setDirty(true);
        setSuccess('');
    };

    const markAllPresent = () => {
        setRows((current) => current.map((row) => (row.status ? row : { ...row, status: 'present' })));
        setDirty(true);
    };

    const count = (status: string) => rows.filter((row) => row.status === status).length;
    const unmarked = rows.filter((row) => !row.status).length;

    const save = async () => {
        const records = rows
            .filter((row) => row.status)
            .map((row) => ({
                user_id: row.user_id,
                status: row.status,
                check_in_time: row.check_in_time || null,
                check_out_time: row.check_out_time || null,
                notes: row.notes || null,
            }));
        if (!records.length) {
            setError('Mark at least one employee first.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result: any = await api('/api/hr/attendance-register', {
                method: 'POST',
                body: JSON.stringify({ date, records }),
            });
            setSuccess(result.message);
            register.reload();
            summary.reload();
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="fb-page">
            <PageHead
                title="Attendance"
                subtitle="Mark who came to work each day and see the month at a glance."
                loading={register.loading || summary.loading}
                onRefresh={() => {
                    register.reload();
                    summary.reload();
                }}
            />
            <Alerts error={error || register.error} success={success} />

            <div className="fb-seg" role="tablist">
                <button type="button" className={tab === 'register' ? 'on' : ''} onClick={() => setTab('register')}>
                    Daily register
                </button>
                <button type="button" className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>
                    Month summary
                </button>
            </div>

            {tab === 'register' && (
                <>
                    <div className="fb-kpis">
                        <Kpi label="Present" value={count('present')} tone="good" />
                        <Kpi label="Late" value={count('late')} tone={count('late') ? 'warn' : undefined} />
                        <Kpi label="Absent" value={count('absent')} tone={count('absent') ? 'bad' : undefined} />
                        <Kpi label="On leave" value={count('on_leave')} />
                        <Kpi label="Not marked" value={unmarked} tone={unmarked ? 'warn' : undefined} />
                    </div>

                    <div className="fb-panel">
                        <div className="fb-filters">
                            <label>
                                Day
                                <input type="date" value={date} max={today()} onChange={(event) => event.target.value && setDate(event.target.value)} />
                            </label>
                            <button type="button" className="fb-btn" onClick={markAllPresent} disabled={!unmarked}>
                                Mark everyone not yet marked as present
                            </button>
                            <button type="button" className="fb-btn primary" onClick={save} disabled={busy || !dirty}>
                                {busy ? 'Saving…' : 'Save attendance'}
                            </button>
                        </div>

                        {rows.length ? (
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th>Status</th>
                                            <th>Came</th>
                                            <th>Left</th>
                                            <th>Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.user_id}>
                                                <td>
                                                    <b>{row.name}</b>
                                                    <small style={{ display: 'block' }}>
                                                        {[row.job_title, row.department].filter(Boolean).join(' · ') || '—'}
                                                        {row.on_approved_leave && ' · approved leave'}
                                                    </small>
                                                </td>
                                                <td>
                                                    <select
                                                        value={row.status || ''}
                                                        onChange={(event) => change(row.user_id, { status: event.target.value || null })}
                                                        aria-label={`Status of ${row.name}`}
                                                    >
                                                        <option value="">Not marked</option>
                                                        {OPTIONS.map(([value, label]) => (
                                                            <option key={value} value={value}>
                                                                {label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="time"
                                                        value={row.check_in_time || ''}
                                                        disabled={row.status === 'absent' || row.status === 'on_leave'}
                                                        onChange={(event) => change(row.user_id, { check_in_time: event.target.value || null })}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="time"
                                                        value={row.check_out_time || ''}
                                                        disabled={row.status === 'absent' || row.status === 'on_leave'}
                                                        onChange={(event) => change(row.user_id, { check_out_time: event.target.value || null })}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        value={row.notes || ''}
                                                        placeholder="Optional"
                                                        onChange={(event) => change(row.user_id, { notes: event.target.value })}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty>{register.loading ? 'Loading…' : 'No working employees to mark.'}</Empty>
                        )}
                        <p className="fb-hint">
                            Attendance for {fmtDate(date)}. Days marked Absent, and unpaid leave, are taken off the salary when payroll is prepared.
                        </p>
                    </div>
                </>
            )}

            {tab === 'summary' && (
                <div className="fb-panel">
                    <div className="fb-filters">
                        <label>
                            Month
                            <input type="month" value={month} max={thisMonth()} onChange={(event) => event.target.value && setMonth(event.target.value)} />
                        </label>
                    </div>
                    <h2>{monthName(month)}</h2>
                    {summary.data?.rows?.length ? (
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th className="num">Present</th>
                                        <th className="num">Late</th>
                                        <th className="num">Absent</th>
                                        <th className="num">On leave</th>
                                        <th className="num">Days recorded</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.data.rows.map((row: any) => (
                                        <tr key={row.user_id}>
                                            <td>
                                                <b>{row.name}</b>
                                                <small style={{ display: 'block' }}>{row.job_title || '—'}</small>
                                            </td>
                                            <td className="num">{row.present}</td>
                                            <td className="num">{row.late}</td>
                                            <td className="num">{row.absent ? <span className="fb-pill bad">{row.absent}</span> : 0}</td>
                                            <td className="num">{row.on_leave}</td>
                                            <td className="num">{row.recorded}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <Empty>{summary.loading ? 'Loading…' : 'Nothing recorded for this month.'}</Empty>
                    )}
                </div>
            )}
        </section>
    );
}
