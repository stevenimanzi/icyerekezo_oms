import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alerts, Empty, Kpi, PageHead, Pill, fmtDate, monthLabel, money, useFinanceData, words } from '../hrKit';
import type { ViewProps } from '../hrKit';

export default function DashboardView({ onNavigate }: ViewProps) {
    const { data, loading, error, reload } = useFinanceData<any>('/api/hr/dashboard');
    const stats = data?.stats;
    const currency = data?.currency || 'RWF';
    const go = (page: string) => () => onNavigate?.(page);

    return (
        <section className="fb-page">
            <PageHead
                title="HR Dashboard"
                subtitle="People, attendance, leave, overtime and payroll in one place."
                loading={loading}
                onRefresh={reload}
            />
            <Alerts error={error} />

            {stats && (
                <>
                    {stats.missing_salary > 0 && (
                        <div className="fb-alert info">
                            <span>
                                <b>{stats.missing_salary}</b> employee{stats.missing_salary === 1 ? ' has' : 's have'} no salary set, so they
                                will not be in payroll.
                            </span>
                            <button type="button" className="fb-btn primary small" onClick={go('hr-employees')}>
                                Set salaries
                            </button>
                        </div>
                    )}
                    {stats.not_marked_today > 0 && (
                        <div className="fb-alert info">
                            <span>
                                Attendance is not yet marked for <b>{stats.not_marked_today}</b> employee
                                {stats.not_marked_today === 1 ? '' : 's'} today.
                            </span>
                            <button type="button" className="fb-btn primary small" onClick={go('hr-attendance')}>
                                Mark attendance
                            </button>
                        </div>
                    )}

                    <div className="fb-kpis">
                        <Kpi label="Employees" value={stats.headcount} hint="Working in the factory" />
                        <Kpi label="Present today" value={stats.present_today} tone="good" />
                        <Kpi label="Absent today" value={stats.absent_today} tone={stats.absent_today ? 'bad' : undefined} />
                        <Kpi label="On leave today" value={stats.on_leave_today} />
                        <Kpi label="Leave waiting" value={stats.pending_leave} tone={stats.pending_leave ? 'warn' : undefined} hint="Needs a decision" />
                        <Kpi label="Overtime waiting" value={stats.pending_overtime} tone={stats.pending_overtime ? 'warn' : undefined} hint="Needs a decision" />
                        <Kpi label="Training coming" value={stats.upcoming_trainings} />
                    </div>

                    <div className="fb-split">
                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Attendance, last 14 days</h2>
                            </div>
                            <div style={{ height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.trend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={1} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                                        <Tooltip />
                                        <Bar dataKey="present" name="Present" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="absent" name="Absent" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Payroll for {monthLabel(data.payroll_period)}</h2>
                            </div>
                            {data.payroll ? (
                                <>
                                    <p>
                                        <Pill status={data.payroll.status} />
                                    </p>
                                    <p>
                                        <b>{money(data.payroll.total_net, currency)}</b> for {data.payroll.employee_count} employees
                                    </p>
                                    <p className="fb-muted">
                                        {data.payroll.status === 'draft' && 'Check the amounts, then send it to finance.'}
                                        {data.payroll.status === 'submitted' && 'Waiting for finance to pay.'}
                                        {data.payroll.status === 'paid' && 'Finance paid it and recorded it as salaries paid.'}
                                    </p>
                                </>
                            ) : (
                                <Empty>Payroll for this month has not been prepared yet.</Empty>
                            )}
                            <button type="button" className="fb-btn primary" onClick={go('hr-payroll')}>
                                Open payroll
                            </button>
                        </div>
                    </div>

                    <div className="fb-split">
                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Leave waiting for a decision</h2>
                                <button type="button" className="fb-btn small" onClick={go('hr-leave')}>
                                    Open leave
                                </button>
                            </div>
                            {data.pending_leave.length ? (
                                <div className="fb-table-wrap">
                                    <table className="fb-table">
                                        <tbody>
                                            {data.pending_leave.map((leave: any) => (
                                                <tr key={leave.id}>
                                                    <td>
                                                        <b>{leave.user?.name}</b>
                                                        <small style={{ display: 'block' }}>{words(leave.leave_type)}</small>
                                                    </td>
                                                    <td>
                                                        {fmtDate(leave.starts_at)} – {fmtDate(leave.ends_at)}
                                                    </td>
                                                    <td className="num">{leave.days_requested} days</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Empty>No leave is waiting.</Empty>
                            )}
                        </div>

                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Overtime waiting for a decision</h2>
                                <button type="button" className="fb-btn small" onClick={go('hr-overtime')}>
                                    Open overtime
                                </button>
                            </div>
                            {data.pending_overtime.length ? (
                                <div className="fb-table-wrap">
                                    <table className="fb-table">
                                        <tbody>
                                            {data.pending_overtime.map((item: any) => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <b>{item.user?.name}</b>
                                                        <small style={{ display: 'block' }}>{item.reason || 'No reason written'}</small>
                                                    </td>
                                                    <td>{fmtDate(item.work_date)}</td>
                                                    <td className="num">{Number(item.hours)} hours</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Empty>No overtime is waiting.</Empty>
                            )}
                        </div>
                    </div>

                    {data.new_hires.length > 0 && (
                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Newest employees</h2>
                            </div>
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <tbody>
                                        {data.new_hires.map((person: any) => (
                                            <tr key={person.id}>
                                                <td>
                                                    <b>{person.name}</b>
                                                </td>
                                                <td>{person.job_title || '—'}</td>
                                                <td>{person.department || '—'}</td>
                                                <td>Joined {fmtDate(person.hired_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
