import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Alerts, Empty, JOB_STATUS, JOB_TYPE, Kpi, PageHead, Pill, PRIORITY, api, canManage, duration, money, shortDate, useFinanceData } from '../mtKit';
import type { ViewProps } from '../mtKit';

const blank = { machine_id: '', maintenance_type: 'breakdown', title: '', description: '', priority: 'high', assigned_to: '', scheduled_at: '' };

export default function ProblemsView({ can }: ViewProps) {
    const [view, setView] = useState('active');
    const [type, setType] = useState('');
    const [machineId, setMachineId] = useState('');
    const [search, setSearch] = useState('');
    const query = `view=${view}${type ? `&type=${type}` : ''}${machineId ? `&machine_id=${machineId}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const { data, loading, error, reload } = useFinanceData<any>(`/api/maintenance/jobs?${query}`);
    const [reporting, setReporting] = useState(false);
    const [form, setForm] = useState({ ...blank });
    const [open, setOpen] = useState<any>(null);
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');

    const canWork = can('maintenance.execute') || canManage(can);
    const jobs: any[] = data?.jobs || [];
    const currency = data?.currency || 'RWF';

    const submit = async () => {
        setBusy(true);
        setFormError('');
        try {
            await api('/api/maintenance', {
                method: 'POST',
                body: JSON.stringify({ ...form, machine_id: Number(form.machine_id), assigned_to: form.assigned_to ? Number(form.assigned_to) : null, scheduled_at: form.scheduled_at || null }),
            });
            setReporting(false);
            setForm({ ...blank });
            setSuccess(form.maintenance_type === 'breakdown' ? 'The problem was reported and the machine is marked broken until it is repaired.' : 'The job was recorded.');
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="fb-page">
            <PageHead title="Problems and repairs" subtitle="Report what is wrong with a machine and follow it until it is repaired." loading={loading} onRefresh={reload}>
                {can('maintenance.create') && (
                    <button type="button" className="primary" onClick={() => { setFormError(''); setReporting(true); }}>
                        Report a problem
                    </button>
                )}
            </PageHead>
            <Alerts error={error} success={success} />

            <div className="fb-kpis">
                <Kpi label="Open jobs" value={data?.counts.active ?? 0} />
                <Kpi label="Breakdowns open" value={data?.counts.breakdowns ?? 0} tone={data?.counts.breakdowns ? 'bad' : 'good'} />
                <Kpi label="Nobody to do them" value={data?.counts.unassigned ?? 0} tone={data?.counts.unassigned ? 'warn' : undefined} />
                <Kpi label="Finished this month" value={data?.counts.done_month ?? 0} tone="good" />
            </div>

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Show
                        <select value={view} onChange={(event) => setView(event.target.value)}>
                            <option value="active">Open jobs</option>
                            <option value="done">Finished or cancelled</option>
                            <option value="all">Everything</option>
                        </select>
                    </label>
                    <label>
                        Type
                        <select value={type} onChange={(event) => setType(event.target.value)}>
                            <option value="">All types</option>
                            {Object.entries(JOB_TYPE).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Machine
                        <select value={machineId} onChange={(event) => setMachineId(event.target.value)}>
                            <option value="">All machines</option>
                            {(data?.machines || []).map((machine: any) => (
                                <option key={machine.id} value={machine.id}>
                                    {machine.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Search
                        <input value={search} placeholder="Job or machine" onChange={(event) => setSearch(event.target.value)} />
                    </label>
                </div>

                {jobs.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Machine</th>
                                    <th>What is wrong</th>
                                    <th>Type</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Given to</th>
                                    <th>Reported</th>
                                    <th className="num">Stopped</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job) => (
                                    <tr key={job.id}>
                                        <td>
                                            <b>{job.machine?.name}</b>
                                            <small style={{ display: 'block' }}>{job.machine?.code}</small>
                                        </td>
                                        <td>
                                            {job.title}
                                            {job.description && <small style={{ display: 'block' }}>{job.description}</small>}
                                        </td>
                                        <td>{JOB_TYPE[job.maintenance_type]}</td>
                                        <td>
                                            <Pill value={job.priority} labels={PRIORITY} />
                                        </td>
                                        <td>
                                            <Pill value={job.status} labels={JOB_STATUS} />
                                        </td>
                                        <td>{job.assignee?.name || '—'}</td>
                                        <td>
                                            {shortDate(job.created_at)}
                                            <small style={{ display: 'block' }}>by {job.reporter?.name}</small>
                                        </td>
                                        <td className="num">{job.downtime_minutes ? duration(job.downtime_minutes) : '—'}</td>
                                        <td>
                                            <button type="button" className="fb-btn small" onClick={() => { setFormError(''); setOpen(job); }}>
                                                {canWork && !['completed', 'cancelled'].includes(job.status) ? 'Work on it' : 'Details'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : view === 'active' ? 'No open problems. Nothing is waiting.' : 'No jobs to show.'}</Empty>
                )}
            </div>

            {reporting && (
                <Modal
                    title="Report a problem"
                    onClose={() => setReporting(false)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setReporting(false)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={submit} disabled={busy || !form.machine_id || !form.title.trim()}>
                                {busy ? 'Saving…' : 'Send report'}
                            </button>
                        </>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <label>
                            Machine
                            <select value={form.machine_id} onChange={(event) => setForm({ ...form, machine_id: event.target.value })}>
                                <option value="">Choose a machine</option>
                                {(data?.machines || []).map((machine: any) => (
                                    <option key={machine.id} value={machine.id}>
                                        {machine.name} ({machine.code})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            What happened?
                            <select
                                value={form.maintenance_type}
                                onChange={(event) => setForm({ ...form, maintenance_type: event.target.value, priority: event.target.value === 'breakdown' ? 'high' : 'normal' })}
                            >
                                <option value="breakdown">The machine stopped working (breakdown)</option>
                                <option value="corrective">The machine works but has a fault (repair)</option>
                                <option value="preventive">Planned service</option>
                                <option value="inspection">Inspection</option>
                            </select>
                        </label>
                        <label>
                            Short description
                            <input value={form.title} placeholder="For example: needle keeps breaking" onChange={(event) => setForm({ ...form, title: event.target.value })} />
                        </label>
                        <label>
                            More details (optional)
                            <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                        </label>
                        <div className="two">
                            <label>
                                How urgent?
                                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                                    {Object.entries(PRIORITY).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Give to (optional)
                                <select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}>
                                    <option value="">Nobody yet</option>
                                    {(data?.users || []).map((person: any) => (
                                        <option key={person.id} value={person.id}>
                                            {person.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {['preventive', 'inspection'].includes(form.maintenance_type) && (
                            <label>
                                Planned for
                                <input type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} />
                            </label>
                        )}
                        {form.maintenance_type === 'breakdown' && <p className="fb-hint">The machine is marked broken at once, and the time it stands still is counted until the repair is finished.</p>}
                    </div>
                </Modal>
            )}

            {open && (
                <JobModal
                    job={open}
                    users={data?.users || []}
                    canWork={canWork}
                    currency={currency}
                    onClose={() => setOpen(null)}
                    onSaved={(message) => {
                        setOpen(null);
                        setSuccess(message);
                        reload();
                    }}
                />
            )}
        </section>
    );
}

function JobModal({ job, users, canWork, currency, onClose, onSaved }: { job: any; users: any[]; canWork: boolean; currency: string; onClose: () => void; onSaved: (message: string) => void }) {
    const closed = ['completed', 'cancelled'].includes(job.status);
    const [form, setForm] = useState({
        status: job.status,
        assigned_to: job.assigned_to ? String(job.assigned_to) : '',
        cause: job.cause || '',
        resolution: job.resolution || '',
        parts_used: job.parts_used || '',
        cost: String(Number(job.cost || 0)),
        downtime_minutes: job.downtime_minutes ? String(job.downtime_minutes) : '',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
    const finishing = form.status === 'completed';

    const save = async (status = form.status) => {
        setBusy(true);
        setError('');
        try {
            await api(`/api/maintenance/${job.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    ...form,
                    status,
                    assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
                    cost: Number(form.cost || 0),
                    downtime_minutes: form.downtime_minutes === '' ? null : Number(form.downtime_minutes),
                }),
            });
            onSaved(status === 'completed' ? `"${job.title}" is finished and the machine is working again.` : `"${job.title}" was saved.`);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={`${job.machine?.name}: ${job.title}`}
            onClose={onClose}
            footer={
                canWork && !closed ? (
                    <>
                        <button className="secondary-btn" onClick={onClose} disabled={busy}>
                            Close
                        </button>
                        {job.status !== 'in_progress' && (
                            <button className="secondary-btn" onClick={() => save('in_progress')} disabled={busy}>
                                Start work
                            </button>
                        )}
                        <button className="primary-btn" onClick={() => save()} disabled={busy}>
                            {busy ? 'Saving…' : finishing ? 'Finish the job' : 'Save'}
                        </button>
                    </>
                ) : (
                    <button className="secondary-btn" onClick={onClose}>
                        Close
                    </button>
                )
            }
        >
            <div className="fb-form">
                {error && <div className="fb-alert error">{error}</div>}
                <p className="fb-muted">
                    {JOB_TYPE[job.maintenance_type]} · reported {shortDate(job.created_at)} by {job.reporter?.name}
                    {job.started_at ? ` · started ${shortDate(job.started_at)}` : ''}
                    {job.completed_at ? ` · finished ${shortDate(job.completed_at)}` : ''}
                </p>
                {job.description && <p>{job.description}</p>}

                {canWork && !closed ? (
                    <>
                        <div className="two">
                            <label>
                                Status
                                <select value={form.status} onChange={(event) => set({ status: event.target.value })}>
                                    {Object.entries(JOB_STATUS).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Given to
                                <select value={form.assigned_to} onChange={(event) => set({ assigned_to: event.target.value })}>
                                    <option value="">Nobody yet</option>
                                    {users.map((person) => (
                                        <option key={person.id} value={person.id}>
                                            {person.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {job.maintenance_type === 'breakdown' && (
                            <label>
                                What caused the problem? {finishing && '(required)'}
                                <input value={form.cause} placeholder="For example: worn belt" onChange={(event) => set({ cause: event.target.value })} />
                            </label>
                        )}
                        <label>
                            What was done? {finishing && '(required)'}
                            <textarea rows={3} value={form.resolution} onChange={(event) => set({ resolution: event.target.value })} />
                        </label>
                        <label>
                            Spare parts used
                            <input value={form.parts_used} placeholder="Part names and how many" onChange={(event) => set({ parts_used: event.target.value })} />
                        </label>
                        <div className="two">
                            <label>
                                Cost of the repair ({currency})
                                <input type="number" min={0} value={form.cost} onChange={(event) => set({ cost: event.target.value })} />
                            </label>
                            <label>
                                Minutes the machine stood still
                                <input type="number" min={0} value={form.downtime_minutes} placeholder={job.maintenance_type === 'breakdown' ? 'Counted for you when finished' : '0'} onChange={(event) => set({ downtime_minutes: event.target.value })} />
                            </label>
                        </div>
                    </>
                ) : (
                    <table className="fb-table">
                        <tbody>
                            <tr><td>Status</td><td><Pill value={job.status} labels={JOB_STATUS} /></td></tr>
                            <tr><td>Given to</td><td>{job.assignee?.name || '—'}</td></tr>
                            {job.cause && <tr><td>Cause</td><td>{job.cause}</td></tr>}
                            {job.resolution && <tr><td>What was done</td><td>{job.resolution}</td></tr>}
                            {job.parts_used && <tr><td>Spare parts</td><td>{job.parts_used}</td></tr>}
                            <tr><td>Cost</td><td>{money(job.cost, currency)}</td></tr>
                            <tr><td>Machine stood still</td><td>{duration(job.downtime_minutes)}</td></tr>
                        </tbody>
                    </table>
                )}
            </div>
        </Modal>
    );
}
