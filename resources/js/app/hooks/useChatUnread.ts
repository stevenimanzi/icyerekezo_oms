import { useEffect, useState } from 'react';
import { api } from '../../core/api';
import { startPolling } from '../../core/polling';
import type { AuthUser } from '../../core/types';

const REFRESH_MS = 8000;

export function useChatUnread(user: AuthUser, enabled: boolean) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (user.is_platform_admin || user.school || !enabled) {
            setCount(0);
            return;
        }

        const refresh = () =>
            api<{ unread: number }>('/api/chat/unread')
                .then((result) => setCount(Number(result.unread) || 0))
                .catch(() => undefined);
        refresh();
        const timer = startPolling(refresh, REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [user.is_platform_admin, user.school, enabled]);

    return count;
}
