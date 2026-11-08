import { useMemo, useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Alerts, Empty, Kpi, PageHead, Pill, api, fmtDate, money, today, useFinanceData, words } from '../hrKit';

type Form = {
    job_title: string;
    department_id: string;
    base_salary: string;
    overtime_rate: string;
    contract_type: string;
    employment_status: string;
    hired_at: string;
    phone: string;
    emergency_contact: string;
};

const toForm = (employee: any): Form => ({
    job_title: employee.job_title || '',
    department_id: employee.department_id ? String(employee.department_id) : '',
    base_salary: String(employee.base_salary || 0),
    overtime_rate: employee.overtime_rate != null ? String(employee.overtime_rate) : '',
    contract_type: employee.contract_type || '',
    employment_status: employee.employment_status || 'active',
    hired_at: employee.hired_at || '',
    phone: employee.phone || '',
    emergency_contact: employee.emergency_contact || '',
});

export default function EmployeesView() {
    const { data, loading, error, reload } = useFinanceData<any>('/api/hr/employees');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');

    const currency = data?.currency || 'RWF';
    const employees: any[] = data?.employees || [];

    const shown = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return employees.filter(
            (person) =>
                (!status || person.employment_status === status) &&
                (!needle ||
                    [person.name, person.email, person.job_title, person.department, person.employee_number]
                        .filter(Boolean)
                        .some((value: string) => value.toLowerCase().includes(needle))),
        );
    }, [employees, search, status]);

    const working = employees.filter((person) => person.employment_status === 'active');
    const payrollTotal = working.reduce((sum, person) => sum + Number(person.base_salary || 0), 0);
    const noSalary = working.filter((person) => Number(person.base_salary) <= 0).length;

    const open = (person: any) => {
        setEditing(person);
        setForm(toForm(person));
        setFormError('');
    };

    const set = (patch: Partial<Form>) => setForm((current) => (current ? { ...current, ...patch } : current));

    const save = async () => {
        if (!form || !editing) return;
        setBusy(true);
        setFormError('');
        try {
            const result: any = await api(`/api/hr/employees/${editing.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...form,
                    department_id: form.department_id || null,
                    overtime_rate: form.overtime_rate === '' ? null : Number(form.overtime_rate),
                    base_salary: Number(form.base_salary || 0),
                    contract_type: form.contract_type || null,
                    hired_at: form.hired_at || null,
                }),
            });
            setEditing(null);
            setSuccess(result.message);
            reload();
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="fb-page">
            <PageHead title="Employees" subtitle="The record of every person working in the factory." loading={loading} onRefresh={reload} />
            <Alerts error={error} success={success} />

            <div className="fb-kpis">
                <Kpi label="Working now" value={working.length} />
                <Kpi label="Monthly salary bill" value={money(payrollTotal, currency)} hint="Base salaries of working employees" />
                <Kpi label="No salary set" value={noSalary} tone={noSalary ? 'warn' : undefined} hint="Left out of payroll" />
            </div>

            <div className="fb-panel">
                <div className="fb-filters">
                    <label>
                        Search
                        <input value={search} placeholder="Name, job, department…" onChange={(event) => setSearch(event.target.value)} />
                    </label>
                    <label>
                        Status
                        <select value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="">Everyone</option>
                            {Object.entries(data?.statuses || {}).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {String(label)}
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
                                    <th>Employee</th>
                                    <th>Job</th>
                                    <th>Department</th>
                                    <th>Contract</th>
                                    <th className="num">Monthly salary</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((person) => (
                                    <tr key={person.id}>
                                        <td>
                                            <b>{person.name}</b>
                                            <small style={{ display: 'block' }}>
                                                {person.employee_number || 'No number yet'} · {person.email}
                                            </small>
                                        </td>
                                        <td>{person.job_title || '—'}</td>
                                        <td>{person.department || '—'}</td>
                                        <td>{person.contract_type ? data?.contracts?.[person.contract_type] : '—'}</td>
                                        <td className="num">
                                            {Number(person.base_salary) > 0 ? money(person.base_salary, currency) : <span className="fb-pill warn">Not set</span>}
                                        </td>
                                        <td>
                                            <Pill status={person.employment_status} />
                                        </td>
                                        <td>
                                            <button type="button" className="fb-btn small" onClick={() => open(person)}>
                                                Open record
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : 'No employee matches.'}</Empty>
                )}
            </div>

            {editing && form && (
                <Modal
                    title={editing.name}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setEditing(null)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={save} disabled={busy}>
                                {busy ? 'Saving…' : 'Save record'}
                            </button>
                        </>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <p className="fb-muted">
                            {editing.email} · {(editing.roles || []).map((role: string) => words(role)).join(', ') || 'No role'} ·{' '}
                            {editing.employee_number || 'Number is given when you save'}
                        </p>
                        <div className="two">
                            <label>
                                Job title
                                <input value={form.job_title} onChange={(event) => set({ job_title: event.target.value })} />
                            </label>
                            <label>
                                Department
                                <select value={form.department_id} onChange={(event) => set({ department_id: event.target.value })}>
                                    <option value="">None</option>
                                    {(data?.departments || []).map((department: any) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="two">
                            <label>
                                Monthly salary ({currency})
                                <input type="number" min={0} value={form.base_salary} onChange={(event) => set({ base_salary: event.target.value })} />
                            </label>
                            <label>
                                Overtime pay per hour (leave empty for the standard rate)
                                <input type="number" min={0} value={form.overtime_rate} onChange={(event) => set({ overtime_rate: event.target.value })} />
                            </label>
                        </div>
                        <div className="two">
                            <label>
                                Contract
                                <select value={form.contract_type} onChange={(event) => set({ contract_type: event.target.value })}>
                                    <option value="">Not set</option>
                                    {Object.entries(data?.contracts || {}).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {String(label)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Status
                                <select value={form.employment_status} onChange={(event) => set({ employment_status: event.target.value })}>
                                    {Object.entries(data?.statuses || {}).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {String(label)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="two">
                            <label>
                                Date hired
                                <input type="date" max={today()} value={form.hired_at} onChange={(event) => set({ hired_at: event.target.value })} />
                            </label>
                            <label>
                                Phone
                                <input value={form.phone} onChange={(event) => set({ phone: event.target.value })} />
                            </label>
                        </div>
                        <label>
                            Emergency contact
                            <input value={form.emergency_contact} placeholder="Name and phone" onChange={(event) => set({ emergency_contact: event.target.value })} />
                        </label>
                        {editing.hired_at && <p className="fb-hint">Hired on {fmtDate(editing.hired_at)}.</p>}
                        <p className="fb-hint">Only people who are Working are in the attendance register and in payroll.</p>
                    </div>
                </Modal>
            )}
        </section>
    );
}
