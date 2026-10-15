import { Boxes, FileText, Inbox, LayoutDashboard, ShoppingCart, Warehouse } from 'lucide-react';
import type { NavGroup, RoleContext, RoleModule } from '../types';

export const warehouseRole: RoleModule = {
    id: 'warehouse',
    matches: ({ flags }) => flags.isWarehouseUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'incoming-requests',
            Inbox,
            text('Stock out', 'Sortie de stock'),
            'inventory.view',
        ],
        ['inventory', Warehouse, labels.warehouse, 'inventory.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['procurement', ShoppingCart, text('Stock in', 'Entrée de stock'), 'procurement.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};

export const warehouseNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    stock: {
        label: text('Stock', 'Stock'),
        icon: Warehouse,
        children: ['incoming-requests', 'inventory', 'products'],
    },
});
