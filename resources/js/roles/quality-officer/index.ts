import { BadgeCheck, ChartColumn, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const qualityOfficerRole: RoleModule = {
    id: 'quality-officer',
    matches: ({ flags }) => flags.isQualityUser,
    nav: (context) => {
        const { labels } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['quality', BadgeCheck, labels.control, 'quality.view'],
            ...productionFlowNav(context),
            ['reports', ChartColumn, labels.reports, 'reports.view'],
        ];
    },
};
