import { FileText, LayoutDashboard, ShieldCheck, Users, Wrench } from 'lucide-react';
import type { RoleModule } from '../types';

export const safetyOfficerRole: RoleModule = {
    id: 'safety-officer',
    matches: ({ flags }) => flags.isSafetyOfficer,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['safety', ShieldCheck, text('Health and safety', 'Sante et securite'), 'safety.view'],
        ['team', Users, text('Workers and training', 'Personnel et formation'), 'users.view'],
        ['machines', Wrench, text('Equipment safety', 'Securite des equipements'), 'maintenance.view'],
        ['reports', FileText, text('Compliance reports', 'Rapports de conformite'), 'reports.view'],
    ],
};
