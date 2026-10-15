import { FileText, LayoutDashboard, Scissors } from 'lucide-react';
import type { RoleModule } from '../types';

export const cuttingRole: RoleModule = {
    id: 'cutting',
    matches: ({ flags }) => flags.isCuttingUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'cutting-workspace',
            Scissors,
            text('Cutting', 'Coupe'),
            'production.view',
        ],
        ['cutting-report', FileText, text('Report', 'Rapport'), 'production.view'],
    ],
};
