import {
    BadgeCheck,
    ChartColumn,
    Factory,
    LayoutDashboard,
    ShoppingCart,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const internalAuditorRole: RoleModule = {
    id: 'internal-auditor',
    matches: ({ flags }) => flags.isInternalAuditor,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
        ['production', Factory, text('Production', 'Production'), 'production.view'],
        ['quality', BadgeCheck, text('Quality', 'Qualité'), 'quality.view'],
        ['procurement', ShoppingCart, text('Purchases', 'Achats'), 'procurement.view'],
        ['reports', ChartColumn, text('Reports', 'Rapports'), 'reports.view'],
    ],
};
