import { AdminTable } from '../components/AdminTable';
import { Status } from '../components/Status';
import { BackupAction } from '../components/BackupAction';
import type { AdminContext } from '../useAdminData';

export function BackupsScreen({ ctx }: { ctx: AdminContext }) {
    const { records, busy, run, showForm } = ctx;
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
                rows={records.map((item: any) => [
                    new Date(item.created_at).toLocaleString(),
                    <Status value={item.status} />,
                    item.size_bytes ? `${(item.size_bytes / 1048576).toFixed(2)} MB` : '—',
                    item.path || '—',
                    item.completed_at ? new Date(item.completed_at).toLocaleString() : '—',
                ])}
            />
        </>
    );
}
