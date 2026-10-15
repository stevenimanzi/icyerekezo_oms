import { BadgeCheck, Cog, Factory, LayoutDashboard } from 'lucide-react';
import type { RoleModule } from '../types';

export const machineOperatorRole: RoleModule = {
    id: 'machine-operator',
    matches: ({ flags }) => flags.isMachineOperator,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['production', Factory, labels.planning, 'production.view'],
        ['quality', BadgeCheck, labels.control, 'quality.view'],
        ['machines', Cog, labels.machines, 'maintenance.view'],
    ],
};
