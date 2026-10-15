import { FileText, LayoutDashboard, PackageOpen, Wallet } from 'lucide-react';
import type { RoleModule } from '../types';

export const financialManagerRole: RoleModule = {
    id: 'financial-manager',
    matches: ({ flags }) => flags.isFinancialManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['finance', Wallet, text('Finance', 'Finance'), 'finance.view'],
        ['sales', PackageOpen, text('Orders', 'Commandes'), 'sales.view'],
        [
            'finance-reports',
            FileText,
            text('Finance reports', 'Rapports financiers'),
            'reports.view',
        ],
    ],
};
