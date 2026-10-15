import { SupportPanel } from '../components/SupportPanel';
import type { AdminContext } from '../useAdminData';

export function SupportScreen({ ctx }: { ctx: AdminContext }) {
    const { records, busy, run } = ctx;
    return (
        <SupportPanel
            records={records}
            busy={busy}
            reply={(id: number, message: string, status: string) =>
                run(`/api/platform/tickets/${id}/reply`, 'POST', { message, status }, 'Reply sent.')
            }
        />
    );
}
