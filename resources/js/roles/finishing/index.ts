import { ChartColumn, LayoutDashboard, Sparkles } from 'lucide-react';
import type { RoleModule } from '../types';
import { requestMaterialsNav } from '../production-flow-nav';

export const finishingRole: RoleModule = {
    id: 'finishing',
    matches: ({ flags }) => flags.isFinishingUser,
    nav: (context) => [
        ['dashboard', LayoutDashboard, context.labels.dashboard, '*'],
        ['finishing-workspace', Sparkles, context.text('Finishing', 'Finition'), 'production.view'],
        ...requestMaterialsNav('finishing', context),
        ['finishing-report', ChartColumn, context.text('Report', 'Rapport'), 'production.view'],
    ],
};
