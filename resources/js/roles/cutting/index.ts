import { ChartColumn, LayoutDashboard, Scissors } from 'lucide-react';
import type { RoleModule } from '../types';
import { requestMaterialsNav } from '../production-flow-nav';

export const cuttingRole: RoleModule = {
    id: 'cutting',
    matches: ({ flags }) => flags.isCuttingUser,
    nav: (context) => [
        ['dashboard', LayoutDashboard, context.labels.dashboard, '*'],
        ['cutting-workspace', Scissors, context.text('Cutting', 'Coupe'), 'production.view'],
        ...requestMaterialsNav('cutting', context),
        ['cutting-report', ChartColumn, context.text('Report', 'Rapport'), 'production.view'],
    ],
};
