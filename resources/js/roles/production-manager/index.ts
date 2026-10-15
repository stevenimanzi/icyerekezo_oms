import { ClipboardCheck, FileText, Gauge, LayoutDashboard, Warehouse, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const productionManagerRole: RoleModule = {
    id: 'production-manager',
    matches: ({ flags }) => flags.isProductionManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Gauge, labels.planning, 'production.view'],
        ['inventory', Warehouse, text('Materials', 'Matières'), 'inventory.view'],
        ['quality', ClipboardCheck, labels.control, 'quality.view'],
        ['machines', Wrench, labels.machines, 'maintenance.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
