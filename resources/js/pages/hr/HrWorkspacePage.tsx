import AttendanceView from './views/AttendanceView';
import DashboardView from './views/DashboardView';
import EmployeesView from './views/EmployeesView';
import LeaveView from './views/LeaveView';
import OvertimeView from './views/OvertimeView';
import PayrollView from './views/PayrollView';
import HrOverviewPage from './HrOverviewPage';
import type { HrView } from './hrKit';

/** One entry point for every human-resources screen; the sidebar picks the view. */
export default function HrWorkspacePage({ view, onNavigate }: { view: HrView; onNavigate?: (page: string) => void }) {
    switch (view) {
        case 'employees':
            return <EmployeesView />;
        case 'attendance':
            return <AttendanceView />;
        case 'leave':
            return <LeaveView />;
        case 'overtime':
            return <OvertimeView />;
        case 'payroll':
            return <PayrollView />;
        case 'training':
            return <HrOverviewPage only="training" />;
        default:
            return <DashboardView onNavigate={onNavigate} />;
    }
}
