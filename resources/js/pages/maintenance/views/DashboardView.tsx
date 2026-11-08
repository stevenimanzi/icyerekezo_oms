import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alerts, Empty, JOB_STATUS, JOB_TYPE, Kpi, PageHead, Pill, PRIORITY, dueText, duration, money, percent, shortDate, useFinanceData } from '../mtKit';
import type { ViewProps } from '../mtKit';

export default function DashboardView({ onNavigate }: ViewProps) {
    const { data, loading, error, reload } = useFinanceData<any>('/api/maintenance/dashboard');
    const go = (page: string) => () => onNavigate?.(page);
    const m = data?.machines;
    const month = data?.month;

    return (
        <section className="fb-page">
            <PageHead title="Maintenance dashboard" subtitle="How the machines are doing, what is broken and what is due for service." loading={loading} onRefresh={reload} />
            <Alerts error={error} />

            {data && (
                <>
                    {m.stopped > 0 && (
                        <div className="fb-alert error">
                            <span>
                                <b>{m.stopped}</b> machine{m.stopped === 1 ? ' is' : 's are'} stopped or broken right now.
                            </span>
                            <button type="button" className="fb-btn small" onClick={go('maint-problems')}>
                                Open problems
                            </button>
                        </div>
                    )}
                    {data.jobs.unassigned > 0 && (
                        <div className="fb-alert info">
                            <span>
                                <b>{data.jobs.unassigned}</b> open job{data.jobs.unassigned === 1 ? ' has' : 's have'} nobody to do {data.jobs.unassigned === 1 ? 'it' : 'them'}.
                            </span>
                            <button type="button" className="fb-btn small" onClick={go('maint-problems')}>
                                Give them out
                            </button>
                        </div>
                    )}
                    {data.not_logged_today > 0 && (
                        <div className="fb-alert info">
                            <span>
                                Today's performance is not yet recorded for <b>{data.not_logged_today}</b> working machine{data.not_logged_today === 1 ? '' : 's'}.
                            </span>
                            <button type="button" className="fb-btn small" onClick={go('maint-performance')}>
                                Record performance
                            </button>
                        </div>
                    )}

                    <div className="fb-kpis">
                        <Kpi label="Machines working" value={`${m.working} of ${m.total}`} tone={m.working === m.total ? 'good' : undefined} hint={m.under_maintenance ? `${m.under_maintenance} being repaired` : undefined} />
                        <Kpi label="Stopped or broken" value={m.stopped} tone={m.stopped ? 'bad' : 'good'} />
                        <Kpi label="Open jobs" value={data.jobs.open} tone={data.jobs.urgent ? 'warn' : undefined} hint={data.jobs.urgent ? `${data.jobs.urgent} urgent or high` : undefined} />
                        <Kpi label="Service overdue" value={data.service.overdue} tone={data.service.overdue ? 'bad' : 'good'} hint={`${data.service.due_soon} more due in 7 days`} />
                    </div>

                    <div className="fb-panel">
                        <div className="fb-panel-head">
                            <h2>This month</h2>
                            <button type="button" className="fb-btn small" onClick={go('maint-reports')}>
                                Full report
                            </button>
                        </div>
                        <div className="fb-kpis">
                            <Kpi label="Availability" value={percent(month.availability)} hint={`${month.run_hours} h run, ${month.stop_hours} h stopped`} />
                            <Kpi label="Output vs target" value={percent(month.performance)} hint={`${month.units_produced.toLocaleString()} pieces made`} />
                            <Kpi label="Good pieces" value={percent(month.quality)} />
                            <Kpi label="OEE" value={percent(month.oee)} hint="Availability × speed × quality" />
                            <Kpi label="Breakdowns" value={month.breakdowns} />
                            <Kpi label="Average repair time" value={duration(month.mttr_minutes)} />
                            <Kpi label="Repair cost" value={money(month.repair_cost, data.currency)} hint={`${month.jobs_done} jobs finished`} />
                        </div>
                        {month.availability === null && <p className="fb-hint">No performance has been recorded this month yet, so availability and OEE show a dash.</p>}
                    </div>

                    <div className="fb-split">
                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Hours run and stopped, last 14 days</h2>
                            </div>
                            <div style={{ height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.trend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={1} />
                                        <YAxis tick={{ fontSize: 11 }} width={36} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="run_hours" name="Hours run" stackId="a" fill="#16a34a" />
                                        <Bar dataKey="stop_hours" name="Hours stopped" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="fb-panel">
                            <div className="fb-panel-head">
                                <h2>Service due</h2>
                                <button type="button" className="fb-btn small" onClick={go('maint-schedule')}>
                                    Service plan
                                </button>
                            </div>
                            {data.due.length ? (
                                <div className="fb-table-wrap">
                                    <table className="fb-table">
                                        <tbody>
                                            {data.due.map((machine: any) => {
                                                const due = dueText(machine.next_maintenance_at);

                                                return (
                                                    <tr key={machine.id}>
                                                        <td>
                                                            <b>{machine.name}</b>
                                                            <small style={{ display: 'block' }}>{machine.code}</small>
                                                        </td>
                                                        <td>{shortDate(machine.next_maintenance_at)}</td>
                                                        <td>
                                                            <span className={`fb-pill ${due.tone}`}>{due.text}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Empty>No service is due in the next 14 days.</Empty>
                            )}
                        </div>
                    </div>

                    <div className="fb-panel">
                        <div className="fb-panel-head">
                            <h2>Jobs that need attention</h2>
                            <button type="button" className="fb-btn small" onClick={go('maint-problems')}>
                                All problems and repairs
                            </button>
                        </div>
                        {data.attention.length ? (
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Machine</th>
                                            <th>Job</th>
                                            <th>Type</th>
                                            <th>Priority</th>
                                            <th>Status</th>
                                            <th>Given to</th>
                                            <th>Reported</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.attention.map((job: any) => (
                                            <tr key={job.id}>
                                                <td>
                                                    <b>{job.machine?.name}</b>
                                                </td>
                                                <td>{job.title}</td>
                                                <td>{JOB_TYPE[job.maintenance_type]}</td>
                                                <td>
                                                    <Pill value={job.priority} labels={PRIORITY} />
                                                </td>
                                                <td>
                                                    <Pill value={job.status} labels={JOB_STATUS} />
                                                </td>
                                                <td>{job.assignee?.name || <span className="fb-pill warn">Nobody yet</span>}</td>
                                                <td>{shortDate(job.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty>No open jobs. Every machine is in order.</Empty>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
