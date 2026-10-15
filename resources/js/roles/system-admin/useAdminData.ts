import { useEffect, useState } from 'react';
import { request } from './api';
import { adminPages, FALLBACK_PAGE } from './pageInfo';
import { startPolling } from '../../core/polling';

const SUCCESS_MESSAGE_MS = 5000;

export type AuditFilters = {
    search: string;
    event: string;
    factory_id: string;
    from: string;
    to: string;
};
export type UserFilters = {
    tab: string;
    search: string;
    active: string;
    role: string;
    page: number;
};

function queryString(filters: Record<string, string | number>) {
    const entries = Object.entries(filters)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, String(value)]);

    return new URLSearchParams(entries).toString();
}

export function useAdminData(page: string) {
    const info = adminPages[page] || adminPages[FALLBACK_PAGE];
    const [data, setData] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Record<string, any>>({});
    const [auditFilters, setAuditFilters] = useState<AuditFilters>({
        search: '',
        event: '',
        factory_id: '',
        from: '',
        to: '',
    });
    const [usersFilters, setUsersFilters] = useState<UserFilters>({
        tab: 'all',
        search: '',
        active: '',
        role: '',
        page: 1,
    });

    const load = async () => {
        setBusy(true);
        setError('');
        try {
            let url = info.endpoint;
            if (page === 'audit-logs') url = `${url}?${queryString(auditFilters)}`;
            if (page === 'platform-users') url = `${url}?${queryString(usersFilters)}`;
            setData(await request(url));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load.');
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        setShowForm(false);
        setForm({});
        setSuccess('');
        setError('');
        load();
    }, [page]);

    useEffect(() => {
        if (!success) return;
        const timer = window.setTimeout(() => setSuccess(''), SUCCESS_MESSAGE_MS);
        return () => window.clearTimeout(timer);
    }, [success]);

    useEffect(() => {
        if (page === 'audit-logs') load();
    }, [auditFilters]);

    useEffect(() => {
        if (page === 'platform-users') load();
    }, [usersFilters]);

    useEffect(() => {
        if (!info.refreshEverySeconds) return;
        const timer = startPolling(
            () =>
                request(info.endpoint)
                    .then(setData)
                    .catch(() => {}),
            info.refreshEverySeconds * 1000,
        );
        return () => window.clearInterval(timer);
    }, [page]);

    const run = async (
        url: string,
        method: string,
        body?: any,
        message = 'Saved successfully.',
    ) => {
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            await request(url, { method, body: body ? JSON.stringify(body) : undefined });
            setSuccess(message);
            setShowForm(false);
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to save.');
            setBusy(false);
        }
    };

    const uploadLogo = async (file: File) => {
        const body = new FormData();
        body.append('logo', file);
        setBusy(true);
        setError('');
        try {
            await request('/api/platform/settings/logo', { method: 'POST', body });
            setSuccess('System logo uploaded.');
            await load();
            window.setTimeout(() => window.location.reload(), 500);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to upload logo.');
            setBusy(false);
        }
    };

    const records =
        page === 'platform-users'
            ? data?.users?.data || []
            : page === 'audit-logs'
              ? data?.logs?.data || []
              : data?.data || [];

    return {
        data,
        records,
        busy,
        error,
        success,
        showForm,
        setShowForm,
        form,
        setForm,
        auditFilters,
        setAuditFilters,
        usersFilters,
        setUsersFilters,
        load,
        run,
        uploadLogo,
    };
}

export type AdminContext = ReturnType<typeof useAdminData>;
