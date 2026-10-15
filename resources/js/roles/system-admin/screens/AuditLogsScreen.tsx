import { AdminTable } from '../components/AdminTable';
import type { AdminContext } from '../useAdminData';

export function AuditLogsScreen({ ctx }: { ctx: AdminContext }) {
    const { data, records, form, auditFilters, setAuditFilters } = ctx;
    return (
        <>
            <div
                className="admin-form"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                    gap: 10,
                    padding: 16,
                    marginBottom: 14,
                }}
            >
                <input
                    placeholder="Search description or event"
                    value={auditFilters.search}
                    onChange={(e) => setAuditFilters({ ...auditFilters, search: e.target.value })}
                    style={{
                        padding: 9,
                        border: '1px solid var(--line)',
                        borderRadius: 7,
                        background: 'var(--panel)',
                        color: 'var(--text)',
                    }}
                />
                <select
                    value={auditFilters.event}
                    onChange={(e) => setAuditFilters({ ...auditFilters, event: e.target.value })}
                >
                    <option value="">All events</option>
                    {(data?.events || []).map((event: string) => (
                        <option key={event} value={event}>
                            {event}
                        </option>
                    ))}
                </select>
                <select
                    value={auditFilters.factory_id}
                    onChange={(e) =>
                        setAuditFilters({ ...auditFilters, factory_id: e.target.value })
                    }
                >
                    <option value="">All factories</option>
                    {(data?.factories || []).map((factory: any) => (
                        <option key={factory.id} value={factory.id}>
                            {factory.name}
                        </option>
                    ))}
                </select>
                <input
                    type="date"
                    value={auditFilters.from}
                    onChange={(e) => setAuditFilters({ ...auditFilters, from: e.target.value })}
                />
                <input
                    type="date"
                    value={auditFilters.to}
                    onChange={(e) => setAuditFilters({ ...auditFilters, to: e.target.value })}
                />
            </div>
            <AdminTable
                headers={['When', 'Event', 'Description', 'User', 'Factory']}
                rows={records.map((item: any) => [
                    new Date(item.created_at).toLocaleString(),
                    item.event,
                    item.description || '—',
                    item.user?.name || 'System',
                    item.factory?.name || '—',
                ])}
            />
        </>
    );
}
