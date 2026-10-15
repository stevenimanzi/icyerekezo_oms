import { ChartColumn, LayoutDashboard, PackageCheck } from 'lucide-react';
import type { RoleModule } from '../types';

export const packingRole: RoleModule = {
    id: 'packing',
    matches: ({ flags }) => flags.isNoguchiFactory && flags.isPackagingUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['packing-workspace', PackageCheck, text('Packing', 'Emballage'), 'production.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
