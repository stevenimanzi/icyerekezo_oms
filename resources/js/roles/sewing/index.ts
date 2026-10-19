import { ChartColumn, LayoutDashboard, Shirt } from 'lucide-react';
import type { RoleModule } from '../types';
import { requestMaterialsNav } from '../production-flow-nav';

export const sewingRole: RoleModule = {
    id: 'sewing',
    matches: ({ flags }) => flags.isSewingUser,
    nav: (context) => [
        ['dashboard', LayoutDashboard, context.labels.dashboard, '*'],
        ['sewing-workspace', Shirt, context.text('Sewing', 'Couture'), 'production.view'],
        ...requestMaterialsNav('sewing', context),
        ['sewing-report', ChartColumn, context.text('Report', 'Rapport'), 'production.view'],
    ],
};
