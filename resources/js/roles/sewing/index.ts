import { FileText, Gauge, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const sewingRole: RoleModule = {
    id: 'sewing',
    matches: ({ user, flags }) => flags.isNoguchiFactory && user.workspace === 'sewing',
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'sewing-workspace',
            Gauge,
            text('Sewing', 'Couture'),
            'production.view',
        ],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
