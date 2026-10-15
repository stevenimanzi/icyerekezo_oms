export type Locale = 'en' | 'fr';

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    locale: Locale;
    timezone?: string;
    current_factory: {
        id: number;
        name: string;
        slug: string;
        industry_type?: string;
        currency_code?: string;
        feature_flags?: string[];
    } | null;
    factories?: { id: number; name: string; slug: string }[];
    is_platform_admin: boolean;
    permissions: string[];
    workspace: string;
    roles: { id: number; name: string; slug: string; dashboard_key: string }[];
    employee_profile?: {
        job_title?: string;
        department?: { name: string };
        workstation?: { name: string; type: string };
    } | null;
    school?: {
        id: number;
        name: string;
        district?: string;
        sector?: string;
        contact_name?: string;
        phone?: string;
        email?: string;
    } | null;
    active_assignments: {
        id: number;
        assignment_type: string;
        title: string;
        priority: string;
        status: string;
        due_at?: string;
    }[];
    announcements?: {
        id: number;
        title: string;
        message: string;
        severity: string;
        published_at: string;
    }[];
    notifications?: AppNotificationItem[];
    unread_notifications_count?: number;
    pending_orders_count?: number;
    subscription?: {
        id: number;
        status: string;
        plan?: { id: number; name: string; code: string; features: string[] };
    } | null;
    system?: {
        name: string;
        tagline?: string;
        logo_url?: string;
        support_email?: string;
        support_phone?: string;
        currency_code?: string;
        timezone?: string;
    };
};

export type AppNotificationItem = {
    id: string;
    read_at: string | null;
    created_at: string;
    data: { title: string; body: string; url?: string; category?: string };
};
