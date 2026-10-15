import { ChartColumn, LayoutDashboard, Warehouse, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const maintenanceTechnicianRole: RoleModule = {
    id: 'maintenance-technician',
    matches: ({ flags }) => flags.isMaintenanceTechnician,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['machines', Wrench, text('Repairs', 'Réparations'), 'maintenance.view'],
        ['inventory', Warehouse, text('Spare parts', 'Pièces de rechange'), 'inventory.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
