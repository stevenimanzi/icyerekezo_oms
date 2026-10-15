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
import type { RoleModule } from '../types';

export const defaultRole: RoleModule = {
    id: 'default',
    matches: () => true,
    nav: ({ labels }) => [
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
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
