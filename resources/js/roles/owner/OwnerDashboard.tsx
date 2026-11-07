import { useMemo, useState } from 'react';
import type { HomeProps } from '../types';
import { KpiCard } from './components/KpiCard';
import { TrendChart } from './components/TrendChart';
import { makeFormat } from '../../core/format';
import './owner.css';
import { ProductionFlowSection } from './sections/ProductionFlowSection';
import { ProductionSection } from './sections/ProductionSection';
import { ownerText } from './text';
import { useOwnerOverview } from './useOwnerOverview';

const PERIOD_OPTIONS = [
    { value: 1, labelKey: 1 },
    { value: 7, labelKey: 7 },
    { value: 30, labelKey: 30 },
    { value: 90, labelKey: 90 },
    { value: 365, labelKey: 365 },
    { value: 'custom', labelKey: 'custom' },
];

export default function OwnerDashboard({ user, locale }: HomeProps) {
    const [period, setPeriod] = useState<number | string>(30);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
    const { data, error, updatedAt, loading, reload } = useOwnerOverview(period, startDate, endDate);

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
                <div className="ow-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        aria-label="Period"
                        value={period}
                        onChange={(event) => {
                            const val = event.target.value;
                            setPeriod(val === 'custom' ? 'custom' : Number(val));
                        }}
                        style={{
                            padding: '0.4rem 2rem 0.4rem 1rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            fontWeight: 600,
                        }}
                    >
                        {PERIOD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {text.periods[opt.labelKey]}
                            </option>
                        ))}
                    </select>

                    {period === 'custom' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="admin-input"
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.875rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    background: '#ffffff',
                                }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>~</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="admin-input"
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.875rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    background: '#ffffff',
                                }}
                            />
                        </div>
                    )}

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
                    <div className="ow-kpis">
                        <KpiCard
                            label={text.kpi.revenue}
                            value={format.moneyShort(data.growth.revenue.current)}
                            comparison={data.growth.revenue}
                            days={data.period.days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.orders}
                            value={format.whole(data.growth.orders.current)}
                            comparison={data.growth.orders}
                            days={data.period.days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.units}
                            value={format.whole(data.growth.units_delivered.current)}
                            comparison={data.growth.units_delivered}
                            days={data.period.days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.output}
                            value={format.whole(data.growth.output.current)}
                            comparison={data.growth.output}
                            days={data.period.days}
                            text={text}
                            format={format}
                        />
                        <KpiCard
                            label={text.kpi.collected}
                            value={format.moneyShort(data.growth.collected.current)}
                            comparison={data.growth.collected}
                            days={data.period.days}
                            text={text}
                            format={format}
                        />
                    </div>

                    {/* Row 2: Developed Analytics Chart */}
                    <div style={{ marginBottom: '20px' }}>
                        <TrendChart
                            trend={data.trend}
                            text={text}
                            format={format}
                            currency={currency}
                        />
                    </div>

                    {/* Row 3: Stage Operational Overview Table */}
                    <div style={{ marginBottom: '20px' }}>
                        {data.flow ? (
                            <ProductionFlowSection
                                data={data.flow}
                                text={text}
                                format={format}
                                locale={locale}
                            />
                        ) : (
                            <ProductionSection data={data.production} text={text} format={format} />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
