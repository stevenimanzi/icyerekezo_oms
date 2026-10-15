import { BadgeCheck, ChartColumn, Cog, Factory, LayoutDashboard, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const productionManagerRole: RoleModule = {
    id: 'production-manager',
    matches: ({ flags }) => flags.isProductionManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Factory, labels.planning, 'production.view'],
        ['inventory', Warehouse, text('Materials', 'Matières'), 'inventory.view'],
        ['quality', BadgeCheck, labels.control, 'quality.view'],
        ['machines', Cog, labels.machines, 'maintenance.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
