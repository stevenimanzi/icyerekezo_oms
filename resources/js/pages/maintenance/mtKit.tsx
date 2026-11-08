import type { ReactNode } from 'react';

export { Alerts, Empty, Kpi, PageHead, api, fmtDate, isoDate, money, number, today, useFinanceData } from '../finance/financeKit';

export type MtView = 'dashboard' | 'machines' | 'problems' | 'performance' | 'schedule' | 'reports';

export type ViewProps = {
    can: (permission: string) => boolean;
    onNavigate?: (page: string) => void;
};

export const MACHINE_STATUS: Record<string, string> = {
    operational: 'Working',
    maintenance: 'Being repaired',
    down: 'Stopped',
    broken: 'Broken',
    retired: 'Retired',
};

export const JOB_STATUS: Record<string, string> = {
    open: 'Waiting',
    scheduled: 'Planned',
    in_progress: 'Being worked on',
    completed: 'Done',
    cancelled: 'Cancelled',
};

export const JOB_TYPE: Record<string, string> = {
    breakdown: 'Breakdown',
    corrective: 'Repair',
    preventive: 'Planned service',
    inspection: 'Inspection',
};

export const PRIORITY: Record<string, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

const TONE: Record<string, string> = {
    operational: 'good',
    maintenance: 'info',
    down: 'bad',
    broken: 'bad',
    open: 'warn',
    scheduled: 'info',
    in_progress: 'info',
    completed: 'good',
    urgent: 'bad',
    high: 'warn',
};

export function Pill({ value, labels }: { value: string; labels: Record<string, string> }): ReactNode {
    return <span className={`fb-pill ${TONE[value] || ''}`}>{labels[value] || value}</span>;
}

export const words = (value: unknown) =>
    String(value ?? '')
        .replaceAll('_', ' ')
        .replace(/^./, (c) => c.toUpperCase());

export const canManage = (can: (permission: string) => boolean) => can('maintenance.manage') || can('factory.manage');

export const percent = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value}%`);

/** Minutes as "2 h 30 min". */
export const duration = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined) return '—';
    const m = Math.round(minutes);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);

    return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
};

export const shortDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));

    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** How a service date reads: overdue, today, in N days, or not planned. */
export function dueText(value?: string | null): { text: string; tone: string } {
    if (!value) return { text: 'Not planned', tone: '' };
    const days = Math.ceil((new Date(String(value).replace(' ', 'T')).getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`, tone: 'bad' };
    if (days === 0) return { text: 'Due today', tone: 'warn' };
    if (days <= 7) return { text: `In ${days} day${days === 1 ? '' : 's'}`, tone: 'warn' };

    return { text: `In ${days} days`, tone: 'good' };
}

export const toInputDate = (value?: string | null) => (value ? String(value).slice(0, 10) : '');
