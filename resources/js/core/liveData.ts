import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { startPolling } from './polling';

const REFRESH_EVERY_MS = 15000;

export function useLiveData<T>(url: string, refreshMs: number = REFRESH_EVERY_MS, enabled = true) {
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
        if (!enabled) {
            setLoading(false);

            return;
        }
        setData(null);
        load();
        const timer = startPolling(load, refreshMs);

        return () => window.clearInterval(timer);
    }, [load, refreshMs, enabled]);

    return { data, error, loading, reload: load };
}

export async function postJson<T = unknown>(url: string, body: object = {}): Promise<T> {
    return api<T>(url, { method: 'POST', body: JSON.stringify(body) });
}
