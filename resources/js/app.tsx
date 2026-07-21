import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Activity, Bell, Boxes, ChevronDown, ChevronRight, CircleDollarSign, ClipboardCheck,
    Factory, Gauge, HelpCircle, Languages, LayoutDashboard, Menu, Moon, PackageCheck,
    PackageOpen, Search, Settings, ShieldCheck, ShoppingCart, Sun, Truck, Users, Warehouse,
    Wrench, X, Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Locale = 'en' | 'fr';

const copy = {
    en: {
        overview: 'Operations overview', welcome: 'Good morning, Jean. Here is your factory at a glance.',
        live: 'Live operations', newOrder: 'New production order', search: 'Search orders, products, batches…',
        production: 'Production today', productionHint: 'of 2,400 unit target', orders: 'Open orders', ordersHint: '6 require attention',
        inventory: 'Inventory value', inventoryHint: '3 low-stock items', quality: 'Quality pass rate', qualityHint: '+1.8% this month',
        output: 'Production output', target: 'Target', actual: 'Actual', activity: 'Recent activity',
        activeOrders: 'Active production orders', viewAll: 'View all', order: 'Order', product: 'Product', stage: 'Current stage', progress: 'Progress', due: 'Due date',
        dashboard: 'Dashboard', procurement: 'Procurement', warehouse: 'Inventory', products: 'Products & BOM', planning: 'Production', control: 'Quality control',
        sales: 'Sales & orders', logistics: 'Logistics', people: 'Team & shifts', machines: 'Machines', reports: 'Reports', settings: 'Settings', support: 'Help & support',
        general: 'Operations', management: 'Management', completed: 'Completed', inProgress: 'In progress', inspection: 'Quality inspection', packaging: 'Packaging',
    },
    fr: {
        overview: 'Vue d’ensemble des opérations', welcome: 'Bonjour Jean. Voici un aperçu de votre usine.',
        live: 'Opérations en direct', newOrder: 'Nouvel ordre de production', search: 'Rechercher commandes, produits, lots…',
        production: 'Production du jour', productionHint: 'sur un objectif de 2 400 unités', orders: 'Commandes ouvertes', ordersHint: '6 nécessitent une action',
        inventory: 'Valeur du stock', inventoryHint: '3 articles en stock faible', quality: 'Taux de conformité', qualityHint: '+1,8 % ce mois-ci',
        output: 'Production réalisée', target: 'Objectif', actual: 'Réalisé', activity: 'Activité récente',
        activeOrders: 'Ordres de production actifs', viewAll: 'Tout afficher', order: 'Ordre', product: 'Produit', stage: 'Étape actuelle', progress: 'Progression', due: 'Échéance',
        dashboard: 'Tableau de bord', procurement: 'Achats', warehouse: 'Stocks', products: 'Produits et nomenclatures', planning: 'Production', control: 'Contrôle qualité',
        sales: 'Ventes et commandes', logistics: 'Logistique', people: 'Équipe et horaires', machines: 'Machines', reports: 'Rapports', settings: 'Paramètres', support: 'Aide et support',
        general: 'Opérations', management: 'Gestion', completed: 'Terminé', inProgress: 'En cours', inspection: 'Contrôle qualité', packaging: 'Emballage',
    },
};

const chartData = [
    { time: '08:00', actual: 110, target: 150 }, { time: '10:00', actual: 390, target: 450 },
    { time: '12:00', actual: 760, target: 750 }, { time: '14:00', actual: 1110, target: 1100 },
    { time: '16:00', actual: 1560, target: 1550 }, { time: '18:00', actual: 1842, target: 1900 },
];

const productionOrders = [
    { id: 'PO-2026-0418', product: 'Premium cotton shirts', detail: 'Batch CT-0721 · 600 pcs', stage: 'Sewing', progress: 68, due: '22 Jul', color: '#2563eb' },
    { id: 'PO-2026-0416', product: 'Sparkling water 500ml', detail: 'Batch SW-0719 · 2,400 btls', stage: 'Quality inspection', progress: 84, due: 'Today', color: '#8b5cf6' },
    { id: 'PO-2026-0411', product: 'Whole milk 1L', detail: 'Batch ML-0720 · 1,200 units', stage: 'Packaging', progress: 92, due: 'Today', color: '#0ea5e9' },
];

function Logo() {
    return <div className="brand"><div className="brand-mark"><Factory size={20}/></div><div><strong>ICYEREKEZO</strong><span>OMS</span></div></div>;
}

function App() {
    const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem('icy_locale') as Locale) || 'en');
    const [dark, setDark] = useState(() => localStorage.getItem('icy_theme') === 'dark');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const t = copy[locale];
    useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('icy_theme', dark ? 'dark' : 'light'); }, [dark]);
    useEffect(() => { document.documentElement.lang = locale; localStorage.setItem('icy_locale', locale); }, [locale]);

    const nav = useMemo(() => [
        [LayoutDashboard, t.dashboard, true], [ShoppingCart, t.procurement], [Warehouse, t.warehouse], [Boxes, t.products],
        [Gauge, t.planning], [ClipboardCheck, t.control], [PackageOpen, t.sales], [Truck, t.logistics],
        [Users, t.people], [Wrench, t.machines], [Activity, t.reports],
    ] as const, [t]);

    const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 2600); };

    return <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-head"><Logo/><button className="icon-btn mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
            <nav>
                <p className="nav-label">{t.general}</p>
                {nav.map(([Icon, label, active]) => <button key={label} className={`nav-item ${active ? 'active' : ''}`} onClick={() => { setSidebarOpen(false); if (!active) toast(`${label} — ${locale === 'en' ? 'coming in the next module' : 'disponible dans le prochain module'}`); }}><Icon size={18}/><span>{label}</span>{label === t.warehouse && <i>3</i>}</button>)}
                <p className="nav-label">{t.management}</p>
                <button className="nav-item"><Settings size={18}/><span>{t.settings}</span></button>
                <button className="nav-item"><HelpCircle size={18}/><span>{t.support}</span></button>
            </nav>
            <div className="factory-card"><div className="factory-avatar">KL</div><div><strong>Kigali Manufacturing</strong><span>Main plant · Kigali</span></div><ChevronRight size={17}/></div>
        </aside>
        {sidebarOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)}/>} 
        <main className="main-area">
            <header className="topbar">
                <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21}/></button>
                <label className="search"><Search size={18}/><input aria-label={t.search} placeholder={t.search}/><kbd>⌘ K</kbd></label>
                <div className="top-actions">
                    <button className="locale-btn" onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}><Languages size={17}/><span>{locale === 'en' ? 'FR' : 'EN'}</span></button>
                    <button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
                    <button className="icon-btn notification" aria-label="Notifications"><Bell size={19}/><b>4</b></button>
                    <button className="user-menu"><span className="avatar">JM</span><span className="user-copy"><strong>Jean Mugabo</strong><small>Factory owner</small></span><ChevronDown size={16}/></button>
                </div>
            </header>
            <div className="page">
                <div className="page-heading"><div><div className="eyebrow"><span></span>{t.live}</div><h1>{t.overview}</h1><p>{t.welcome}</p></div><button className="primary-btn" onClick={() => toast(locale === 'en' ? 'Production order form opens in the next step.' : 'Le formulaire d’ordre sera ajouté à la prochaine étape.')}><Zap size={17}/>{t.newOrder}</button></div>
                <section className="metric-grid">
                    <Metric icon={<Factory/>} label={t.production} value="1,842" suffix="units" detail={t.productionHint} trend="+12.4%" tone="blue" />
                    <Metric icon={<ShoppingCart/>} label={t.orders} value="38" detail={t.ordersHint} trend="+5" tone="amber" />
                    <Metric icon={<CircleDollarSign/>} label={t.inventory} value="RWF 284.6M" detail={t.inventoryHint} trend="+3.2%" tone="violet" />
                    <Metric icon={<ShieldCheck/>} label={t.quality} value="97.6%" detail={t.qualityHint} trend="+1.8%" tone="green" />
                </section>
                <section className="dashboard-grid">
                    <article className="panel chart-panel"><PanelTitle title={t.output} action={<div className="chart-legend"><span className="actual-dot">{t.actual}</span><span className="target-dot">{t.target}</span></div>}/><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={.25}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)"/><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }}/><Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10 }}/><Area type="monotone" dataKey="target" stroke="#94a3b8" fill="none" strokeDasharray="5 5" strokeWidth={2}/><Area type="monotone" dataKey="actual" stroke="#2563eb" fill="url(#actualFill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>
                    <article className="panel activity-panel"><PanelTitle title={t.activity} action={<button className="dots">•••</button>}/><div className="activity-list">
                        <ActivityItem icon={<PackageCheck/>} tone="green" title="PO-2026-0409 completed" text="1,000 polo shirts moved to finished goods" time="8 min"/>
                        <ActivityItem icon={<ClipboardCheck/>} tone="violet" title="Quality inspection approved" text="Batch ML-0720 · Whole milk 1L" time="24 min"/>
                        <ActivityItem icon={<PackageOpen/>} tone="amber" title="Low stock alert" text="Cotton fabric · 182 metres remaining" time="41 min"/>
                        <ActivityItem icon={<Truck/>} tone="blue" title="Shipment dispatched" text="SHP-00842 · Rubavu distribution centre" time="1 hr"/>
                    </div></article>
                </section>
                <article className="panel orders-panel"><PanelTitle title={t.activeOrders} action={<button className="text-btn">{t.viewAll}<ChevronRight size={16}/></button>}/><div className="table-scroll"><table><thead><tr><th>{t.order}</th><th>{t.product}</th><th>{t.stage}</th><th>{t.progress}</th><th>{t.due}</th></tr></thead><tbody>{productionOrders.map((item, index) => <tr key={item.id}><td><strong>{item.id}</strong></td><td><div className="product-cell"><span className={`product-icon p${index}`}><Boxes size={17}/></span><div><strong>{item.product}</strong><small>{item.detail}</small></div></div></td><td><span className={`status s${index}`}>{locale === 'fr' ? (index === 0 ? 'Couture' : index === 1 ? t.inspection : t.packaging) : item.stage}</span></td><td><div className="progress-cell"><div className="progress"><span style={{ width: `${item.progress}%`, background: item.color }}/></div><b>{item.progress}%</b></div></td><td><strong>{item.due}</strong></td></tr>)}</tbody></table></div></article>
            </div>
        </main>
        {notice && <div className="toast">{notice}</div>}
    </div>;
}

function Metric({ icon, label, value, suffix, detail, trend, tone }: { icon: React.ReactNode; label: string; value: string; suffix?: string; detail: string; trend: string; tone: string }) {
    return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><div><strong>{value}</strong>{suffix && <small>{suffix}</small>}</div><p><b className={tone}>{trend}</b>{detail}</p></div></article>;
}
function PanelTitle({ title, action }: { title: string; action: React.ReactNode }) { return <div className="panel-title"><h2>{title}</h2>{action}</div>; }
function ActivityItem({ icon, tone, title, text, time }: { icon: React.ReactNode; tone: string; title: string; text: string; time: string }) { return <div className="activity-item"><span className={`activity-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time></div>; }

createRoot(document.getElementById('app')!).render(<React.StrictMode><App/></React.StrictMode>);
