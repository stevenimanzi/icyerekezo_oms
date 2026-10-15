import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function StockSection({ data, text, format }: SectionProps<OwnerOverview['stock']>) {
    const t = text.stock;

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.moneyShort(data.value), label: t.value }}
            rows={[
                {
                    label: t.low,
                    value: format.whole(data.low_stock),
                    tone: toneFor(data.low_stock),
                },
                {
                    label: t.out,
                    value: format.whole(data.out_of_stock),
                    tone: toneFor(data.out_of_stock, 'bad'),
                },
                {
                    label: t.expiring,
                    value: format.whole(data.expiring_soon),
                    tone: toneFor(data.expiring_soon),
                },
                { label: t.tracked, value: format.whole(data.tracked_items) },
            ]}
        />
    );
}
