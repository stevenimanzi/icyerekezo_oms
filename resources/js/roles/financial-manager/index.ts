import { ChartColumn, LayoutDashboard, TrendingUp, Wallet } from 'lucide-react';
import type { RoleModule } from '../types';

export const financialManagerRole: RoleModule = {
    id: 'financial-manager',
    matches: ({ flags }) => flags.isFinancialManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, text('Finance & Sales', 'Finance et Ventes'), '*'],
        ['finance', Wallet, text('Finance & Collections', 'Finance et recouvrement'), 'finance.view'],
        ['sales', TrendingUp, text('Orders & Invoices', 'Commandes et factures'), 'sales.view'],
        [
            'finance-reports',
            ChartColumn,
            text('Finance reports', 'Rapports financiers'),
            'reports.view',
        ],
    ],
};
