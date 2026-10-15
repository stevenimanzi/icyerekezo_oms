import { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '../../core/types';
import { pageFromLocation, pathForPage } from '../routing';

export function usePageNavigation(user: AuthUser, allowedPages: string[]) {
    const [activePage, setActivePage] = useState(() => pageFromLocation(user));
    const skipHistory = useRef(true);

    useEffect(() => {
        const path = pathForPage(user, activePage);
        document.title = `${activePage.replaceAll('-', ' ')} | ${user.system?.name || 'ICYEREKEZO OMS'}`;

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
