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
import type { RoleModule } from '../types';

export const defaultRole: RoleModule = {
    id: 'default',
    matches: () => true,
    nav: ({ labels }) => [
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
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
