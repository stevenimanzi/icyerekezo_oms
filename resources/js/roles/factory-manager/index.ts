import { FileBarChart, Cog, Factory, LayoutDashboard, Truck, Users } from 'lucide-react';
import type { NavItem, RoleModule } from '../types';
import { productionFlowNav } from '../production-flow-nav';

export const factoryManagerRole: RoleModule = {
    id: 'factory-manager',
    matches: ({ flags }) => flags.isFactoryManager,
    nav: (context) => {
        const { labels, text, flags } = context;

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
            ...(flags.isNoguchiFactory
                ? [
                      [
                          'logistics-reports',
                          FileBarChart,
                          text('Delivery report', 'Rapport de livraison'),
                          'reports.view',
                      ] as NavItem,
                  ]
                : [
                      [
                          'logistics',
                          Truck,
                          text('Logistics report', 'Rapport logistique'),
                          'logistics.view',
                      ] as NavItem,
                  ]),
            ...productionFlowNav(context),
            ['reports', FileBarChart, labels.reports, 'reports.view'],
        ];
    },
};
