import { Activity, AlertTriangle, CalendarClock, Cog, FileBarChart, LayoutDashboard, Warehouse } from 'lucide-react';
import type { NavItem, RoleContext, RoleModule } from '../types';

/** The sidebar of everyone who looks after the machines. */
export const maintenanceNav = ({ labels, text }: RoleContext): NavItem[] => [
    ['dashboard', LayoutDashboard, labels.dashboard, '*'],
    ['machines', Cog, text('Machines', 'Machines'), 'maintenance.view'],
    ['maint-problems', AlertTriangle, text('Problems and repairs', 'Pannes et réparations'), 'maintenance.view'],
    ['maint-performance', Activity, text('Machine performance', 'Performance des machines'), 'maintenance.view'],
    ['maint-schedule', CalendarClock, text('Service plan', 'Plan d\'entretien'), 'maintenance.view'],
    ['inventory', Warehouse, text('Spare parts', 'Pièces de rechange'), 'inventory.view'],
    ['reports', FileBarChart, text('Reports', 'Rapports'), 'reports.view'],
];

export const maintenanceTechnicianRole: RoleModule = {
    id: 'maintenance-technician',
    matches: ({ flags }) => flags.isMaintenanceTechnician,
    nav: maintenanceNav,
};
