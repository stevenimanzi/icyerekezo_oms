import { FileText, LayoutDashboard, ShieldCheck, Users, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const safetyOfficerRole: RoleModule = {
    id: 'safety-officer',
    matches: ({ flags }) => flags.isSafetyOfficer,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['safety', ShieldCheck, text('Safety', 'Sécurité'), 'safety.view'],
        ['team', Users, text('Workers', 'Employés'), 'users.view'],
        ['machines', Wrench, text('Machines', 'Machines'), 'maintenance.view'],
        ['reports', FileText, text('Reports', 'Rapports'), 'reports.view'],
    ],
};
