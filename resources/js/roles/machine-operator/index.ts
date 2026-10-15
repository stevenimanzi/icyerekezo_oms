import { ClipboardCheck, Gauge, LayoutDashboard, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const machineOperatorRole: RoleModule = {
    id: 'machine-operator',
    matches: ({ flags }) => flags.isMachineOperator,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Gauge, labels.planning, 'production.view'],
        ['quality', ClipboardCheck, labels.control, 'quality.view'],
        ['machines', Wrench, labels.machines, 'maintenance.view'],
    ],
};
