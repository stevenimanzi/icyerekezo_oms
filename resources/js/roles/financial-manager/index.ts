import { ChartColumn, LayoutDashboard, Package, TrendingUp, Wallet, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const financialManagerRole: RoleModule = {
    id: 'financial-manager',
    matches: ({ flags }) => flags.isFinancialManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, text('Finance & Sales', 'Finance et Ventes'), '*'],
        ['sales', TrendingUp, text('Orders & Invoices', 'Commandes et factures'), 'sales.view'],
        ['finance', Wallet, text('Finance & Collections', 'Finance et recouvrement'), 'finance.view'],
        ['products', Package, text('Products & Prices', 'Produits et prix'), 'products.view'],
        ['inventory', Warehouse, text('Stock Available', 'Stock disponible'), 'inventory.view'],
        [
            'finance-reports',
            ChartColumn,
            text('Finance reports', 'Rapports financiers'),
            'reports.view',
        ],
        ['reports', ChartColumn, text('Sales & Stock reports', 'Rapports ventes et stock'), 'reports.view'],
    ],
};
