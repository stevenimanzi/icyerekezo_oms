import {
    BadgeCheck,
    FileBarChart,
    Factory,
    History,
    LayoutDashboard,
    ShoppingCart,
    TrendingUp,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const ownerRole: RoleModule = {
    id: 'owner',
    matches: ({ flags }) => flags.isFactoryOwner,
    nav: (context) => {
        const { text } = context;

        return [
            ['dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
            ['activity', History, text('Activity', 'Activité'), 'audit.view'],
            ['procurement', ShoppingCart, text('Purchases', 'Achats'), 'procurement.view'],
            ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
            ['production', Factory, text('Production', 'Production'), 'production.view'],
            ['quality', BadgeCheck, text('Quality', 'Qualité'), 'quality.view'],
            ['sales', TrendingUp, text('Sales & Marketing', 'Ventes et marketing'), 'sales.view'],
            ['logistics', Truck, text('Deliveries', 'Livraisons'), 'logistics.view'],
            ...(context.flags.isNoguchiFactory
                ? [
                      [
                          'logistics-reports',
                          FileBarChart,
                          text('Delivery report', 'Rapport de livraison'),
                          'reports.view',
                      ] as NavItem,
                  ]
                : []),
            ['team', Users, text('Team', 'Équipe'), 'users.view'],
            ...productionFlowNav(context),
            ['reports', FileBarChart, text('Reports', 'Rapports'), 'reports.view'],
        ];
    },
};
