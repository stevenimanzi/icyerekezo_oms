import { ClipboardCheck, FileText, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const qualityOfficerRole: RoleModule = {
    id: 'quality-officer',
    matches: ({ flags }) => flags.isQualityUser,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['quality', ClipboardCheck, labels.control, 'quality.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
