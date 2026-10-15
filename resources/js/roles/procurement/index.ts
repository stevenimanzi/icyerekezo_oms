import { ChartColumn, LayoutDashboard, Package, ShoppingCart, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const procurementRole: RoleModule = {
    id: 'procurement',
    matches: ({ flags }) => flags.isProcurementUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['procurement', ShoppingCart, labels.procurement, 'procurement.view'],
        ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
        ['products', Package, labels.products, 'products.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
