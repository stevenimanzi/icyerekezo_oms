import SystemSettingsPanel from '../components/SystemSettingsPanel';
import type { AdminContext } from '../useAdminData';

export function SettingsScreen({ ctx }: { ctx: AdminContext }) {
    const { data, busy, run, uploadLogo } = ctx;
    return (
        <SystemSettingsPanel
            settings={data || {}}
            editing={true}
            busy={busy}
            uploadLogo={uploadLogo}
            submit={async (values: any) => {
                await run('/api/platform/settings', 'PUT', values, 'System configuration updated.');
                window.setTimeout(() => window.location.reload(), 500);
            }}
        />
    );
}
