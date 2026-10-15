import { ChartColumn, ClipboardList, LayoutDashboard, Wallet } from 'lucide-react';
import type { RoleModule } from '../types';

export const financialManagerRole: RoleModule = {
    id: 'financial-manager',
    matches: ({ flags }) => flags.isFinancialManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['finance', Wallet, text('Finance', 'Finance'), 'finance.view'],
        ['sales', ClipboardList, text('Orders', 'Commandes'), 'sales.view'],
        [
            'finance-reports',
            ChartColumn,
            text('Finance reports', 'Rapports financiers'),
            'reports.view',
        ],
    ],
};
