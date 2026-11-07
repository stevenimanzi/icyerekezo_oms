import { AdminTable } from '../components/AdminTable';
import { Status } from '../components/Status';
import { BackupAction } from '../components/BackupAction';
import type { AdminContext } from '../useAdminData';

function formatSafeDate(raw: any): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? '—' : d.toLocaleString();
    } catch {
        return '—';
    }
}

export function BackupsScreen({ ctx }: { ctx: AdminContext }) {
    const { records, busy, run, showForm } = ctx;
    const safeRecords = Array.isArray(records) ? records.filter(Boolean) : [];
    return (
        <>
            <BackupAction
                open={showForm}
                busy={busy}
                submit={() =>
                    run('/api/platform/backups', 'POST', undefined, 'Backup queued securely.')
                }
            />
            <AdminTable
                headers={['Requested', 'Status', 'Size', 'File', 'Completed']}
                rows={safeRecords.map((item: any) => [
                    formatSafeDate(item?.created_at),
                    <Status value={item?.status || 'pending'} />,
                    item?.size_bytes ? `${(item.size_bytes / 1048576).toFixed(2)} MB` : '—',
                    item?.path || '—',
                    item?.completed_at ? formatSafeDate(item.completed_at) : '—',
                ])}
            />
        </>
    );
}
