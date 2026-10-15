import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../core/api';
import { startPolling } from '../../../core/polling';

const REFRESH_EVERY_MS = 15000;

export function useFlowData<T>(url: string) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);

        return api<T>(url)
            .then((result) => {
                setData(result);
                setError('');
            })
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setLoading(false));
    }, [url]);

    useEffect(() => {
        setData(null);
        load();
        const timer = startPolling(load, REFRESH_EVERY_MS);

        return () => window.clearInterval(timer);
    }, [load]);

    return { data, error, loading, reload: load };
}

export async function postFlow<T = unknown>(url: string, body: object = {}): Promise<T> {
    return api<T>(url, { method: 'POST', body: JSON.stringify(body) });
}
