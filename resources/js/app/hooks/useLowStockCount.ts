import { useEffect, useState } from 'react';
import { api } from '../../core/api';
import type { AuthUser } from '../../core/types';

const REFRESH_MS = 15000;

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
        const timer = window.setInterval(refresh, REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [user.is_platform_admin, canViewInventory]);

    return count;
}
