import { lazy } from 'react';
import type { RoleFlags } from './flags';
import type { HomeComponent } from './types';

const DepartmentDashboard = lazy(() => import('./default/DepartmentDashboard'));
const ExecutiveDashboard = lazy(() => import('./factory-administrator/ExecutiveDashboard'));
const FinancialManagerHome = lazy(() => import('./financial-manager/Home'));
const HrOfficerHome = lazy(() => import('./hr-officer/Home'));
const OwnerDashboard = lazy(() => import('./owner/OwnerDashboard'));
const RoleHome = lazy(() => import('./default/RoleHome'));
const FlowStageHome = lazy(() => import('../pages/production/flow/home/StageHome'));
const FlowManagerHome = lazy(() => import('../pages/production/flow/home/ManagerHome'));
const SafetyOfficerHome = lazy(() => import('./safety-officer/Home'));

export function homeFor(flags: RoleFlags): HomeComponent {
    if (flags.isFactoryOwner) return OwnerDashboard;
    if (flags.isExecutiveUser) return flags.hasProductionFlow ? OwnerDashboard : ExecutiveDashboard;
    if (flags.isFinancialManager) return FinancialManagerHome;
    if (flags.isHrOfficer) return HrOfficerHome;
    if (flags.isSafetyOfficer) return SafetyOfficerHome;
    if (flags.hasProductionFlow) {
        if (
            flags.isCuttingUser ||
            flags.isSewingUser ||
            flags.isFinishingUser ||
            flags.isPackagingUser
        )
            return FlowStageHome;
        if (flags.isProductionManager || flags.isProductionSupervisor || flags.isQualityUser)
            return FlowManagerHome;
    }

    return flags.hasProductionFlow ? RoleHome : DepartmentDashboard;
}
