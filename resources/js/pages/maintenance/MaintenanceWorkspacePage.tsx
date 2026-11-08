import ProblemsView from './views/ProblemsView';
import DashboardView from './views/DashboardView';
import MachinesView from './views/MachinesView';
import PerformanceView from './views/PerformanceView';
import ReportsView from './views/ReportsView';
import ScheduleView from './views/ScheduleView';
import type { MtView } from './mtKit';

/** One entry point for every machines and maintenance screen; the sidebar picks the view. */
export default function MaintenanceWorkspacePage({
    view,
    can,
    onNavigate,
}: {
    view: MtView;
    can: (permission: string) => boolean;
    onNavigate?: (page: string) => void;
}) {
    const props = { can, onNavigate };
    switch (view) {
        case 'machines':
            return <MachinesView {...props} />;
        case 'problems':
            return <ProblemsView {...props} />;
        case 'performance':
            return <PerformanceView {...props} />;
        case 'schedule':
            return <ScheduleView {...props} />;
        case 'reports':
            return <ReportsView {...props} />;
        default:
            return <DashboardView {...props} />;
    }
}
