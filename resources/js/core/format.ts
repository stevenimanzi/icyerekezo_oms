import type { Locale } from './types';

const LOCALES: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR' };

export function makeFormat(locale: Locale, currency: string) {
    const tag = LOCALES[locale];
    const plain = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 });
    const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });

    return {
        number: (value: number) => plain.format(value),
        whole: (value: number) => whole.format(value),
        compact: (value: number) => compact.format(value),
        money: (value: number) => `${currency} ${whole.format(value)}`,
        moneyShort: (value: number) => `${currency} ${compact.format(value)}`,
        percent: (value: number | null) => (value === null ? '—' : `${plain.format(value)}%`),
        signedPercent: (value: number) =>
            `${value > 0 ? '+' : value < 0 ? '−' : ''}${plain.format(Math.abs(value))}%`,
        hours: (minutes: number) =>
            minutes >= 60 ? `${plain.format(minutes / 60)} h` : `${whole.format(minutes)} min`,
        date: (value: string | null) =>
            value
                ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString(tag, {
                      dateStyle: 'medium',
                  })
                : '—',
        dateTime: (iso: string | null) =>
            iso
                ? new Date(iso).toLocaleString(tag, { dateStyle: 'medium', timeStyle: 'short' })
                : '—',
        timeAgo: (iso: string | null) => {
            if (!iso) return '—';
            const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
            const formatter = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
            const steps: [Intl.RelativeTimeFormatUnit, number][] = [
                ['day', 86400],
                ['hour', 3600],
                ['minute', 60],
            ];
            for (const [unit, size] of steps) {
                if (Math.abs(seconds) >= size)
                    return formatter.format(Math.round(seconds / size), unit);
            }
            return formatter.format(seconds, 'second');
        },
    };
}

export type Format = ReturnType<typeof makeFormat>;

export function humanize(event: string): string {
    return event.replace(/[._]/g, ' ');
}
