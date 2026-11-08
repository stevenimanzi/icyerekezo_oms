import { useState } from 'react';
import { Alerts, Empty, JOB_STATUS, JOB_TYPE, Kpi, PageHead, PRIORITY, duration, isoDate, money, number, percent, shortDate, today, useFinanceData, words } from '../mtKit';
import type { ViewProps } from '../mtKit';

const daysAgo = (days: number) => isoDate(new Date(Date.now() - days * 86400000));

export default function ReportsView(_props: ViewProps) {
    const [from, setFrom] = useState(daysAgo(29));
    const [to, setTo] = useState(today());
    const perf = useFinanceData<any>(`/api/maintenance/performance?from=${from}&to=${to}`);
    const jobs = useFinanceData<any>(`/api/maintenance/jobs?view=all&from=${from}&to=${to}`);
    const t = perf.data?.totals;
    const currency = jobs.data?.currency || 'RWF';
    const list: any[] = jobs.data?.jobs || [];
    const breakdowns = list.filter((job) => job.maintenance_type === 'breakdown');

    return (
        <section className="fb-page">
            <PageHead
                title="Machine performance report"
                subtitle="How each machine performed, how long it stood still, and every problem and repair in the chosen dates."
                loading={perf.loading || jobs.loading}
                onRefresh={() => {
                    perf.reload();
                    jobs.reload();
                }}
            />
            <Alerts error={perf.error || jobs.error} />

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        From
                        <input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} />
                    </label>
                    <label>
                        To
                        <input type="date" value={to} min={from} max={today()} onChange={(event) => event.target.value && setTo(event.target.value)} />
                    </label>
                </div>
            </div>

            {t && (
                <div className="fb-kpis">
                    <Kpi label="Availability" value={percent(t.availability)} hint={`${t.run_hours} of ${t.planned_hours} hours run`} />
                    <Kpi label="Output vs target" value={percent(t.performance)} hint={`${number(t.units_produced)} made, target ${number(t.units_target)}`} />
                    <Kpi label="Good pieces" value={percent(t.quality)} hint={`${number(t.units_rejected)} rejected`} />
                    <Kpi label="OEE" value={percent(t.oee)} hint="Availability × speed × quality" />
                    <Kpi label="Breakdowns" value={t.breakdowns} tone={t.breakdowns ? 'bad' : 'good'} />
                    <Kpi label="Repair cost" value={money(t.repair_cost, currency)} />
                </div>
            )}

            <div className="fb-panel">
                <h2>Performance of each machine</h2>
                {perf.data?.summary?.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Machine</th>
                                    <th className="num">Planned hours</th>
                                    <th className="num">Hours run</th>
                                    <th className="num">Hours stopped</th>
                                    <th className="num">Availability</th>
                                    <th className="num">Pieces made</th>
                                    <th className="num">Target</th>
                                    <th className="num">Output vs target</th>
                                    <th className="num">Good pieces</th>
                                    <th className="num">OEE</th>
                                    <th className="num">Breakdowns</th>
                                    <th className="num">Hours between breakdowns</th>
                                    <th className="num">Average repair</th>
                                    <th className="num">Repair cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perf.data.summary.map((row: any) => (
                                    <tr key={row.machine_id}>
                                        <td>
                                            <b>{row.name}</b>
                                        </td>
                                        <td className="num">{row.planned_hours}</td>
                                        <td className="num">{row.run_hours}</td>
                                        <td className="num">{row.stop_hours}</td>
                                        <td className="num">{percent(row.availability)}</td>
                                        <td className="num">{number(row.units_produced)}</td>
                                        <td className="num">{number(row.units_target)}</td>
                                        <td className="num">{percent(row.performance)}</td>
                                        <td className="num">{percent(row.quality)}</td>
                                        <td className="num">
                                            <b>{percent(row.oee)}</b>
                                        </td>
                                        <td className="num">{row.breakdowns}</td>
                                        <td className="num">{row.mtbf_hours ?? '—'}</td>
                                        <td className="num">{duration(row.mttr_minutes)}</td>
                                        <td className="num">{money(row.repair_cost, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{perf.loading ? 'Loading…' : 'Nothing was recorded in these dates.'}</Empty>
                )}
                <p className="fb-hint">
                    Availability = hours run ÷ hours planned. Output vs target = pieces made ÷ target. Good pieces = pieces that were not rejected. OEE = availability × output vs
                    target (at most 100%) × good pieces. Dashes mean the figures needed (for example a target) were not recorded.
                </p>
            </div>

            <div className="fb-split">
                <div className="fb-panel">
                    <h2>Why machines stood still</h2>
                    {perf.data?.stop_reasons?.length ? (
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Reason</th>
                                        <th className="num">Times</th>
                                        <th className="num">Hours stopped</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {perf.data.stop_reasons.map((row: any) => (
                                        <tr key={row.reason}>
                                            <td>{row.label}</td>
                                            <td className="num">{row.times}</td>
                                            <td className="num">{(row.minutes / 60).toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <Empty>No stops were recorded.</Empty>
                    )}
                </div>
                <div className="fb-panel">
                    <h2>Problems reported</h2>
                    {breakdowns.length ? (
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Machine</th>
                                        <th>Problem</th>
                                        <th>Cause</th>
                                        <th className="num">Stopped</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdowns.map((job) => (
                                        <tr key={job.id}>
                                            <td>{shortDate(job.created_at)}</td>
                                            <td>{job.machine?.name}</td>
                                            <td>{job.title}</td>
                                            <td>{job.cause || '—'}</td>
                                            <td className="num">{job.downtime_minutes ? duration(job.downtime_minutes) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <Empty>No breakdown in these dates.</Empty>
                    )}
                </div>
            </div>

            <div className="fb-panel">
                <h2>All jobs in these dates</h2>
                {list.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Machine</th>
                                    <th>Job</th>
                                    <th>Type</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Reported by</th>
                                    <th>Done by</th>
                                    <th>What was done</th>
                                    <th className="num">Stopped</th>
                                    <th className="num">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((job) => (
                                    <tr key={job.id}>
                                        <td>{shortDate(job.created_at)}</td>
                                        <td>{job.machine?.name}</td>
                                        <td>{job.title}</td>
                                        <td>{JOB_TYPE[job.maintenance_type]}</td>
                                        <td>{PRIORITY[job.priority] || words(job.priority)}</td>
                                        <td>{JOB_STATUS[job.status]}</td>
                                        <td>{job.reporter?.name}</td>
                                        <td>{job.assignee?.name || '—'}</td>
                                        <td>{job.resolution || '—'}</td>
                                        <td className="num">{job.downtime_minutes ? duration(job.downtime_minutes) : '—'}</td>
                                        <td className="num">{money(job.cost, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{jobs.loading ? 'Loading…' : 'No job was opened in these dates.'}</Empty>
                )}
            </div>
        </section>
    );
}
