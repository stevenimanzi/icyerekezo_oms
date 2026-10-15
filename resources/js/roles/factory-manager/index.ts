import { FileText, Gauge, LayoutDashboard, Truck, Users, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const factoryManagerRole: RoleModule = {
    id: 'factory-manager',
    matches: ({ flags }) => flags.isFactoryManager,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Gauge, text('Production setup', 'Réglage production'), 'production.view'],
        ['team', Users, labels.people, 'users.view'],
        ['machines', Wrench, labels.machines, 'maintenance.view'],
        [
            'logistics-reports',
            Truck,
            text('Delivery report', 'Rapport de livraison'),
            'reports.view',
        ],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
