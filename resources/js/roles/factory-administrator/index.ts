import {
    Boxes,
    ClipboardCheck,
    FileText,
    Gauge,
    LayoutDashboard,
    PackageOpen,
    ShoppingCart,
    Truck,
    Users,
    Warehouse,
    Wrench,
} from 'lucide-react';
import type { NavGroup, RoleContext, RoleModule } from '../types';

export const factoryAdministratorRole: RoleModule = {
    id: 'factory-administrator',
    matches: ({ flags }) => flags.isFactoryAdmin,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['procurement', ShoppingCart, labels.procurement, 'procurement.view'],
        ['inventory', Warehouse, labels.warehouse, 'inventory.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['production', Gauge, labels.planning, 'production.view'],
        ['quality', ClipboardCheck, labels.control, 'quality.view'],
        ['sales', PackageOpen, labels.sales, 'sales.view'],
        ['logistics', Truck, labels.logistics, 'logistics.view'],
        ['team', Users, labels.people, 'users.view'],
        ['machines', Wrench, labels.machines, 'maintenance.view'],
        [
            'logistics-reports',
            Truck,
            text('Delivery report', 'Rapport de livraison'),
            'reports.view',
        ],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};

export const executiveNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    supply: {
        label: text('Buying & stock', 'Achats et stock'),
        icon: ShoppingCart,
        children: ['procurement', 'inventory', 'products'],
    },
    operations: {
        label: text('Factory work', 'Travail en usine'),
        icon: Gauge,
        children: ['production', 'quality', 'machines'],
    },
    commercial: {
        label: text('Commercial', 'Commercial'),
        icon: PackageOpen,
        children: ['sales', 'logistics'],
    },
});
