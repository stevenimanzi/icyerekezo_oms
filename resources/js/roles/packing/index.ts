import { ChartColumn, LayoutDashboard, PackageCheck } from 'lucide-react';
import type { RoleModule } from '../types';
import { requestMaterialsNav } from '../production-flow-nav';

export const packingRole: RoleModule = {
    id: 'packing',
    matches: ({ flags }) => flags.isPackagingUser,
    nav: (context) => [
        ['dashboard', LayoutDashboard, context.labels.dashboard, '*'],
        [
            'packing-workspace',
            PackageCheck,
            context.text('Packing', 'Emballage'),
            'production.view',
        ],
        ...requestMaterialsNav('packing', context),
        ['packing-report', ChartColumn, context.text('Report', 'Rapport'), 'production.view'],
    ],
};
