import { Boxes, FileText, Gauge, LayoutDashboard, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const productionPlannerRole: RoleModule = {
    id: 'production-planner',
    matches: ({ flags }) => flags.isProductionPlanner,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Gauge, text('Planning', 'Planification'), 'production.view'],
        ['products', Boxes, labels.products, 'products.view'],
        ['inventory', Warehouse, text('Materials', 'Matières'), 'inventory.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
