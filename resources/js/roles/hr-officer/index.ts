import { CalendarCheck, ChartColumn, LayoutDashboard, Users } from 'lucide-react';
import type { RoleModule } from '../types';

export const hrOfficerRole: RoleModule = {
    id: 'hr-officer',
    matches: ({ flags }) => flags.isHrOfficer,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['team', Users, text('Employees', 'Employés'), 'users.view'],
        ['hr', CalendarCheck, text('Attendance & leave', 'Présence et congés'), 'hr.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
