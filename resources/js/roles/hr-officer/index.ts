import { Activity, FileText, LayoutDashboard, Users } from 'lucide-react';
import type { RoleModule } from '../types';

export const hrOfficerRole: RoleModule = {
    id: 'hr-officer',
    matches: ({ flags }) => flags.isHrOfficer,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['team', Users, text('Employees', 'Employés'), 'users.view'],
        [
            'hr',
            Activity,
            text('Attendance & leave', 'Présence et congés'),
            'hr.view',
        ],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
