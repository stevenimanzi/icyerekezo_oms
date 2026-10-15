import {
    Bell,
    Building2,
    CreditCard,
    Database,
    Headset,
    LayoutDashboard,
    Megaphone,
    ScrollText,
    Settings,
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
        ['audit-logs', ScrollText, text('Activity log', "Journal d'activité"), '*'],
        ['announcements', Megaphone, text('Announcements', 'Annonces'), '*'],
        ['notifications', Bell, text('Notifications', 'Notifications'), '*'],
        ['support-center', Headset, text('Support', 'Support'), '*'],
        ['backups', Database, text('Backups', 'Sauvegardes'), '*'],
        ['system-settings', Settings, text('Settings', 'Paramètres'), '*'],
    ],
};
