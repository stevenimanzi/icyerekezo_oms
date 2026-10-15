import { Boxes, FileText, Inbox, LayoutDashboard, ShoppingCart, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const warehouseRole: RoleModule = {
    id: 'warehouse',
    matches: ({ flags }) => flags.isWarehouseUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['procurement', ShoppingCart, text('Stock in', 'Entrée de stock'), 'procurement.view'],
        ['incoming-requests', Inbox, text('Stock out', 'Sortie de stock'), 'inventory.view'],
        ['inventory', Warehouse, labels.warehouse, 'inventory.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
