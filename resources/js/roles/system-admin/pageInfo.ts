import type { ElementType } from 'react';
import {
    Activity,
    Building2,
    CreditCard,
    Database,
    Megaphone,
    MessageSquare,
    Settings,
    ShieldCheck,
    Users,
} from 'lucide-react';

export type AdminPageInfo = {
    icon: ElementType;
    title: string;
    description: string;
    endpoint: string;
    canCreate: boolean;
    refreshEverySeconds?: number;
};

export const FALLBACK_PAGE = 'platform-dashboard';

export const adminPages: Record<string, AdminPageInfo> = {
    'platform-dashboard': {
        icon: Activity,
        title: 'Platform overview',
        description:
            'Live control of factories, users, subscriptions, support and system services.',
        endpoint: '/api/platform/overview',
        canCreate: false,
        refreshEverySeconds: 15,
    },
    factories: {
        icon: Building2,
        title: 'Factories',
        description: 'Register, approve, activate and suspend every factory.',
        endpoint: '/api/platform/factories',
        canCreate: true,
    },
    'platform-users': {
        icon: Users,
        title: 'All users',
        description: 'Control account status and trusted platform administrators.',
        endpoint: '/api/platform/users',
        canCreate: true,
    },
    subscriptions: {
        icon: CreditCard,
        title: 'Subscriptions',
        description: 'Create plans, assign billing periods and monitor expiry.',
        endpoint: '/api/platform/subscriptions',
        canCreate: true,
    },
    announcements: {
        icon: Megaphone,
        title: 'Announcements',
        description: 'Broadcast important messages to platform users.',
        endpoint: '/api/platform/announcements',
        canCreate: true,
    },
    'support-center': {
        icon: MessageSquare,
        title: 'Support centre',
        description: 'Receive problems, reply and track resolution.',
        endpoint: '/api/platform/tickets',
        canCreate: false,
        refreshEverySeconds: 15,
    },
    backups: {
        icon: Database,
        title: 'Database backups',
        description: 'Create and monitor secure recovery points.',
        endpoint: '/api/platform/backups',
        canCreate: true,
        refreshEverySeconds: 15,
    },
    'audit-logs': {
        icon: ShieldCheck,
        title: 'Audit logs',
        description: 'Every recorded action across every factory, searchable and filterable.',
        endpoint: '/api/platform/audit-logs',
        canCreate: false,
    },
    'system-settings': {
        icon: Settings,
        title: 'System settings',
        description: 'Manage branding, registration and maintenance mode.',
        endpoint: '/api/platform/settings',
        canCreate: false,
    },
};
