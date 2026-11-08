import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Alerts, Empty, Kpi, MACHINE_STATUS, PageHead, Pill, api, canManage, fmtDate, isoDate, number, percent, today, useFinanceData } from '../mtKit';
import type { ViewProps } from '../mtKit';

const daysAgo = (days: number) => isoDate(new Date(Date.now() - days * 86400000));

type Form = {
    machine_id: string;
    log_date: string;
    shift: string;
    planned_hours: string;
    run_hours: string;
    stop_reason: string;
    units_produced: string;
    units_target: string;
    units_rejected: string;
    notes: string;
};

const blank = (): Form => ({ machine_id: '', log_date: today(), shift: 'day', planned_hours: '8', run_hours: '8', stop_reason: '', units_produced: '', units_target: '', units_rejected: '', notes: '' });

export default function PerformanceView({ can }: ViewProps) {
    const [from, setFrom] = useState(daysAgo(29));
    const [to, setTo] = useState(today());
    const [machineId, setMachineId] = useState('');
    const { data, loading, error, reload } = useFinanceData<any>(`/api/maintenance/performance?from=${from}&to=${to}${machineId ? `&machine_id=${machineId}` : ''}`);
    const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');
    const [failure, setFailure] = useState('');

    const t = data?.totals;
    const manager = data?.can_manage || canManage(can);
    const machines: any[] = data?.machines || [];
    const form = editing?.form;
    const set = (patch: Partial<Form>) => setEditing((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
    const machine = machines.find((item) => String(item.id) === form?.machine_id);
    const stopped = form ? Number(form.run_hours || 0) < Number(form.planned_hours || 0) : false;

    const open = (log?: any) => {
        setFormError('');
        setEditing(
            log
                ? {
                      id: log.id,
                      form: {
                          machine_id: String(log.machine_id),
                          log_date: String(log.log_date).slice(0, 10),
                          shift: log.shift,
                          planned_hours: String(+(log.planned_minutes / 60).toFixed(2)),
                          run_hours: String(+(log.run_minutes / 60).toFixed(2)),
                          stop_reason: log.stop_reason || '',
                          units_produced: String(log.units_produced || ''),
                          units_target: String(log.units_target || ''),
                          units_rejected: String(log.units_rejected || ''),
                          notes: log.notes || '',
                      },
                  }
                : { id: null, form: { ...blank(), machine_id: machineId } },
        );
    };

    const save = async () => {
        if (!editing || !form) return;
        setBusy(true);
        setFormError('');
        try {
            await api(editing.id ? `/api/maintenance/performance/${editing.id}` : '/api/maintenance/performance', {
                method: editing.id ? 'PATCH' : 'POST',
                body: JSON.stringify({
                    machine_id: Number(form.machine_id),
                    log_date: form.log_date,
                    shift: form.shift,
                    planned_minutes: Math.round(Number(form.planned_hours) * 60),
                    run_minutes: Math.round(Number(form.run_hours) * 60),
                    stop_reason: stopped ? form.stop_reason || null : null,
                    units_produced: Number(form.units_produced || 0),
                    units_target: Number(form.units_target || 0),
                    units_rejected: Number(form.units_rejected || 0),
                    notes: form.notes || null,
                }),
            });
            setEditing(null);
            setSuccess(editing.id ? 'The record was corrected.' : 'Machine performance was recorded.');
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (log: any) => {
        if (!window.confirm(`Delete the record of ${log.machine?.name} for ${fmtDate(log.log_date)}?`)) return;
        setFailure('');
        try {
            await api(`/api/maintenance/performance/${log.id}`, { method: 'DELETE' });
            setSuccess('The record was deleted.');
            reload();
        } catch (reason: any) {
            setFailure(reason.message);
        }
    };

    return (
        <section className="fb-page">
            <PageHead title="Machine performance" subtitle="Record how long each machine ran and what it made, and see how well it performs." loading={loading} onRefresh={reload}>
                {can('maintenance.create') && (
                    <button type="button" className="primary" onClick={() => open()}>
                        Record performance
                    </button>
                )}
            </PageHead>
            <Alerts error={error || failure} success={success} />

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
                    <label>
                        Machine
                        <select value={machineId} onChange={(event) => setMachineId(event.target.value)}>
                            <option value="">All machines</option>
                            {machines.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {t && (
                <div className="fb-kpis">
                    <Kpi label="Availability" value={percent(t.availability)} hint={`${t.run_hours} of ${t.planned_hours} hours run`} tone={t.availability !== null && t.availability < 70 ? 'warn' : undefined} />
                    <Kpi label="Output vs target" value={percent(t.performance)} hint={`${number(t.units_produced)} pieces made`} />
                    <Kpi label="Good pieces" value={percent(t.quality)} hint={`${number(t.units_rejected)} rejected`} />
                    <Kpi label="OEE" value={percent(t.oee)} hint="Availability × speed × quality" />
                    <Kpi label="Hours stopped" value={t.stop_hours} tone={t.stop_hours ? 'warn' : undefined} />
                    <Kpi label="Breakdowns" value={t.breakdowns} tone={t.breakdowns ? 'bad' : 'good'} />
                </div>
            )}

            <div className="fb-split">
                <div className="fb-panel">
                    <h2>By machine</h2>
                    {data?.summary?.length ? (
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Machine</th>
                                        <th className="num">Hours run</th>
                                        <th className="num">Availability</th>
                                        <th className="num">Output vs target</th>
                                        <th className="num">OEE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.summary.map((row: any) => (
                                        <tr key={row.machine_id}>
                                            <td>
                                                <b>{row.name}</b>
                                                <small style={{ display: 'block' }}>{row.code}</small>
                                            </td>
                                            <td className="num">{row.run_hours}</td>
                                            <td className="num">{percent(row.availability)}</td>
                                            <td className="num">{percent(row.performance)}</td>
                                            <td className="num">
                                                <b>{percent(row.oee)}</b>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <Empty>{loading ? 'Loading…' : 'Nothing recorded in these dates.'}</Empty>
                    )}
                </div>
                <div className="fb-panel">
                    <h2>Why machines stood still</h2>
                    {data?.stop_reasons?.length ? (
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Reason</th>
                                        <th className="num">Times</th>
                                        <th className="num">Hours</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.stop_reasons.map((row: any) => (
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
            </div>

            <div className="fb-panel">
                <h2>Daily records</h2>
                {data?.logs?.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Day</th>
                                    <th>Machine</th>
                                    <th>Shift</th>
                                    <th className="num">Planned h</th>
                                    <th className="num">Run h</th>
                                    <th>Stop reason</th>
                                    <th className="num">Made</th>
                                    <th className="num">Target</th>
                                    <th className="num">Rejected</th>
                                    <th>Recorded by</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {data.logs.map((log: any) => (
                                    <tr key={log.id}>
                                        <td>{fmtDate(log.log_date)}</td>
                                        <td>
                                            <b>{log.machine?.name}</b>
                                        </td>
                                        <td>{data.shifts[log.shift] || log.shift}</td>
                                        <td className="num">{+(log.planned_minutes / 60).toFixed(1)}</td>
                                        <td className="num">{+(log.run_minutes / 60).toFixed(1)}</td>
                                        <td>{log.stop_reason ? data.reasons[log.stop_reason] || log.stop_reason : '—'}</td>
                                        <td className="num">{number(log.units_produced)}</td>
                                        <td className="num">{log.units_target ? number(log.units_target) : '—'}</td>
                                        <td className="num">{number(log.units_rejected)}</td>
                                        <td>{log.recorder?.name}</td>
                                        <td>
                                            {can('maintenance.create') && (
                                                <>
                                                    <button type="button" className="fb-btn small" onClick={() => open(log)}>
                                                        Correct
                                                    </button>{' '}
                                                    {manager && (
                                                        <button type="button" className="fb-btn danger small" onClick={() => remove(log)}>
                                                            Delete
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : 'No daily records in these dates. Press Record performance after each shift.'}</Empty>
                )}
            </div>

            {editing && form && (
                <Modal
                    title={editing.id ? 'Correct the record' : 'Record machine performance'}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setEditing(null)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={save} disabled={busy || !form.machine_id}>
                                {busy ? 'Saving…' : 'Save record'}
                            </button>
                        </>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <label>
                            Machine
                            <select value={form.machine_id} disabled={!!editing.id} onChange={(event) => set({ machine_id: event.target.value })}>
                                <option value="">Choose a machine</option>
                                {machines
                                    .filter((item) => item.status !== 'retired')
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({MACHINE_STATUS[item.status]})
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <div className="two">
                            <label>
                                Day
                                <input type="date" value={form.log_date} max={today()} onChange={(event) => set({ log_date: event.target.value })} />
                            </label>
                            <label>
                                Shift
                                <select value={form.shift} onChange={(event) => set({ shift: event.target.value })}>
                                    {Object.entries(data?.shifts || {}).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {String(label)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="two">
                            <label>
                                Hours it should have worked
                                <input type="number" min={0.5} max={24} step={0.5} value={form.planned_hours} onChange={(event) => set({ planned_hours: event.target.value })} />
                            </label>
                            <label>
                                Hours it really worked
                                <input type="number" min={0} max={24} step={0.25} value={form.run_hours} onChange={(event) => set({ run_hours: event.target.value })} />
                            </label>
                        </div>
                        {stopped && (
                            <label>
                                Why did it stand still?
                                <select value={form.stop_reason} onChange={(event) => set({ stop_reason: event.target.value })}>
                                    <option value="">Choose a reason</option>
                                    {Object.entries(data?.reasons || {}).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {String(label)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <div className="two">
                            <label>
                                Pieces made
                                <input type="number" min={0} value={form.units_produced} onChange={(event) => set({ units_produced: event.target.value })} />
                            </label>
                            <label>
                                Pieces rejected
                                <input type="number" min={0} value={form.units_rejected} onChange={(event) => set({ units_rejected: event.target.value })} />
                            </label>
                        </div>
                        <label>
                            Target pieces (leave empty to use the usual speed of the machine)
                            <input type="number" min={0} value={form.units_target} onChange={(event) => set({ units_target: event.target.value })} />
                        </label>
                        {machine && !machine.ideal_output_per_hour && !form.units_target && <p className="fb-hint">This machine has no usual speed set, so output vs target and OEE cannot be worked out until you type a target or set the usual pieces per hour on the machine.</p>}
                        <label>
                            Notes
                            <textarea rows={2} value={form.notes} onChange={(event) => set({ notes: event.target.value })} />
                        </label>
                    </div>
                </Modal>
            )}
        </section>
    );
}
