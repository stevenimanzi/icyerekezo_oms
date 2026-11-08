import { useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { Alerts, Empty, Kpi, PageHead, api, fmtDate, number, useFinanceData } from '../finance/financeKit';

export type LgView = 'dashboard' | 'deliveries' | 'send-out' | 'confirm' | 'vehicles';

type Props = {
    view: LgView;
    can: (permission: string) => boolean;
    onNavigate?: (page: string) => void;
};

const STATUS: Record<string, string> = {
    planned: 'Needs a vehicle',
    ready: 'Ready to send out',
    in_transit: 'On the road',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};
const TONE: Record<string, string> = { planned: 'warn', ready: 'info', in_transit: 'info', delivered: 'good', cancelled: '' };
const VEHICLE_STATUS: Record<string, string> = {
    available: 'Free',
    assigned: 'On a delivery',
    maintenance: 'Being repaired',
    inactive: 'Switched off',
};
const VEHICLE_TONE: Record<string, string> = { available: 'good', assigned: 'info', maintenance: 'warn', inactive: '' };

const when = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const orderNo = (value: any) => String(value || '').replace(/^LEGACY-NOGUCHI-/i, '');
const isLate = (shipment: any) => ['planned', 'ready'].includes(shipment.status) && shipment.planned_dispatch_at && new Date(shipment.planned_dispatch_at).getTime() < Date.now();
const Pill = ({ status }: { status: string }) => <span className={`fb-pill ${TONE[status] || ''}`}>{STATUS[status] || status}</span>;

type Act = { kind: 'new' | 'vehicle' | 'send' | 'deliver' | 'cancel' | 'details'; shipment?: any; order?: any } | null;

export default function LogisticsWorkspacePage({ view, can, onNavigate }: Props) {
    const overview = useFinanceData<any>('/api/logistics/overview');
    const [act, setAct] = useState<Act>(null);
    const [message, setMessage] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const done = (text: string) => {
        setAct(null);
        setMessage(text);
        setReloadKey((key) => key + 1);
        overview.reload();
    };

    const caps = overview.data?.capabilities || {};
    const props = { overview: overview.data, caps, setAct, reloadKey, onNavigate, can };

    return (
        <section className="fb-page">
            {message && (
                <div className="fb-alert success">
                    <span>{message}</span>
                    <button type="button" className="fb-btn small" onClick={() => setMessage('')}>
                        Close
                    </button>
                </div>
            )}
            <Alerts error={overview.error} />
            {view === 'dashboard' && <Dashboard {...props} loading={overview.loading} reload={overview.reload} />}
            {view === 'deliveries' && <Deliveries {...props} mode="all" />}
            {view === 'send-out' && <Deliveries {...props} mode="open" />}
            {view === 'confirm' && <Deliveries {...props} mode="confirm" />}
            {view === 'vehicles' && <Vehicles {...props} onSaved={done} loading={overview.loading} reload={overview.reload} />}

            {act && act.kind === 'new' && <NewDelivery overview={overview.data} order={act.order} onClose={() => setAct(null)} onSaved={done} />}
            {act && act.kind === 'vehicle' && <VehicleDialog shipment={act.shipment} vehicles={overview.data?.vehicles || []} onClose={() => setAct(null)} onSaved={done} />}
            {act && act.kind === 'send' && <SendDialog shipment={act.shipment} onClose={() => setAct(null)} onSaved={done} />}
            {act && act.kind === 'deliver' && <DeliverDialog shipment={act.shipment} onClose={() => setAct(null)} onSaved={done} />}
            {act && act.kind === 'cancel' && <CancelDialog shipment={act.shipment} onClose={() => setAct(null)} onSaved={done} />}
            {act && act.kind === 'details' && <Details shipment={act.shipment} onClose={() => setAct(null)} />}
        </section>
    );
}

// ------------------------------------------------------------------ dashboard

function Dashboard({ overview, caps, setAct, onNavigate, loading, reload, reloadKey }: any) {
    const open = useFinanceData<any>(`/api/logistics/deliveries?status=open&k=${reloadKey}`);
    const s = overview?.summary;
    const list: any[] = open.data?.shipments || [];
    const orders: any[] = overview?.incoming_orders || [];
    const go = (page: string) => () => onNavigate?.(page);

    return (
        <>
            <PageHead
                title="Today's deliveries"
                subtitle="What must be sent, what is on the road and which orders still need a delivery."
                loading={loading || open.loading}
                onRefresh={() => {
                    reload();
                    open.reload();
                }}
            >
                {caps.plan && (
                    <button type="button" className="fb-btn primary" onClick={() => setAct({ kind: 'new' })}>
                        New delivery
                    </button>
                )}
            </PageHead>
            {s && (
                <>
                    {s.delayed > 0 && (
                        <div className="fb-alert error">
                            <span>
                                <b>{s.delayed}</b> deliver{s.delayed === 1 ? 'y has' : 'ies have'} not left yet and the planned time has passed.
                            </span>
                            <button type="button" className="fb-btn small" onClick={go('dispatch')}>
                                Open send out list
                            </button>
                        </div>
                    )}
                    <div className="fb-kpis">
                        <Kpi label="Orders waiting for a delivery" value={number(orders.length)} tone={orders.length ? 'warn' : 'good'} hint="Accepted, no delivery made yet" />
                        <Kpi label="Needs a vehicle" value={number(s.planned)} />
                        <Kpi label="Ready to send out" value={number(s.ready)} />
                        <Kpi label="On the road" value={number(s.in_transit)} />
                        <Kpi label="Late to leave" value={number(s.delayed)} tone={s.delayed ? 'bad' : 'good'} />
                        <Kpi label="Delivered today" value={number(s.delivered_today)} tone="good" />
                        <Kpi label="Vehicles free" value={`${s.available_vehicles} of ${s.vehicles}`} />
                        <Kpi label="Delivered in total" value={number(s.delivered)} hint={`${number(s.delivered_packages)} packages`} />
                    </div>
                </>
            )}

            <div className="fb-panel">
                <h2>Orders waiting for a delivery</h2>
                {orders.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Customer</th>
                                    <th className="num">Items</th>
                                    <th>Due</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <b>{orderNo(order.document_number)}</b>
                                        </td>
                                        <td>{order.customer_name || '—'}</td>
                                        <td className="num">{number(order.item_count)}</td>
                                        <td>{fmtDate(order.due_date)}</td>
                                        <td className="num">
                                            {caps.plan && (
                                                <button type="button" className="fb-btn small primary" onClick={() => setAct({ kind: 'new', order })}>
                                                    Plan delivery
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>No order is waiting. Every accepted order already has a delivery.</Empty>
                )}
            </div>

            <div className="fb-panel">
                <h2>Deliveries to follow</h2>
                {list.length ? <DeliveryTable rows={list} caps={caps} setAct={setAct} /> : <Empty>{open.loading ? 'Loading…' : 'Nothing to send or collect right now.'}</Empty>}
            </div>
        </>
    );
}

// ------------------------------------------------------------------ deliveries

function Deliveries({ caps, setAct, reloadKey, mode, overview }: any) {
    const [status, setStatus] = useState(mode === 'open' ? 'open' : mode === 'confirm' ? 'in_transit' : '');
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search.trim()) query.set('search', search.trim());
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    query.set('k', String(reloadKey));
    const { data, loading, error, reload } = useFinanceData<any>(`/api/logistics/deliveries?${query.toString()}`);
    const rows: any[] = data?.shipments || [];
    const titles: Record<string, [string, string]> = {
        all: ['Deliveries', 'Every delivery made for a customer order, from planning to the signed proof.'],
        open: ['Send out', 'Give each delivery a vehicle, send it out and follow it until it arrives.'],
        confirm: ['Confirm delivery', 'When the customer receives the goods, write who received them and the proof number.'],
    };
    const [title, subtitle] = titles[mode];
    const orders: any[] = overview?.incoming_orders || [];

    return (
        <>
            <PageHead title={title} subtitle={subtitle} loading={loading} onRefresh={reload}>
                {caps.plan && (
                    <button type="button" className="fb-btn primary" onClick={() => setAct({ kind: 'new' })}>
                        New delivery
                    </button>
                )}
            </PageHead>
            <Alerts error={error} />
            {mode === 'all' && orders.length > 0 && (
                <div className="fb-alert info">
                    <span>
                        <b>{orders.length}</b> accepted order{orders.length === 1 ? '' : 's'} still need a delivery.
                    </span>
                </div>
            )}
            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Show
                        <select value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="">All deliveries</option>
                            <option value="open">Not finished yet</option>
                            <option value="late">Late to leave</option>
                            <option value="planned">Needs a vehicle</option>
                            <option value="ready">Ready to send out</option>
                            <option value="in_transit">On the road</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </label>
                    <label>
                        Made from
                        <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
                    </label>
                    <label>
                        Made until
                        <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
                    </label>
                    <label>
                        Search
                        <input type="search" value={search} placeholder="Number, customer, place or receiver" onChange={(event) => setSearch(event.target.value)} />
                    </label>
                </div>
            </div>
            <div className="fb-panel">
                {rows.length ? <DeliveryTable rows={rows} caps={caps} setAct={setAct} showProof={mode === 'confirm' || status === 'delivered'} /> : <Empty>{loading ? 'Loading…' : 'No delivery matches these filters.'}</Empty>}
                {data && data.total > rows.length && <p className="fb-hint">Showing the latest {data.limit} of {data.total}. Use the filters to narrow the list.</p>}
            </div>
        </>
    );
}

function DeliveryTable({ rows, caps, setAct, showProof }: { rows: any[]; caps: any; setAct: (act: Act) => void; showProof?: boolean }) {
    return (
        <div className="fb-table-wrap">
            <table className="fb-table">
                <thead>
                    <tr>
                        <th>Delivery</th>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Place</th>
                        <th className="num">Packages</th>
                        <th>Vehicle and driver</th>
                        <th>Leaves on</th>
                        <th>Status</th>
                        {showProof && <th>Received by</th>}
                        {showProof && <th>Proof number</th>}
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((shipment) => (
                        <tr key={shipment.id}>
                            <td>
                                <b>{shipment.shipment_number}</b>
                            </td>
                            <td>{orderNo(shipment.sales_document?.document_number) || '—'}</td>
                            <td>{shipment.customer_name || '—'}</td>
                            <td>{shipment.destination}</td>
                            <td className="num">{number(shipment.package_count)}</td>
                            <td>{shipment.vehicle ? `${shipment.vehicle.registration_number}${shipment.vehicle.driver_name ? ' · ' + shipment.vehicle.driver_name : ''}` : <span className="fb-hint">No vehicle yet</span>}</td>
                            <td>
                                {when(shipment.planned_dispatch_at)}
                                {isLate(shipment) && <span className="fb-pill bad"> Late</span>}
                            </td>
                            <td>
                                <Pill status={shipment.status} />
                            </td>
                            {showProof && <td>{shipment.received_by || '—'}</td>}
                            {showProof && <td>{shipment.proof_reference || '—'}</td>}
                            <td className="num">
                                <div className="fb-row-actions">
                                    {['planned', 'ready'].includes(shipment.status) && caps.plan && (
                                        <button type="button" className="fb-btn small" onClick={() => setAct({ kind: 'vehicle', shipment })}>
                                            {shipment.vehicle ? 'Change vehicle' : 'Give a vehicle'}
                                        </button>
                                    )}
                                    {shipment.status === 'ready' && caps.dispatch && (
                                        <button type="button" className="fb-btn small primary" onClick={() => setAct({ kind: 'send', shipment })}>
                                            Send out
                                        </button>
                                    )}
                                    {shipment.status === 'in_transit' && caps.deliver && (
                                        <button type="button" className="fb-btn small good" onClick={() => setAct({ kind: 'deliver', shipment })}>
                                            Confirm delivery
                                        </button>
                                    )}
                                    {['planned', 'ready'].includes(shipment.status) && caps.plan && (
                                        <button type="button" className="fb-btn small danger" onClick={() => setAct({ kind: 'cancel', shipment })}>
                                            Cancel
                                        </button>
                                    )}
                                    <button type="button" className="fb-btn small" onClick={() => setAct({ kind: 'details', shipment })}>
                                        Details
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ------------------------------------------------------------------ vehicles

const blankVehicle = { registration_number: '', vehicle_type: 'Truck', driver_name: '', driver_phone: '', status: 'available', capacity: '', capacity_unit: 'kg' };

function Vehicles({ overview, caps, loading, reload, onSaved }: any) {
    const [editing, setEditing] = useState<any>(null);
    const vehicles: any[] = overview?.vehicles || [];
    const [error, setError] = useState('');
    const remove = async (vehicle: any) => {
        if (!window.confirm(`Remove ${vehicle.registration_number} from the list?`)) return;
        try {
            const result = await api<any>(`/api/logistics/vehicles/${vehicle.id}`, { method: 'DELETE' });
            onSaved(result.message);
        } catch (reason: any) {
            setError(reason.message);
        }
    };

    return (
        <>
            <PageHead title="Vehicles and drivers" subtitle="The vehicles you deliver with, who drives them and whether they are free." loading={loading} onRefresh={reload}>
                {caps.plan && (
                    <button type="button" className="fb-btn primary" onClick={() => setEditing({ ...blankVehicle })}>
                        Add a vehicle
                    </button>
                )}
            </PageHead>
            <Alerts error={error} />
            <div className="fb-panel">
                {vehicles.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Number plate</th>
                                    <th>Type</th>
                                    <th>Driver</th>
                                    <th>Phone</th>
                                    <th className="num">Can carry</th>
                                    <th>Now</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map((vehicle) => (
                                    <tr key={vehicle.id}>
                                        <td>
                                            <b>{vehicle.registration_number}</b>
                                        </td>
                                        <td>{vehicle.vehicle_type}</td>
                                        <td>{vehicle.driver_name || '—'}</td>
                                        <td>{vehicle.driver_phone || '—'}</td>
                                        <td className="num">{vehicle.capacity ? `${number(vehicle.capacity)} ${vehicle.capacity_unit || ''}` : '—'}</td>
                                        <td>
                                            <span className={`fb-pill ${VEHICLE_TONE[vehicle.status] || ''}`}>{VEHICLE_STATUS[vehicle.status] || vehicle.status}</span>
                                        </td>
                                        <td className="num">
                                            {caps.plan && (
                                                <div className="fb-row-actions">
                                                    <button type="button" className="fb-btn small" onClick={() => setEditing({ ...vehicle, capacity: vehicle.capacity ?? '' })}>
                                                        Change
                                                    </button>
                                                    <button type="button" className="fb-btn small danger" onClick={() => remove(vehicle)}>
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : 'No vehicle yet. Add the first vehicle to start planning deliveries.'}</Empty>
                )}
            </div>
            {editing && <VehicleForm vehicle={editing} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); onSaved(text); }} />}
        </>
    );
}

function VehicleForm({ vehicle, onClose, onSaved }: { vehicle: any; onClose: () => void; onSaved: (message: string) => void }) {
    const [form, setForm] = useState<any>(vehicle);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const isNew = !vehicle.id;
    const set = (patch: any) => setForm((current: any) => ({ ...current, ...patch }));
    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await api<any>(isNew ? '/api/logistics/vehicles' : `/api/logistics/vehicles/${vehicle.id}`, {
                method: isNew ? 'POST' : 'PATCH',
                body: JSON.stringify({ ...form, capacity: form.capacity === '' ? null : form.capacity }),
            });
            onSaved(result.message);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog title={isNew ? 'Add a vehicle' : `Change ${vehicle.registration_number}`} onClose={onClose} busy={busy} onSave={save} saveText={isNew ? 'Add vehicle' : 'Save'} disabled={!form.registration_number?.trim() || !form.vehicle_type?.trim()}>
            {error && <div className="fb-alert error">{error}</div>}
            <label>
                Number plate
                <input value={form.registration_number} onChange={(event) => set({ registration_number: event.target.value })} />
            </label>
            <label>
                Type of vehicle
                <input value={form.vehicle_type} placeholder="Truck, van, motorbike…" onChange={(event) => set({ vehicle_type: event.target.value })} />
            </label>
            <label>
                Driver name
                <input value={form.driver_name || ''} onChange={(event) => set({ driver_name: event.target.value })} />
            </label>
            <label>
                Driver phone
                <input value={form.driver_phone || ''} onChange={(event) => set({ driver_phone: event.target.value })} />
            </label>
            <label>
                What it can carry
                <input type="number" min="0" value={form.capacity ?? ''} onChange={(event) => set({ capacity: event.target.value })} />
            </label>
            <label>
                Unit
                <input value={form.capacity_unit || ''} placeholder="kg" onChange={(event) => set({ capacity_unit: event.target.value })} />
            </label>
            <label>
                Now
                <select value={form.status} disabled={form.status === 'assigned'} onChange={(event) => set({ status: event.target.value })}>
                    <option value="available">Free to use</option>
                    {form.status === 'assigned' && <option value="assigned">On a delivery</option>}
                    <option value="maintenance">Being repaired</option>
                    <option value="inactive">Switched off</option>
                </select>
            </label>
            {form.status === 'assigned' && <p className="fb-hint">This vehicle is on a delivery. It becomes free again when the delivery is confirmed or cancelled.</p>}
        </Dialog>
    );
}

// ------------------------------------------------------------------ dialogs

function Dialog({ title, onClose, onSave, saveText, busy, disabled, children, danger }: { title: string; onClose: () => void; onSave?: () => void; saveText?: string; busy?: boolean; disabled?: boolean; children: ReactNode; danger?: boolean }) {
    return (
        <Modal
            title={title}
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {onSave ? 'Cancel' : 'Close'}
                    </button>
                    {onSave && (
                        <button className={danger ? 'danger-btn' : 'primary-btn'} onClick={onSave} disabled={busy || disabled}>
                            {busy ? 'Please wait…' : saveText || 'Save'}
                        </button>
                    )}
                </>
            }
        >
            <div className="fb-form">{children}</div>
        </Modal>
    );
}

function useSend(onSaved: (message: string) => void) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const send = async (url: string, method: string, body: any, fallback: string) => {
        setBusy(true);
        setError('');
        try {
            const result = await api<any>(url, { method, body: JSON.stringify(body) });
            onSaved(fallback || result.message);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return { busy, error, send };
}

function NewDelivery({ overview, order, onClose, onSaved }: { overview: any; order?: any; onClose: () => void; onSaved: (message: string) => void }) {
    const orders: any[] = overview?.incoming_orders || [];
    const vehicles: any[] = (overview?.vehicles || []).filter((vehicle: any) => vehicle.status === 'available');
    const [form, setForm] = useState({ sales_document_id: order ? String(order.id) : '', delivery_vehicle_id: '', destination: '', package_count: '1', total_weight: '', weight_unit: 'kg', planned_dispatch_at: '', delivery_notes: '' });
    const set = (patch: any) => setForm((current) => ({ ...current, ...patch }));
    const { busy, error, send } = useSend(onSaved);
    const save = () =>
        send(
            '/api/logistics/shipments',
            'POST',
            { ...form, delivery_vehicle_id: form.delivery_vehicle_id || null, total_weight: form.total_weight || 0, planned_dispatch_at: form.planned_dispatch_at || null },
            'Delivery created. It will show in the send out list.',
        );

    return (
        <Dialog title="New delivery" onClose={onClose} busy={busy} onSave={save} saveText="Create delivery" disabled={!form.sales_document_id || !form.destination.trim() || Number(form.package_count) < 1}>
            {error && <div className="fb-alert error">{error}</div>}
            {orders.length === 0 && <div className="fb-alert info">No accepted order is waiting for a delivery.</div>}
            <label>
                Customer order
                <select value={form.sales_document_id} onChange={(event) => set({ sales_document_id: event.target.value })}>
                    <option value="">Choose the order</option>
                    {orders.map((item) => (
                        <option key={item.id} value={item.id}>
                            {orderNo(item.document_number)} — {item.customer_name || 'No name'} ({item.item_count} items)
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Where it goes
                <input value={form.destination} placeholder="Town, street or customer address" onChange={(event) => set({ destination: event.target.value })} />
            </label>
            <label>
                Number of packages
                <input type="number" min="1" value={form.package_count} onChange={(event) => set({ package_count: event.target.value })} />
            </label>
            <label>
                Total weight (optional)
                <input type="number" min="0" step="0.001" value={form.total_weight} onChange={(event) => set({ total_weight: event.target.value })} />
            </label>
            <label>
                Weight unit
                <input value={form.weight_unit} onChange={(event) => set({ weight_unit: event.target.value })} />
            </label>
            <label>
                Vehicle (you can choose later)
                <select value={form.delivery_vehicle_id} onChange={(event) => set({ delivery_vehicle_id: event.target.value })}>
                    <option value="">Choose later</option>
                    {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration_number} — {vehicle.driver_name || 'no driver'}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                When it should leave
                <input type="datetime-local" value={form.planned_dispatch_at} onChange={(event) => set({ planned_dispatch_at: event.target.value })} />
            </label>
            <label>
                Notes for the driver
                <textarea value={form.delivery_notes} onChange={(event) => set({ delivery_notes: event.target.value })} />
            </label>
        </Dialog>
    );
}

function VehicleDialog({ shipment, vehicles, onClose, onSaved }: { shipment: any; vehicles: any[]; onClose: () => void; onSaved: (message: string) => void }) {
    const usable = vehicles.filter((vehicle) => vehicle.status === 'available' || vehicle.id === shipment.delivery_vehicle_id);
    const [vehicleId, setVehicleId] = useState(shipment.delivery_vehicle_id ? String(shipment.delivery_vehicle_id) : '');
    const [leaves, setLeaves] = useState(shipment.planned_dispatch_at ? String(shipment.planned_dispatch_at).slice(0, 16) : '');
    const { busy, error, send } = useSend(onSaved);
    const save = () => send(`/api/logistics/shipments/${shipment.id}`, 'PATCH', { action: 'ready', delivery_vehicle_id: vehicleId, planned_dispatch_at: leaves || null }, `${shipment.shipment_number} is ready to send out.`);

    return (
        <Dialog title={`Vehicle for ${shipment.shipment_number}`} onClose={onClose} busy={busy} onSave={save} saveText="Save and mark ready" disabled={!vehicleId}>
            {error && <div className="fb-alert error">{error}</div>}
            {usable.length === 0 && <div className="fb-alert info">No vehicle is free. Add a vehicle or wait for one to come back.</div>}
            <label>
                Vehicle
                <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                    <option value="">Choose a vehicle</option>
                    {usable.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration_number} — {vehicle.driver_name || 'no driver'}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                When it should leave
                <input type="datetime-local" value={leaves} onChange={(event) => setLeaves(event.target.value)} />
            </label>
        </Dialog>
    );
}

function SendDialog({ shipment, onClose, onSaved }: { shipment: any; onClose: () => void; onSaved: (message: string) => void }) {
    const { busy, error, send } = useSend(onSaved);

    return (
        <Dialog title={`Send out ${shipment.shipment_number}`} onClose={onClose} busy={busy} saveText="Yes, send it out" onSave={() => send(`/api/logistics/shipments/${shipment.id}`, 'PATCH', { action: 'dispatch' }, `${shipment.shipment_number} is on the road.`)}>
            {error && <div className="fb-alert error">{error}</div>}
            <p>
                {number(shipment.package_count)} package{Number(shipment.package_count) === 1 ? '' : 's'} for <b>{shipment.customer_name || 'the customer'}</b> to {shipment.destination}, with{' '}
                <b>{shipment.vehicle?.registration_number}</b>
                {shipment.vehicle?.driver_name ? ` (${shipment.vehicle.driver_name})` : ''}. Press the button when the vehicle leaves the factory.
            </p>
        </Dialog>
    );
}

function DeliverDialog({ shipment, onClose, onSaved }: { shipment: any; onClose: () => void; onSaved: (message: string) => void }) {
    const [receiver, setReceiver] = useState('');
    const [proof, setProof] = useState('');
    const [notes, setNotes] = useState('');
    const { busy, error, send } = useSend(onSaved);
    const save = () => send(`/api/logistics/shipments/${shipment.id}`, 'PATCH', { action: 'deliver', received_by: receiver.trim(), proof_reference: proof.trim(), delivery_notes: notes.trim() || null }, `${shipment.shipment_number} was delivered and the order is complete.`);

    return (
        <Dialog title={`Confirm delivery of ${shipment.shipment_number}`} onClose={onClose} busy={busy} onSave={save} saveText="Confirm delivery" disabled={!receiver.trim() || !proof.trim()}>
            {error && <div className="fb-alert error">{error}</div>}
            <p>
                {number(shipment.package_count)} package{Number(shipment.package_count) === 1 ? '' : 's'} to <b>{shipment.customer_name || shipment.destination}</b>.
            </p>
            <label>
                Who received the goods?
                <input value={receiver} placeholder="Full name of the person" onChange={(event) => setReceiver(event.target.value)} />
            </label>
            <label>
                Proof number
                <input value={proof} placeholder="Number on the signed delivery note or receipt" onChange={(event) => setProof(event.target.value)} />
            </label>
            <label>
                Notes (optional)
                <textarea value={notes} placeholder="Anything that was damaged, missing or agreed" onChange={(event) => setNotes(event.target.value)} />
            </label>
        </Dialog>
    );
}

function CancelDialog({ shipment, onClose, onSaved }: { shipment: any; onClose: () => void; onSaved: (message: string) => void }) {
    const [reason, setReason] = useState('');
    const { busy, error, send } = useSend(onSaved);

    return (
        <Dialog
            title={`Cancel ${shipment.shipment_number}`}
            onClose={onClose}
            busy={busy}
            danger
            saveText="Cancel this delivery"
            onSave={() => send(`/api/logistics/shipments/${shipment.id}`, 'PATCH', { action: 'cancel', delivery_notes: reason.trim() || null }, `${shipment.shipment_number} was cancelled. The order can get a new delivery.`)}
        >
            {error && <div className="fb-alert error">{error}</div>}
            <p>The order goes back to the list of orders waiting for a delivery, and the vehicle becomes free.</p>
            <label>
                Why is it cancelled? (optional)
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
        </Dialog>
    );
}

function Details({ shipment, onClose }: { shipment: any; onClose: () => void }) {
    const line = (label: string, value: ReactNode) => (
        <div className="fb-detail-line">
            <span>{label}</span>
            <b>{value || '—'}</b>
        </div>
    );

    return (
        <Dialog title={shipment.shipment_number} onClose={onClose}>
            {line('Status', STATUS[shipment.status] || shipment.status)}
            {line('Customer order', orderNo(shipment.sales_document?.document_number))}
            {line('Customer', shipment.customer_name)}
            {line('Place', shipment.destination)}
            {line('Packages', number(shipment.package_count))}
            {line('Weight', Number(shipment.total_weight) ? `${number(shipment.total_weight)} ${shipment.weight_unit || ''}` : '')}
            {line('Vehicle', shipment.vehicle ? `${shipment.vehicle.registration_number} (${shipment.vehicle.vehicle_type})` : '')}
            {line('Driver', shipment.vehicle ? `${shipment.vehicle.driver_name || ''} ${shipment.vehicle.driver_phone || ''}`.trim() : '')}
            {line('Should leave', when(shipment.planned_dispatch_at))}
            {line('Left on', when(shipment.dispatched_at))}
            {line('Delivered on', when(shipment.delivered_at))}
            {line('Received by', shipment.received_by)}
            {line('Proof number', shipment.proof_reference)}
            {line('Notes', shipment.delivery_notes)}
        </Dialog>
    );
}
