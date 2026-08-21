import React, { useEffect, useState } from 'react';
import { Activity, Building2, CheckCircle2, CreditCard, Database, Megaphone, MessageSquare, Plus, RefreshCw, Save, Settings, ShieldCheck, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SystemSettingsPanel from '../system/SystemSettingsPanel';

type Locale = 'en' | 'fr';
const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-CSRF-TOKEN': csrf(), ...(options.headers || {}) } });
    const text = await response.text();
    let payload: any = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The server returned a web page instead of data. Please refresh and sign in again.');
    }
    if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat().join(' ') || 'Request failed.');
    return payload;
}

const pageInfo: Record<string, [React.ElementType, string, string]> = {
    'platform-dashboard': [Activity, 'Platform overview', 'Live control of factories, users, subscriptions, support and system services.'],
    factories: [Building2, 'Factories', 'Register, approve, activate and suspend every factory.'],
    'platform-users': [Users, 'All users', 'Control account status and trusted platform administrators.'],
    subscriptions: [CreditCard, 'Subscriptions', 'Create plans, assign billing periods and monitor expiry.'],
    announcements: [Megaphone, 'Announcements', 'Broadcast important messages to platform users.'],
    'support-center': [MessageSquare, 'Support centre', 'Receive problems, reply and track resolution.'],
    backups: [Database, 'Database backups', 'Create and monitor secure recovery points.'],
    'system-settings': [Settings, 'System settings', 'Manage branding, registration and maintenance mode.'],
};
const industries = [
    ['general_manufacturing', 'General manufacturing'], ['clothing_textiles', 'Clothing and textiles'], ['food_processing', 'Food processing'], ['beverages', 'Beverages and drinks'],
    ['dairy', 'Milk and dairy products'], ['pharmaceuticals_medicines', 'Medicines and pharmaceuticals'], ['plastics_rubber', 'Plastics and rubber materials'], ['steel_metals', 'Steel and metal products'],
    ['grain_flour_milling', 'Maize, grain and flour milling'], ['agriculture_animal_feed', 'Agriculture and animal feed'], ['construction_materials', 'Construction materials, cement and bricks'],
    ['furniture_wood', 'Furniture and wood products'], ['paper_packaging_printing', 'Paper, packaging and printing'], ['chemicals_cosmetics_soap', 'Chemicals, cosmetics and soap'],
    ['electronics_electrical', 'Electronics and electrical products'], ['automotive_machinery', 'Automotive parts and machinery'], ['recycling_waste', 'Recycling and waste processing'], ['other', 'Other factory industry'],
];

export default function PlatformAdminPage({ page, locale }: { page: string; locale: Locale }) {
    const [data, setData] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Record<string, any>>({});
    const [Icon, title, description] = pageInfo[page] || pageInfo['platform-dashboard'];
    const endpoint = ({
        'platform-dashboard': '/api/platform/overview', factories: '/api/platform/factories', 'platform-users': '/api/platform/users',
        subscriptions: '/api/platform/subscriptions', announcements: '/api/platform/announcements', 'support-center': '/api/platform/tickets',
        backups: '/api/platform/backups', 'system-settings': '/api/platform/settings',
    } as Record<string, string>)[page];

    const load = async () => {
        setBusy(true);
        setError('');
        try {
            setData(await request(endpoint));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load.');
        } finally { setBusy(false); }
    };
    useEffect(() => { setShowForm(false); setForm({}); load(); }, [page]);
    useEffect(() => {
        if (!['support-center', 'platform-dashboard', 'backups'].includes(page)) return;
        const timer = window.setInterval(() => request(endpoint).then(setData).catch(() => {}), 5000);
        return () => window.clearInterval(timer);
    }, [page, endpoint]);

    const run = async (url: string, method: string, body?: any, message = 'Saved successfully.') => {
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            await request(url, { method, body: body ? JSON.stringify(body) : undefined });
            setSuccess(message);
            setShowForm(false);
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to save.');
            setBusy(false);
        }
    };
    const uploadLogo = async (file: File) => {
        const body = new FormData();
        body.append('logo', file);
        setBusy(true);
        setError('');
        try {
            await request('/api/platform/settings/logo', { method: 'POST', body });
            setSuccess('System logo uploaded.');
            await load();
            window.setTimeout(() => window.location.reload(), 500);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to upload logo.');
            setBusy(false);
        }
    };
    const records = page === 'platform-users' ? (data?.users?.data || []) : (data?.data || []);

    return (
        <section className="platform-page">
            <div className="platform-heading">
                <div><span className="platform-kicker">SYSTEM ADMINISTRATION</span><h1>{title}</h1><p>{description}</p></div>
                <div className="platform-heading-actions">
                    <button className="secondary-btn" onClick={load} disabled={busy}><RefreshCw size={15} />Refresh</button>
                    {!['platform-dashboard', 'support-center', 'system-settings'].includes(page) && (
                        <button className="primary-btn" onClick={() => setShowForm(!showForm)}><Plus size={16} />{page === 'backups' ? 'Create backup' : 'Create new'}</button>
                    )}
                </div>
            </div>
            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success"><CheckCircle2 size={16} />{success}</div>}

            {page === 'platform-dashboard' && <Dashboard data={data} />}

            {page === 'factories' && (
                <>
                    <FactoryForm open={showForm} form={form} setForm={setForm} submit={(values: any) => run('/api/platform/factories', 'POST', values, 'Factory registered and awaiting approval.')} />
                    <AdminTable
                        headers={['Factory', 'Industry', 'Users', 'Status', 'Action']}
                        rows={records.map((item: any) => [
                            <b>{item.name}</b>, item.industry_type || '—', item.users_count, <Status value={item.status} />,
                            <select value={item.status} onChange={event => run(`/api/platform/factories/${item.id}`, 'PATCH', { status: event.target.value }, 'Factory status updated.')}>
                                <option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option>
                            </select>,
                        ])}
                    />
                </>
            )}

            {page === 'platform-users' && (
                <>
                    <UserForm open={showForm} factories={data?.factories || []} submit={(values: any) => run('/api/platform/users', 'POST', values, 'Factory user created successfully.')} />
                    <AdminTable
                        headers={['User', 'Email', 'Factories', 'Active', 'Password']}
                        rows={records.map((item: any) => [
                            <b>{item.name}</b>, item.email, item.factories?.map((f: any) => f.name).join(', ') || 'Not assigned',
                            <Toggle checked={item.is_active} onChange={value => run(`/api/platform/users/${item.id}`, 'PATCH', { is_active: value })} />,
                            <button className="table-action" onClick={() => { const password = window.prompt(`Enter a new secure password for ${item.email}`); if (password) run(`/api/platform/users/${item.id}/password`, 'PUT', { password, password_confirmation: password }, 'Password reset successfully.'); }}>Reset password</button>,
                        ])}
                    />
                </>
            )}

            {page === 'subscriptions' && (
                <SubscriptionPanel
                    data={data} open={showForm} busy={busy}
                    submitPlan={(values: any) => run('/api/platform/plans', 'POST', values, 'Subscription plan created.')}
                    updatePlan={(id: number, values: any) => run(`/api/platform/plans/${id}`, 'PUT', values, 'Subscription plan updated.')}
                    assign={(values: any) => run(`/api/platform/factories/${values.factory_id}/subscriptions`, 'POST', values, 'Subscription assigned and factory activated.')}
                    changeSubscription={(id: number, values: any) => run(`/api/platform/subscriptions/${id}`, 'PATCH', values, 'Factory subscription changed.')}
                />
            )}

            {page === 'announcements' && (
                <>
                    <SimpleForm
                        open={showForm}
                        fields={[['title', 'Title'], ['message', 'Message', 'textarea'], ['severity', 'Severity', 'select', ['info', 'success', 'warning', 'critical']], ['audience', 'Audience', 'select', ['all', 'factory_owners', 'factory_users']]]}
                        form={form} setForm={setForm}
                        submit={(values: any) => run('/api/platform/announcements', 'POST', values, 'Announcement published to users.')}
                    />
                    <AdminTable
                        headers={['Title', 'Message', 'Severity', 'Audience', 'Published']}
                        rows={records.map((item: any) => [<b>{item.title}</b>, item.message, <Status value={item.severity} />, item.audience, new Date(item.published_at).toLocaleString()])}
                    />
                </>
            )}

            {page === 'support-center' && <SupportPanel records={records} busy={busy} reply={(id: number, message: string, status: string) => run(`/api/platform/tickets/${id}/reply`, 'POST', { message, status }, 'Reply sent.')} />}

            {page === 'backups' && (
                <>
                    <BackupAction open={showForm} busy={busy} submit={() => run('/api/platform/backups', 'POST', undefined, 'Backup queued securely.')} />
                    <AdminTable
                        headers={['Requested', 'Status', 'Size', 'File', 'Completed']}
                        rows={records.map((item: any) => [
                            new Date(item.created_at).toLocaleString(), <Status value={item.status} />,
                            item.size_bytes ? `${(item.size_bytes / 1048576).toFixed(2)} MB` : '—', item.path || '—',
                            item.completed_at ? new Date(item.completed_at).toLocaleString() : '—',
                        ])}
                    />
                </>
            )}

            {page === 'system-settings' && (
                <SystemSettingsPanel
                    settings={data || {}} editing={true} busy={busy} uploadLogo={uploadLogo}
                    submit={async (values: any) => { await run('/api/platform/settings', 'PUT', values, 'System configuration updated.'); window.setTimeout(() => window.location.reload(), 500); }}
                />
            )}

            {busy && !data && <div className="admin-loading">Loading platform controls…</div>}
        </section>
    );
}

function Dashboard({ data }: { data: any }) {
    const s = data?.statistics || {};
    const growth = data?.growth || [];
    const cards: [string, number, React.ElementType][] = [
        ['Factories', s.factories || 0, Building2], ['Active subscriptions', s.active_subscriptions || 0, CreditCard],
        ['Platform users', s.users || 0, Users], ['Open support tickets', s.open_tickets || 0, MessageSquare],
    ];

    return (
        <>
            <div className="admin-metrics">
                {cards.map(([label, value, CardIcon]) => (
                    <article key={label}><span><CardIcon size={20} /></span><div><small>{label}</small><strong>{value}</strong></div></article>
                ))}
            </div>
            <article className="panel platform-growth">
                <header>
                    <div><span className="platform-kicker">14-DAY TREND</span><h2>Platform growth</h2><p>Cumulative factories, users and subscriptions from live platform records.</p></div>
                    <div className="growth-live"><i></i><span>Live data</span></div>
                </header>
                <div className="platform-growth-chart">
                    {growth.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={growth} margin={{ top: 14, right: 18, left: -12, bottom: 4 }}>
                                <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={.75} />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} dy={8} tick={{ fill: 'var(--muted)', fontSize: 11, fontWeight: 600 }} />
                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                                <Tooltip cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,23,42,.12)' }} />
                                <Line type="monotone" dataKey="factories" name="Factories" stroke="#1597e5" strokeWidth={3} dot={{ r: 2, fill: '#1597e5', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="users" name="Users" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 2, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="subscriptions" name="Subscriptions" stroke="#19b8ca" strokeWidth={3} dot={{ r: 2, fill: '#19b8ca', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <div className="executive-empty">Waiting for growth data…</div>}
                </div>
                <div className="growth-legend"><span className="factories">Factories</span><span className="users">Users</span><span className="subscriptions">Subscriptions</span></div>
            </article>
            <div className="admin-split">
                <article className="panel">
                    <h2>Recent factories</h2>
                    <AdminTable headers={['Factory', 'Users', 'Status']} rows={(data?.factories || []).map((f: any) => [f.name, f.users_count, <Status value={f.status} />])} />
                </article>
                <article className="panel">
                    <h2>Real system activity</h2>
                    <div className="activity-feed">
                        {(data?.activities || []).map((a: any) => (
                            <div key={a.id}><span><Activity size={14} /></span><div><b>{a.description}</b><small>{a.user?.name || 'System'} · {new Date(a.created_at).toLocaleString()}</small></div></div>
                        ))}
                    </div>
                </article>
            </div>
        </>
    );
}

function FactoryForm({ open, form, setForm, submit }: any) {
    if (!open) return null;
    const update = (key: string, value: string) => setForm({ ...form, [key]: value });
    const credentialFields: [string, string, string][] = [
        ['owner_name', 'Owner name', 'text'], ['owner_email', 'Owner email', 'email'], ['owner_password', 'Owner temporary password', 'password'],
        ['manager_name', 'Factory manager name', 'text'], ['manager_email', 'Factory manager email', 'email'], ['manager_password', 'Manager temporary password', 'password'],
    ];
    return (
        <form className="admin-form panel" onSubmit={e => { e.preventDefault(); submit({ ...form, industry_type: form.industry_type === 'other' ? form.industry_other : form.industry_type }); }}>
            <h2>Register factory, owner and manager</h2>
            <div className="form-grid">
                <label>Factory name<input required value={form.factory_name || ''} onChange={e => update('factory_name', e.target.value)} /></label>
                <label>
                    Industry type
                    <select required value={form.industry_type || ''} onChange={e => update('industry_type', e.target.value)}>
                        <option value="">Choose factory industry</option>
                        {industries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </label>
                {form.industry_type === 'other' && <label>Custom industry name<input required value={form.industry_other || ''} onChange={e => update('industry_other', e.target.value)} /></label>}
                {credentialFields.map(([key, label, type]) => <label key={key}>{label}<input required type={type} value={form[key] || ''} onChange={e => update(key, e.target.value)} /></label>)}
            </div>
            <button className="primary-btn"><Save size={16} />Register factory</button>
        </form>
    );
}
function UserForm({ open, factories, submit }: any) {
    const [values, setValues] = useState<any>({});
    const selected = factories.find((f: any) => String(f.id) === String(values.factory_id));
    if (!open) return null;
    const userFields: [string, string, string][] = [
        ['name', 'Full name', 'text'], ['email', 'Email address', 'email'], ['employee_number', 'Employee number', 'text'], ['job_title', 'Job title', 'text'], ['password', 'Temporary password', 'password'],
    ];
    return (
        <form className="admin-form panel" onSubmit={e => { e.preventDefault(); submit(values); }}>
            <h2>Create factory user</h2>
            <div className="form-grid">
                <label>
                    Factory
                    <select required value={values.factory_id || ''} onChange={e => setValues({ ...values, factory_id: e.target.value, role_id: '' })}>
                        <option value="">Select factory</option>
                        {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </label>
                <label>
                    Role
                    <select required value={values.role_id || ''} onChange={e => setValues({ ...values, role_id: e.target.value })}>
                        <option value="">Select role</option>
                        {(selected?.roles || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </label>
                {userFields.map(([key, label, type]) => <label key={key}>{label}<input required={key !== 'job_title'} type={type} value={values[key] || ''} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}
            </div>
            <button className="primary-btn"><Save size={16} />Create user account</button>
        </form>
    );
}

const planTemplates: any = {
    starter: { name: 'Starter', code: 'STARTER', monthly_price: 100000, currency_code: 'RWF', features: ['dashboard', 'production', 'inventory', 'products', 'team', 'reports', 'support'] },
    professional: { name: 'Professional', code: 'PROFESSIONAL', monthly_price: 200000, currency_code: 'RWF', features: ['dashboard', 'production', 'inventory', 'products', 'procurement', 'quality', 'sales', 'logistics', 'team', 'maintenance', 'reports', 'support'] },
    enterprise: { name: 'Enterprise', code: 'ENTERPRISE', monthly_price: 300000, currency_code: 'RWF', features: ['dashboard', 'production', 'inventory', 'products', 'procurement', 'quality', 'sales', 'logistics', 'team', 'maintenance', 'reports', 'support'] },
};
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateAfter = (value: string, months: number, days = 0) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    date.setMonth(date.getMonth() + months);
    date.setDate(date.getDate() + days);
    return localDate(date);
};

function SubscriptionPanel({ data, open, busy, submitPlan, updatePlan, assign, changeSubscription }: any) {
    const today = localDate(new Date());
    const catalog = Object.entries(data?.feature_catalog || {});
    const [template, setTemplate] = useState('');
    const [plan, setPlan] = useState<any>({ currency_code: 'RWF', features: [] });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [subscription, setSubscription] = useState<any>({ starts_at: today, ends_at: dateAfter(today, 1), grace_ends_at: dateAfter(today, 1, 7) });
    const [changes, setChanges] = useState<Record<number, string>>({});
    const selectedPlan = (data?.plans || []).find((item: any) => String(item.id) === String(subscription.subscription_plan_id));

    const updateStart = (starts_at: string) => setSubscription({ ...subscription, starts_at, ends_at: dateAfter(starts_at, 1), grace_ends_at: dateAfter(starts_at, 1, 7) });
    const updateEnd = (ends_at: string) => setSubscription({ ...subscription, ends_at, grace_ends_at: dateAfter(ends_at, 0, 7) });
    const chooseTemplate = (value: string) => {
        setTemplate(value);
        setEditingId(null);
        setPlan(value ? { ...planTemplates[value], features: [...planTemplates[value].features] } : { currency_code: 'RWF', features: [] });
    };
    const edit = (item: any) => {
        setEditingId(item.id);
        setTemplate('');
        setPlan({ ...item, features: item.features || [] });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const toggleFeature = (key: string) => setPlan({ ...plan, features: (plan.features || []).includes(key) ? plan.features.filter((item: string) => item !== key) : [...(plan.features || []), key] });
    const savePlan = (event: React.FormEvent) => { event.preventDefault(); editingId ? updatePlan(editingId, plan) : submitPlan(plan); };
    const planFields: [string, string][] = [['name', 'Plan name'], ['code', 'Plan code'], ['monthly_price', 'Price per month'], ['currency_code', 'Currency']];

    return (
        <>
            {(open || editingId) && (
                <div className="subscription-editor-grid">
                    <form className="admin-form panel plan-editor" onSubmit={savePlan}>
                        <header>
                            <div><span>{editingId ? 'EDIT PLAN' : 'NEW PLAN'}</span><h2>{editingId ? 'Update subscription type' : 'Create subscription type'}</h2></div>
                            {editingId && <button type="button" className="table-action" onClick={() => { setEditingId(null); setPlan({ currency_code: 'RWF', features: [] }); }}>Cancel</button>}
                        </header>
                        {!editingId && (
                            <label>
                                Start from template
                                <select value={template} onChange={e => chooseTemplate(e.target.value)}>
                                    <option value="">Empty plan</option>
                                    <option value="starter">Starter — RWF 100,000</option>
                                    <option value="professional">Professional — RWF 200,000</option>
                                    <option value="enterprise">Enterprise — RWF 300,000</option>
                                </select>
                            </label>
                        )}
                        <div className="form-grid">
                            {planFields.map(([key, label]) => <label key={key}>{label}<input required type={key === 'monthly_price' ? 'number' : 'text'} value={plan[key] || ''} onChange={e => setPlan({ ...plan, [key]: e.target.value })} /></label>)}
                        </div>
                        <div className="feature-editor">
                            <div><h3>Included features</h3><p>Select what factories on this subscription type can access.</p></div>
                            <div className="feature-options">
                                {catalog.map(([key, label]: any) => (
                                    <label className={(plan.features || []).includes(key) ? 'selected' : ''} key={key}>
                                        <input type="checkbox" checked={(plan.features || []).includes(key)} onChange={() => toggleFeature(key)} /><span><CheckCircle2 size={16} />{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button className="primary-btn" disabled={busy}><Save size={16} />{editingId ? 'Save plan changes' : 'Create subscription type'}</button>
                    </form>

                    {open && (
                        <form className="admin-form panel assignment-editor" onSubmit={e => { e.preventDefault(); assign(subscription); }}>
                            <h2>Assign or renew subscription</h2>
                            <label>
                                Factory
                                <select required value={subscription.factory_id || ''} onChange={e => setSubscription({ ...subscription, factory_id: e.target.value })}>
                                    <option value="">Select factory</option>
                                    {(data?.factories || []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </label>
                            <label>
                                Subscription type
                                <select required value={subscription.subscription_plan_id || ''} onChange={e => setSubscription({ ...subscription, subscription_plan_id: e.target.value })}>
                                    <option value="">Select subscription type</option>
                                    {(data?.plans || []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.currency_code} {Number(p.monthly_price).toLocaleString()}/month</option>)}
                                </select>
                            </label>
                            {selectedPlan && <div className="selected-plan-summary"><b>{selectedPlan.name}</b><span>{(selectedPlan.features || []).length} features included</span></div>}
                            <label>Subscription starts on<input required type="date" value={subscription.starts_at} onChange={e => updateStart(e.target.value)} /></label>
                            <label>Payment is due on<input required type="date" value={subscription.ends_at} onChange={e => updateEnd(e.target.value)} /></label>
                            <label>Factory access stops on<input readOnly type="date" value={subscription.grace_ends_at || ''} /><small>The factory gets 7 extra days to pay after the due date.</small></label>
                            <button className="primary-btn" disabled={busy}><CreditCard size={16} />Activate subscription</button>
                        </form>
                    )}
                </div>
            )}

            <div className="subscription-plan-grid">
                {(data?.plans || []).map((item: any) => (
                    <article className="panel subscription-plan-card" key={item.id}>
                        <header><span><CreditCard size={20} /></span><button className="table-action" onClick={() => edit(item)}>Edit plan</button></header>
                        <small>{item.code}</small>
                        <h3>{item.name}</h3>
                        <strong>{item.currency_code} {Number(item.monthly_price).toLocaleString()}<em>/month</em></strong>
                        <div className="plan-features">{(item.features || []).map((key: string) => <span key={key}><CheckCircle2 size={13} />{(data?.feature_catalog || {})[key] || key}</span>)}</div>
                    </article>
                ))}
            </div>

            <AdminTable
                headers={['Factory', 'Current type', 'Status', 'Starts', 'Payment due', 'Change subscription type']}
                rows={(data?.subscriptions?.data || []).map((item: any) => [
                    item.factory?.name, item.plan?.name, <Status value={item.status} />, new Date(item.starts_at).toLocaleDateString(), new Date(item.ends_at).toLocaleDateString(),
                    <div className="subscription-change">
                        <select value={changes[item.id] || item.subscription_plan_id} onChange={e => setChanges({ ...changes, [item.id]: e.target.value })}>
                            {(data?.plans || []).map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                        </select>
                        <button className="table-action" disabled={busy || String(changes[item.id] || item.subscription_plan_id) === String(item.subscription_plan_id)} onClick={() => changeSubscription(item.id, { subscription_plan_id: changes[item.id] })}>Save</button>
                    </div>,
                ])}
            />
        </>
    );
}

function SupportPanel({ records, reply, busy }: any) {
    const [activeId, setActiveId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    useEffect(() => { if (records.length && !records.some((item: any) => item.id === activeId)) setActiveId(records[0].id); }, [records, activeId]);
    const ticket = records.find((item: any) => item.id === activeId);
    const send = () => {
        const text = message.trim();
        if (!text || !ticket) return;
        reply(ticket.id, text, 'waiting_customer');
        setMessage('');
    };

    if (!records.length) {
        return <div className="panel empty-state"><span><MessageSquare size={28} /></span><h3>No support conversations yet</h3><p>Questions sent by factory users will appear here automatically.</p></div>;
    }

    return (
        <div className="support-room panel">
            <aside className="chat-list">
                {records.map((item: any) => (
                    <button key={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => setActiveId(item.id)}>
                        <span>{item.user?.name?.slice(0, 2).toUpperCase() || 'US'}</span>
                        <div><b>{item.user?.name || 'System user'}</b><small>{item.subject}</small><em>{item.factory?.name || 'Platform'} · {item.status.replaceAll('_', ' ')}</em></div>
                    </button>
                ))}
            </aside>
            {ticket && (
                <section className="chat-window">
                    <header>
                        <div><h3>{ticket.subject}</h3><p>{ticket.user?.name} · {ticket.user?.email} · {ticket.factory?.name || 'Platform'}</p></div>
                        <Status value={ticket.status} />
                    </header>
                    <div className="chat-messages">
                        {ticket.messages?.map((item: any) => (
                            <div key={item.id} className={item.user?.is_platform_admin ? 'chat-message admin' : 'chat-message user'}>
                                <b>{item.user?.is_platform_admin ? 'System administrator' : item.user?.name || 'User'}</b><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time>
                            </div>
                        ))}
                    </div>
                    <div className="chat-compose">
                        <textarea aria-label="Reply message" placeholder="Write your answer…" value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                        <button className="primary-btn" disabled={busy || !message.trim()} onClick={send}>Send</button>
                    </div>
                </section>
            )}
        </div>
    );
}
function BackupAction({ open, busy, submit }: any) {
    if (!open) return null;
    return (
        <div className="admin-form panel">
            <h2>Create database backup</h2>
            <p>This creates a protected, compressed database recovery point now. Credentials are never included in the backup history.</p>
            <button className="primary-btn" disabled={busy} onClick={submit}><Database size={16} />Create backup now</button>
        </div>
    );
}

// Superseded by the imported SystemSettingsPanel (used for the 'system-settings' page
// above) — kept intact rather than removed since nothing currently references it, but
// deleting unreferenced code wasn't part of this pass's scope.
function SettingsPanel({ settings, editing, submit, busy }: any) {
    const [values, setValues] = useState<any>({});
    const update = (key: string, value: any) => setValues((current: any) => ({ ...current, [key]: value }));
    useEffect(() => setValues({
        system_name: settings.system_name || 'ICYEREKEZO OMS', system_tagline: settings.system_tagline || 'Factory operations made clear.',
        logo_url: settings.logo_url || '', support_email: settings.support_email || '', support_phone: settings.support_phone || '',
        default_locale: settings.default_locale || 'en', currency_code: settings.currency_code || 'RWF', timezone: settings.timezone || 'Africa/Kigali',
        backup_retention_days: Number(settings.backup_retention_days || 30), registration_enabled: settings.registration_enabled !== '0',
        maintenance_enabled: settings.maintenance_enabled === '1', maintenance_message: settings.maintenance_message || 'Scheduled maintenance in progress.',
    }), [settings]);

    return (
        <div className="settings-live">
            <article className="panel admin-form settings-form">
                <section>
                    <h2>System identity</h2>
                    <div className="form-grid">
                        <label>System name<input disabled={!editing} value={values.system_name || ''} onChange={e => update('system_name', e.target.value)} /></label>
                        <label>Short description<input disabled={!editing} value={values.system_tagline || ''} onChange={e => update('system_tagline', e.target.value)} /></label>
                    </div>
                    <label>Logo web address<input disabled={!editing} placeholder="https://…" value={values.logo_url || ''} onChange={e => update('logo_url', e.target.value)} /></label>
                </section>
                <section>
                    <h2>Support contact</h2>
                    <div className="form-grid">
                        <label>Support email<input disabled={!editing} type="email" value={values.support_email || ''} onChange={e => update('support_email', e.target.value)} /></label>
                        <label>Support phone<input disabled={!editing} value={values.support_phone || ''} onChange={e => update('support_phone', e.target.value)} /></label>
                    </div>
                </section>
                <section>
                    <h2>Defaults for new factories</h2>
                    <div className="form-grid">
                        <label>
                            Default language
                            <select disabled={!editing} value={values.default_locale || 'en'} onChange={e => update('default_locale', e.target.value)}><option value="en">English</option><option value="fr">Français</option></select>
                        </label>
                        <label>
                            Default currency
                            <select disabled={!editing} value={values.currency_code || 'RWF'} onChange={e => update('currency_code', e.target.value)}>
                                <option value="RWF">Rwandan franc (RWF)</option><option value="USD">US dollar (USD)</option><option value="EUR">Euro (EUR)</option>
                            </select>
                        </label>
                        <label>
                            Default time zone
                            <select disabled={!editing} value={values.timezone || 'Africa/Kigali'} onChange={e => update('timezone', e.target.value)}>
                                <option value="Africa/Kigali">Kigali</option><option value="Africa/Johannesburg">Johannesburg</option><option value="Africa/Nairobi">Nairobi</option><option value="UTC">UTC</option>
                            </select>
                        </label>
                        <label>Keep backups for (days)<input disabled={!editing} type="number" min="1" max="365" value={values.backup_retention_days || 30} onChange={e => update('backup_retention_days', Number(e.target.value))} /></label>
                    </div>
                </section>
                <section>
                    <h2>Access and availability</h2>
                    <label className="switch-line"><span><b>Allow new factory registration</b><small>When off, the public registration form cannot create accounts.</small></span><Toggle disabled={!editing} checked={!!values.registration_enabled} onChange={(v: boolean) => update('registration_enabled', v)} /></label>
                    <label className="switch-line danger"><span><b>Maintenance mode</b><small>Factory users are temporarily blocked; platform administrators keep access.</small></span><Toggle disabled={!editing} checked={!!values.maintenance_enabled} onChange={(v: boolean) => update('maintenance_enabled', v)} /></label>
                    <label>Message shown during maintenance<textarea disabled={!editing} value={values.maintenance_message || ''} onChange={e => update('maintenance_message', e.target.value)} /></label>
                </section>
                {editing && <button className="primary-btn" disabled={busy} onClick={() => submit(values)}><Save size={16} />Save all settings</button>}
            </article>
            <aside>
                <article className="panel settings-summary"><ShieldCheck size={28} /><h3>{values.system_name || 'ICYEREKEZO OMS'}</h3><p>{values.system_tagline}</p><Status value={values.maintenance_enabled ? 'maintenance enabled' : 'system online'} /></article>
                <article className="panel settings-facts">
                    <h3>Current configuration</h3>
                    <div><span>Registration</span><b>{values.registration_enabled ? 'Open' : 'Closed'}</b></div>
                    <div><span>Language</span><b>{values.default_locale === 'fr' ? 'French' : 'English'}</b></div>
                    <div><span>Currency</span><b>{values.currency_code}</b></div>
                    <div><span>Time zone</span><b>{values.timezone}</b></div>
                    <div><span>Backup retention</span><b>{values.backup_retention_days} days</b></div>
                </article>
            </aside>
        </div>
    );
}

function SimpleForm({ open, fields, form, setForm, submit }: any) {
    if (!open) return null;
    const values = { ...form };
    fields.forEach(([key, , type = 'text', options]: any) => { if (type === 'select' && !values[key]) values[key] = options[0]; });
    return (
        <form className="admin-form panel" onSubmit={e => { e.preventDefault(); submit(values); }}>
            <h2>Enter details</h2>
            <div className="form-grid">
                {fields.map(([key, label, type = 'text', options]: any) => (
                    <label key={key}>
                        {label}
                        {type === 'textarea' ? <textarea required value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                            : type === 'select' ? <select required value={values[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>{options.map((o: string) => <option key={o} value={o}>{o.replaceAll('_', ' ')}</option>)}</select>
                                : <input required type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />}
                    </label>
                ))}
            </div>
            <button className="primary-btn" type="submit"><Save size={16} />Save</button>
        </form>
    );
}
function AdminTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="empty-cell">No records yet.</td></tr>}</tbody>
            </table>
        </div>
    );
}
function Status({ value }: { value: string }) {
    return <span className={`admin-status ${String(value).replaceAll(' ', '-')}`}>{value}</span>;
}
function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return <button type="button" disabled={disabled} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button>;
}
