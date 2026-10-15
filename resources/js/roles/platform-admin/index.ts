import { Bell, Building2, CreditCard, Database, LayoutDashboard, Megaphone, MessageSquare, Settings, ShieldCheck, Users } from 'lucide-react';
import type { RoleModule } from '../types';

export const platformAdminRole: RoleModule = {
    id: 'platform-admin',
    matches: ({ user }) => user.is_platform_admin,
    nav: ({ text }) => [
        ['platform-dashboard', LayoutDashboard, text('Platform overview', 'Vue plateforme'), '*'],
        ['factories', Building2, text('Factories', 'Usines'), '*'],
        ['platform-users', Users, text('All users', 'Tous les utilisateurs'), '*'],
        ['subscriptions', CreditCard, text('Subscriptions', 'Abonnements'), '*'],
        ['audit-logs', ShieldCheck, text('Audit logs', "Journaux d'audit"), '*'],
        ['announcements', Megaphone, text('Announcements', 'Annonces'), '*'],
        ['notifications', Bell, text('Notifications', 'Notifications'), '*'],
        ['support-center', MessageSquare, text('Support centre', 'Centre de support'), '*'],
        ['backups', Database, text('Database backups', 'Sauvegardes'), '*'],
        ['system-settings', Settings, text('System settings', 'Paramètres système'), '*'],
    ],
};
