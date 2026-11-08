import type { ReactNode } from 'react';

export {
    Alerts,
    Empty,
    Kpi,
    PageHead,
    api,
    fmtDate,
    isoDate,
    methodLabel,
    money,
    monthName,
    number,
    thisMonth,
    today,
    useFinanceData,
} from '../finance/financeKit';

export type HrView = 'dashboard' | 'employees' | 'attendance' | 'leave' | 'overtime' | 'payroll' | 'training';

export type ViewProps = { onNavigate?: (page: string) => void };

export const words = (value: unknown) =>
    String(value ?? '')
        .replaceAll('_', ' ')
        .replace(/^./, (c) => c.toUpperCase());

/** Colour of a status pill. */
export const tone = (status: string): string =>
    ({
        approved: 'good',
        paid: 'good',
        present: 'good',
        active: 'good',
        submitted: 'info',
        late: 'warn',
        pending: 'warn',
        draft: 'warn',
        on_leave: 'info',
        rejected: 'bad',
        absent: 'bad',
        cancelled: 'bad',
        suspended: 'bad',
        terminated: 'bad',
    })[status] || '';

export const STATUS_WORDS: Record<string, string> = {
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    on_leave: 'On leave',
    pending: 'Waiting',
    approved: 'Approved',
    rejected: 'Rejected',
    draft: 'Being prepared',
    submitted: 'Sent to finance',
    paid: 'Paid',
    cancelled: 'Cancelled',
    active: 'Working',
    suspended: 'Suspended',
    terminated: 'Left the factory',
};

export const statusWord = (status: string) => STATUS_WORDS[status] || words(status);

export function Pill({ status }: { status: string }): ReactNode {
    return <span className={`fb-pill ${tone(status)}`}>{statusWord(status)}</span>;
}

export const monthLabel = (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
