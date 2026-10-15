import { Boxes, FileText, LayoutDashboard, PackageOpen, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const salesRole: RoleModule = {
    id: 'sales',
    matches: ({ flags }) => flags.isSalesUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['sales', PackageOpen, labels.sales, 'sales.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
