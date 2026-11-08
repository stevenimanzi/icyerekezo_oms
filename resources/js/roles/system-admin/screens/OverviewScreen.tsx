import React from 'react';
import { Activity } from 'lucide-react';

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { AdminTable } from '../components/AdminTable';
import { Status } from '../components/Status';
import type { AdminContext } from '../useAdminData';

function formatSafeDate(raw: any): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? '—' : d.toLocaleString();
    } catch {
        return '—';
    }
}

export function OverviewScreen({ ctx }: { ctx: AdminContext }) {
    const { data } = ctx;
    const s = data?.statistics || {};
    const growth = Array.isArray(data?.growth) ? data.growth : [];
    const cards: [string, string | number][] = [
        ['Factories', s.factories || 0],
        [
            'Total revenue',
            s.revenue ? 'RWF ' + Number(s.revenue).toLocaleString() : 'RWF 0',
        ],
        ['Platform users', s.users || 0],
        ['Open support tickets', s.open_tickets || 0],
    ];

    const factories = Array.isArray(data?.factories) ? data.factories : [];
    const factoryRows = factories.filter(Boolean).map((f: any) => [
        f?.name || '—',
        f?.users_count ?? 0,
        <Status value={f?.status || 'active'} />,
    ]);

    const activities = Array.isArray(data?.activities) ? data.activities : [];

    return (
        <>
            <div className="admin-metrics">
                {cards.map(([label, value]) => (
                    <article key={label}>
                        <div>
                            <small>{label}</small>
                            <strong>{value}</strong>
                        </div>
                    </article>
                ))}
            </div>
            <article className="panel platform-growth">
                <header>
                    <div>
                        <span className="platform-kicker">12-MONTH TREND</span>
                        <h2>Platform growth</h2>
                        <p>
                            Cumulative factories, users and subscriptions from live platform
                            records.
                        </p>
                    </div>
                    <div className="growth-live">
                        <span>Current data</span>
                    </div>
                </header>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', padding: '6px 14px', background: 'var(--soft)', borderRadius: '6px', border: '1px solid var(--line)', margin: '0 16px 10px 16px', fontSize: '11.5px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '14px', height: '3px', background: '#1597e5', borderRadius: '2px', display: 'inline-block' }} />
                        <span><b>Blue line:</b> Total onboarded factories</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '14px', height: '3px', background: '#8b5cf6', borderRadius: '2px', display: 'inline-block' }} />
                        <span><b>Purple line:</b> Active registered users</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '14px', height: '3px', background: '#19b8ca', borderRadius: '2px', display: 'inline-block' }} />
                        <span><b>Teal line:</b> Active subscriptions</span>
                    </span>
                </div>
                <div className="platform-growth-chart" style={{ minHeight: 280, position: 'relative' }}>
                    {growth.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minHeight={260}>
                            <LineChart
                                data={growth}
                                margin={{ top: 14, right: 18, left: -12, bottom: 4 }}
                            >
                                <CartesianGrid
                                    vertical={false}
                                    stroke="var(--line)"
                                    strokeOpacity={0.75}
                                />
                                <XAxis
                                    dataKey="label"
                                    tickLine={false}
                                    axisLine={false}
                                    dy={8}
                                    tick={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 600 }}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                                />
                                <Tooltip
                                    cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }}
                                    contentStyle={{
                                        background: 'var(--panel)',
                                        border: '1px solid var(--line)',
                                        borderRadius: 10,
                                        boxShadow: '0 12px 30px rgba(15,23,42,.12)',
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="factories"
                                    name="Factories"
                                    stroke="#1597e5"
                                    strokeWidth={3}
                                    dot={{ r: 2, fill: '#1597e5', strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="users"
                                    name="Users"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={{ r: 2, fill: '#8b5cf6', strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="subscriptions"
                                    name="Subscriptions"
                                    stroke="#19b8ca"
                                    strokeWidth={3}
                                    dot={{ r: 2, fill: '#19b8ca', strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div
                            className="executive-empty"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                            }}
                        >
                            Waiting for growth data…
                        </div>
                    )}
                </div>
                <div className="growth-legend">
                    <span className="factories">Factories</span>
                    <span className="users">Users</span>
                    <span className="subscriptions">Subscriptions</span>
                </div>
            </article>
            <div className="admin-split">
                <article className="panel">
                    <h2>Recent factories</h2>
                    <AdminTable
                        headers={['Factory', 'Users', 'Status']}
                        rows={factoryRows}
                    />
                </article>
                <article className="panel">
                    <h2>Real system activity</h2>
                    <div className="activity-feed">
                        {activities.length > 0 ? (
                            activities.filter(Boolean).map((a: any, idx: number) => (
                                <div key={a?.id ?? idx}>
                                    <span>
                                        <Activity size={14} />
                                    </span>
                                    <div>
                                        <b>{a?.description || 'System event'}</b>
                                        <small>
                                            {a?.user?.name || 'System'} ·{' '}
                                            {formatSafeDate(a?.created_at)}
                                        </small>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--muted)', padding: '16px 0', textAlign: 'center' }}>
                                No recent activity.
                            </p>
                        )}
                    </div>
                </article>
            </div>
        </>
    );
}
