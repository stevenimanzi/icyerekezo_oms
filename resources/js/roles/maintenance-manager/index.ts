import { maintenanceNav } from '../maintenance-technician';
import type { RoleModule } from '../types';

/** The person responsible for machines and maintenance. */
export const maintenanceManagerRole: RoleModule = {
    id: 'maintenance-manager',
    matches: ({ flags }) => flags.isMaintenanceManager,
    nav: maintenanceNav,
};
