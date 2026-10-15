import { FileText, Gauge, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const finishingRole: RoleModule = {
    id: 'finishing',
    matches: ({ flags }) => flags.isNoguchiFactory && flags.isFinishingUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['finishing-workspace', Gauge, text('Record finishing', 'Enregistrer la finition'), 'production.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
