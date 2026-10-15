import { useEffect, useState } from 'react';
import { api } from '../../core/api';
import type { AuthUser } from '../../core/types';
import { startPolling } from '../../core/polling';

const REFRESH_MS = 60000;

export function useLowStockCount(user: AuthUser, canViewInventory: boolean) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (user.is_platform_admin || !canViewInventory) {
            setCount(0);
            return;
        }

        const refresh = () =>
            api<{ low_stock: number }>('/api/inventory/overview')
                .then((result) => setCount(Number(result.low_stock) || 0))
                .catch(() => setCount(0));
        refresh();
        const timer = startPolling(refresh, REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [user.is_platform_admin, canViewInventory]);

    return count;
}
