import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../core/api';
import { makeFormat } from '../../core/format';
import { startPolling } from '../../core/polling';
import type { HomeProps } from '../types';
import { KpiCard } from '../owner/components/KpiCard';
import '../owner/owner.css';
import { CashSection } from '../owner/sections/CashSection';
import { CustomersSection } from '../owner/sections/CustomersSection';
import { EquipmentSection } from '../owner/sections/EquipmentSection';
import { ProductionFlowSection } from '../owner/sections/ProductionFlowSection';
import { ProductionSection } from '../owner/sections/ProductionSection';
import { QualitySection } from '../owner/sections/QualitySection';
import { StockSection } from '../owner/sections/StockSection';
import { ownerText } from '../owner/text';
import type { Comparison, OwnerOverview } from '../owner/types';

type Overview = Partial<
    Pick<
        OwnerOverview,
        'cash' | 'customers' | 'stock' | 'equipment' | 'quality' | 'flow' | 'production'
    >
> & {
    period: OwnerOverview['period'];
    sections: string[];
    growth: Record<
        'revenue' | 'orders' | 'units_delivered' | 'output' | 'collected',
        Comparison | null
    >;
};

const PERIODS = [7, 30, 90, 365];
const REFRESH_MS = 15000;

/** The home of a department role (sales, finance, stock, maintenance...): live figures from the parts of the factory it may see. */
export default function RoleHome({ user, locale }: HomeProps) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const text = ownerText[locale];
    const currency = user.current_factory?.currency_code || 'RWF';
    const format = useMemo(() => makeFormat(locale, currency), [locale, currency]);
    const role = user.roles?.[0]?.name ?? '';

    const load = useCallback(() => {
        setLoading(true);

        return api<Overview>(`/api/dashboard/role-overview?days=${days}`)
            .then((result) => {
                setData(result);
                setError('');
            })
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setLoading(false));
    }, [days]);

    useEffect(() => {
        load();
        const timer = startPolling(load, REFRESH_MS);

        return () => window.clearInterval(timer);
    }, [load]);

    const kpis = data
        ? (
              [
                  ['revenue', text.kpi.revenue, true],
                  ['orders', text.kpi.orders, false],
                  ['units_delivered', text.kpi.units, false],
                  ['output', text.kpi.output, false],
                  ['collected', text.kpi.collected, true],
              ] as const
          ).filter(([key]) => data.growth[key])
        : [];

    return (
        <section className="ow">
            <div className="page-heading">
                <div>
                    <div className="eyebrow">
                        <span></span>
                        {role}
                    </div>
                    <h1>{user.current_factory?.name ?? text.title}</h1>
                    <p>{text.greeting(user.name)}</p>
                </div>
                <div className="ow-controls">
                    <select
                        aria-label="Period"
                        value={days}
                        onChange={(event) => setDays(Number(event.target.value))}
                    >
                        {PERIODS.map((period) => (
                            <option key={period} value={period}>
                                {text.periods[period]}
                            </option>
                        ))}
                    </select>
                    <button className="secondary-btn" onClick={load} disabled={loading}>
                        {text.refresh}
                    </button>
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}

            {!data ? (
                <div className="panel ow-empty-page">{text.loading}</div>
            ) : (
                <>
                    {kpis.length > 0 && (
                        <div className="ow-kpis">
                            {kpis.map(([key, label, money]) => (
                                <KpiCard
                                    key={key}
                                    label={label}
                                    value={
                                        money
                                            ? format.moneyShort(data.growth[key]!.current)
                                            : format.whole(data.growth[key]!.current)
                                    }
                                    comparison={data.growth[key]!}
                                    days={days}
                                    text={text}
                                    format={format}
                                />
                            ))}
                        </div>
                    )}

                    <div className="ow-grid">
                        {data.cash && <CashSection data={data.cash} text={text} format={format} />}
                        {data.flow && (
                            <ProductionFlowSection
                                data={data.flow}
                                text={text}
                                format={format}
                                locale={locale}
                            />
                        )}
                        {data.production && (
                            <ProductionSection data={data.production} text={text} format={format} />
                        )}
                        {data.stock && (
                            <StockSection data={data.stock} text={text} format={format} />
                        )}
                        {data.customers && (
                            <CustomersSection data={data.customers} text={text} format={format} />
                        )}
                        {data.quality && (
                            <QualitySection data={data.quality} text={text} format={format} />
                        )}
                        {data.equipment && (
                            <EquipmentSection data={data.equipment} text={text} format={format} />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
