import type { AuthUser } from '../core/types';

const SPECIALIZED_OPERATOR_ROLES = [
    'sewing-operator',
    'finishing-manager',
    'mixing-operator',
    'processing-operator',
    'bottling-operator',
    'packaging-operator',
    'machine-operator',
];

const OPERATOR_WORKSPACES = ['workstation', 'sewing', 'finishing', 'mixing', 'processing', 'bottling', 'packaging'];

export function getRoleFlags(user: AuthUser) {
    const hasRole = (slug: string) => user.roles.some((role) => role.slug === slug);
    const inWorkspaceOrRole = (workspace: string, slug: string) => user.workspace === workspace || hasRole(slug);

    const jobTitle = user.employee_profile?.job_title?.toLowerCase() ?? '';

    return {
        isExecutiveUser:
            user.is_platform_admin ||
            user.workspace === 'executive' ||
            user.roles.some((role) => ['factory-owner', 'factory-administrator', 'factory-manager'].includes(role.slug)),
        isFactoryOwner: hasRole('factory-owner'),
        isFactoryAdmin: hasRole('factory-administrator'),
        isFactoryManager: hasRole('factory-manager'),
        isFinancialManager: hasRole('financial-manager'),
        isProductionPlanner: hasRole('production-planner'),
        isProductionSupervisor: hasRole('production-supervisor'),
        isMaintenanceTechnician: hasRole('maintenance-technician'),
        isQualityManager: hasRole('quality-manager'),
        isHrOfficer: hasRole('hr-officer'),
        isSafetyOfficer: hasRole('health-safety-officer'),
        isInternalAuditor: hasRole('internal-auditor'),
        isProductionManager: inWorkspaceOrRole('production', 'production-manager'),
        isCuttingUser: inWorkspaceOrRole('cutting', 'cutting-operator'),
        isFinishingUser: inWorkspaceOrRole('finishing', 'finishing-manager'),
        isPackagingUser:
            user.workspace === 'packaging' ||
            user.workspace === 'packing' ||
            user.roles.some((role) => role.slug === 'packing-manager' || role.slug === 'packaging-operator'),
        isMachineOperator:
            OPERATOR_WORKSPACES.includes(user.workspace) ||
            user.roles.some((role) => SPECIALIZED_OPERATOR_ROLES.includes(role.slug)),
        isWarehouseUser: inWorkspaceOrRole('warehouse', 'warehouse-keeper'),
        isProcurementUser: inWorkspaceOrRole('procurement', 'procurement-officer'),
        isQualityUser:
            user.workspace === 'quality' ||
            user.roles.some((role) => role.slug?.includes('quality') || role.name?.toLowerCase().includes('quality')) ||
            Boolean(jobTitle && jobTitle.includes('quality')) ||
            user.name.includes('Quality Control Manager'),
        isSchoolUser: user.workspace === 'school' || hasRole('school-user'),
        isLogisticsUser: inWorkspaceOrRole('logistics', 'logistics-officer'),
        isSalesUser: inWorkspaceOrRole('sales', 'sales-officer'),
        isFinanceUser: inWorkspaceOrRole('finance', 'accountant'),
        isNoguchiFactory: user.current_factory?.name?.trim().toLowerCase() === 'noguchi holdings ltd',
    };
}

export type RoleFlags = ReturnType<typeof getRoleFlags>;
