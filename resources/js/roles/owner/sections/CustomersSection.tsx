import { HealthCard, toneFor } from '../components/HealthCard';
import type { OwnerOverview } from '../types';
import type { SectionProps } from './sectionProps';

export function CustomersSection({ data, text, format }: SectionProps<OwnerOverview['customers']>) {
    const t = text.customers;

    return (
        <HealthCard
            title={t.title}
            headline={{ value: format.percent(data.fulfilment_rate), label: t.fulfilment }}
            rows={[
                { label: t.received, value: format.whole(data.received) },
                { label: t.open, value: format.whole(data.open) },
                { label: t.late, value: format.whole(data.late), tone: toneFor(data.late, 'bad') },
                { label: t.ordered, value: format.number(data.units_ordered) },
                { label: t.delivered, value: format.number(data.units_delivered) },
                { label: t.returns, value: format.whole(data.returns), tone: toneFor(data.returns) },
            ]}
        >
            <div className="ow-top">
                <h3>{t.top}</h3>
                {data.top.length ? (
                    <ol>
                        {data.top.map((customer) => (
                            <li key={customer.name}>
                                <span>
                                    {customer.name}
                                    <small>
                                        {customer.orders} {t.orders}
                                    </small>
                                </span>
                                <b>{format.moneyShort(customer.revenue)}</b>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="ow-empty">{t.noCustomers}</p>
                )}
            </div>
        </HealthCard>
    );
}
