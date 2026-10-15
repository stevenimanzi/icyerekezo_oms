import { ChartColumn, Factory, LayoutDashboard, Package, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const productionPlannerRole: RoleModule = {
    id: 'production-planner',
    matches: ({ flags }) => flags.isProductionPlanner,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Factory, text('Planning', 'Planification'), 'production.view'],
        ['products', Package, labels.products, 'products.view'],
        ['inventory', Warehouse, text('Materials', 'Matières'), 'inventory.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
