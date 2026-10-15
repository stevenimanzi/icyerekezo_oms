import {
    BadgeCheck,
    ChartColumn,
    Factory,
    History,
    LayoutDashboard,
    ShoppingCart,
    TrendingUp,
    Truck,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const ownerRole: RoleModule = {
    id: 'owner',
    matches: ({ flags }) => flags.isFactoryOwner,
    nav: ({ text }) => [
        ['dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
        ['activity', History, text('Activity', 'Activité'), 'audit.view'],
        ['procurement', ShoppingCart, text('Purchases', 'Achats'), 'procurement.view'],
        ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
        ['production', Factory, text('Production', 'Production'), 'production.view'],
        ['quality', BadgeCheck, text('Quality', 'Qualité'), 'quality.view'],
        ['sales', TrendingUp, text('Sales & Marketing', 'Ventes et marketing'), 'sales.view'],
        ['logistics', Truck, text('Deliveries', 'Livraisons'), 'logistics.view'],
        [
            'logistics-reports',
            ChartColumn,
            text('Delivery report', 'Rapport de livraison'),
            'reports.view',
        ],
        ['reports', ChartColumn, text('Reports', 'Rapports'), 'reports.view'],
    ],
};
