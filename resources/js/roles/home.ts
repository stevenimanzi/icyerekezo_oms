import { lazy } from 'react';
import type { RoleFlags } from './flags';
import type { HomeComponent } from './types';

const DepartmentDashboard = lazy(() => import('./default/DepartmentDashboard'));
const ExecutiveDashboard = lazy(() => import('./factory-administrator/ExecutiveDashboard'));
const FinancialManagerHome = lazy(() => import('./financial-manager/Home'));
const HrOfficerHome = lazy(() => import('./hr-officer/Home'));
const OwnerDashboard = lazy(() => import('./owner/OwnerDashboard'));
const SafetyOfficerHome = lazy(() => import('./safety-officer/Home'));

export function homeFor(flags: RoleFlags): HomeComponent {
    if (flags.isFactoryOwner) return OwnerDashboard;
    if (flags.isExecutiveUser) return ExecutiveDashboard;
    if (flags.isFinancialManager) return FinancialManagerHome;
    if (flags.isHrOfficer) return HrOfficerHome;
    if (flags.isSafetyOfficer) return SafetyOfficerHome;

    return DepartmentDashboard;
}
