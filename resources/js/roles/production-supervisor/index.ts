import { BadgeCheck, ChartColumn, Cog, Factory, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const productionSupervisorRole: RoleModule = {
    id: 'production-supervisor',
    matches: ({ flags }) => flags.isProductionSupervisor,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Factory, text('Production', 'Production'), 'production.view'],
        ['quality', BadgeCheck, labels.control, 'quality.view'],
        ['machines', Cog, labels.machines, 'maintenance.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
