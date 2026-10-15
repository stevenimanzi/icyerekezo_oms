import { BadgeCheck, ChartColumn, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const qualityManagerRole: RoleModule = {
    id: 'quality-manager',
    matches: ({ flags }) => flags.isQualityManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['quality', BadgeCheck, text('Quality', 'Qualité'), 'quality.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
