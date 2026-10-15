import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function ProductionSection({
    data,
    text,
    format,
}: SectionProps<OwnerOverview['production']>) {
    const t = text.production;

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.percent(data.completion_rate), label: t.rate }}
            rows={[
                { label: t.planned, value: format.number(data.planned) },
                { label: t.completed, value: format.number(data.completed) },
                {
                    label: t.rejected,
                    value: `${format.number(data.rejected)} (${format.percent(data.reject_rate)})`,
                    tone: toneFor(data.rejected),
                },
                { label: t.waste, value: format.number(data.waste) },
                { label: t.open, value: format.whole(data.open_orders) },
                {
                    label: t.late,
                    value: format.whole(data.late_orders),
                    tone: toneFor(data.late_orders, 'bad'),
                },
                { label: t.onTime, value: format.percent(data.on_time_rate) },
                { label: t.downtime, value: format.hours(data.downtime_minutes) },
            ]}
        />
    );
}
