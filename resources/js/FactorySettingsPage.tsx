import React, {useEffect, useState} from 'react';
import {Building2, Clock3, FileText, Factory, MapPin, Save, Settings, ShieldCheck} from 'lucide-react';

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function api(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {...options, headers: {Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf(), ...(options.headers || {})}});
    const text = await response.text();
    let data: any;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The server returned an invalid response.');
    }
    if (!response.ok) throw new Error(data.message || Object.values(data.errors || {}).flat().join(' ') || 'Request failed.');
    return data;
}

const Field = ({label, note, children}: any) => <label>{label}{children}{note && <small>{note}</small>}</label>;
const Card = ({icon: Icon, title, note, children}: any) => <section className="panel factory-setting-card"><header><span><Icon/></span><div><h2>{title}</h2><p>{note}</p></div></header>{children}</section>;
const Check = ({label, note, checked, change}: any) => <label className="switch-line"><span><b>{label}</b><small>{note}</small></span><input type="checkbox" checked={!!checked} onChange={event => change(event.target.checked)}/></label>;

const tabs = [
    {key: 'profile', label: 'Factory profile', icon: Building2},
    {key: 'location', label: 'Location', icon: MapPin},
    {key: 'schedule', label: 'Work schedule', icon: Clock3},
    {key: 'controls', label: 'Operating rules', icon: ShieldCheck},
    {key: 'reports', label: 'Report design', icon: FileText},
];

export default function FactorySettingsPage() {
    const [data, setData] = useState<any>(null);
    const [form, setForm] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('profile');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = async () => {
        try {
            const result = await api('/api/factory/settings');
            setData(result);
            setForm({...result.factory, settings: {...result.settings, report: {...result.settings.report}}});
            setError('');
        } catch (exception: any) {
            setError(exception.message);
        }
    };
    useEffect(() => { load(); }, []);

    const update = (key: string, value: any) => setForm((current: any) => ({...current, [key]: value}));
    const setting = (key: string, value: any) => setForm((current: any) => ({...current, settings: {...current.settings, [key]: value}}));
    const report = (key: string, value: any) => setForm((current: any) => ({...current, settings: {...current.settings, report: {...current.settings.report, [key]: value}}}));
    const toggleDay = (day: string) => {
        const selected = form.settings.working_days || [];
        setting('working_days', selected.includes(day) ? selected.filter((item: string) => item !== day) : [...selected, day]);
    };
    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const result = await api('/api/factory/settings', {method: 'PUT', body: JSON.stringify(form)});
            setData(result);
            setForm({...result.factory, settings: {...result.settings, report: {...result.settings.report}}});
            setSuccess(result.message);
        } catch (exception: any) {
            setError(exception.message);
        } finally {
            setBusy(false);
        }
    };

    if (!form) return <section className="module-page"><div className="module-hero"><div className="module-title"><span><Settings/></span><div><h1>Factory settings</h1><p>Manage your factory profile and operating rules.</p></div></div></div>{error && <div className="admin-alert error">{error}</div>}<div className="panel admin-loading">Loading factory settings…</div></section>;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const reportSettings = form.settings.report;

    return <section className="module-page factory-settings-page">
        <div className="module-hero">
            <div className="module-title"><span><Settings/></span><div><div className="eyebrow"><i/>LIVE FACTORY CONTROL</div><h1>Factory settings</h1><p>Choose a section below to manage your factory.</p></div></div>
            <button form="factory-settings-form" className="primary-btn" disabled={busy}><Save size={17}/>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
        {error && <div className="admin-alert error">{error}</div>}
        {success && <div className="admin-alert success">{success}</div>}

        <nav className="panel factory-settings-tabs" aria-label="Factory settings sections">
            {tabs.map(({key, label, icon: Icon}) => <button type="button" key={key} className={activeTab === key ? 'active' : ''} onClick={() => { setActiveTab(key); setSuccess(''); }}>
                <Icon size={18}/><span>{label}</span>
            </button>)}
        </nav>

        <form id="factory-settings-form" onSubmit={save} className="factory-settings-grid">
            <div className="factory-settings-main">
                {activeTab === 'profile' && <Card icon={Building2} title="Factory profile" note="Official information shown on reports and operational documents."><div className="form-grid">
                    <Field label="Factory name"><input required value={form.name || ''} onChange={event => update('name', event.target.value)}/></Field>
                    <Field label="Industry type" note="Only the platform administrator can change this."><input disabled value={String(form.industry_type || '').replaceAll('_', ' ')}/></Field>
                    <Field label="Factory email"><input type="email" placeholder="factory@company.com" value={form.email || ''} onChange={event => update('email', event.target.value)}/></Field>
                    <Field label="Factory phone"><input placeholder="+250 7…" value={form.phone || ''} onChange={event => update('phone', event.target.value)}/></Field>
                    <Field label="Registration number"><input placeholder="Official registration number" value={form.settings.registration_number || ''} onChange={event => setting('registration_number', event.target.value)}/></Field>
                    <Field label="Tax number / TIN"><input placeholder="Tax identification number" value={form.settings.tax_number || ''} onChange={event => setting('tax_number', event.target.value)}/></Field>
                </div></Card>}

                {activeTab === 'location' && <Card icon={MapPin} title="Location and regional settings" note="Controls report dates, language and money values."><div className="form-grid">
                    <Field label="Street address"><input placeholder="Industrial zone, street or building" value={form.settings.address || ''} onChange={event => setting('address', event.target.value)}/></Field>
                    <Field label="City"><input placeholder="Kigali" value={form.settings.city || ''} onChange={event => setting('city', event.target.value)}/></Field>
                    <Field label="Country code"><input required maxLength={2} value={form.country_code || 'RW'} onChange={event => update('country_code', event.target.value.toUpperCase())}/></Field>
                    <Field label="Currency"><select value={form.currency_code} onChange={event => update('currency_code', event.target.value)}>{['RWF', 'USD', 'EUR', 'KES', 'UGX'].map(item => <option key={item}>{item}</option>)}</select></Field>
                    <Field label="Time zone"><select value={form.timezone} onChange={event => update('timezone', event.target.value)}><option value="Africa/Kigali">Kigali</option><option value="Africa/Johannesburg">Johannesburg</option><option value="Africa/Nairobi">Nairobi</option><option value="Africa/Kampala">Kampala</option><option value="UTC">UTC</option></select></Field>
                    <Field label="Default language"><select value={form.default_locale} onChange={event => update('default_locale', event.target.value)}><option value="en">English</option><option value="fr">Français</option></select></Field>
                </div></Card>}

                {activeTab === 'schedule' && <Card icon={Clock3} title="Working schedule" note="Define normal operating hours and working days."><div className="form-grid">
                    <Field label="Opening time"><input required type="time" value={form.settings.opening_time} onChange={event => setting('opening_time', event.target.value)}/></Field>
                    <Field label="Closing time"><input required type="time" value={form.settings.closing_time} onChange={event => setting('closing_time', event.target.value)}/></Field>
                </div><div className="working-days">{days.map(day => <button type="button" key={day} className={form.settings.working_days.includes(day) ? 'active' : ''} onClick={() => toggleDay(day)}>{day.slice(0, 3)}</button>)}</div></Card>}

                {activeTab === 'controls' && <Card icon={ShieldCheck} title="Operating controls" note="Safety rules for production and stock recording."><div className="form-grid">
                    <Field label="Production order prefix" note={`Example: ${form.settings.production_order_prefix || 'PO'}-0001`}><input required maxLength={12} value={form.settings.production_order_prefix} onChange={event => setting('production_order_prefix', event.target.value.toUpperCase())}/></Field>
                    <Field label="Low-stock alert level"><input required type="number" min="0" value={form.settings.low_stock_alert_level} onChange={event => setting('low_stock_alert_level', Number(event.target.value))}/></Field>
                </div>
                    <Check label="Require production approval" note="Orders must be approved before work begins." checked={form.settings.require_production_approval} change={(value: boolean) => setting('require_production_approval', value)}/>
                    <Check label="Require quality release" note="Finished goods need a passed quality check before release." checked={form.settings.require_quality_release} change={(value: boolean) => setting('require_quality_release', value)}/>
                    <Check label="Allow stock below zero" note="Keep disabled to prevent issuing unavailable material." checked={form.settings.allow_negative_stock} change={(value: boolean) => setting('allow_negative_stock', value)}/>
                </Card>}

                {activeTab === 'reports' && <Card icon={FileText} title="Report design" note="Choose the daily report your factory needs. Changes apply to live reports and printed PDF documents.">
                    <div className="form-grid">
                        <Field label="Report title"><input required placeholder="Daily production and stock report" value={reportSettings.title} onChange={event => report('title', event.target.value)}/></Field>
                        <Field label="Default report period"><select value={reportSettings.default_period} onChange={event => report('default_period', event.target.value)}><option value="day">Today</option><option value="week">Last 7 days</option><option value="month">This month</option></select></Field>
                        <Field label="PDF page layout"><select value={reportSettings.orientation} onChange={event => report('orientation', event.target.value)}><option value="landscape">Landscape — wide tables</option><option value="portrait">Portrait — normal page</option></select></Field>
                        <Field label="Received quantity label"><input required placeholder="Material received" value={reportSettings.input_label} onChange={event => report('input_label', event.target.value)}/></Field>
                        <Field label="Completed quantity label"><input required placeholder="Work completed" value={reportSettings.output_label} onChange={event => report('output_label', event.target.value)}/></Field>
                        <Field label="Product details to record" note="Separate items with commas. Example: Product, Batch, Colour, Size"><input placeholder="Product, Batch, Type, Grade" value={(reportSettings.attributes || []).join(', ')} onChange={event => report('attributes', event.target.value.split(',').map(item => item.trim()).filter(Boolean))}/></Field>
                        <Field label="Common units" note="Separate units with commas. Saved product units remain the source of truth."><input placeholder="kg, L, m, pcs" value={(reportSettings.unit_examples || []).join(', ')} onChange={event => report('unit_examples', event.target.value.split(',').map(item => item.trim()).filter(Boolean))}/></Field>
                    </div>
                    <div className="report-options">
                        <Check label="Show summary totals" note="Display the main totals at the top of the report." checked={reportSettings.show_summary} change={(value: boolean) => report('show_summary', value)}/>
                        <Check label="Show daily work register" note="List each department's work for every selected day." checked={reportSettings.show_daily_register} change={(value: boolean) => report('show_daily_register', value)}/>
                        <Check label="Show department totals" note="Display totals for each department." checked={reportSettings.show_department_totals} change={(value: boolean) => report('show_department_totals', value)}/>
                        <Check label="Show warehouse stock" note="Include opening balance, stock in/out and closing balance." checked={reportSettings.show_stock_register} change={(value: boolean) => report('show_stock_register', value)}/>
                        <Check label="Show report guidance" note="Print the expected product details and common units." checked={reportSettings.show_guidance} change={(value: boolean) => report('show_guidance', value)}/>
                    </div>
                </Card>}
            </div>

            <aside className="panel factory-settings-summary">
                <Factory size={30}/><small>ACTIVE FACTORY</small><h2>{form.name}</h2><p>{String(form.industry_type || '').replaceAll('_', ' ')}</p>
                <dl>
                    <div><dt>Location</dt><dd>{form.settings.city || 'Not set'}, {form.country_code}</dd></div>
                    <div><dt>Working hours</dt><dd>{form.settings.opening_time} – {form.settings.closing_time}</dd></div>
                    <div><dt>Report period</dt><dd>{reportSettings.default_period}</dd></div>
                    <div><dt>PDF layout</dt><dd>{reportSettings.orientation}</dd></div>
                    <div><dt>Status</dt><dd className="success">{data?.factory?.status || 'active'}</dd></div>
                </dl>
            </aside>
        </form>
    </section>;
}
