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
    const hasData = trend.some((point) => point[metric] > 0);

    return (
        <article className="panel ow-trend">
            <div className="panel-title">
                <h2>{text.trend}</h2>
                <div className="ow-tabs" role="tablist">
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
            <div className="ow-chart">
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
                                stroke="var(--line)"
                            />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={56}
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                tickFormatter={(value: number) => format.compact(value)}
                            />
                            <Tooltip
                                formatter={(value) => formatValue(Number(value))}
                                contentStyle={{
                                    background: 'var(--panel)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 10,
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
