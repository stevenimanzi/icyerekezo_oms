import { BadgeCheck, ChartColumn, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const qualityOfficerRole: RoleModule = {
    id: 'quality-officer',
    matches: ({ flags }) => flags.isQualityUser,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['quality', BadgeCheck, labels.control, 'quality.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
