import { ClipboardCheck, FileText, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const qualityManagerRole: RoleModule = {
    id: 'quality-manager',
    matches: ({ flags }) => flags.isQualityManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'quality',
            ClipboardCheck,
            text('Quality management', 'Gestion de la qualite'),
            'quality.view',
        ],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
