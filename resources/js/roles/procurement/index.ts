import { Boxes, FileText, LayoutDashboard, ShoppingCart, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const procurementRole: RoleModule = {
    id: 'procurement',
    matches: ({ flags }) => flags.isProcurementUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['procurement', ShoppingCart, labels.procurement, 'procurement.view'],
        ['inventory', Warehouse, text('Stock levels', 'Niveaux de stock'), 'inventory.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
