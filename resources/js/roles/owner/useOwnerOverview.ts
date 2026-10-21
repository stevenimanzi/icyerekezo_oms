import { useCallback, useEffect, useState } from 'react';
import { api } from '../../core/api';
import type { OwnerOverview } from './types';
import { startPolling } from '../../core/polling';

const REFRESH_EVERY_MS = 15000;

export function useOwnerOverview(days: number | string, from?: string, to?: string) {
    const [data, setData] = useState<OwnerOverview | null>(null);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);

        let url = `/api/executive/owner-overview?days=${days}`;
        if (days === 'custom' && from && to) {
            url += `&from=${from}&to=${to}`;
        }

        return api<OwnerOverview>(url)
            .then((result) => {
                setData(result);
                setError('');
                setUpdatedAt(new Date());
            })
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setLoading(false));
    }, [days, from, to]);

    useEffect(() => {
        load();
        const timer = startPolling(load, REFRESH_EVERY_MS);

        return () => window.clearInterval(timer);
    }, [load]);

    return { data, error, updatedAt, loading, reload: load };
}
