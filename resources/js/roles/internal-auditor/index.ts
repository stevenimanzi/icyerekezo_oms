import {
    BadgeCheck,
    ChartColumn,
    Factory,
    LayoutDashboard,
    ShoppingCart,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const internalAuditorRole: RoleModule = {
    id: 'internal-auditor',
    matches: ({ flags }) => flags.isInternalAuditor,
    nav: (context) => {
        const { labels, text } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
            ['production', Factory, text('Production', 'Production'), 'production.view'],
            ['quality', BadgeCheck, text('Quality', 'Qualité'), 'quality.view'],
            ['procurement', ShoppingCart, text('Purchases', 'Achats'), 'procurement.view'],
            ...productionFlowNav(context),
            ['reports', ChartColumn, text('Reports', 'Rapports'), 'reports.view'],
        ];
    },
};
