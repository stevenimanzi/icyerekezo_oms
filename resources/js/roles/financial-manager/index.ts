import { FileText, LayoutDashboard, PackageOpen, Wallet } from 'lucide-react';
import type { RoleModule } from '../types';

export const financialManagerRole: RoleModule = {
    id: 'financial-manager',
    matches: ({ flags }) => flags.isFinancialManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['finance', Wallet, text('Finance overview', 'Vue financière'), 'finance.view'],
        ['sales', PackageOpen, text('Orders & invoices', 'Commandes et factures'), 'sales.view'],
        ['finance-reports', FileText, text('Financial reports', 'Rapports financiers'), 'reports.view'],
    ],
};
