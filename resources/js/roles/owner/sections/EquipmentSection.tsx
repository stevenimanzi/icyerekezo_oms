import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function EquipmentSection({ data, text, format }: SectionProps<OwnerOverview['equipment']>) {
    const t = text.equipment;

    return (
        <HealthCard
            title={t.title}
            headline={{
                value: format.percent(data.availability_rate),
                label: t.availability,
                tone: data.unavailable > 0 ? 'warn' : undefined,
            }}
            rows={[
                { label: t.machines, value: format.whole(data.machines) },
                {
                    label: t.unavailable,
                    value: format.whole(data.unavailable),
                    tone: toneFor(data.unavailable, 'bad'),
                },
                {
                    label: t.overdue,
                    value: format.whole(data.service_overdue),
                    tone: toneFor(data.service_overdue),
                },
                { label: t.open, value: format.whole(data.open_jobs) },
                { label: t.downtime, value: format.hours(data.downtime_minutes) },
            ]}
        />
    );
}
