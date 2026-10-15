import { AdminTable } from '../components/AdminTable';
import { Status } from '../components/Status';
import { SimpleForm } from '../components/SimpleForm';
import type { AdminContext } from '../useAdminData';

export function AnnouncementsScreen({ ctx }: { ctx: AdminContext }) {
    const { records, run, form, setForm, showForm } = ctx;
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
                rows={records.map((item: any) => [
                    <b>{item.title}</b>,
                    item.message,
                    <Status value={item.severity} />,
                    item.audience,
                    new Date(item.published_at).toLocaleString(),
                ])}
            />
        </>
    );
}
