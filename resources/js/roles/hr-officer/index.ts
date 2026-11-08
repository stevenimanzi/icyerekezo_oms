import {
    CalendarCheck,
    CalendarOff,
    FileBarChart,
    GraduationCap,
    LayoutDashboard,
    ShieldCheck,
    Timer,
    UserCog,
    Users,
    Wallet,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const hrOfficerRole: RoleModule = {
    id: 'hr-officer',
    matches: ({ flags }) => flags.isHrOfficer,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['hr-employees', Users, text('Employees', 'Employés'), 'hr.view'],
        ['hr-attendance', CalendarCheck, text('Attendance', 'Présence'), 'hr.view'],
        ['hr-leave', CalendarOff, text('Leave', 'Congés'), 'hr.view'],
        ['hr-overtime', Timer, text('Overtime', 'Heures supplémentaires'), 'hr.view'],
        ['hr-payroll', Wallet, text('Payroll', 'Paie'), 'hr.view'],
        ['hr-training', GraduationCap, text('Training', 'Formation'), 'hr.view'],
        ['team', UserCog, text('Staff accounts', 'Comptes du personnel'), 'users.view'],
        ['reports', FileBarChart, labels.reports, 'reports.view'],
    ],
};
