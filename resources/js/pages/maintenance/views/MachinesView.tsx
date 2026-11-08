import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { MachineModal } from '../MachineModal';
import { Alerts, Empty, JOB_STATUS, JOB_TYPE, Kpi, MACHINE_STATUS, PageHead, Pill, canManage, dueText, duration, fmtDate, money, number, percent, shortDate, useFinanceData } from '../mtKit';
import type { ViewProps } from '../mtKit';

export default function MachinesView({ can }: ViewProps) {
    const { data, loading, error, reload } = useFinanceData<any>('/api/machines/list');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<any>(undefined); // undefined = closed, null = new
    const [viewing, setViewing] = useState<any>(null);
    const [success, setSuccess] = useState('');

    const manager = data?.can_manage || canManage(can);
    const canEdit = manager || can('maintenance.execute');
    const machines: any[] = data?.machines || [];
    const needle = search.trim().toLowerCase();
    const shown = machines.filter((m) => (!status || m.status === status) && (!needle || [m.name, m.code, m.type, m.location].filter(Boolean).some((v: string) => v.toLowerCase().includes(needle))));
    const count = (s: string) => machines.filter((m) => m.status === s).length;

    return (
        <section className="fb-page">
            <PageHead title="Machines" subtitle="Every machine in the factory, how it is doing and when it needs service." loading={loading} onRefresh={reload}>
                {manager && (
                    <button type="button" className="primary" onClick={() => setEditing(null)}>
                        Register a machine
                    </button>
                )}
            </PageHead>
            <Alerts error={error} success={success} />

            <div className="fb-kpis">
                <Kpi label="Machines" value={machines.filter((m) => m.status !== 'retired').length} />
                <Kpi label="Working" value={count('operational')} tone="good" />
                <Kpi label="Being repaired" value={count('maintenance')} />
                <Kpi label="Stopped or broken" value={count('broken') + count('down')} tone={count('broken') + count('down') ? 'bad' : undefined} />
            </div>

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Search
                        <input value={search} placeholder="Name, code, type, place" onChange={(event) => setSearch(event.target.value)} />
                    </label>
                    <label>
                        State
                        <select value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="">All</option>
                            {Object.entries(MACHINE_STATUS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {shown.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Machine</th>
                                    <th>Type</th>
                                    <th>Place</th>
                                    <th>State</th>
                                    <th className="num">Availability, 30 days</th>
                                    <th className="num">OEE</th>
                                    <th className="num">Open jobs</th>
                                    <th>Next service</th>
                                    <th className="num">Hours run</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((m) => {
                                    const due = dueText(m.next_maintenance_at);

                                    return (
                                        <tr key={m.id}>
                                            <td>
                                                <b>{m.name}</b>
                                                <small style={{ display: 'block' }}>{m.code}</small>
                                            </td>
                                            <td>{m.type}</td>
                                            <td>{m.location || m.department?.name || '—'}</td>
                                            <td>
                                                <Pill value={m.status} labels={MACHINE_STATUS} />
                                            </td>
                                            <td className="num">{percent(m.availability)}</td>
                                            <td className="num">{percent(m.oee)}</td>
                                            <td className="num">{m.open_jobs || '—'}</td>
                                            <td>{m.status === 'retired' ? '—' : <span className={`fb-pill ${due.tone}`}>{due.text}</span>}</td>
                                            <td className="num">{number(Math.round(Number(m.runtime_hours)))}</td>
                                            <td>
                                                <button type="button" className="fb-btn small" onClick={() => setViewing(m)}>
                                                    History
                                                </button>{' '}
                                                {canEdit && (
                                                    <button type="button" className="fb-btn small" onClick={() => setEditing(m)}>
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : machines.length ? 'No machine matches.' : 'No machine is registered yet.'}</Empty>
                )}
            </div>

            {editing !== undefined && (
                <MachineModal
                    machine={editing}
                    departments={data?.departments || []}
                    canManage={manager}
                    onClose={() => setEditing(undefined)}
                    onSaved={(message) => {
                        setEditing(undefined);
                        setSuccess(message);
                        reload();
                    }}
                />
            )}
            {viewing && <HistoryModal machine={viewing} onClose={() => setViewing(null)} />}
        </section>
    );
}

function HistoryModal({ machine, onClose }: { machine: any; onClose: () => void }) {
    const { data, loading, error } = useFinanceData<any>(`/api/machines/${machine.id}/history`);
    const s = data?.last_90_days;

    return (
        <Modal title={`${machine.name} (${machine.code})`} onClose={onClose} footer={<button className="secondary-btn" onClick={onClose}>Close</button>}>
            <div className="fb-form">
                {error && <div className="fb-alert error">{error}</div>}
                {loading && <p className="fb-muted">Loading…</p>}
                {data && (
                    <>
                        <p className="fb-muted">
                            {[data.machine.manufacturer, data.machine.model, data.machine.serial_number && `S/N ${data.machine.serial_number}`, data.machine.department?.name].filter(Boolean).join(' · ') || 'No more details written.'}
                            {data.machine.last_maintenance_at ? ` · last service ${shortDate(data.machine.last_maintenance_at)}` : ''}
                        </p>
                        <h2>Last 90 days</h2>
                        <div className="fb-kpis">
                            <Kpi label="Availability" value={percent(s.availability)} />
                            <Kpi label="OEE" value={percent(s.oee)} />
                            <Kpi label="Breakdowns" value={s.breakdowns} tone={s.breakdowns ? 'bad' : 'good'} />
                            <Kpi label="Average between breakdowns" value={s.mtbf_hours === null ? '—' : `${s.mtbf_hours} h`} />
                            <Kpi label="Average repair time" value={duration(s.mttr_minutes)} />
                            <Kpi label="Repair cost" value={money(s.repair_cost)} />
                        </div>
                        <h2>Recent jobs</h2>
                        {data.jobs.length ? (
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Job</th>
                                            <th>Type</th>
                                            <th>Status</th>
                                            <th className="num">Stopped</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.jobs.map((job: any) => (
                                            <tr key={job.id}>
                                                <td>{shortDate(job.created_at)}</td>
                                                <td>
                                                    {job.title}
                                                    {job.cause && <small style={{ display: 'block' }}>Cause: {job.cause}</small>}
                                                </td>
                                                <td>{JOB_TYPE[job.maintenance_type]}</td>
                                                <td>
                                                    <Pill value={job.status} labels={JOB_STATUS} />
                                                </td>
                                                <td className="num">{job.downtime_minutes ? duration(job.downtime_minutes) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty>No job was ever opened for this machine.</Empty>
                        )}
                        <h2>Recent daily records</h2>
                        {data.logs.length ? (
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Day</th>
                                            <th className="num">Run h</th>
                                            <th className="num">Made</th>
                                            <th className="num">Rejected</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.logs.map((log: any) => (
                                            <tr key={log.id}>
                                                <td>{fmtDate(log.log_date)}</td>
                                                <td className="num">{+(log.run_minutes / 60).toFixed(1)}</td>
                                                <td className="num">{number(log.units_produced)}</td>
                                                <td className="num">{number(log.units_rejected)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty>No daily record yet.</Empty>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}
