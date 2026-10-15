import { ChartColumn, Cog, Factory, LayoutDashboard, Users } from 'lucide-react';
import type { RoleModule } from '../types';

export const factoryManagerRole: RoleModule = {
    id: 'factory-manager',
    matches: ({ flags }) => flags.isFactoryManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Factory, text('Production setup', 'Réglage production'), 'production.view'],
        ['team', Users, labels.people, 'users.view'],
        ['machines', Cog, labels.machines, 'maintenance.view'],
        [
            'logistics-reports',
            ChartColumn,
            text('Delivery report', 'Rapport de livraison'),
            'reports.view',
        ],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
