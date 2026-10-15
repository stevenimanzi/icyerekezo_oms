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
            text('Incoming requests', 'Demandes entrantes'),
            'inventory.view',
        ],
        ['inventory', Warehouse, labels.warehouse, 'inventory.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['procurement', ShoppingCart, text('Incoming goods', 'Réceptions'), 'procurement.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};

export const warehouseNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    stock: {
        label: text('Stock Management', 'Gestion de stock'),
        icon: Warehouse,
        children: ['incoming-requests', 'inventory', 'products'],
    },
});
