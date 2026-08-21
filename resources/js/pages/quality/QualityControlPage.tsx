import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

async function api(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
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

const emptyForm = {
    production_order_id: '', stage_execution_id: '', batch_id: '', item_id: '',
    inspection_type: 'in_process', sample_size: '', inspected_quantity: '',
    passed_quantity: '', rejected_quantity: '', result: 'passed',
    defect_details: '', corrective_action: '', notes: '',
};

export default function QualityControlPage({ can }: any) {
    const [data, setData] = useState<any>(null);
    const [form, setForm] = useState<any>(emptyForm);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = () => api('/api/quality/overview').then(setData).catch((e: any) => setError(e.message));
    useEffect(() => {
        load();
        const timer = window.setInterval(load, 5000);
        return () => clearInterval(timer);
    }, []);

    const orders = data?.orders || [];
    const items = data?.items || [];
    const inspections = data?.inspections?.data || [];
    const packedBatches = data?.packed_batches || [];
    const metrics = data?.metrics || {};
    const selectedOrder = orders.find((order: any) => String(order.id) === String(form.production_order_id));

    const startNewInspection = () => {
        setForm(emptyForm);
        setOpen(true);
    };

    const inspectBatch = (batch: any) => {
        setForm({
            ...emptyForm,
            batch_id: String(batch.id),
            item_id: String(batch.item_id),
            inspection_type: 'finished_goods',
            inspected_quantity: String(batch.available_qty),
            passed_quantity: String(batch.available_qty),
            rejected_quantity: '0',
        });
        setOpen(true);
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            await api('/api/quality/inspections', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    production_order_id: form.production_order_id || null,
                    stage_execution_id: form.stage_execution_id || null,
                    batch_id: form.batch_id || null,
                    item_id: form.item_id || selectedOrder?.item_id || null,
                    sample_size: Number(form.sample_size || 0),
                    inspected_quantity: Number(form.inspected_quantity),
                    passed_quantity: Number(form.passed_quantity || 0),
                    rejected_quantity: Number(form.rejected_quantity || 0),
                }),
            });
            setForm(emptyForm);
            setOpen(false);
            setSuccess('Quality inspection recorded.');
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const approve = async (id: number) => {
        setBusy(true);
        try {
            await api('/api/quality/inspections/' + id + '/approve', { method: 'POST' });
            setSuccess('Inspection approved.');
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="module-page">
            <div className="module-hero">
                <div className="module-title">
                    <span><ClipboardCheck /></span>
                    <div>
                        <div className="eyebrow"><i></i>LIVE QUALITY CONTROL</div>
                        <h1>Quality inspections</h1>
                        <p>Inspect materials, production stages and finished products with full traceability.</p>
                    </div>
                </div>
                <div className="workflow-actions">
                    <button className="secondary-btn" onClick={load}><RefreshCw size={16} />Refresh</button>
                    {can('quality.inspect') && (
                        <button className="primary-btn" onClick={() => (open ? setOpen(false) : startNewInspection())}>
                            <Plus size={16} />{open ? 'Close' : 'New inspection'}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <div className="quality-metrics">
                <MetricCard icon={<ClipboardCheck />} label="Pending" value={metrics.pending} />
                <MetricCard icon={<CheckCircle2 />} label="Passed this month" value={metrics.passed} />
                <MetricCard icon={<XCircle />} label="Failed this month" value={metrics.failed} />
                <MetricCard icon={<ShieldCheck />} label="Pass rate" value={(metrics.pass_rate || 0) + '%'} />
            </div>

            {can('quality.inspect') && <PackedBatchQueue batches={packedBatches} onInspect={inspectBatch} />}

            {open && (
                <InspectionForm
                    form={form}
                    setForm={setForm}
                    orders={orders}
                    items={items}
                    packedBatches={packedBatches}
                    selectedOrder={selectedOrder}
                    busy={busy}
                    onSave={save}
                    onClose={() => setOpen(false)}
                />
            )}

            <InspectionsTable inspections={inspections} busy={busy} can={can} onApprove={approve} />
        </section>
    );
}

function PackedBatchQueue({ batches, onInspect }: any) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr><th>Packed batch awaiting inspection</th><th>Quantity</th><th>Action</th></tr>
                </thead>
                <tbody>
                    {batches.length ? batches.map((batch: any) => (
                        <tr key={batch.id}>
                            <td><b>{batch.name}</b></td>
                            <td>{Number(batch.available_qty).toLocaleString()}</td>
                            <td><button className="table-action" onClick={() => onInspect(batch)}>Inspect</button></td>
                        </tr>
                    )) : (
                        <tr><td colSpan={3}>No packed batches are waiting on quality control.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function InspectionForm({ form, setForm, orders, items, packedBatches, selectedOrder, busy, onSave, onClose }: any) {
    const set = (field: string) => (event: any) => setForm({ ...form, [field]: event.target.value });
    const packedBatchName = form.batch_id
        ? packedBatches.find((batch: any) => String(batch.id) === String(form.batch_id))?.name || ('Batch #' + form.batch_id)
        : null;

    return (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <form className="panel admin-form quality-form" style={{ maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: '800px' }} onSubmit={onSave}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>Record quality inspection</h2>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XCircle size={24} /></button>
                </div>
                <div className="form-grid">
                    {packedBatchName && <label>Packed batch<input disabled value={packedBatchName} /></label>}
                    <label>Inspection type
                        <select value={form.inspection_type} onChange={set('inspection_type')}>
                            <option value="incoming_material">Incoming material</option>
                            <option value="in_process">Production stage</option>
                            <option value="finished_goods">Finished goods</option>
                            <option value="random">Random check</option>
                            <option value="customer_return">Customer return</option>
                        </select>
                    </label>
                    <label>Production order
                        <select value={form.production_order_id} onChange={event => setForm({ ...form, production_order_id: event.target.value, stage_execution_id: '', item_id: '' })}>
                            <option value="">Not linked to an order</option>
                            {orders.map((order: any) => <option key={order.id} value={order.id}>{order.order_number} — {order.item?.name}</option>)}
                        </select>
                    </label>
                    <label>Production stage
                        <select value={form.stage_execution_id} onChange={set('stage_execution_id')}>
                            <option value="">Not linked to a stage</option>
                            {(selectedOrder?.executions || []).map((execution: any) => (
                                <option key={execution.id} value={execution.id}>{execution.stage?.name} — {execution.status.replaceAll('_', ' ')}</option>
                            ))}
                        </select>
                    </label>
                    <label>Standalone item
                        <select value={form.item_id} onChange={set('item_id')}>
                            <option value="">Use order product / none</option>
                            {items.map((item: any) => <option key={item.id} value={item.id}>{item.name} — {item.sku}</option>)}
                        </select>
                    </label>
                    <label>Inspected quantity<input required type="number" min="0.01" step="0.01" value={form.inspected_quantity} onChange={set('inspected_quantity')} /></label>
                    <label>Sample size<input type="number" min="0" step="0.01" value={form.sample_size} onChange={set('sample_size')} /></label>
                    <label>Passed quantity<input required type="number" min="0" step="0.01" value={form.passed_quantity} onChange={set('passed_quantity')} /></label>
                    <label>Rejected quantity<input required type="number" min="0" step="0.01" value={form.rejected_quantity} onChange={set('rejected_quantity')} /></label>
                    <label>Result
                        <select value={form.result} onChange={set('result')}>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                            <option value="conditional">Conditional pass</option>
                            <option value="pending">Pending tests</option>
                        </select>
                    </label>
                    <label>Corrective action<textarea value={form.corrective_action} onChange={set('corrective_action')} /></label>
                    <label>Notes<textarea value={form.notes} onChange={set('notes')} /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" className="primary-btn" disabled={busy}>Save inspection</button>
                </div>
            </form>
        </div>
    );
}

function InspectionsTable({ inspections, busy, can, onApprove }: any) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr><th>Inspection</th><th>Order / item</th><th>Type</th><th>Quantities</th><th>Result</th><th>Inspector</th><th>Approval</th></tr>
                </thead>
                <tbody>
                    {inspections.length ? inspections.map((inspection: any) => (
                        <tr key={inspection.id}>
                            <td><b>{inspection.inspection_number}</b><br /><small>{inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleString() : 'Pending'}</small></td>
                            <td>{inspection.order?.order_number || inspection.batch?.batch_number || '—'}<br /><small>{inspection.item?.name || inspection.stage_execution?.stage?.name || 'General inspection'}</small></td>
                            <td>{inspection.inspection_type.replaceAll('_', ' ')}</td>
                            <td>{Number(inspection.passed_quantity)} passed<br /><small>{Number(inspection.rejected_quantity)} rejected</small></td>
                            <td><span className={'admin-status ' + inspection.result}>{inspection.result}</span></td>
                            <td>{inspection.inspector?.name}</td>
                            <td>
                                {inspection.approved_at ? (
                                    <span>Approved by {inspection.approver?.name}</span>
                                ) : inspection.result !== 'pending' && can('quality.approve') ? (
                                    <button className="table-action" disabled={busy} onClick={() => onApprove(inspection.id)}>Approve</button>
                                ) : (
                                    <span>Awaiting approval</span>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={7}>No inspections recorded yet.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function MetricCard({ icon, label, value }: any) {
    return (
        <article className="panel quality-kpi">
            <span>{icon}</span>
            <div><small>{label}</small><b>{typeof value === 'string' ? value : Number(value || 0).toLocaleString()}</b></div>
        </article>
    );
}
