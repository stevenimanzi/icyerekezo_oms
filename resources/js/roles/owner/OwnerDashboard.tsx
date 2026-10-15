import { useMemo, useState } from 'react';
import type { HomeProps } from '../types';
import { ActivityList } from './components/ActivityList';
import { AlertsBar } from './components/AlertsBar';
import { KpiCard } from './components/KpiCard';
import { TrendChart } from './components/TrendChart';
import { makeFormat } from './format';
import './owner.css';
import { CashSection } from './sections/CashSection';
import { CustomersSection } from './sections/CustomersSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { PeopleSection } from './sections/PeopleSection';
import { ProductionSection } from './sections/ProductionSection';
import { QualitySection } from './sections/QualitySection';
import { SafetySection } from './sections/SafetySection';
import { StockSection } from './sections/StockSection';
import { ownerText } from './text';
import { useOwnerOverview } from './useOwnerOverview';

const PERIODS = [7, 30, 90, 365];

export default function OwnerDashboard({ user, locale, onNavigate, pages }: HomeProps) {
    const [days, setDays] = useState(30);
    const { data, error, updatedAt, loading, reload } = useOwnerOverview(days);

    const text = ownerText[locale];
    const currency = user.current_factory?.currency_code || 'RWF';
    const format = useMemo(() => makeFormat(locale, currency), [locale, currency]);

    return (
        <section className="ow">
            <div className="page-heading">
                <div>
                    <div className="eyebrow">
                        <span></span>
                        {text.eyebrow}
                    </div>
                    <h1>{text.title}</h1>
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
                    <button className="secondary-btn" onClick={reload} disabled={loading}>
                        {text.refresh}
                    </button>
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}

            <p className="ow-status">
                {updatedAt
                    ? `${text.updatedAt} ${updatedAt.toLocaleTimeString()}`
                    : text.connecting}
            </p>

            {!data ? (
                <div className="panel ow-empty-page">{text.loading}</div>
            ) : (
                <>
                    <AlertsBar
                        alerts={data.alerts}
                        openablePages={pages}
                        text={text}
                        onNavigate={onNavigate}
                    />

                    <div className="ow-kpis">
                        <KpiCard
                            label={text.kpi.revenue}
                            value={format.moneyShort(data.growth.revenue.current)}
                            comparison={data.growth.revenue}
                            days={days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.orders}
                            value={format.whole(data.growth.orders.current)}
                            comparison={data.growth.orders}
                            days={days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.units}
                            value={format.whole(data.growth.units_delivered.current)}
                            comparison={data.growth.units_delivered}
                            days={days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.output}
                            value={format.whole(data.growth.output.current)}
                            comparison={data.growth.output}
                            days={days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.collected}
                            value={format.moneyShort(data.growth.collected.current)}
                            comparison={data.growth.collected}
                            days={days}
                            text={text}
                            format={format}
                        />
                    </div>

                    <TrendChart
                        trend={data.trend}
                        text={text}
                        format={format}
                        currency={currency}
                    />

                    <div className="ow-grid">
                        <CashSection data={data.cash} text={text} format={format} />
                        <ProductionSection data={data.production} text={text} format={format} />
                        <StockSection data={data.stock} text={text} format={format} />
                        <CustomersSection data={data.customers} text={text} format={format} />
                        <QualitySection data={data.quality} text={text} format={format} />
                        <PeopleSection data={data.people} text={text} format={format} />
                        <SafetySection data={data.safety} text={text} format={format} />
                        <EquipmentSection data={data.equipment} text={text} format={format} />
                        <ActivityList
                            entries={data.activity}
                            text={text}
                            format={format}
                            onViewAll={
                                pages.includes('activity')
                                    ? () => onNavigate('activity')
                                    : undefined
                            }
                        />
                    </div>
                </>
            )}
        </section>
    );
}
