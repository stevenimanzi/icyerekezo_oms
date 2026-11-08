import { useState } from 'react';
import { MachineModal } from '../MachineModal';
import { Alerts, Empty, Kpi, MACHINE_STATUS, PageHead, Pill, api, canManage, dueText, shortDate, useFinanceData } from '../mtKit';
import type { ViewProps } from '../mtKit';

export default function ScheduleView({ can }: ViewProps) {
    const { data, loading, error, reload } = useFinanceData<any>('/api/machines/list');
    const [editing, setEditing] = useState<any>(null);
    const [success, setSuccess] = useState('');
    const [failure, setFailure] = useState('');
    const manager = data?.can_manage || canManage(can);

    const machines: any[] = (data?.machines || [])
        .filter((m: any) => m.status !== 'retired')
        .sort((a: any, b: any) => {
            if (!a.next_maintenance_at && !b.next_maintenance_at) return a.name.localeCompare(b.name);
            if (!a.next_maintenance_at) return 1;
            if (!b.next_maintenance_at) return -1;

            return a.next_maintenance_at.localeCompare(b.next_maintenance_at);
        });
    const overdue = machines.filter((m) => m.next_maintenance_at && new Date(m.next_maintenance_at.replace(' ', 'T')).getTime() < Date.now()).length;
    const unplanned = machines.filter((m) => !m.next_maintenance_at).length;

    const createJob = async (machine: any) => {
        setFailure('');
        try {
            await api('/api/maintenance', {
                method: 'POST',
                body: JSON.stringify({ machine_id: machine.id, maintenance_type: 'preventive', title: `Planned service of ${machine.name}`, priority: 'normal' }),
            });
            setSuccess(`A service job for ${machine.name} was opened. Finish it in Problems and repairs and the next service date moves forward by itself.`);
            reload();
        } catch (reason: any) {
            setFailure(reason.message);
        }
    };

    return (
        <section className="fb-page">
            <PageHead title="Service plan" subtitle="When each machine was last serviced and when it is due next." loading={loading} onRefresh={reload} />
            <Alerts error={error || failure} success={success} />

            <div className="fb-kpis">
                <Kpi label="Machines in the plan" value={machines.length - unplanned} />
                <Kpi label="Service overdue" value={overdue} tone={overdue ? 'bad' : 'good'} />
                <Kpi label="No service planned" value={unplanned} tone={unplanned ? 'warn' : undefined} hint="Set how often to service" />
            </div>

            <div className="fb-panel">
                {machines.length ? (
                    <div className="fb-table-wrap">
                        <table className="fb-table">
                            <thead>
                                <tr>
                                    <th>Machine</th>
                                    <th>State</th>
                                    <th className="num">Serviced every</th>
                                    <th>Last service</th>
                                    <th>Next service</th>
                                    <th>When</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {machines.map((m) => {
                                    const due = dueText(m.next_maintenance_at);

                                    return (
                                        <tr key={m.id}>
                                            <td>
                                                <b>{m.name}</b>
                                                <small style={{ display: 'block' }}>{m.code}</small>
                                            </td>
                                            <td>
                                                <Pill value={m.status} labels={MACHINE_STATUS} />
                                            </td>
                                            <td className="num">{m.maintenance_interval_days ? `${m.maintenance_interval_days} days` : '—'}</td>
                                            <td>{shortDate(m.last_maintenance_at)}</td>
                                            <td>{shortDate(m.next_maintenance_at)}</td>
                                            <td>
                                                <span className={`fb-pill ${due.tone}`}>{due.text}</span>
                                            </td>
                                            <td>
                                                {can('maintenance.create') && (
                                                    <button type="button" className="fb-btn small" onClick={() => createJob(m)}>
                                                        Open service job
                                                    </button>
                                                )}{' '}
                                                {(manager || can('maintenance.execute')) && (
                                                    <button type="button" className="fb-btn small" onClick={() => setEditing(m)}>
                                                        Change plan
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{loading ? 'Loading…' : 'No machine is registered yet.'}</Empty>
                )}
            </div>

            {editing && (
                <MachineModal
                    machine={editing}
                    departments={data?.departments || []}
                    canManage={manager}
                    onClose={() => setEditing(null)}
                    onSaved={(message) => {
                        setEditing(null);
                        setSuccess(message);
                        reload();
                    }}
                />
            )}
        </section>
    );
}
