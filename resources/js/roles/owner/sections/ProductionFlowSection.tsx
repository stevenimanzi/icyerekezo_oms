import { HealthCard, toneFor } from '../components/HealthCard';
import type { Format } from '../../../core/format';
import type { ownerText } from '../text';
import type { OwnerOverview } from '../types';

type Props = {
    data: NonNullable<OwnerOverview['flow']>;
    text: (typeof ownerText)['en'];
    format: Format;
    locale: 'en' | 'fr';
};

/** Where the pieces are right now, stage by stage, with what needs the owner's attention. */
export function ProductionFlowSection({ data, text, format, locale }: Props) {
    const t = text.flow;
    const inProgress = data.stages.reduce((sum, stage) => sum + stage.here, 0);
    const damaged = data.stages.reduce((sum, stage) => sum + stage.damaged, 0);

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.whole(inProgress), label: t.headline }}
            rows={[
                ...data.stages.map((stage) => ({
                    label: stage.label[locale],
                    value: t.stageLine(stage.done, stage.here),
                })),
                { label: t.damaged, value: format.whole(damaged), tone: toneFor(damaged) },
                { label: t.lots, value: format.whole(data.lots_open) },
                {
                    label: t.held,
                    value: format.whole(data.lots_held),
                    tone: toneFor(data.lots_held, 'bad'),
                },
                {
                    label: t.requests,
                    value: format.whole(data.requests_waiting),
                    tone: toneFor(data.requests_waiting),
                },
                {
                    label: t.deliveries,
                    value: format.whole(data.deliveries_waiting),
                    tone: toneFor(data.stuck_deliveries),
                },
                { label: t.finalCheck, value: format.whole(data.awaiting_final_check) },
            ]}
        />
    );
}
