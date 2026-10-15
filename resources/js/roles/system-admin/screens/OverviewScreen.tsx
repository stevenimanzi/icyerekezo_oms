import React from 'react';
import { Activity, Building2, CreditCard, MessageSquare, Users } from 'lucide-react';
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

export function OverviewScreen({ ctx }: { ctx: AdminContext }) {
    const { data } = ctx;
    const s = data?.statistics || {};
    const growth = data?.growth || [];
    const cards: [string, string | number, React.ElementType][] = [
        ['Factories', s.factories || 0, Building2],
        [
            'Total revenue',
            s.revenue ? 'RWF ' + Number(s.revenue).toLocaleString() : 'RWF 0',
            CreditCard,
        ],
        ['Platform users', s.users || 0, Users],
        ['Open support tickets', s.open_tickets || 0, MessageSquare],
    ];

    return (
        <>
            <div className="admin-metrics">
                {cards.map(([label, value, CardIcon]) => (
                    <article key={label}>
                        <span>
                            <CardIcon size={20} />
                        </span>
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
                <div className="platform-growth-chart">
                    {growth.length ? (
                        <ResponsiveContainer width="100%" height="100%">
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
                        <div className="executive-empty">Waiting for growth data…</div>
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
                        rows={(data?.factories || []).map((f: any) => [
                            f.name,
                            f.users_count,
                            <Status value={f.status} />,
                        ])}
                    />
                </article>
                <article className="panel">
                    <h2>Real system activity</h2>
                    <div className="activity-feed">
                        {(data?.activities || []).map((a: any) => (
                            <div key={a.id}>
                                <span>
                                    <Activity size={14} />
                                </span>
                                <div>
                                    <b>{a.description}</b>
                                    <small>
                                        {a.user?.name || 'System'} ·{' '}
                                        {new Date(a.created_at).toLocaleString()}
                                    </small>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>
            </div>
        </>
    );
}
