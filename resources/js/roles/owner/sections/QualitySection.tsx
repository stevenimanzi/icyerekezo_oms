import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function QualitySection({ data, text, format }: SectionProps<OwnerOverview['quality']>) {
    const t = text.quality;
    const dropped = data.pass_rate !== null && data.previous_pass_rate !== null && data.pass_rate < data.previous_pass_rate;

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.percent(data.pass_rate), label: t.passRate, tone: dropped ? 'warn' : undefined }}
            rows={[
                { label: t.before, value: format.percent(data.previous_pass_rate) },
                { label: t.inspections, value: format.whole(data.inspections) },
                { label: t.failed, value: format.whole(data.failed), tone: toneFor(data.failed) },
                { label: t.conditional, value: format.whole(data.conditional) },
                { label: t.rejected, value: format.number(data.rejected_quantity), tone: toneFor(data.rejected_quantity) },
                { label: t.pending, value: format.whole(data.pending) },
            ]}
        />
    );
}
