import { BadgeCheck, ChartColumn, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const qualityManagerRole: RoleModule = {
    id: 'quality-manager',
    matches: ({ flags }) => flags.isQualityManager,
    nav: (context) => {
        const { labels, text } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['quality', BadgeCheck, text('Quality', 'Qualité'), 'quality.view'],
            ...productionFlowNav(context),
            ['reports', ChartColumn, labels.reports, 'reports.view'],
        ];
    },
};
