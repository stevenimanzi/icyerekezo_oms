import DepartmentDashboard from './default/DepartmentDashboard';
import ExecutiveDashboard from './factory-administrator/ExecutiveDashboard';
import FinancialManagerHome from './financial-manager/Home';
import type { RoleFlags } from './flags';
import HrOfficerHome from './hr-officer/Home';
import OwnerDashboard from './owner/OwnerDashboard';
import SafetyOfficerHome from './safety-officer/Home';
import type { HomeComponent } from './types';

export function homeFor(flags: RoleFlags): HomeComponent {
    if (flags.isFactoryOwner) return OwnerDashboard;
    if (flags.isExecutiveUser) return ExecutiveDashboard;
    if (flags.isFinancialManager) return FinancialManagerHome;
    if (flags.isHrOfficer) return HrOfficerHome;
    if (flags.isSafetyOfficer) return SafetyOfficerHome;

    return DepartmentDashboard;
}
