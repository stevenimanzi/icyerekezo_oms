import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../core/api';
import { startPolling } from '../../../core/polling';
import type { SalesOverview } from './types';

const REFRESH_EVERY_MS = 30000;

export type SalesFilters = { search: string; payment: string; from: string; to: string; page: number };

export function useSalesOverview(filters: SalesFilters) {
    const [data, setData] = useState<SalesOverview | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        const params = new URLSearchParams({ page: String(filters.page) });
        if (filters.search) params.set('search', filters.search);
        if (filters.payment) params.set('payment', filters.payment);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);

        setLoading(true);

        return api<SalesOverview>(`/api/sales/manual/overview?${params}`)
            .then((result) => {
                setData(result);
                setError('');
            })
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setLoading(false));
    }, [filters.page, filters.search, filters.payment, filters.from, filters.to]);

    useEffect(() => {
        load();
        const timer = startPolling(load, REFRESH_EVERY_MS);

        return () => window.clearInterval(timer);
    }, [load]);

    return { data, error, loading, reload: load };
}
