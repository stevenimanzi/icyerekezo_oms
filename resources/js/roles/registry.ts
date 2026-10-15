import type { Labels } from '../core/labels';
import type { AuthUser, Locale } from '../core/types';
import { accountantRole } from './accountant';
import { cuttingRole } from './cutting';
import { defaultRole } from './default';
import { executiveNavGroups, factoryAdministratorRole } from './factory-administrator';
import { factoryManagerRole } from './factory-manager';
import { financialManagerRole } from './financial-manager';
import { finishingRole } from './finishing';
import { getRoleFlags } from './flags';
import { hrOfficerRole } from './hr-officer';
import { internalAuditorRole } from './internal-auditor';
import { logisticsNavGroups, logisticsRole } from './logistics';
import { machineOperatorRole } from './machine-operator';
import { maintenanceTechnicianRole } from './maintenance-technician';
import { ownerRole } from './owner';
import { packingRole } from './packing';
import { platformAdminRole } from './platform-admin';
import { procurementRole } from './procurement';
import { productionManagerRole } from './production-manager';
import { productionPlannerRole } from './production-planner';
import { productionSupervisorRole } from './production-supervisor';
import { qualityManagerRole } from './quality-manager';
import { qualityOfficerRole } from './quality-officer';
import { safetyOfficerRole } from './safety-officer';
import { salesRole } from './sales';
import { schoolNavGroups, schoolRole } from './school';
import { sewingRole } from './sewing';
import type { NavGroup, NavItem, RoleContext, RoleModule } from './types';
import { warehouseNavGroups, warehouseRole } from './warehouse';

export const ROLES: RoleModule[] = [
    platformAdminRole,
    ownerRole,
    factoryAdministratorRole,
    factoryManagerRole,
    financialManagerRole,
    productionPlannerRole,
    productionSupervisorRole,
    maintenanceTechnicianRole,
    qualityManagerRole,
    hrOfficerRole,
    safetyOfficerRole,
    internalAuditorRole,
    productionManagerRole,
    cuttingRole,
    sewingRole,
    finishingRole,
    packingRole,
    machineOperatorRole,
    warehouseRole,
    procurementRole,
    qualityOfficerRole,
    schoolRole,
    logisticsRole,
    salesRole,
    accountantRole,
    defaultRole,
];

export function buildRoleContext(user: AuthUser, locale: Locale, labels: Labels): RoleContext {
    return {
        user,
        locale,
        labels,
        flags: getRoleFlags(user),
        text: (en, fr) => (locale === 'en' ? en : fr),
    };
}

export function resolveRole(context: RoleContext): RoleModule {
    return ROLES.find((role) => role.matches(context)) ?? defaultRole;
}

export function navFor(context: RoleContext): NavItem[] {
    return resolveRole(context).nav(context);
}

export function navGroupsFor(context: RoleContext): Record<string, NavGroup> {
    const { flags } = context;

    if (flags.isSchoolUser) return schoolNavGroups(context);
    if (flags.isWarehouseUser) return warehouseNavGroups(context);
    if (flags.isLogisticsUser && !flags.isNoguchiFactory) return logisticsNavGroups(context);
    if (flags.isFactoryAdmin || flags.isFactoryOwner) return executiveNavGroups(context);

    return {};
}
