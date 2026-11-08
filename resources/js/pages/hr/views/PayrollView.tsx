import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { Alerts, Empty, Kpi, PageHead, Pill, api, fmtDate, money, monthLabel, thisMonth, useFinanceData } from '../hrKit';

export default function PayrollView() {
    const { data, loading, error, reload } = useFinanceData<any>('/api/hr/payroll');
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ period: thisMonth(), statutory_rate: '0', notes: '' });
    const [openId, setOpenId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');
    const [failure, setFailure] = useState('');

    const currency = data?.currency || 'RWF';
    const runs: any[] = data?.runs || [];
    const live = runs.filter((run) => run.status !== 'cancelled');
    const current = live.find((run) => run.period === thisMonth());

    const create = async () => {
        setBusy(true);
        setFormError('');
        try {
            const run: any = await api('/api/hr/payroll', {
                method: 'POST',
                body: JSON.stringify({ ...form, statutory_rate: Number(form.statutory_rate || 0), notes: form.notes || null }),
            });
            setCreating(false);
            setSuccess(`Payroll ${run.run_number} was prepared. Check it, then send it to finance.`);
            reload();
            setOpenId(run.id);
        } catch (reason: any) {
            setFormError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="fb-page">
            <PageHead title="Payroll" subtitle="HR prepares the monthly salaries and sends them to finance, who pay them." loading={loading} onRefresh={reload}>
                <button type="button" className="primary" onClick={() => { setFormError(''); setCreating(true); }}>
                    Prepare payroll
                </button>
            </PageHead>
            <Alerts error={error || failure} success={success} />

            {data?.missing_salary?.length > 0 && (
                <div className="fb-alert info">
                    {data.missing_salary.length} working employee{data.missing_salary.length === 1 ? ' has' : 's have'} no salary set and will be left out:{' '}
                    {data.missing_salary.slice(0, 5).join(', ')}
                    {data.missing_salary.length > 5 ? '…' : ''}. Set it in Employees.
                </div>
            )}

            <div className="fb-kpis">
                <Kpi label="This month" value={current ? money(current.total_net, currency) : 'Not prepared'} hint={current ? `${current.employee_count} employees` : 'Press Prepare payroll'} />
                <Kpi label="Waiting for finance" value={live.filter((run) => run.status === 'submitted').length} tone={live.some((run) => run.status === 'submitted') ? 'warn' : undefined} />
                <Kpi label="Paid runs" value={live.filter((run) => run.status === 'paid').length} tone="good" />
                <Kpi label="Standard month" value={`${data?.rules?.work_days ?? 26} days`} hint={`Overtime ${data?.rules?.overtime_multiplier ?? 1.5} × hourly`} />
            </div>

            <div className="fb-panel">
                <h2>Payroll runs</h2>
                {runs.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Payroll</th>
                                    <th className="num">Employees</th>
                                    <th className="num">Gross</th>
                                    <th className="num">Deductions</th>
                                    <th className="num">Net to pay</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run) => (
                                    <tr key={run.id}>
                                        <td>
                                            <b>{monthLabel(run.period)}</b>
                                        </td>
                                        <td>
                                            {run.run_number}
                                            <small style={{ display: 'block' }}>
                                                {run.creator?.name ? `By ${run.creator.name}` : ''}
                                                {run.paid_at ? ` · paid ${fmtDate(run.paid_at)}` : ''}
                                            </small>
                                        </td>
                                        <td className="num">{run.employee_count}</td>
                                        <td className="num">{money(run.total_gross, currency)}</td>
                                        <td className="num">{money(run.total_deductions, currency)}</td>
                                        <td className="num">
                                            <b>{money(run.total_net, currency)}</b>
                                        </td>
                                        <td>
                                            <Pill status={run.status} />
                                        </td>
                                        <td>
                                            <button type="button" className="fb-btn small" onClick={() => setOpenId(run.id)}>
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : 'No payroll yet. Press Prepare payroll to start.'}</Empty>
                )}
            </div>

            {creating && (
                <Modal
                    title="Prepare payroll"
                    narrow
                    onClose={() => setCreating(false)}
                    footer={
                        <>
                            <button className="secondary-btn" onClick={() => setCreating(false)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={create} disabled={busy}>
                                {busy ? 'Preparing…' : 'Prepare payroll'}
                            </button>
                        </>
                    }
                >
                    <div className="fb-form">
                        {formError && <div className="fb-alert error">{formError}</div>}
                        <label>
                            Month
                            <input type="month" value={form.period} max={thisMonth()} onChange={(event) => setForm({ ...form, period: event.target.value })} />
                        </label>
                        <label>
                            Statutory deduction (% of gross, for example pension or tax)
                            <input type="number" min={0} max={60} step={0.1} value={form.statutory_rate} onChange={(event) => setForm({ ...form, statutory_rate: event.target.value })} />
                        </label>
                        <label>
                            Note
                            <textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                        </label>
                        <p className="fb-hint">
                            Every working employee with a salary is included. Approved overtime is added, and absent days and unpaid leave are taken off.
                            You can still add allowances or deductions before sending to finance.
                        </p>
                    </div>
                </Modal>
            )}

            {openId !== null && (
                <RunDetail
                    id={openId}
                    onClose={() => setOpenId(null)}
                    onChanged={(message) => {
                        if (message) setSuccess(message);
                        reload();
                    }}
                    onError={setFailure}
                />
            )}
        </section>
    );
}

function RunDetail({ id, onClose, onChanged, onError }: { id: number; onClose: () => void; onChanged: (message?: string) => void; onError: (message: string) => void }) {
    const { data, loading, error, reload } = useFinanceData<any>(`/api/hr/payroll/${id}`);
    const [edits, setEdits] = useState<Record<number, { allowances: string; other_deductions: string }>>({});
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');

    const run = data?.run;
    const lines: any[] = data?.lines || [];
    const currency = data?.currency || 'RWF';
    const isDraft = run?.status === 'draft';

    const value = (line: any, key: 'allowances' | 'other_deductions') => edits[line.id]?.[key] ?? String(Number(line[key] || 0));

    const edit = (line: any, key: 'allowances' | 'other_deductions', next: string) =>
        setEdits((current) => ({
            ...current,
            [line.id]: { allowances: value(line, 'allowances'), other_deductions: value(line, 'other_deductions'), [key]: next },
        }));

    const saveLine = async (line: any) => {
        setProblem('');
        try {
            await api(`/api/hr/payroll/lines/${line.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    allowances: Number(value(line, 'allowances') || 0),
                    other_deductions: Number(value(line, 'other_deductions') || 0),
                }),
            });
            setEdits((current) => {
                const { [line.id]: _removed, ...rest } = current;

                return rest;
            });
            reload();
            onChanged();
        } catch (reason: any) {
            setProblem(reason.message);
        }
    };

    const act = async (path: 'submit' | 'cancel') => {
        if (path === 'cancel' && !window.confirm('Cancel this payroll? You can prepare it again afterwards.')) return;
        if (path === 'submit' && !window.confirm(`Send this payroll of ${money(run.total_net, currency)} to finance? You cannot change it after this.`)) return;
        setBusy(true);
        setProblem('');
        try {
            await api(`/api/hr/payroll/${id}/${path}`, { method: 'POST' });
            onChanged(path === 'submit' ? 'Payroll was sent to finance. They will pay it and record it as salaries paid.' : 'Payroll was cancelled.');
            onClose();
        } catch (reason: any) {
            setProblem(reason.message);
            onError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={run ? `${run.run_number} · ${monthLabel(run.period)}` : 'Payroll'}
            onClose={onClose}
            footer={
                run && (
                    <>
                        {run.status !== 'cancelled' && (
                            <a className="secondary-btn" href={`/api/hr/payroll/${id}/payslips`}>
                                Download payslips
                            </a>
                        )}
                        {(isDraft || run.status === 'submitted') && (
                            <button className="secondary-btn" onClick={() => act('cancel')} disabled={busy}>
                                Cancel payroll
                            </button>
                        )}
                        {isDraft && (
                            <button className="primary-btn" onClick={() => act('submit')} disabled={busy || !lines.length}>
                                {busy ? 'Sending…' : 'Send to finance'}
                            </button>
                        )}
                    </>
                )
            }
        >
            <div className="fb-form" style={{ minWidth: 0 }}>
                {(error || problem) && <div className="fb-alert error">{error || problem}</div>}
                {loading && !run && <p className="fb-muted">Loading…</p>}
                {run && (
                    <>
                        <div className="fb-kpis">
                            <Kpi label="Status" value={<Pill status={run.status} />} />
                            <Kpi label="Gross" value={money(run.total_gross, currency)} />
                            <Kpi label="Deductions" value={money(run.total_deductions, currency)} />
                            <Kpi label="Net to pay" value={money(run.total_net, currency)} tone="good" hint={`${run.employee_count} employees · statutory ${Number(run.statutory_rate)}%`} />
                        </div>
                        {isDraft && <p className="fb-hint">Add allowances (bonus, transport) or other deductions (advance, loan) for any person, then save the row.</p>}
                        <div className="fb-table-wrap">
                            <table className="fb-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th className="num">Salary</th>
                                        <th className="num">Overtime</th>
                                        <th className="num">Allowances</th>
                                        <th className="num">Absent</th>
                                        <th className="num">Statutory</th>
                                        <th className="num">Other deductions</th>
                                        <th className="num">Net pay</th>
                                        {isDraft && <th />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line) => (
                                        <tr key={line.id}>
                                            <td>
                                                <b>{line.employee_name}</b>
                                                <small style={{ display: 'block' }}>{line.job_title || line.employee_number || ''}</small>
                                            </td>
                                            <td className="num">{money(line.base_salary, currency)}</td>
                                            <td className="num">
                                                {money(line.overtime_pay, currency)}
                                                {Number(line.overtime_hours) > 0 && <small style={{ display: 'block' }}>{Number(line.overtime_hours)} h</small>}
                                            </td>
                                            <td className="num">
                                                {isDraft ? (
                                                    <input type="number" min={0} className="fb-cell-input" value={value(line, 'allowances')} onChange={(event) => edit(line, 'allowances', event.target.value)} />
                                                ) : (
                                                    money(line.allowances, currency)
                                                )}
                                            </td>
                                            <td className="num">
                                                −{money(line.absence_deduction, currency)}
                                                {line.absent_days > 0 && <small style={{ display: 'block' }}>{line.absent_days} days</small>}
                                            </td>
                                            <td className="num">−{money(line.statutory_deduction, currency)}</td>
                                            <td className="num">
                                                {isDraft ? (
                                                    <input type="number" min={0} className="fb-cell-input" value={value(line, 'other_deductions')} onChange={(event) => edit(line, 'other_deductions', event.target.value)} />
                                                ) : (
                                                    money(line.other_deductions, currency)
                                                )}
                                            </td>
                                            <td className="num">
                                                <b>{money(line.net_pay, currency)}</b>
                                            </td>
                                            {isDraft && (
                                                <td>
                                                    <button type="button" className="fb-btn small" disabled={!edits[line.id]} onClick={() => saveLine(line)}>
                                                        Save
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {run.status === 'submitted' && <p className="fb-hint">Sent to finance on {fmtDate(run.submitted_at)}. Finance pays it and records it as salaries paid.</p>}
                        {run.status === 'paid' && <p className="fb-hint">Paid on {fmtDate(run.paid_at)}{run.payer?.name ? ` by ${run.payer.name}` : ''}.</p>}
                    </>
                )}
            </div>
        </Modal>
    );
}
