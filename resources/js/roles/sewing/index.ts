import { ChartColumn, LayoutDashboard, Shirt } from 'lucide-react';
import type { RoleModule } from '../types';

export const sewingRole: RoleModule = {
    id: 'sewing',
    matches: ({ user, flags }) => flags.isNoguchiFactory && user.workspace === 'sewing',
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['sewing-workspace', Shirt, text('Sewing', 'Couture'), 'production.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
