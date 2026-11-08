import { BadgeCheck, FileBarChart, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const qualityOfficerRole: RoleModule = {
    id: 'quality-officer',
    matches: ({ flags }) => flags.isQualityUser,
    nav: (context) => {
        const { labels } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['quality', BadgeCheck, labels.control, 'quality.view'],
            ['reports', FileBarChart, labels.reports, 'reports.view'],
        ];
    },
};
