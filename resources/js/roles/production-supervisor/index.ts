import { BadgeCheck, ChartColumn, Cog, Factory, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const productionSupervisorRole: RoleModule = {
    id: 'production-supervisor',
    matches: ({ flags }) => flags.isProductionSupervisor,
    nav: (context) => {
        const { labels, text } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['production', Factory, text('Production', 'Production'), 'production.view'],
            ['quality', BadgeCheck, labels.control, 'quality.view'],
            ['machines', Cog, labels.machines, 'maintenance.view'],
            ...productionFlowNav(context),
            ['reports', ChartColumn, labels.reports, 'reports.view'],
        ];
    },
};
