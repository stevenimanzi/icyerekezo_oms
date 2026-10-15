import { ChartColumn, Cog, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import type { RoleModule } from '../types';

export const safetyOfficerRole: RoleModule = {
    id: 'safety-officer',
    matches: ({ flags }) => flags.isSafetyOfficer,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['safety', ShieldCheck, text('Safety', 'Sécurité'), 'safety.view'],
        ['team', Users, text('Workers', 'Employés'), 'users.view'],
        ['machines', Cog, text('Machines', 'Machines'), 'maintenance.view'],
        ['reports', ChartColumn, text('Reports', 'Rapports'), 'reports.view'],
    ],
};
