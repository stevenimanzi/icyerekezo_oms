import {
    Bell,
    Building2,
    CreditCard,
    Database,
    LayoutDashboard,
    Megaphone,
    MessageSquare,
    Settings,
    ShieldCheck,
    Users,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const systemAdminRole: RoleModule = {
    id: 'system-admin',
    matches: ({ user }) => user.is_platform_admin,
    nav: ({ text }) => [
        ['platform-dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
        ['factories', Building2, text('Factories', 'Usines'), '*'],
        ['platform-users', Users, text('Users', 'Utilisateurs'), '*'],
        ['subscriptions', CreditCard, text('Subscriptions', 'Abonnements'), '*'],
        ['audit-logs', ShieldCheck, text('Activity log', "Journal d'activité"), '*'],
        ['announcements', Megaphone, text('Announcements', 'Annonces'), '*'],
        ['notifications', Bell, text('Notifications', 'Notifications'), '*'],
        ['support-center', MessageSquare, text('Support', 'Support'), '*'],
        ['backups', Database, text('Backups', 'Sauvegardes'), '*'],
        ['system-settings', Settings, text('Settings', 'Paramètres'), '*'],
    ],
};
