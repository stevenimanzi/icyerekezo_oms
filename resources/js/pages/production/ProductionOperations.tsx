import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, PackageCheck, Play, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

async function api(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('The server returned an unreadable response. Please try again.');
    }
    if (!response.ok) {
        const details = Object.values(data.errors || {}).flat().join(' ');
        throw new Error(details || data.message || 'The action could not be completed.');
    }
    return data;
}

const blank = () => ({
    order_number: 'PO-' + new Date().toISOString().slice(2, 10).replaceAll('-', '') + '-' + String(Date.now()).slice(-4),
    bill_of_material_id: '', workflow_template_id: '', warehouse_id: '', planned_quantity: '',
    planned_start: new Date().toISOString().slice(0, 10), planned_end: '',
});
const blankComponent = () => ({ item_id: '', quantity: '', waste_percent: '0', is_optional: false });
const blankBom = () => ({
    item_id: '', name: '', version: '1.0', output_quantity: '', expected_waste_percent: '0',
    components: [blankComponent()],
});
const statusLabel: Record<string, string> = {
    draft: 'Needs approval', approved: 'Ready to produce', in_progress: 'In production', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled',
    not_started: 'Waiting for previous step', ready: 'Ready to start', blocked: 'Blocked', failed: 'Failed', rework: 'Needs rework',
};
const number = (value: any) => Number(value || 0).toLocaleString();

export default function ProductionOperations({ can }: any) {
    const [data, setData] = useState<any>(null);
    const [catalog, setCatalog] = useState<any>(null);
    const [form, setForm] = useState<any>(blank());
    const [bomForm, setBomForm] = useState<any>(blankBom());
    const [open, setOpen] = useState(false);
    const [bomOpen, setBomOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [stageEdits, setStageEdits] = useState<Record<number, any>>({});
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    const canPlan = can('production.plan');
    const canApprove = can('production.approve');
    const canExecute = can('production.execute');
    const readOnly = !canPlan && !canApprove && !canExecute;

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [overview, products] = await Promise.all([
                api('/api/manufacturing/overview'),
                canPlan ? api('/api/products/overview') : Promise.resolve(null),
            ]);
            setData(overview);
            if (products) setCatalog(products);
            setUpdatedAt(new Date());
            setError('');
        } catch (reason: any) {
            if (!silent) setError(reason.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };
    useEffect(() => { load(); const timer = window.setInterval(() => load(true), 15000); return () => window.clearInterval(timer); }, []);

    const orders = data?.orders?.data || [];
    const summary = data?.summary || {};
    const recipes = data?.boms || [];
    const processes = (data?.workflows || []).filter((item: any) => item.status === 'active');
    const warehouses = data?.warehouses || [];
    const items = catalog?.items || [];
    const stages = orders.flatMap((order: any) => (order.executions || []).map((stage: any) => ({ ...stage, order_number: order.order_number, product: order.item?.name || 'Product' })));

    const editBomField = (field: string, value: any) => setBomForm((current: any) => ({ ...current, [field]: value }));
    const editComponent = (index: number, field: string, value: any) => setBomForm((current: any) => ({
        ...current,
        components: current.components.map((component: any, position: number) => (position === index ? { ...component, [field]: value } : component)),
    }));
    const addComponent = () => setBomForm((current: any) => ({ ...current, components: [...current.components, blankComponent()] }));
    const removeComponent = (index: number) => setBomForm((current: any) => ({ ...current, components: current.components.filter((_: any, position: number) => position !== index) }));

    const createBom = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const components = bomForm.components.map((component: any) => {
                const material = items.find((item: any) => String(item.id) === String(component.item_id));
                if (!material) throw new Error('Choose a material for every ingredient row.');
                return {
                    item_id: Number(component.item_id), unit_id: material.unit_id,
                    quantity: Number(component.quantity), waste_percent: Number(component.waste_percent || 0),
                    is_optional: Boolean(component.is_optional),
                };
            });
            await api('/api/manufacturing/boms', {
                method: 'POST',
                body: JSON.stringify({
                    item_id: Number(bomForm.item_id), name: bomForm.name, version: bomForm.version,
                    output_quantity: Number(bomForm.output_quantity), expected_waste_percent: Number(bomForm.expected_waste_percent || 0),
                    components,
                }),
            });
            setBomForm(blankBom());
            setBomOpen(false);
            setSuccess('Product recipe created successfully.');
            await load();
        } catch (reason: any) {
            setError(reason.message);
        } finally { setBusy(false); }
    };

    const create = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const recipe = recipes.find((item: any) => String(item.id) === String(form.bill_of_material_id));
            if (!recipe) throw new Error('Choose a product recipe.');
            await api('/api/manufacturing/orders', { method: 'POST', body: JSON.stringify({ ...form, item_id: recipe.item_id, planned_quantity: Number(form.planned_quantity), planned_end: form.planned_end || null }) });
            setForm(blank());
            setOpen(false);
            setSuccess('Production order created successfully.');
            await load();
        } catch (reason: any) {
            setError(reason.message);
        } finally { setBusy(false); }
    };

    const approve = async (id: number) => {
        setBusy(true);
        setError('');
        try {
            await api('/api/manufacturing/orders/' + id + '/approve', { method: 'POST' });
            setSuccess('Order approved. The first production step is ready.');
            await load();
        } catch (reason: any) {
            setError(reason.message);
        } finally { setBusy(false); }
    };

    const editStage = (id: number, field: string, value: any) => setStageEdits(current => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));

    const saveStage = async (stage: any, nextStatus: string) => {
        const values = stageEdits[stage.id] || {};
        setBusy(true);
        setError('');
        try {
            await api('/api/manufacturing/stages/' + stage.id, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: nextStatus,
                    input_quantity: Number(values.input_quantity ?? stage.input_quantity ?? 0),
                    output_quantity: Number(values.output_quantity ?? stage.output_quantity ?? 0),
                    rejected_quantity: Number(values.rejected_quantity ?? stage.rejected_quantity ?? 0),
                    waste_quantity: Number(values.waste_quantity ?? stage.waste_quantity ?? 0),
                    downtime_minutes: Number(values.downtime_minutes ?? stage.downtime_minutes ?? 0),
                }),
            });
            setSuccess(nextStatus === 'completed' ? 'Production step completed.' : 'Production step updated.');
            await load();
        } catch (reason: any) {
            setError(reason.message);
        } finally { setBusy(false); }
    };

    return (
        <section className="module-page production-operations">
            <div className="module-hero production-hero">
                <div className="module-title">
                    <div>
                        <div className="eyebrow"><i></i>{readOnly ? 'LIVE FACTORY DATA' : 'LIVE PRODUCTION'}</div>
                        <h1>{readOnly ? 'Production performance' : 'Production orders'}</h1>
                        <p>{readOnly ? 'Monitor orders, output, losses and progress using records entered by your factory team.' : 'Create production work, check progress and record results for each step.'}</p>
                        {updatedAt && <small className="production-updated">Last updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}
                    </div>
                </div>
                <div className="workflow-actions">
                    <button className="secondary-btn" disabled={loading} onClick={() => load()}><RefreshCw className={loading ? 'spin' : ''} size={16} />{loading ? 'Refreshing…' : 'Refresh data'}</button>
                    {canPlan && <button className="secondary-btn" disabled={!items.length} onClick={() => setBomOpen(!bomOpen)}><Plus size={16} />{bomOpen ? 'Close recipe form' : 'Create product recipe'}</button>}
                    {canPlan && <button className="primary-btn" disabled={!recipes.length || !processes.length || !warehouses.length} onClick={() => setOpen(!open)}><Plus size={16} />{open ? 'Close form' : 'Create production order'}</button>}
                </div>
            </div>

            {error && <div className="admin-alert error"><AlertTriangle size={18} /><span>{error}</span></div>}
            {success && <div className="admin-alert success"><CheckCircle2 size={18} /><span>{success}</span></div>}

            {(!recipes.length || !processes.length || !warehouses.length) && !loading && !readOnly && (
                <div className="production-setup-warning">
                    <AlertTriangle />
                    <div><b>Production setup is not complete</b><p>{!recipes.length ? 'Create a product recipe before adding an order. ' : ''}{!processes.length ? 'The Factory Manager must activate a production process. ' : ''}{!warehouses.length ? 'No warehouse is available to receive finished output.' : ''}</p></div>
                </div>
            )}

            {bomOpen && canPlan && (
                <form className="panel admin-form production-order-form" onSubmit={createBom}>
                    <header><div><h2>Create a product recipe</h2><p>Define the finished product, its raw materials and how much of each is needed.</p></div></header>
                    <div className="form-grid">
                        <label>
                            Finished product
                            <select required value={bomForm.item_id} onChange={event => editBomField('item_id', event.target.value)}>
                                <option value="">Choose the item this recipe produces</option>
                                {items.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                            </select>
                        </label>
                        <label>Recipe name<input required value={bomForm.name} onChange={event => editBomField('name', event.target.value)} placeholder="Example: Standard maize flour" /></label>
                        <label>Version<input required value={bomForm.version} onChange={event => editBomField('version', event.target.value)} /></label>
                        <label>Output quantity per batch<input required type="number" min="0.01" step="0.01" value={bomForm.output_quantity} onChange={event => editBomField('output_quantity', event.target.value)} placeholder="Example: 10" /></label>
                        <label>Expected waste (%)<input type="number" min="0" max="100" step="0.1" value={bomForm.expected_waste_percent} onChange={event => editBomField('expected_waste_percent', event.target.value)} /></label>
                    </div>
                    <div className="bom-components">
                        <p><b>Raw materials needed per batch</b></p>
                        {bomForm.components.map((component: any, index: number) => (
                            <div className="form-grid bom-component-row" key={index}>
                                <label>
                                    Material
                                    <select required value={component.item_id} onChange={event => editComponent(index, 'item_id', event.target.value)}>
                                        <option value="">Choose a material</option>
                                        {items.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                                    </select>
                                </label>
                                <label>Quantity needed<input required type="number" min="0.000001" step="any" value={component.quantity} onChange={event => editComponent(index, 'quantity', event.target.value)} /></label>
                                <label>Waste (%)<input type="number" min="0" max="100" step="0.1" value={component.waste_percent} onChange={event => editComponent(index, 'waste_percent', event.target.value)} /></label>
                                <label className="check-row"><input type="checkbox" checked={component.is_optional} onChange={event => editComponent(index, 'is_optional', event.target.checked)} /><span>Optional</span></label>
                                {bomForm.components.length > 1 && <button type="button" className="icon-btn" onClick={() => removeComponent(index)} aria-label="Remove material"><Trash2 size={16} /></button>}
                            </div>
                        ))}
                        <button type="button" className="secondary-btn" onClick={addComponent}><Plus size={15} />Add another material</button>
                    </div>
                    <button className="primary-btn" disabled={busy}><Save size={16} />{busy ? 'Creating…' : 'Create recipe'}</button>
                </form>
            )}

            <section className="production-summary">
                {readOnly ? (
                    <>
                        <Summary label="Active orders" value={summary.active_orders} />
                        <Summary label="Planned quantity" value={summary.planned_quantity} />
                        <Summary label="Completed output" value={summary.completed_quantity} />
                        <Summary label="Rejected or wasted" value={Number(summary.rejected_quantity || 0) + Number(summary.waste_quantity || 0)} danger={Number(summary.rejected_quantity || 0) + Number(summary.waste_quantity || 0) > 0} />
                    </>
                ) : (
                    <>
                        <Summary label="Needs approval" value={summary.needs_approval} />
                        <Summary label="Active orders" value={summary.active_orders} />
                        <Summary label="Completed orders" value={summary.completed_orders} />
                        <Summary label="Past due" value={summary.past_due} danger={summary.past_due > 0} />
                    </>
                )}
            </section>

            {open && canPlan && (
                <form className="panel admin-form production-order-form" onSubmit={create}>
                    <header><div><h2>Create a production order</h2><p>Choose the product, quantity, process and finish date.</p></div></header>
                    <div className="form-grid">
                        <label>Order number<input required value={form.order_number} onChange={event => setForm({ ...form, order_number: event.target.value })} /></label>
                        <label>
                            Product recipe
                            <select required value={form.bill_of_material_id} onChange={event => setForm({ ...form, bill_of_material_id: event.target.value })}>
                                <option value="">Choose what to produce</option>
                                {recipes.map((item: any) => <option key={item.id} value={item.id}>{item.item?.name || item.name} — Recipe {item.version}</option>)}
                            </select>
                        </label>
                        <label>
                            Production process
                            <select required value={form.workflow_template_id} onChange={event => setForm({ ...form, workflow_template_id: event.target.value })}>
                                <option value="">Choose the production steps</option>
                                {processes.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </label>
                        <label>
                            Warehouse
                            <select required value={form.warehouse_id} onChange={event => setForm({ ...form, warehouse_id: event.target.value })}>
                                <option value="">Choose where materials come from and output goes to</option>
                                {warehouses.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </label>
                        <label>Quantity to produce<input required type="number" min="0.01" step="0.01" value={form.planned_quantity} onChange={event => setForm({ ...form, planned_quantity: event.target.value })} /></label>
                        <label>Start date<input type="date" value={form.planned_start} onChange={event => setForm({ ...form, planned_start: event.target.value })} /></label>
                        <label>Finish date<input type="date" min={form.planned_start} value={form.planned_end} onChange={event => setForm({ ...form, planned_end: event.target.value })} /></label>
                    </div>
                    <button className="primary-btn" disabled={busy}><Save size={16} />{busy ? 'Creating…' : 'Create order'}</button>
                </form>
            )}

            <section className="panel production-section">
                <header className="production-section-head">
                    <div>
                        <h2>{readOnly ? 'Production order progress' : 'Production orders'}</h2>
                        <p>{readOnly ? 'Current quantities, progress and deadlines recorded by the production team.' : 'Approve new orders and check how much work is complete.'}</p>
                    </div>
                </header>
                <div className="admin-table-wrap borderless">
                    <table className="admin-table production-orders-table">
                        <thead><tr><th>Order</th><th>Product</th>{readOnly && <th>Planned</th>}<th>Progress</th><th>Status</th><th>Steps</th><th>Finish date</th>{!readOnly && <th>Action</th>}</tr></thead>
                        <tbody>
                            {orders.length ? orders.map((item: any) => {
                                const progress = Number(item.planned_quantity) > 0 ? Math.min(100, Math.round(Number(item.completed_quantity || 0) / Number(item.planned_quantity) * 100)) : 0;
                                return (
                                    <tr key={item.id}>
                                        <td><b>{item.order_number}</b></td>
                                        <td>{item.item?.name || 'Product'}</td>
                                        {readOnly && <td>{number(item.planned_quantity)}</td>}
                                        <td><div className="simple-progress"><span style={{ width: progress + '%' }}></span></div><small>{number(item.completed_quantity)} of {number(item.planned_quantity)} ({progress}%)</small></td>
                                        <td><span className={'admin-status ' + item.status}>{statusLabel[item.status] || item.status}</span></td>
                                        <td>{item.executions?.filter((step: any) => step.status === 'completed').length || 0} of {item.executions?.length || 0}</td>
                                        <td>{item.planned_end ? new Date(item.planned_end + 'T12:00:00').toLocaleDateString() : 'Not set'}</td>
                                        {!readOnly && (
                                            <td>
                                                {item.status === 'draft' && canApprove ? (
                                                    <button className="table-action" disabled={busy} onClick={() => approve(item.id)}><CheckCircle2 size={15} />Approve order</button>
                                                ) : (
                                                    <span className="muted-action">{item.status === 'completed' ? 'Finished' : 'No action needed'}</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={8}><Empty title="No production records yet" text={readOnly ? 'Production orders will appear when the production team records them.' : 'Create the first production order to begin tracking work.'} /></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {readOnly ? <OwnerStageResults stages={stages} /> : (
                <section className="panel production-section">
                    <header className="production-section-head"><div><h2>Production steps</h2><p>Start ready work, record quantities and complete steps in order.</p></div></header>
                    {stages.length ? (
                        <div className="production-step-list">
                            {stages.map((stage: any) => <EditableStage key={stage.id} stage={stage} edit={stageEdits[stage.id] || {}} editStage={editStage} saveStage={saveStage} busy={busy} canExecute={canExecute} />)}
                        </div>
                    ) : (
                        <Empty title="No production steps are active" text="Approve a production order to create its production steps." />
                    )}
                </section>
            )}
        </section>
    );
}

function EditableStage({ stage, edit, editStage, saveStage, busy, canExecute }: any) {
    const canRecord = canExecute && ['ready', 'in_progress', 'blocked', 'rework'].includes(stage.status);
    const resultFields: [string, string][] = [['input_quantity', 'Material received into this step'], ['output_quantity', 'Units produced'], ['rejected_quantity', 'Units rejected'], ['waste_quantity', 'Waste'], ['downtime_minutes', 'Stopped time (minutes)']];

    return (
        <article className="production-step">
            <div className="production-step-title">
                <span className={'step-dot ' + stage.status}></span>
                <div><b>{stage.stage?.name || 'Production step'}</b><small>{stage.order_number} · {stage.product}</small></div>
                <em className={'admin-status ' + stage.status}>{statusLabel[stage.status] || stage.status.replaceAll('_', ' ')}</em>
            </div>
            {canRecord && (
                <div className="production-result-fields">
                    {resultFields.map(([field, label]) => (
                        <label key={field}>{label}<input type="number" min="0" value={edit[field] ?? stage[field] ?? 0} onChange={event => editStage(stage.id, field, event.target.value)} /></label>
                    ))}
                </div>
            )}
            {canExecute && (
                <div className="production-step-actions">
                    {stage.status === 'ready' && <button className="primary-btn" disabled={busy} onClick={() => saveStage(stage, 'in_progress')}><Play size={15} />Start step</button>}
                    {stage.status === 'in_progress' && (
                        <>
                            <button className="secondary-btn" disabled={busy} onClick={() => saveStage(stage, 'blocked')}>Mark blocked</button>
                            <button className="primary-btn" disabled={busy} onClick={() => saveStage(stage, 'completed')}><CheckCircle2 size={15} />Complete step</button>
                        </>
                    )}
                    {['blocked', 'rework'].includes(stage.status) && <button className="primary-btn" disabled={busy} onClick={() => saveStage(stage, 'in_progress')}><Play size={15} />Resume work</button>}
                    {stage.status === 'not_started' && <span>Complete the previous step first.</span>}
                    {stage.status === 'completed' && <span className="completed-label"><CheckCircle2 size={16} />Step completed</span>}
                </div>
            )}
        </article>
    );
}

function OwnerStageResults({ stages }: any) {
    return (
        <section className="panel production-section">
            <header className="production-section-head"><div><h2>Production step results</h2><p>Output and losses recorded at each stage of production.</p></div></header>
            <div className="admin-table-wrap borderless">
                <table className="admin-table production-results-table">
                    <thead><tr><th>Order</th><th>Production step</th><th>Status</th><th>Input</th><th>Output</th><th>Rejected</th><th>Waste</th><th>Stopped time</th></tr></thead>
                    <tbody>
                        {stages.length ? stages.map((stage: any) => (
                            <tr key={stage.id}>
                                <td><b>{stage.order_number}</b></td>
                                <td>{stage.stage?.name || 'Production step'}</td>
                                <td><span className={'admin-status ' + stage.status}>{statusLabel[stage.status] || stage.status.replaceAll('_', ' ')}</span></td>
                                <td>{number(stage.input_quantity)}</td>
                                <td>{number(stage.output_quantity)}</td>
                                <td>{number(stage.rejected_quantity)}</td>
                                <td>{number(stage.waste_quantity)}</td>
                                <td>{number(stage.downtime_minutes)} min</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={8}><Empty title="No production step results yet" text="Results will appear when the production team starts recording work." /></td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
function Summary({ label, value, danger = false }: any) {
    return <article className={'panel production-summary-card ' + (danger ? 'danger' : '')}><small>{label}</small><b>{number(value)}</b></article>;
}
function Empty({ title, text }: any) {
    return <div className="production-empty"><PackageCheck size={28} /><b>{title}</b><span>{text}</span></div>;
}
