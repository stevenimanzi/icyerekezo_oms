import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '../core/types';
import { navFor } from '../roles/registry';
import type { NavGroup, NavItem, RoleContext } from '../roles/types';

/** Which subscription feature a page belongs to. Pages that are not listed use their own name. */
const FEATURE_FOR_PAGE: Record<string, string> = {
    dashboard: 'dashboard',
    activity: 'dashboard',
    procurement: 'procurement',
    inventory: 'inventory',
    'incoming-requests': 'inventory',
    products: 'products',
    production: 'production',
    quality: 'quality',
    sales: 'sales',
    logistics: 'logistics',
    'logistics-reports': 'logistics',
    dispatch: 'logistics',
    vehicles: 'logistics',
    'delivery-confirmation': 'logistics',
    agreement: 'logistics',
    team: 'team',
    hr: 'team',
    safety: 'team',
    audit: 'reports',
    machines: 'maintenance',
    reports: 'reports',
    finance: 'sales',
    'finance-reports': 'reports',
    'cutting-workspace': 'production',
    'fabric-request': 'inventory',
    'cut-fabrics': 'production',
    'damaged-fabrics': 'inventory',
    'cutting-report': 'production',
    'sewing-workspace': 'production',
    'finishing-workspace': 'production',
    'packing-workspace': 'production',
};

export function createAccess(user: AuthUser) {
    const features = user.subscription?.plan?.features;

    return {
        can: (permission: string) => user.permissions.includes('*') || user.permissions.includes(permission),
        hasFeature: (page: string) => !features || features.includes(FEATURE_FOR_PAGE[page] || page),
    };
}

export type Access = ReturnType<typeof createAccess>;

/** The sidebar entries this person may open: right permission and included in the factory's plan. */
export function visibleNav(context: RoleContext, access: Access): NavItem[] {
    const { user, flags } = context;

    return navFor(context).filter(
        ([page, , , permission]) =>
            (permission === '*' || access.can(permission)) &&
            (user.is_platform_admin || flags.isSchoolUser || access.hasFeature(page)),
    );
}

export type NavEntry =
    | { type: 'item'; key: string; item: NavItem }
    | { type: 'group'; key: string; label: string; icon: LucideIcon; items: NavItem[] };

/** Folds the flat list into expandable groups, keeping each group where its first child was. */
export function groupNav(nav: NavItem[], groups: Record<string, NavGroup>): NavEntry[] {
    const assigned = new Set<string>();
    const built: Extract<NavEntry, { type: 'group' }>[] = [];

    Object.entries(groups).forEach(([key, group]) => {
        const items = nav.filter(([page]) => group.children.includes(page));
        if (!items.length) return;

        items.forEach(([page]) => assigned.add(page));
        built.push({ type: 'group', key, label: group.label, icon: group.icon, items });
    });

    const result: NavEntry[] = [];
    nav.forEach((item) => {
        const [page] = item;
        if (!assigned.has(page)) {
            result.push({ type: 'item', key: page, item });
            return;
        }

        const group = built.find((entry) => entry.items[0][0] === page);
        if (group) result.push(group);
    });

    return result;
}
