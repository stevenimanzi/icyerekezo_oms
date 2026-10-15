import {
    Activity,
    ClipboardCheck,
    FileText,
    Gauge,
    LayoutDashboard,
    PackageOpen,
    ShoppingCart,
    Truck,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const ownerRole: RoleModule = {
    id: 'owner',
    matches: ({ flags }) => flags.isFactoryOwner,
    nav: ({ text }) => [
        ['dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
        ['activity', Activity, text('Activity', 'Activité'), 'audit.view'],
        [
            'procurement',
            ShoppingCart,
            text('Purchases', 'Achats'),
            'procurement.view',
        ],
        ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
        [
            'production',
            Gauge,
            text('Production', 'Production'),
            'production.view',
        ],
        ['quality', ClipboardCheck, text('Quality', 'Qualité'), 'quality.view'],
        ['sales', PackageOpen, text('Sales', 'Ventes'), 'sales.view'],
        ['logistics', Truck, text('Deliveries', 'Livraisons'), 'logistics.view'],
        [
            'logistics-reports',
            Truck,
            text('Delivery report', 'Rapport de livraison'),
            'reports.view',
        ],
        ['reports', FileText, text('Reports', 'Rapports'), 'reports.view'],
    ],
};
