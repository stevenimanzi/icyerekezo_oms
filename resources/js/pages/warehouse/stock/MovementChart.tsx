import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Format } from '../../../core/format';
import type { StockText } from './text';
import type { StockAnalytics } from './types';

type Props = { movement: StockAnalytics['movement']; text: StockText; format: Format };

export function MovementChart({ movement, text, format }: Props) {
    const copy = text.overview;
    const data = movement.daily.map((point) => ({
        ...point,
        label: format.date(point.day).replace(/\s\d{4}$/, ''),
    }));
    const hasData = movement.daily.some((point) => point.received > 0 || point.issued > 0);

    return (
        <article className="panel">
            <div className="panel-title">
                <h2>{copy.movementTitle}</h2>
            </div>
            <div className="ui-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0 0 16px 0', fontSize: '12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#16a34a', display: 'inline-block' }} />
                    <b>{copy.received}</b> (Green: Stock received into warehouse): {format.money(movement.received_value)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b', display: 'inline-block' }} />
                    <b>{copy.issued}</b> (Orange: Materials issued to factory floor): {format.money(movement.issued_value)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#dc2626', display: 'inline-block' }} />
                    <b>{copy.wasted}</b> (Red: Damaged/scrap losses): {format.money(movement.wasted_value)}
                </span>
            </div>
            <div className="ui-chart">
                {hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={56}
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                tickFormatter={(value: number) => format.compact(value)}
                            />
                            <Tooltip
                                formatter={(value) => format.money(Number(value))}
                                contentStyle={{
                                    background: 'var(--panel)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 10,
                                }}
                            />
                            <Bar
                                dataKey="received"
                                name={copy.received}
                                fill="#16a34a"
                                radius={[4, 4, 0, 0]}
                            />
                            <Bar
                                dataKey="issued"
                                name={copy.issued}
                                fill="#f59e0b"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="ui-empty">{text.stockIn.empty}</div>
                )}
            </div>
        </article>
    );
}
