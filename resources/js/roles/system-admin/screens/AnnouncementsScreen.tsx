import { AdminTable } from '../components/AdminTable';
import { Status } from '../components/Status';
import { SimpleForm } from '../components/SimpleForm';
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

export function AnnouncementsScreen({ ctx }: { ctx: AdminContext }) {
    const { records, run, form, setForm, showForm } = ctx;
    const safeRecords = Array.isArray(records) ? records.filter(Boolean) : [];
    return (
        <>
            <SimpleForm
                open={showForm}
                fields={[
                    ['title', 'Title'],
                    ['message', 'Message', 'textarea'],
                    ['severity', 'Severity', 'select', ['info', 'success', 'warning', 'critical']],
                    ['audience', 'Audience', 'select', ['all', 'factory_owners', 'factory_users']],
                ]}
                form={form}
                setForm={setForm}
                submit={(values: any) =>
                    run(
                        '/api/platform/announcements',
                        'POST',
                        values,
                        'Announcement published to users.',
                    )
                }
            />
            <AdminTable
                headers={['Title', 'Message', 'Severity', 'Audience', 'Published']}
                rows={safeRecords.map((item: any) => [
                    <b>{item?.title || '—'}</b>,
                    item?.message || '—',
                    <Status value={item?.severity || 'info'} />,
                    item?.audience || 'all',
                    formatSafeDate(item?.published_at),
                ])}
            />
        </>
    );
}
