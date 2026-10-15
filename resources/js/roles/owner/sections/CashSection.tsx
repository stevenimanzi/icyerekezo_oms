import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function CashSection({ data, text, format }: SectionProps<OwnerOverview['cash']>) {
    const t = text.cash;

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.percent(data.collection_rate), label: t.rate, tone: data.collection_rate !== null && data.collection_rate < 50 ? 'warn' : 'good' }}
            rows={[
                { label: t.billed, value: format.money(data.billed) },
                { label: t.collected, value: format.money(data.collected) },
                { label: t.receivable, value: format.money(data.receivable) },
                { label: t.overdue, value: format.money(data.overdue_receivable), tone: toneFor(data.overdue_receivable, 'bad') },
                { label: t.payable, value: format.money(data.payable) },
                { label: t.receipts, value: format.whole(data.pending_receipts), tone: toneFor(data.pending_receipts) },
                { label: t.maintenance, value: format.money(data.maintenance_cost) },
            ]}
        />
    );
}
