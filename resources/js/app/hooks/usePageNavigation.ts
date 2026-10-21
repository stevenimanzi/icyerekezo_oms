import { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '../../core/types';
import { pageFromLocation, pathForPage } from '../routing';

function formatPageTitle(page: string): string {
    const titles: Record<string, string> = {
        'dashboard': 'Dashboard',
        'cutting-workspace': 'Cutting Workspace',
        'cutting-report': 'Cutting Report',
        'sewing-workspace': 'Sewing Workspace',
        'sewing-report': 'Sewing Report',
        'finishing-workspace': 'Finishing Workspace',
        'finishing-report': 'Finishing Report',
        'packing-workspace': 'Packing Workspace',
        'packing-report': 'Packing Report',
        'factory-report': 'Factory Report',
        'production-flow': 'Production Flow',
        'material-requests': 'Material Requests',
        'requests': 'Requests',
        'quality-control': 'Quality Control',
        'stock-overview': 'Stock Overview',
        'inventory': 'Inventory',
        'sales': 'Sales',
        'manual-sales': 'Manual Sales',
        'sales-orders': 'Sales Orders',
        'customers': 'Customers',
        'chat': 'Chat',
        'notifications': 'Notifications',
        'profile': 'Profile',
        'settings': 'Settings',
        'team': 'Team',
        'machines': 'Machines',
        'maintenance': 'Maintenance',
        'safety': 'Safety',
        'procurement': 'Procurement',
        'logistics': 'Logistics',
        'finance': 'Finance',
        'hr': 'Human Resources',
    };

    if (titles[page]) {
        return titles[page];
    }

    return page
        .split(/[-_]/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export function usePageNavigation(user: AuthUser, allowedPages: string[]) {
    const [activePage, setActivePage] = useState(() => pageFromLocation(user));
    const skipHistory = useRef(true);

    useEffect(() => {
        const path = pathForPage(user, activePage);
        const title = formatPageTitle(activePage);
        const systemName = user.system?.name || 'ICYEREKEZO OMS';
        document.title = `${title} | ${systemName}`;

        if (skipHistory.current) {
            skipHistory.current = false;
            if (window.location.pathname !== path)
                window.history.replaceState({ page: activePage }, '', path);
        } else if (window.location.pathname !== path) {
            window.history.pushState({ page: activePage }, '', path);
        }
    }, [activePage, user]);

    useEffect(() => {
        const back = () => {
            skipHistory.current = true;
            setActivePage(pageFromLocation(user));
        };
        window.addEventListener('popstate', back);

        return () => window.removeEventListener('popstate', back);
    }, [user]);

    useEffect(() => {
        if (!allowedPages.includes(activePage)) {
            setActivePage(
                user.is_platform_admin ? 'platform-dashboard' : allowedPages[0] || 'notifications',
            );
        }
    }, [activePage, allowedPages, user.is_platform_admin]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.querySelector('.page')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [activePage]);

    return { activePage, setActivePage };
}
