import { BadgeCheck, ChartColumn, Cog, Factory, LayoutDashboard, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const productionManagerRole: RoleModule = {
    id: 'production-manager',
    matches: ({ flags }) => flags.isProductionManager,
    nav: (context) => {
        const { labels, text } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['production', Factory, labels.planning, 'production.view'],
            ['inventory', Warehouse, text('Materials', 'Matières'), 'inventory.view'],
            ['quality', BadgeCheck, labels.control, 'quality.view'],
            ['machines', Cog, labels.machines, 'maintenance.view'],
            ...productionFlowNav(context),
            ['reports', ChartColumn, labels.reports, 'reports.view'],
        ];
    },
};
