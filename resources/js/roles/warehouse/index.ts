import {
    ChartColumn,
    LayoutDashboard,
    Package,
    PackageMinus,
    PackagePlus,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const warehouseRole: RoleModule = {
    id: 'warehouse',
    matches: ({ flags }) => flags.isWarehouseUser,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['procurement', PackagePlus, text('Stock in', 'Entrée de stock'), 'procurement.view'],
        ['incoming-requests', PackageMinus, text('Stock out', 'Sortie de stock'), 'inventory.view'],
        ['inventory', Warehouse, labels.warehouse, 'inventory.view'],
        ['products', Package, labels.products, 'products.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
