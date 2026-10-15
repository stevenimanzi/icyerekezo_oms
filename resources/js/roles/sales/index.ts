import { ChartColumn, LayoutDashboard, Package, TrendingUp, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const salesRole: RoleModule = {
    id: 'sales',
    matches: ({ flags }) => flags.isSalesUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['sales', TrendingUp, labels.sales, 'sales.view'],
        ['products', Package, labels.products, 'products.view'],
        ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
