import { ClipboardCheck, FileText, Gauge, LayoutDashboard, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const productionSupervisorRole: RoleModule = {
    id: 'production-supervisor',
    matches: ({ flags }) => flags.isProductionSupervisor,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'production',
            Gauge,
            text('Production', 'Production'),
            'production.view',
        ],
        ['quality', ClipboardCheck, labels.control, 'quality.view'],
        ['machines', Wrench, labels.machines, 'maintenance.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
