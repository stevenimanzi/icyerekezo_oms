import { ChartColumn, LayoutDashboard, Sparkles } from 'lucide-react';
import type { RoleModule } from '../types';

export const finishingRole: RoleModule = {
    id: 'finishing',
    matches: ({ flags }) => flags.isNoguchiFactory && flags.isFinishingUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['finishing-workspace', Sparkles, text('Finishing', 'Finition'), 'production.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
