import {
    BadgeCheck,
    ChartColumn,
    Cog,
    Factory,
    LayoutDashboard,
    Package,
    ShoppingCart,
    TrendingUp,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';
import type { NavGroup, RoleContext, RoleModule } from '../types';

export const factoryAdministratorRole: RoleModule = {
    id: 'factory-administrator',
    matches: ({ flags }) => flags.isFactoryAdmin,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['procurement', ShoppingCart, labels.procurement, 'procurement.view'],
        ['inventory', Warehouse, labels.warehouse, 'inventory.view'],
        ['products', Package, labels.products, 'products.view'],
        ['production', Factory, labels.planning, 'production.view'],
        ['quality', BadgeCheck, labels.control, 'quality.view'],
        ['sales', TrendingUp, labels.sales, 'sales.view'],
        ['logistics', Truck, labels.logistics, 'logistics.view'],
        ['team', Users, labels.people, 'users.view'],
        ['machines', Cog, labels.machines, 'maintenance.view'],
        [
            'logistics-reports',
            ChartColumn,
            text('Delivery report', 'Rapport de livraison'),
            'reports.view',
        ],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};

export const executiveNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    supply: {
        label: text('Buying & stock', 'Achats et stock'),
        icon: Warehouse,
        children: ['procurement', 'inventory', 'products'],
    },
    operations: {
        label: text('Factory work', 'Travail en usine'),
        icon: Factory,
        children: ['production', 'quality', 'machines'],
    },
    commercial: {
        label: text('Selling', 'Vente'),
        icon: TrendingUp,
        children: ['sales', 'logistics'],
    },
});
