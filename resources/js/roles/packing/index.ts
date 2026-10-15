import { FileText, Gauge, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const packingRole: RoleModule = {
    id: 'packing',
    matches: ({ flags }) => flags.isNoguchiFactory && flags.isPackagingUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['packing-workspace', Gauge, text('Record packing', "Enregistrer l'emballage"), 'production.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
