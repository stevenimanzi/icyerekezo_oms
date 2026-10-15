import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function SafetySection({ data, text, format }: SectionProps<OwnerOverview['safety']>) {
    const t = text.safety;

    return (
        <HealthCard
            title={t.title}
            headline={{
                value: data.days_without_incident === null ? t.none : format.whole(data.days_without_incident),
                label: t.days,
                tone: data.serious_open > 0 ? 'bad' : 'good',
            }}
            rows={[
                { label: t.incidents, value: format.whole(data.incidents), tone: toneFor(data.incidents) },
                { label: t.open, value: format.whole(data.open), tone: toneFor(data.open) },
                { label: t.serious, value: format.whole(data.serious_open), tone: toneFor(data.serious_open, 'bad') },
            ]}
        />
    );
}
