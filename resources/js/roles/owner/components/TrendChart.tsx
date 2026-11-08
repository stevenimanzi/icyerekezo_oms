import { useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { Format } from '../../../core/format';
import type { ownerText } from '../text';
import type { OwnerOverview } from '../types';

type Text = (typeof ownerText)['en'];
type Metric = 'revenue' | 'orders' | 'output';

type Props = {
    trend: OwnerOverview['trend'];
    text: Text;
    format: Format;
    currency: string;
};

export function TrendChart({ trend, text, format, currency }: Props) {
    const [metric, setMetric] = useState<Metric>('revenue');

    const formatValue = (value: number) =>
        metric === 'revenue' ? `${currency} ${format.whole(value)}` : format.whole(value);
    
    const metricTotal = trend.reduce((sum, point) => sum + (point[metric] || 0), 0);
    const hasData = trend && trend.length > 0;

    const metricExplanaion = {
        revenue: 'Blue line represents total factory revenue (RWF) generated from fulfilled orders and sales.',
        orders: 'Blue line represents total count of school and client orders processed over time.',
        output: 'Blue line represents total garment units completed across cutting, sewing, and finishing.',
    };

    return (
        <article className="panel ow-trend" style={{ padding: '20px 24px' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{text.trend}</h2>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        Total for this period: <b style={{ color: 'var(--text)' }}>{formatValue(metricTotal)}</b>
                    </span>
                </div>
                <div className="ow-tabs" role="tablist" style={{ margin: 0 }}>
                    {(Object.keys(text.trendTabs) as Metric[]).map((key) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={metric === key}
                            className={metric === key ? 'active' : ''}
                            onClick={() => setMetric(key)}
                        >
                            {text.trendTabs[key]}
                        </button>
                    ))}
                </div>
            </div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    margin: '0 0 16px 0',
                    background: 'var(--info-bg)',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--info)',
                }}
            >
                <span
                    style={{
                        display: 'inline-block',
                        width: '18px',
                        height: '3px',
                        background: '#2563eb',
                        borderRadius: '2px',
                    }}
                />
                <span>{metricExplanaion[metric]}</span>
            </div>
            <div className="ow-chart" style={{ width: '100%', height: '320px', padding: 0 }}>
                {hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="owTrendFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="var(--line, #e2e8f0)"
                            />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted, #64748b)', fontSize: 12 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={56}
                                tick={{ fill: 'var(--muted, #64748b)', fontSize: 12 }}
                                tickFormatter={(value: number) => format.compact(value)}
                            />
                            <Tooltip
                                formatter={(value) => formatValue(Number(value))}
                                contentStyle={{
                                    background: 'var(--panel, #ffffff)',
                                    border: '1px solid var(--line, var(--line))',
                                    borderRadius: 10,
                                    fontSize: '12px',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey={metric}
                                stroke="#2563eb"
                                strokeWidth={3}
                                fill="url(#owTrendFill)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="ow-empty">—</p>
                )}
            </div>
        </article>
    );
}
