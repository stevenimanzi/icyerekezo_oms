import { ChartColumn, Cog, Factory, LayoutDashboard, Users } from 'lucide-react';
import type { RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const factoryManagerRole: RoleModule = {
    id: 'factory-manager',
    matches: ({ flags }) => flags.isFactoryManager,
    nav: (context) => {
        const { labels, text } = context;

        return [
            ['dashboard', LayoutDashboard, labels.dashboard, '*'],
            [
                'production',
                Factory,
                text('Production setup', 'Réglage production'),
                'production.view',
            ],
            ['team', Users, labels.people, 'users.view'],
            ['machines', Cog, labels.machines, 'maintenance.view'],
            [
                'logistics-reports',
                ChartColumn,
                text('Delivery report', 'Rapport de livraison'),
                'reports.view',
            ],
            ...productionFlowNav(context),
            ['reports', ChartColumn, labels.reports, 'reports.view'],
        ];
    },
};
