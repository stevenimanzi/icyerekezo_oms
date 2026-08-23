import React, { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, HardHat, ListChecks, RefreshCw, ShieldAlert } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

async function api(url: string, options: RequestInit = {}) {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, ...(options.headers || {}) } });
    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Safety data could not be read. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || Object.values(data.errors || {}).flat()[0] as string || 'Safety data could not be loaded.');
    return data;
}
const date = (value: any) => (value ? new Date(value).toLocaleDateString() : 'Not set');
const label = (value: string) => String(value || '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

export default function SafetyOverviewPage() {
    const [data, setData] = useState<any>(null);
    const [tab, setTab] = useState<'incidents' | 'inspections' | 'ppe' | 'actions'>('incidents');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState<number | null>(null);

    const [incidentForm, setIncidentForm] = useState({ incident_date: new Date().toISOString().slice(0, 10), location: '', description: '', severity: 'minor', injured_person: '' });
    const [inspectionForm, setInspectionForm] = useState({ area: '', inspection_date: new Date().toISOString().slice(0, 10), result: 'pass', notes: '' });
    const [ppeForm, setPpeForm] = useState({ user_id: '', equipment_name: '', issued_at: new Date().toISOString().slice(0, 10), condition: 'new' });
    const [actionForm, setActionForm] = useState({ source_type: 'general', description: '', assigned_to: '', due_date: '' });

    const load = () => {
        setLoading(true);
        api('/api/safety/overview').then((result) => { setData(result); setError(''); }).catch((reason: any) => setError(reason.message)).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const employees = data?.employees || [];
    const stats = data?.stats || {};

    const reportIncident = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/safety/incidents', { method: 'POST', body: JSON.stringify(incidentForm) });
            setSuccess('Incident reported.');
            setIncidentForm({ ...incidentForm, location: '', description: '', injured_person: '' });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const updateIncidentStatus = async (id: number, status: string) => {
        setBusy(id); setError(''); setSuccess('');
        try {
            await api(`/api/safety/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            load();
        } catch (reason: any) { setError(reason.message); } finally { setBusy(null); }
    };

    const submitInspection = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/safety/inspections', { method: 'POST', body: JSON.stringify(inspectionForm) });
            setSuccess('Inspection recorded.');
            setInspectionForm({ ...inspectionForm, area: '', notes: '' });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const issuePpe = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/safety/ppe', { method: 'POST', body: JSON.stringify(ppeForm) });
            setSuccess('Equipment issued.');
            setPpeForm({ ...ppeForm, user_id: '', equipment_name: '' });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const returnPpe = async (id: number) => {
        setBusy(id); setError(''); setSuccess('');
        try {
            await api(`/api/safety/ppe/${id}/return`, { method: 'POST' });
            load();
        } catch (reason: any) { setError(reason.message); } finally { setBusy(null); }
    };

    const createAction = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(''); setSuccess('');
        try {
            await api('/api/safety/corrective-actions', { method: 'POST', body: JSON.stringify(actionForm) });
            setSuccess('Corrective action created.');
            setActionForm({ source_type: 'general', description: '', assigned_to: '', due_date: '' });
            load();
        } catch (reason: any) { setError(reason.message); }
    };

    const updateActionStatus = async (id: number, status: string) => {
        setBusy(id); setError(''); setSuccess('');
        try {
            await api(`/api/safety/corrective-actions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            load();
        } catch (reason: any) { setError(reason.message); } finally { setBusy(null); }
    };

    return (
        <section className="module-page">
            <div className="page-heading">
                <div>
                    <h1>Health and safety</h1>
                    <p>Record incidents, inspections, protective equipment and corrective actions.</p>
                </div>
                <button className="secondary-btn" disabled={loading} onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <section className="department-metrics cols-4">
                <article className="department-metric panel"><span className="metric-icon red"><ShieldAlert /></span><div><small>Open incidents</small><strong>{stats.open_incidents || 0}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon amber"><AlertTriangle /></span><div><small>Incidents this month</small><strong>{stats.incidents_this_month || 0}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon violet"><ClipboardCheck /></span><div><small>Failed inspections (month)</small><strong>{stats.failed_inspections || 0}</strong></div></article>
                <article className="department-metric panel"><span className="metric-icon blue"><ListChecks /></span><div><small>Open corrective actions</small><strong>{stats.open_actions || 0}</strong></div></article>
            </section>

            <article className="panel chart-panel">
                <header className="department-panel-head"><div><h2>Incident trend (7 days)</h2><p>New incidents reported versus resolved each day.</p></div></header>
                <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data?.incident_trend || []} margin={{ top: 12, right: 18, left: -18, bottom: 2 }}>
                            <CartesianGrid vertical={false} stroke="var(--line)" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} />
                            <Line type="monotone" dataKey="incidents" name="Reported" stroke="#ef4444" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </article>

            <div className="module-tabs" role="tablist">
                <button className={tab === 'incidents' ? 'active' : ''} onClick={() => setTab('incidents')}><ShieldAlert size={15} />Incidents</button>
                <button className={tab === 'inspections' ? 'active' : ''} onClick={() => setTab('inspections')}><ClipboardCheck size={15} />Inspections</button>
                <button className={tab === 'ppe' ? 'active' : ''} onClick={() => setTab('ppe')}><HardHat size={15} />Protective equipment</button>
                <button className={tab === 'actions' ? 'active' : ''} onClick={() => setTab('actions')}><ListChecks size={15} />Corrective actions</button>
            </div>

            {tab === 'incidents' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Workplace incidents</h2><p>Report an incident, then track it through investigation to resolution.</p></div></header>
                    <form className="admin-form" onSubmit={reportIncident}>
                        <div className="form-grid">
                            <label>Date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={incidentForm.incident_date} onChange={(e) => setIncidentForm({ ...incidentForm, incident_date: e.target.value })} /></label>
                            <label>Location<input value={incidentForm.location} onChange={(e) => setIncidentForm({ ...incidentForm, location: e.target.value })} placeholder="e.g. Cutting floor" /></label>
                            <label>Severity<select value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="critical">Critical</option></select></label>
                            <label>Injured person<input value={incidentForm.injured_person} onChange={(e) => setIncidentForm({ ...incidentForm, injured_person: e.target.value })} placeholder="Optional" /></label>
                            <label style={{ gridColumn: '1 / -1' }}>Description<input required value={incidentForm.description} onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })} placeholder="What happened" /></label>
                        </div>
                        <footer><button className="primary-btn">Report incident</button></footer>
                    </form>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Date</th><th>Location</th><th>Severity</th><th>Description</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {(data?.incidents || []).length ? data.incidents.map((item: any) => (
                                    <tr key={item.id}>
                                        <td>{date(item.incident_date)}</td><td>{item.location || '—'}</td>
                                        <td><span className={`admin-status ${['severe', 'critical'].includes(item.severity) ? 'critical' : item.severity === 'moderate' ? 'warning' : ''}`}>{item.severity}</span></td>
                                        <td>{item.description}</td>
                                        <td><span className={`admin-status ${item.status === 'resolved' ? 'accepted' : 'pending'}`}>{label(item.status)}</span></td>
                                        <td>{item.status !== 'resolved' && (
                                            <select disabled={busy === item.id} value={item.status} onChange={(e) => updateIncidentStatus(item.id, e.target.value)}>
                                                <option value="reported">Reported</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option>
                                            </select>
                                        )}</td>
                                    </tr>
                                )) : <tr><td className="empty-cell" colSpan={6}>No incidents reported.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {tab === 'inspections' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Safety inspections</h2><p>Record a walk-through inspection result for any area.</p></div></header>
                    <form className="admin-form" onSubmit={submitInspection}>
                        <div className="form-grid">
                            <label>Area<input required value={inspectionForm.area} onChange={(e) => setInspectionForm({ ...inspectionForm, area: e.target.value })} placeholder="e.g. Warehouse racking" /></label>
                            <label>Date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={inspectionForm.inspection_date} onChange={(e) => setInspectionForm({ ...inspectionForm, inspection_date: e.target.value })} /></label>
                            <label>Result<select value={inspectionForm.result} onChange={(e) => setInspectionForm({ ...inspectionForm, result: e.target.value })}><option value="pass">Pass</option><option value="needs_attention">Needs attention</option><option value="fail">Fail</option></select></label>
                            <label style={{ gridColumn: '1 / -1' }}>Notes<input value={inspectionForm.notes} onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })} placeholder="Optional" /></label>
                        </div>
                        <footer><button className="primary-btn">Record inspection</button></footer>
                    </form>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Area</th><th>Date</th><th>Result</th><th>Inspector</th><th>Notes</th></tr></thead>
                            <tbody>
                                {(data?.inspections || []).length ? data.inspections.map((item: any) => (
                                    <tr key={item.id}><td>{item.area}</td><td>{date(item.inspection_date)}</td><td><span className={`admin-status ${item.result === 'pass' ? 'accepted' : item.result === 'fail' ? 'rejected' : 'warning'}`}>{label(item.result)}</span></td><td>{item.inspector?.name || '—'}</td><td>{item.notes || '—'}</td></tr>
                                )) : <tr><td className="empty-cell" colSpan={5}>No inspections recorded.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {tab === 'ppe' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Protective equipment</h2><p>Track what has been issued to each employee and when it's returned.</p></div></header>
                    <form className="admin-form" onSubmit={issuePpe}>
                        <div className="form-grid">
                            <label>Employee<select required value={ppeForm.user_id} onChange={(e) => setPpeForm({ ...ppeForm, user_id: e.target.value })}><option value="">Choose employee</option>{employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></label>
                            <label>Equipment<input required value={ppeForm.equipment_name} onChange={(e) => setPpeForm({ ...ppeForm, equipment_name: e.target.value })} placeholder="e.g. Safety goggles" /></label>
                            <label>Issued<input required type="date" max={new Date().toISOString().slice(0, 10)} value={ppeForm.issued_at} onChange={(e) => setPpeForm({ ...ppeForm, issued_at: e.target.value })} /></label>
                            <label>Condition<select value={ppeForm.condition} onChange={(e) => setPpeForm({ ...ppeForm, condition: e.target.value })}><option value="new">New</option><option value="good">Good</option><option value="worn">Worn</option><option value="damaged">Damaged</option></select></label>
                        </div>
                        <footer><button className="primary-btn">Issue equipment</button></footer>
                    </form>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Employee</th><th>Equipment</th><th>Issued</th><th>Condition</th><th>Returned</th><th>Action</th></tr></thead>
                            <tbody>
                                {(data?.ppe_assignments || []).length ? data.ppe_assignments.map((item: any) => (
                                    <tr key={item.id}>
                                        <td>{item.user?.name}</td><td>{item.equipment_name}</td><td>{date(item.issued_at)}</td><td>{item.condition}</td><td>{item.returned_at ? date(item.returned_at) : '—'}</td>
                                        <td>{!item.returned_at && <button className="table-action" disabled={busy === item.id} onClick={() => returnPpe(item.id)}>Mark returned</button>}</td>
                                    </tr>
                                )) : <tr><td className="empty-cell" colSpan={6}>No equipment issued yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {tab === 'actions' && (
                <article className="panel">
                    <header className="department-panel-head"><div><h2>Corrective actions</h2><p>Track follow-up work from incidents, inspections, or general safety concerns.</p></div></header>
                    <form className="admin-form" onSubmit={createAction}>
                        <div className="form-grid">
                            <label>Source<select value={actionForm.source_type} onChange={(e) => setActionForm({ ...actionForm, source_type: e.target.value })}><option value="general">General</option><option value="incident">Incident</option><option value="inspection">Inspection</option></select></label>
                            <label>Assigned to<select value={actionForm.assigned_to} onChange={(e) => setActionForm({ ...actionForm, assigned_to: e.target.value })}><option value="">Unassigned</option>{employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></label>
                            <label>Due date<input type="date" value={actionForm.due_date} onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })} /></label>
                            <label style={{ gridColumn: '1 / -1' }}>Description<input required value={actionForm.description} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })} placeholder="What needs to be fixed" /></label>
                        </div>
                        <footer><button className="primary-btn">Create action</button></footer>
                    </form>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead><tr><th>Description</th><th>Source</th><th>Assigned to</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {(data?.corrective_actions || []).length ? data.corrective_actions.map((item: any) => (
                                    <tr key={item.id}>
                                        <td>{item.description}</td><td>{item.source_type}</td><td>{item.assignee?.name || '—'}</td><td>{item.due_date ? date(item.due_date) : '—'}</td>
                                        <td><span className={`admin-status ${item.status === 'completed' ? 'accepted' : item.status === 'in_progress' ? 'warning' : 'pending'}`}>{label(item.status)}</span></td>
                                        <td>{item.status !== 'completed' && (
                                            <select disabled={busy === item.id} value={item.status} onChange={(e) => updateActionStatus(item.id, e.target.value)}>
                                                <option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
                                            </select>
                                        )}</td>
                                    </tr>
                                )) : <tr><td className="empty-cell" colSpan={6}>No corrective actions yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}
        </section>
    );
}
