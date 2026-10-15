import { FileText, LayoutDashboard, Warehouse, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const maintenanceTechnicianRole: RoleModule = {
    id: 'maintenance-technician',
    matches: ({ flags }) => flags.isMaintenanceTechnician,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'machines',
            Wrench,
            text('Maintenance work orders', 'Ordres de maintenance'),
            'maintenance.view',
        ],
        ['inventory', Warehouse, text('Spare parts', 'Pieces de rechange'), 'inventory.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
