import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { MACHINE_STATUS, api, toInputDate } from './mtKit';

type Props = {
    machine: any | null; // null = register a new machine
    departments: any[];
    canManage: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
};

/** Register a machine, or change how it is described, how often it is serviced and how fast it should run. */
export function MachineModal({ machine, departments, canManage, onClose, onSaved }: Props) {
    const isNew = !machine;
    const [form, setForm] = useState({
        name: machine?.name || '',
        code: machine?.code || '',
        type: machine?.type || '',
        department_id: machine?.department_id ? String(machine.department_id) : '',
        serial_number: machine?.serial_number || '',
        manufacturer: machine?.manufacturer || '',
        model: machine?.model || '',
        location: machine?.location || '',
        status: machine?.status || 'operational',
        runtime_hours: String(machine?.runtime_hours ?? 0),
        ideal_output_per_hour: machine?.ideal_output_per_hour ? String(machine.ideal_output_per_hour) : '',
        installed_at: toInputDate(machine?.installed_at),
        maintenance_interval_days: machine?.maintenance_interval_days ? String(machine.maintenance_interval_days) : '',
        next_maintenance_at: toInputDate(machine?.next_maintenance_at),
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

    const save = async () => {
        setBusy(true);
        setError('');
        const body: any = {
            ...form,
            department_id: form.department_id || null,
            runtime_hours: Number(form.runtime_hours || 0),
            ideal_output_per_hour: form.ideal_output_per_hour === '' ? null : Number(form.ideal_output_per_hour),
            installed_at: form.installed_at || null,
            maintenance_interval_days: form.maintenance_interval_days === '' ? null : Number(form.maintenance_interval_days),
            next_maintenance_at: form.next_maintenance_at || null,
        };
        try {
            await api(isNew ? '/api/machines' : `/api/machines/${machine.id}`, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(body) });
            onSaved(isNew ? `${form.name} was registered.` : `${form.name} was saved.`);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={isNew ? 'Register a machine' : `Machine: ${machine.name}`}
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button className="primary-btn" onClick={save} disabled={busy || !form.name || !form.code || !form.type}>
                        {busy ? 'Saving…' : isNew ? 'Register machine' : 'Save machine'}
                    </button>
                </>
            }
        >
            <div className="fb-form">
                {error && <div className="fb-alert error">{error}</div>}
                <div className="two">
                    <label>
                        Machine name
                        <input value={form.name} onChange={(event) => set({ name: event.target.value })} disabled={!canManage && !isNew} />
                    </label>
                    <label>
                        Machine code
                        <input value={form.code} onChange={(event) => set({ code: event.target.value })} disabled={!canManage && !isNew} />
                    </label>
                </div>
                <div className="two">
                    <label>
                        Type (for example sewing machine)
                        <input value={form.type} onChange={(event) => set({ type: event.target.value })} disabled={!canManage && !isNew} />
                    </label>
                    <label>
                        Department
                        <select value={form.department_id} onChange={(event) => set({ department_id: event.target.value })}>
                            <option value="">None</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="two">
                    <label>
                        Manufacturer
                        <input value={form.manufacturer} onChange={(event) => set({ manufacturer: event.target.value })} />
                    </label>
                    <label>
                        Model
                        <input value={form.model} onChange={(event) => set({ model: event.target.value })} />
                    </label>
                </div>
                <div className="two">
                    <label>
                        Serial number
                        <input value={form.serial_number} onChange={(event) => set({ serial_number: event.target.value })} />
                    </label>
                    <label>
                        Where it stands
                        <input value={form.location} onChange={(event) => set({ location: event.target.value })} />
                    </label>
                </div>
                <div className="two">
                    <label>
                        Usual pieces per hour (used as the target)
                        <input type="number" min={0} value={form.ideal_output_per_hour} onChange={(event) => set({ ideal_output_per_hour: event.target.value })} />
                    </label>
                    <label>
                        Date installed
                        <input type="date" value={form.installed_at} onChange={(event) => set({ installed_at: event.target.value })} />
                    </label>
                </div>
                <div className="two">
                    <label>
                        Service every (days)
                        <input type="number" min={1} value={form.maintenance_interval_days} onChange={(event) => set({ maintenance_interval_days: event.target.value })} />
                    </label>
                    <label>
                        Next service on
                        <input type="date" value={form.next_maintenance_at} onChange={(event) => set({ next_maintenance_at: event.target.value })} />
                    </label>
                </div>
                {!isNew && (
                    <div className="two">
                        <label>
                            State
                            <select value={form.status} onChange={(event) => set({ status: event.target.value })}>
                                {Object.entries(MACHINE_STATUS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Hours run so far
                            <input type="number" min={0} value={form.runtime_hours} onChange={(event) => set({ runtime_hours: event.target.value })} />
                        </label>
                    </div>
                )}
                <p className="fb-hint">After a planned service is finished, the next service date moves forward by itself using the number of days above.</p>
            </div>
        </Modal>
    );
}
