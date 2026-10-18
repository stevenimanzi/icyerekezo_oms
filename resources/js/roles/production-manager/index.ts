import {
    BadgeCheck,
    ChartColumn,
    Factory,
    LayoutDashboard,
    Scissors,
    Shirt,
    Warehouse,
    Workflow,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const productionManagerRole: RoleModule = {
    id: 'production-manager',
    matches: ({ flags }) => flags.isProductionManager,
    nav: (context) => {
        const { labels, text } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            ['production-flow', Workflow, text('Production flow', 'Flux de production'), 'production.view'],
            ['cutting-workspace', Scissors, text('Cutting lines', 'Lignes de coupe'), 'production.view'],
            ['sewing-workspace', Shirt, text('Sewing lines', 'Lignes de couture'), 'production.view'],
            ['production', Factory, labels.planning, 'production.view'],
            ['quality', BadgeCheck, labels.control, 'quality.view'],
            ['reports', ChartColumn, labels.reports, 'reports.view'],
            ['inventory', Warehouse, text('Materials', 'Matières'), 'inventory.view'],
        ];
    },
};
