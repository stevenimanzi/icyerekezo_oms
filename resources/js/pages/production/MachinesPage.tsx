import React, { useEffect, useState } from 'react';
import { Activity, Factory, Plus, RefreshCw, Wrench } from 'lucide-react';

async function api(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    let payload: any;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new Error('Invalid server response.');
    }
    if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat().join(' ') || 'Request failed.');
    return payload;
}

const machineBlank = { name: '', code: '', type: '', department_id: '', serial_number: '', manufacturer: '', model: '', location: '', installed_at: '', next_maintenance_at: '' };
const requestBlank = { machine_id: '', maintenance_type: 'preventive', title: '', description: '', priority: 'normal', assigned_to: '', scheduled_at: '' };

export default function MachinesPage({ can }: any) {
    const [data, setData] = useState<any>(null);
    const [machine, setMachine] = useState<any>(machineBlank);
    const [request, setRequest] = useState<any>(requestBlank);
    const [showMachine, setShowMachine] = useState(false);
    const [showRequest, setShowRequest] = useState(false);
    const [edits, setEdits] = useState<Record<number, any>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = () => api('/api/machines/overview').then(setData).catch((e: any) => setError(e.message));
    useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, []);

    const createMachine = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api('/api/machines', {
                method: 'POST',
                body: JSON.stringify({ ...machine, department_id: machine.department_id || null, next_maintenance_at: machine.next_maintenance_at || null, installed_at: machine.installed_at || null }),
            });
            setMachine(machineBlank);
            setShowMachine(false);
            setSuccess('Machine registered.');
            await load();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };

    const createRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api('/api/maintenance', { method: 'POST', body: JSON.stringify({ ...request, assigned_to: request.assigned_to || null, scheduled_at: request.scheduled_at || null }) });
            setRequest(requestBlank);
            setShowRequest(false);
            setSuccess('Maintenance request created.');
            await load();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };

    const update = async (x: any) => {
        const e = edits[x.id] || {};
        setBusy(true);
        try {
            await api('/api/maintenance/' + x.id, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: e.status || x.status,
                    assigned_to: e.assigned_to ?? x.assigned_to ?? null,
                    resolution: e.resolution ?? x.resolution ?? '',
                    cost: Number(e.cost ?? x.cost ?? 0),
                    downtime_minutes: Number(e.downtime_minutes ?? x.downtime_minutes ?? 0),
                    scheduled_at: e.scheduled_at ?? x.scheduled_at ?? null,
                }),
            });
            setSuccess('Maintenance record updated.');
            await load();
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
    };

    const metrics = data?.metrics || {};
    const records = data?.maintenance?.data || [];
    const machineFields: [string, string][] = [['name', 'Machine name'], ['code', 'Machine code'], ['type', 'Machine type'], ['serial_number', 'Serial number'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['location', 'Location']];

    return (
        <section className="module-page">
            <div className="module-hero">
                <div className="module-title">
                    <span><Wrench /></span>
                    <div><div className="eyebrow"><i></i>LIVE EQUIPMENT CONTROL</div><h1>Machines and maintenance</h1><p>Track equipment availability, breakdowns, preventive maintenance, costs and downtime.</p></div>
                </div>
                <div className="workflow-actions">
                    <button className="secondary-btn" onClick={load}><RefreshCw size={16} />Refresh</button>
                    {can('maintenance.create') && <button className="secondary-btn" onClick={() => setShowRequest(!showRequest)}><Plus size={16} />Maintenance request</button>}
                    {can('factory.manage') && <button className="primary-btn" onClick={() => setShowMachine(!showMachine)}><Plus size={16} />Register machine</button>}
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <div className="quality-metrics">
                <K label="Total machines" value={metrics.total} />
                <K label="Operational" value={metrics.operational} />
                <K label="Under maintenance" value={metrics.maintenance} />
                <K label="Down / broken" value={metrics.down} />
                <K label="Maintenance due" value={metrics.due_maintenance} />
            </div>

            {showMachine && (
                <form className="panel admin-form quality-form" onSubmit={createMachine}>
                    <h2>Register machine</h2>
                    <div className="form-grid">
                        {machineFields.map(([key, label]) => (
                            <label key={key}>{label}<input required={['name', 'code', 'type'].includes(key)} value={machine[key]} onChange={e => setMachine({ ...machine, [key]: e.target.value })} /></label>
                        ))}
                        <label>
                            Department
                            <select value={machine.department_id} onChange={e => setMachine({ ...machine, department_id: e.target.value })}>
                                <option value="">Not assigned</option>
                                {(data?.departments || []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                        </label>
                        <label>Installed date<input type="date" value={machine.installed_at} onChange={e => setMachine({ ...machine, installed_at: e.target.value })} /></label>
                        <label>Next maintenance<input type="datetime-local" value={machine.next_maintenance_at} onChange={e => setMachine({ ...machine, next_maintenance_at: e.target.value })} /></label>
                    </div>
                    <button className="primary-btn" disabled={busy}>Register machine</button>
                </form>
            )}

            {showRequest && (
                <form className="panel admin-form quality-form" onSubmit={createRequest}>
                    <h2>Create maintenance request</h2>
                    <div className="form-grid">
                        <label>
                            Machine
                            <select required value={request.machine_id} onChange={e => setRequest({ ...request, machine_id: e.target.value })}>
                                <option value="">Choose machine</option>
                                {(data?.machines || []).map((x: any) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
                            </select>
                        </label>
                        <label>
                            Type
                            <select value={request.maintenance_type} onChange={e => setRequest({ ...request, maintenance_type: e.target.value })}>
                                <option value="preventive">Preventive</option>
                                <option value="corrective">Corrective</option>
                                <option value="inspection">Inspection</option>
                                <option value="breakdown">Breakdown</option>
                            </select>
                        </label>
                        <label>Title<input required value={request.title} onChange={e => setRequest({ ...request, title: e.target.value })} /></label>
                        <label>
                            Priority
                            <select value={request.priority} onChange={e => setRequest({ ...request, priority: e.target.value })}>
                                <option>low</option><option>normal</option><option>high</option><option>urgent</option>
                            </select>
                        </label>
                        <label>
                            Assign technician
                            <select value={request.assigned_to} onChange={e => setRequest({ ...request, assigned_to: e.target.value })}>
                                <option value="">Unassigned</option>
                                {(data?.users || []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                        </label>
                        <label>Schedule<input type="datetime-local" value={request.scheduled_at} onChange={e => setRequest({ ...request, scheduled_at: e.target.value })} /></label>
                        <label>Description<textarea value={request.description} onChange={e => setRequest({ ...request, description: e.target.value })} /></label>
                    </div>
                    <button className="primary-btn" disabled={busy}>Create request</button>
                </form>
            )}

            <div className="machine-cards">
                {(data?.machines || []).map((x: any) => (
                    <article className="panel" key={x.id}>
                        <header>
                            <span><Factory size={20} /></span>
                            <div><b>{x.name}</b><small>{x.code} · {x.type}</small></div>
                            <em className={'admin-status ' + x.status}>{x.status}</em>
                        </header>
                        <dl>
                            <div><dt>Department</dt><dd>{x.department?.name || 'Not assigned'}</dd></div>
                            <div><dt>Location</dt><dd>{x.location || 'Not set'}</dd></div>
                            <div><dt>Runtime</dt><dd>{Number(x.runtime_hours)} hours</dd></div>
                            <div><dt>Next service</dt><dd>{x.next_maintenance_at ? new Date(x.next_maintenance_at).toLocaleString() : 'Not scheduled'}</dd></div>
                        </dl>
                    </article>
                ))}
            </div>

            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead><tr><th>Maintenance</th><th>Machine</th><th>Status</th><th>Assigned</th><th>Downtime</th><th>Resolution / cost</th><th>Action</th></tr></thead>
                    <tbody>
                        {records.length ? records.map((x: any) => {
                            const e = edits[x.id] || {};
                            return (
                                <tr key={x.id}>
                                    <td><b>{x.title}</b><br /><small>{x.maintenance_type} · {x.priority}</small></td>
                                    <td>{x.machine?.name}</td>
                                    <td>
                                        <select disabled={!can('maintenance.execute')} value={e.status || x.status} onChange={v => setEdits({ ...edits, [x.id]: { ...e, status: v.target.value } })}>
                                            <option value="open">Open</option>
                                            <option value="scheduled">Scheduled</option>
                                            <option value="in_progress">In progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </td>
                                    <td>{x.assignee?.name || 'Unassigned'}</td>
                                    <td><input className="stage-number-input" disabled={!can('maintenance.execute')} type="number" min="0" value={e.downtime_minutes ?? x.downtime_minutes ?? 0} onChange={v => setEdits({ ...edits, [x.id]: { ...e, downtime_minutes: v.target.value } })} /></td>
                                    <td><input disabled={!can('maintenance.execute')} placeholder="Resolution required to complete" value={e.resolution ?? x.resolution ?? ''} onChange={v => setEdits({ ...edits, [x.id]: { ...e, resolution: v.target.value } })} /></td>
                                    <td>{can('maintenance.execute') ? <button className="table-action" disabled={busy} onClick={() => update(x)}>Save</button> : <span>View only</span>}</td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan={7}>No maintenance records yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function K({ label, value }: any) {
    return <article className="panel quality-kpi"><span><Activity /></span><div><small>{label}</small><b>{Number(value || 0).toLocaleString()}</b></div></article>;
}
