import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PageExportButtons } from '../../components/ExportButtons';
import { RefreshCw } from 'lucide-react';
import { api } from '../../core/api';
import './finance-books.css';

export { api };

export const money = (value: unknown, currency = 'RWF') =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'RWF' ? 0 : 2,
    }).format(Number(value || 0));

export const number = (value: unknown) => new Intl.NumberFormat().format(Number(value || 0));

export const fmtDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));

    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};

export const METHOD_LABEL: Record<string, string> = {
    cash: 'Cash',
    mobile_money: 'Mobile money',
    bank_transfer: 'Bank transfer',
    cheque: 'Cheque',
    card: 'Card',
};

export const methodLabel = (value?: string | null) =>
    value ? METHOD_LABEL[value] || value.replaceAll('_', ' ') : '—';

export const isoDate = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

    return local.toISOString().slice(0, 10);
};

export const today = () => isoDate(new Date());

export const monthStart = (offset = 0) => {
    const now = new Date();

    return isoDate(new Date(now.getFullYear(), now.getMonth() + offset, 1));
};

export const monthEnd = (offset = 0) => {
    const now = new Date();

    return isoDate(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));
};

export const thisMonth = () => today().slice(0, 7);

export const monthName = (period?: string | null) => {
    if (!period) return '—';
    const [year, month] = period.split('-').map(Number);

    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });
};

export function useFinanceData<T = any>(url: string) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const latest = useRef(0);

    const load = useCallback(() => {
        const ticket = ++latest.current;
        setLoading(true);
        api<T>(url)
            .then((result) => {
                if (ticket !== latest.current) return;
                setData(result);
                setError('');
            })
            .catch((reason: any) => {
                if (ticket === latest.current) setError(reason.message);
            })
            .finally(() => {
                if (ticket === latest.current) setLoading(false);
            });
    }, [url]);

    useEffect(() => {
        load();
    }, [load]);

    return { data, loading, error, reload: load, setError };
}

export function useDebounced<T>(value: T, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);

        return () => window.clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

export function PageHead({
    title,
    subtitle,
    children,
    loading,
    onRefresh,
}: {
    title: string;
    subtitle: string;
    children?: ReactNode;
    loading?: boolean;
    onRefresh?: () => void;
}) {
    return (
        <div className="fb-head">
            <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>
            <div className="fb-actions">
                {children}
                <PageExportButtons title={title} />
                {onRefresh && (
                    <button type="button" onClick={onRefresh} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                )}
            </div>
        </div>
    );
}

export function Kpi({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    tone?: 'good' | 'bad' | 'warn';
}) {
    return (
        <article className={`fb-kpi ${tone || ''}`}>
            <span>{label}</span>
            <b>{value}</b>
            {hint && <small>{hint}</small>}
        </article>
    );
}

export function Alerts({ error, success }: { error?: string; success?: string }) {
    return (
        <>
            {error && <div className="fb-alert error">{error}</div>}
            {success && <div className="fb-alert success">{success}</div>}
        </>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="fb-empty">{children}</div>;
}

export const PALETTE = ['#2563eb', '#7c3aed', '#0891b2', '#d97706', '#db2777', '#059669', '#64748b'];
