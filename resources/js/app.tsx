import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Activity, Bell, Boxes, Building2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardCheck, CreditCard, Database,
    Factory, Gauge, HelpCircle, Languages, LayoutDashboard, Megaphone, Menu, MessageSquare, Moon, PackageCheck,
    PackageOpen, Search, Settings, ShieldCheck, ShoppingCart, Sun, Truck, Users, Warehouse,
    Wrench, X, Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PlatformAdminPage from './PlatformAdminPage';

type Locale = 'en' | 'fr';
type AuthUser = {
    id: number; name: string; email: string; locale: Locale;
    current_factory: { id: number; name: string; slug: string; industry_type?: string } | null;
    is_platform_admin: boolean; permissions: string[]; workspace: string;
    roles: { id: number; name: string; slug: string; dashboard_key: string }[];
    employee_profile?: { job_title?: string; department?: { name: string }; workstation?: { name: string; type: string } } | null;
    active_assignments: { id: number; assignment_type: string; title: string; priority: string; status: string; due_at?: string }[];
    announcements?: { id: number; title: string; message: string; severity: string; published_at: string }[];
    system?: { name: string; tagline?: string; logo_url?: string; support_email?: string; support_phone?: string; currency_code?: string; timezone?: string };
};

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf(), ...(options.headers ?? {}) },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Something went wrong.');
    return payload;
}

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

function Logo({ name = 'ICYEREKEZO OMS', logoUrl }: { name?: string; logoUrl?: string } = {}) {
    const words = name.split(' '); const suffix = words.length > 1 ? words.pop() : 'OMS';
    return <div className="brand"><div className="brand-mark">{logoUrl ? <img src={logoUrl} alt=""/> : <Factory size={20}/>}</div><div><strong>{words.join(' ')}</strong><span>{suffix}</span></div></div>;
}

const adminPagePaths: Record<string, string> = { 'platform-dashboard': '/admin', factories: '/admin/factories', 'platform-users': '/admin/users', subscriptions: '/admin/subscriptions', announcements: '/admin/announcements', 'support-center': '/admin/support', backups: '/admin/backups', 'system-settings': '/admin/settings' };
const adminPathPages = Object.fromEntries(Object.entries(adminPagePaths).map(([page, path]) => [path, page]));
function pageFromLocation(user: AuthUser): string {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (user.is_platform_admin) return adminPathPages[path] || 'platform-dashboard';
    const parts = path.split('/').filter(Boolean); const page = parts.length > 1 ? parts[1] : 'dashboard'; return ({ report: 'reports', users: 'team', products_bom: 'products' } as Record<string,string>)[page] || page;
}
function pathForPage(user: AuthUser, page: string): string {
    if (user.is_platform_admin) return adminPagePaths[page] || '/admin';
    const workspace = user.workspace || 'operations'; return page === 'dashboard' ? `/${workspace}` : `/${workspace}/${page}`;
}

function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
    const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem('icy_locale') as Locale) || 'en');
    const [dark, setDark] = useState(() => localStorage.getItem('icy_theme') === 'dark');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [activePage, setActivePage] = useState(() => pageFromLocation(user));
    const skipHistory = useRef(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const t = copy[locale];
    const can = (permission: string) => user.permissions.includes('*') || user.permissions.includes(permission);
    const workspaceName = ({ platform_admin: 'Platform administration', executive: t.overview, production: locale === 'en' ? 'Production command centre' : 'Centre de production', warehouse: locale === 'en' ? 'Warehouse workspace' : 'Espace entrepot', procurement: locale === 'en' ? 'Procurement workspace' : 'Espace achats', quality: locale === 'en' ? 'Quality control workspace' : 'Espace controle qualite', cutting: locale === 'en' ? 'Cutting workstation' : 'Poste de coupe', workstation: locale === 'en' ? 'Operator workstation' : 'Poste operateur', logistics: locale === 'en' ? 'Logistics workspace' : 'Espace logistique', sales: locale === 'en' ? 'Sales workspace' : 'Espace ventes', finance: locale === 'en' ? 'Finance workspace' : 'Espace finances' } as Record<string,string>)[user.workspace] || t.overview;
    useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('icy_theme', dark ? 'dark' : 'light'); }, [dark]);
    useEffect(() => { document.documentElement.lang = locale; localStorage.setItem('icy_locale', locale); }, [locale]);
    useEffect(() => {
        const path = pathForPage(user, activePage); document.title = `${activePage.replaceAll('-', ' ')} | ${user.system?.name || 'ICYEREKEZO OMS'}`;
        if (skipHistory.current) { skipHistory.current = false; if (window.location.pathname !== path) window.history.replaceState({ page: activePage }, '', path); }
        else if (window.location.pathname !== path) window.history.pushState({ page: activePage }, '', path);
    }, [activePage, user]);
    useEffect(() => { const back = () => { skipHistory.current = true; setActivePage(pageFromLocation(user)); }; window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, [user]);
    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault(); document.querySelector<HTMLInputElement>('.search input')?.focus();
            }
            if (event.key === 'Escape') { setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false); }
        };
        window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
    }, []);

    const nav = useMemo(() => (user.is_platform_admin ? [
        ['platform-dashboard', LayoutDashboard, locale === 'en' ? 'Platform overview' : 'Vue plateforme', '*'], ['factories', Building2, locale === 'en' ? 'Factories' : 'Usines', '*'], ['platform-users', Users, locale === 'en' ? 'All users' : 'Tous les utilisateurs', '*'], ['subscriptions', CreditCard, locale === 'en' ? 'Subscriptions' : 'Abonnements', '*'], ['announcements', Megaphone, locale === 'en' ? 'Announcements' : 'Annonces', '*'], ['support-center', MessageSquare, locale === 'en' ? 'Support centre' : 'Centre de support', '*'], ['backups', Database, locale === 'en' ? 'Database backups' : 'Sauvegardes', '*'], ['system-settings', Settings, locale === 'en' ? 'System settings' : 'Paramètres système', '*'],
    ] as const : [
        ['dashboard', LayoutDashboard, t.dashboard, '*'], ['procurement', ShoppingCart, t.procurement, 'procurement.view'], ['inventory', Warehouse, t.warehouse, 'inventory.view'], ['products', Boxes, t.products, 'products.view'],
        ['production', Gauge, t.planning, 'production.view'], ['quality', ClipboardCheck, t.control, 'quality.view'], ['sales', PackageOpen, t.sales, 'sales.view'], ['logistics', Truck, t.logistics, 'logistics.view'],
        ['team', Users, t.people, 'users.view'], ['machines', Wrench, t.machines, 'maintenance.view'], ['reports', Activity, t.reports, 'reports.view'],
    ] as const).filter(([, , , permission]) => permission === '*' || can(permission)), [t, locale, user.is_platform_admin, user.permissions]);
    useEffect(() => {
        const allowed = nav.map(([key]) => key as string); if (!user.is_platform_admin) { allowed.push('support'); if (can('factory.manage')) allowed.push('settings'); }
        if (!allowed.includes(activePage)) setActivePage(user.is_platform_admin ? 'platform-dashboard' : 'dashboard');
    }, [activePage, nav, user.is_platform_admin]);

    const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 2600); };

    return <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-head"><Logo name={user.system?.name} logoUrl={user.system?.logo_url}/><button className="icon-btn mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
            <nav>
                <p className="nav-label">{t.general}</p>
                {nav.map(([key, Icon, label]) => <button key={key} className={`nav-item ${activePage === key ? 'active' : ''}`} onClick={() => { setActivePage(key); setSidebarOpen(false); }}><Icon size={18}/><span>{label}</span>{label === t.warehouse && <i>3</i>}</button>)}
                {!user.is_platform_admin && <><p className="nav-label">{t.management}</p>{can('factory.manage') && <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => { setActivePage('settings'); setSidebarOpen(false); }}><Settings size={18}/><span>{t.settings}</span></button>}<button className={`nav-item ${activePage === 'support' ? 'active' : ''}`} onClick={() => { setActivePage('support'); setSidebarOpen(false); }}><HelpCircle size={18}/><span>{t.support}</span></button></>}
            </nav>
            <button className="factory-card" onClick={() => setActivePage(user.is_platform_admin ? 'system-settings' : 'settings')}><div className="factory-avatar">{user.current_factory?.name.slice(0, 2).toUpperCase() || 'IC'}</div><div><strong>{user.current_factory?.name || user.system?.name || 'ICYEREKEZO OMS'}</strong><span>{user.is_platform_admin ? (locale === 'en' ? 'Platform control centre' : 'Centre de contrôle') : (locale === 'en' ? 'Factory workspace' : 'Espace usine')}</span></div><ChevronRight size={17}/></button>
        </aside>
        {sidebarOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)}/>} 
        <main className="main-area">
            <header className="topbar">
                <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21}/></button>
                <label className="search"><Search size={18}/><input aria-label={t.search} placeholder={t.search} onFocus={() => setSearchOpen(true)} onKeyDown={event => { if (event.key === 'Enter') { setSearchOpen(false); setActivePage('products'); toast(locale === 'en' ? 'Search opened in Products & BOM.' : 'Recherche ouverte dans Produits et nomenclatures.'); } }}/><kbd>Ctrl K</kbd>{searchOpen && <div className="top-popover search-popover"><strong>{locale === 'en' ? 'Quick search' : 'Recherche rapide'}</strong><button onMouseDown={() => { setActivePage('products'); setSearchOpen(false); }}>{t.products}</button><button onMouseDown={() => { setActivePage('production'); setSearchOpen(false); }}>{t.planning}</button><button onMouseDown={() => { setActivePage('inventory'); setSearchOpen(false); }}>{t.warehouse}</button></div>}</label>
                <div className="top-actions">
                    <button className="locale-btn" onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}><Languages size={17}/><span>{locale === 'en' ? 'FR' : 'EN'}</span></button>
                    <button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
                    <div className="popover-anchor"><button className="icon-btn notification" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19}/><b>{user.announcements?.length || 0}</b></button>{notificationsOpen && <div className="top-popover notification-menu"><strong>{locale === 'en' ? 'Notifications' : 'Notifications'}</strong>{user.announcements?.length ? user.announcements.slice(0,4).map(item => <span key={item.id}><b>{item.title}</b>{item.message}</span>) : <span>{locale === 'en' ? 'No new announcements' : 'Aucune nouvelle annonce'}</span>}<button onClick={() => { setNotificationsOpen(false); setActivePage(user.is_platform_admin ? 'announcements' : 'support'); }}>View all activity</button></div>}</div>
                    <div className="popover-anchor"><button className="user-menu" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar">{user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="user-copy"><strong>{user.name}</strong><small>{user.employee_profile?.job_title || user.roles[0]?.name || (user.is_platform_admin ? 'Platform administrator' : 'Team member')}</small></span><ChevronDown size={16}/></button>{profileOpen && <div className="top-popover profile-menu"><button onClick={() => { setActivePage(user.is_platform_admin ? 'system-settings' : 'settings'); setProfileOpen(false); }}>{locale === 'en' ? 'Profile & settings' : 'Profil et paramètres'}</button><button onClick={onLogout}>{locale === 'en' ? 'Sign out' : 'Se déconnecter'}</button></div>}</div>
                </div>
            </header>
            <div className="page">
                {user.is_platform_admin ? <PlatformAdminPage page={activePage} locale={locale}/> : activePage === 'support' ? <UserSupportChat user={user} locale={locale}/> : activePage !== 'dashboard' ? <ModulePage page={activePage} locale={locale} can={can} onNavigate={setActivePage}/> : <>
                <div className="page-heading"><div><div className="eyebrow"><span></span>{t.live}</div><h1>{t.overview}</h1><p>{t.welcome}</p></div><button className="primary-btn" onClick={() => setActivePage('production')}><Zap size={17}/>{t.newOrder}</button></div>
                <section className="workspace-banner"><div><span>{locale === 'en' ? 'Your workspace' : 'Votre espace'}</span><strong>{workspaceName}</strong><small>{user.employee_profile?.workstation ? `${user.employee_profile.department?.name || ''} / ${user.employee_profile.workstation.name}` : (user.roles[0]?.name || 'ICYEREKEZO OMS')}</small></div>{user.active_assignments?.length > 0 && <div className="assignment-preview"><b>{user.active_assignments.length} {locale === 'en' ? 'active assignments' : 'taches actives'}</b>{user.active_assignments.slice(0, 2).map(task => <span key={task.id}>{task.title} · {task.status.replace('_', ' ')}</span>)}</div>}</section>
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
                <article className="panel orders-panel"><PanelTitle title={t.activeOrders} action={<button className="text-btn" onClick={() => setActivePage('production')}>{t.viewAll}<ChevronRight size={16}/></button>}/><div className="table-scroll"><table><thead><tr><th>{t.order}</th><th>{t.product}</th><th>{t.stage}</th><th>{t.progress}</th><th>{t.due}</th></tr></thead><tbody>{productionOrders.map((item, index) => <tr key={item.id}><td><strong>{item.id}</strong></td><td><div className="product-cell"><span className={`product-icon p${index}`}><Boxes size={17}/></span><div><strong>{item.product}</strong><small>{item.detail}</small></div></div></td><td><span className={`status s${index}`}>{locale === 'fr' ? (index === 0 ? 'Couture' : index === 1 ? t.inspection : t.packaging) : item.stage}</span></td><td><div className="progress-cell"><div className="progress"><span style={{ width: `${item.progress}%`, background: item.color }}/></div><b>{item.progress}%</b></div></td><td><strong>{item.due}</strong></td></tr>)}</tbody></table></div></article>
                </>}
            </div>
        </main>
        {notice && <div className="toast">{notice}</div>}
    </div>;
}

const moduleContent = {
    'platform-dashboard': { icon: LayoutDashboard, en: ['Platform control centre', 'Monitor every factory, subscription, user, support request and system service.', ['System health', 'Factory activity', 'Subscription status', 'Security events']], fr: ['Centre de contrôle plateforme', 'Supervisez les usines, abonnements, utilisateurs, demandes et services.', ['Santé système', 'Activité des usines', 'État des abonnements', 'Événements sécurité']] },
    factories: { icon: Building2, en: ['Factory administration', 'Register, approve, activate, suspend and monitor every factory account.', ['All factories', 'Pending approval', 'Active factories', 'Suspended factories']], fr: ['Administration des usines', 'Enregistrez, approuvez, activez, suspendez et surveillez chaque usine.', ['Toutes les usines', 'En attente', 'Usines actives', 'Usines suspendues']] },
    'platform-users': { icon: Users, en: ['Platform users', 'Search all accounts, control status and grant trusted platform administrators.', ['All users', 'Factory owners', 'Platform administrators', 'Inactive accounts']], fr: ['Utilisateurs plateforme', 'Recherchez les comptes, contrôlez leur état et les administrateurs.', ['Tous les utilisateurs', 'Propriétaires', 'Administrateurs', 'Comptes inactifs']] },
    subscriptions: { icon: CreditCard, en: ['Subscriptions & plans', 'Configure plans, limits, billing periods, renewals and automatic suspension.', ['Subscription plans', 'Active subscriptions', 'Expiring soon', 'Payment history']], fr: ['Abonnements et forfaits', 'Configurez forfaits, limites, périodes, renouvellements et suspensions.', ['Forfaits', 'Abonnements actifs', 'Expiration proche', 'Historique paiements']] },
    announcements: { icon: Megaphone, en: ['Platform announcements', 'Send operational, billing or emergency messages to all platform users.', ['Compose message', 'Published', 'Scheduled', 'Expired']], fr: ['Annonces plateforme', 'Envoyez des messages opérationnels, financiers ou urgents à tous.', ['Composer', 'Publiées', 'Planifiées', 'Expirées']] },
    'support-center': { icon: MessageSquare, en: ['Support centre', 'Receive factory problems, reply to conversations and track resolution.', ['Open tickets', 'In progress', 'Waiting customer', 'Resolved']], fr: ['Centre de support', 'Recevez les problèmes, répondez et suivez leur résolution.', ['Tickets ouverts', 'En cours', 'Attente client', 'Résolus']] },
    backups: { icon: Database, en: ['Database backups', 'Request encrypted database backups and monitor scheduled recovery points.', ['Backup history', 'Create backup', 'Schedule', 'Recovery status']], fr: ['Sauvegardes base de données', 'Demandez des sauvegardes et surveillez les points de restauration.', ['Historique', 'Créer sauvegarde', 'Planification', 'État restauration']] },
    'system-settings': { icon: Settings, en: ['System configuration', 'Manage platform identity, logo, registration, maintenance and support contacts.', ['Identity & branding', 'Registration', 'Maintenance mode', 'Security']], fr: ['Configuration système', 'Gérez identité, logo, inscriptions, maintenance et contacts.', ['Identité et marque', 'Inscription', 'Mode maintenance', 'Sécurité']] },
    procurement: { icon: ShoppingCart, en: ['Procurement', 'Control suppliers, requests, quotations, purchase orders and receipts.', ['Purchase requests', 'Supplier quotations', 'Purchase orders', 'Goods receipts']], fr: ['Achats', 'Gérez les fournisseurs, demandes, devis, commandes et réceptions.', ['Demandes d’achat', 'Devis fournisseurs', 'Bons de commande', 'Réceptions']] },
    inventory: { icon: Warehouse, en: ['Inventory & warehouses', 'Track every movement across warehouses, locations, batches and stock states.', ['Current stock', 'Stock movements', 'Transfers', 'Counts & adjustments']], fr: ['Stocks et entrepôts', 'Suivez chaque mouvement par entrepôt, emplacement, lot et état.', ['Stock actuel', 'Mouvements', 'Transferts', 'Comptages et ajustements']] },
    products: { icon: Boxes, en: ['Products & BOM', 'Manage materials, finished products, versions and manufacturing recipes.', ['Items & SKUs', 'Categories', 'Bills of materials', 'Units & conversions']], fr: ['Produits et nomenclatures', 'Gérez les matières, produits finis, versions et recettes de fabrication.', ['Articles et SKU', 'Catégories', 'Nomenclatures', 'Unités et conversions']] },
    production: { icon: Gauge, en: ['Production', 'Plan demand, check materials and execute configurable factory workflows.', ['Production orders', 'Planning', 'Workflow templates', 'Stage execution']], fr: ['Production', 'Planifiez la demande, vérifiez les matières et exécutez les flux configurables.', ['Ordres de production', 'Planification', 'Modèles de flux', 'Exécution des étapes']] },
    quality: { icon: ClipboardCheck, en: ['Quality control', 'Inspect incoming materials, production stages and finished batches.', ['Inspection queue', 'Test templates', 'Defects & rework', 'Certificates']], fr: ['Contrôle qualité', 'Inspectez les matières reçues, les étapes et les lots finis.', ['File d’inspection', 'Modèles de test', 'Défauts et retouches', 'Certificats']] },
    sales: { icon: PackageOpen, en: ['Sales & orders', 'Manage customers, quotations, orders, invoices and returns.', ['Customer orders', 'Quotations', 'Invoices', 'Returns']], fr: ['Ventes et commandes', 'Gérez les clients, devis, commandes, factures et retours.', ['Commandes clients', 'Devis', 'Factures', 'Retours']] },
    logistics: { icon: Truck, en: ['Logistics', 'Plan packing, dispatch, routes, vehicles and proof of delivery.', ['Shipments', 'Dispatch board', 'Vehicles & drivers', 'Proof of delivery']], fr: ['Logistique', 'Planifiez emballage, expédition, routes, véhicules et preuve de livraison.', ['Expéditions', 'Tableau d’envoi', 'Véhicules et chauffeurs', 'Preuve de livraison']] },
    team: { icon: Users, en: ['Team & shifts', 'Assign secure role workspaces, stations, shifts and daily work.', ['Employees', 'Roles & permissions', 'Work assignments', 'Shifts & attendance']], fr: ['Équipe et horaires', 'Attribuez les rôles, postes, horaires et travaux quotidiens.', ['Employés', 'Rôles et permissions', 'Affectations', 'Horaires et présence']] },
    machines: { icon: Wrench, en: ['Machines & maintenance', 'Track machine availability, maintenance plans, breakdowns and downtime.', ['Machine register', 'Maintenance schedule', 'Repair requests', 'Downtime']], fr: ['Machines et maintenance', 'Suivez disponibilité, maintenance, pannes et temps d’arrêt.', ['Registre machines', 'Plan de maintenance', 'Demandes de réparation', 'Temps d’arrêt']] },
    reports: { icon: Activity, en: ['Reports & analytics', 'Review operational performance and export trusted business reports.', ['Executive reports', 'Inventory reports', 'Production reports', 'Financial reports']], fr: ['Rapports et analyses', 'Analysez la performance et exportez des rapports fiables.', ['Rapports exécutifs', 'Rapports de stock', 'Rapports de production', 'Rapports financiers']] },
    settings: { icon: Settings, en: ['Factory settings', 'Configure factory identity, branches, departments, approvals and numbering.', ['Factory profile', 'Branches & departments', 'Approval rules', 'Security settings']], fr: ['Paramètres de l’usine', 'Configurez identité, sites, départements, validations et numérotation.', ['Profil usine', 'Sites et départements', 'Règles de validation', 'Paramètres de sécurité']] },
    support: { icon: HelpCircle, en: ['Help & support', 'Find guidance, report a problem or contact the ICYEREKEZO support team.', ['Getting started', 'User guide', 'Support tickets', 'System status']], fr: ['Aide et support', 'Consultez les guides, signalez un problème ou contactez le support.', ['Bien démarrer', 'Guide utilisateur', 'Tickets support', 'État du système']] },
} as const;

function UserSupportChat({user,locale}:{user:AuthUser;locale:Locale}) {
    const [tickets,setTickets]=useState<any[]>([]);const [activeId,setActiveId]=useState<number|null>(null);const [creating,setCreating]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const [form,setForm]=useState({subject:'',message:'',category:'general',priority:'normal'});
    const load=async()=>{try{const result:any=await api('/api/support/tickets');setTickets(result.data||[])}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load support messages.')}};
    useEffect(()=>{load();const timer=window.setInterval(load,5000);return()=>window.clearInterval(timer)},[]);
    useEffect(()=>{if(tickets.length&&!tickets.some(item=>item.id===activeId))setActiveId(tickets[0].id)},[tickets,activeId]);
    const active=tickets.find(item=>item.id===activeId);
    const create=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const ticket:any=await api('/api/support/tickets',{method:'POST',body:JSON.stringify(form)});setCreating(false);setForm({subject:'',message:'',category:'general',priority:'normal'});await load();setActiveId(ticket.id)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to send your question.')}finally{setBusy(false)}};
    const send=async()=>{const text=message.trim();if(!text||!active)return;setBusy(true);setError('');try{await api(`/api/support/tickets/${active.id}/reply`,{method:'POST',body:JSON.stringify({message:text})});setMessage('');await load()}catch(reason){setError(reason instanceof Error?reason.message:'Unable to send your message.')}finally{setBusy(false)}};
    return <section className="module-page"><div className="module-hero"><div className="module-title"><span><MessageSquare size={22}/></span><div><div className="eyebrow"><i></i>{locale==='en'?'Support online':'Support en ligne'}</div><h1>{locale==='en'?'Ask the system administrator':'Contacter l’administrateur'}</h1><p>{locale==='en'?'Send a question and continue the conversation here.':'Envoyez une question et poursuivez la conversation ici.'}</p></div></div><button className="primary-btn" onClick={()=>setCreating(!creating)}><MessageSquare size={17}/>{locale==='en'?'New question':'Nouvelle question'}</button></div>{error&&<div className="admin-alert error">{error}</div>}{creating&&<form className="admin-form panel support-new" onSubmit={create}><h2>{locale==='en'?'Ask a new question':'Poser une nouvelle question'}</h2><div className="form-grid"><label>{locale==='en'?'Subject':'Sujet'}<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>{locale==='en'?'Question type':'Type de question'}<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="general">General</option><option value="technical">Technical</option><option value="billing">Billing</option><option value="security">Security</option><option value="data">Data</option></select></label></div><label>{locale==='en'?'Your question':'Votre question'}<textarea required value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></label><button className="primary-btn" disabled={busy}>{locale==='en'?'Send question':'Envoyer'}</button></form>}<div className="support-room panel"><aside className="chat-list">{tickets.length?tickets.map(item=><button key={item.id} className={item.id===activeId?'active':''} onClick={()=>setActiveId(item.id)}><span>{item.subject.slice(0,2).toUpperCase()}</span><div><b>{item.subject}</b><small>{item.messages?.at(-1)?.message||'No messages'}</small><em>{item.status.replaceAll('_',' ')}</em></div></button>):<div className="chat-empty">{locale==='en'?'No questions yet. Start a conversation.':'Aucune question.'}</div>}</aside>{active?<section className="chat-window"><header><div><h3>{active.subject}</h3><p>{active.ticket_number} · {active.status.replaceAll('_',' ')}</p></div></header><div className="chat-messages">{active.messages?.map((item:any)=><div key={item.id} className={item.user_id===user.id?'chat-message admin':'chat-message user'}><b>{item.user_id===user.id?(locale==='en'?'You':'Vous'):(item.user?.name||'System administrator')}</b><p>{item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div>)}</div><div className="chat-compose"><textarea aria-label="Message" placeholder={locale==='en'?'Write a message…':'Écrire un message…'} value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><button className="primary-btn" disabled={busy||!message.trim()} onClick={send}>{locale==='en'?'Send':'Envoyer'}</button></div></section>:<section className="chat-window chat-welcome"><MessageSquare size={36}/><h3>{locale==='en'?'Select a conversation':'Choisissez une conversation'}</h3></section>}</div></section>
}

function ModulePage({ page, locale, can, onNavigate }: { page: string; locale: Locale; can: (permission: string) => boolean; onNavigate: (page: string) => void }) {
    const module = moduleContent[page as keyof typeof moduleContent] || moduleContent.support;
    const [title, description, sections] = module[locale];
    const [selected, setSelected] = useState(0);
    const Icon = module.icon;
    const createPermission: Record<string, string | null> = { 'platform-dashboard': null, factories: null, 'platform-users': null, subscriptions: null, announcements: null, 'support-center': null, backups: null, 'system-settings': null, procurement: 'procurement.create', inventory: 'inventory.adjust', products: 'products.create', production: 'production.plan', quality: 'quality.inspect', sales: 'sales.create', logistics: 'logistics.plan', team: 'users.create', machines: 'maintenance.create', reports: 'reports.export', settings: 'factory.manage', support: null };
    const mayCreate = createPermission[page] === null || (createPermission[page] ? can(createPermission[page]!) : false);
    const action = page === 'production' ? (locale === 'en' ? 'Create production order' : 'Créer un ordre de production') : page === 'team' ? (locale === 'en' ? 'Add employee' : 'Ajouter un employé') : (locale === 'en' ? 'Create new' : 'Créer');
    return <section className="module-page">
        <div className="module-hero"><div className="module-title"><span><Icon size={22}/></span><div><div className="eyebrow"><i></i>{locale === 'en' ? 'Live module' : 'Module actif'}</div><h1>{title}</h1><p>{description}</p></div></div>{mayCreate && <button className="primary-btn" onClick={() => setSelected(0)}><Zap size={17}/>{action}</button>}</div>
        <div className="module-tabs" role="tablist">{sections.map((section, index) => <button key={section} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}>{section}</button>)}</div>
        <section className="module-grid">
            <article className="panel module-main"><PanelTitle title={sections[selected]} action={can('reports.export') ? <button className="text-btn">{locale === 'en' ? 'Export' : 'Exporter'}<ChevronRight size={16}/></button> : <span/>}/><div className="empty-state"><span><Icon size={28}/></span><h3>{locale === 'en' ? `${sections[selected]} workspace is ready` : `L’espace ${sections[selected]} est prêt`}</h3><p>{locale === 'en' ? 'Records created in this module will appear here with role-based actions, filters and audit history.' : 'Les enregistrements apparaîtront ici avec actions par rôle, filtres et historique.'}</p><button className="secondary-btn" onClick={() => setSelected((selected + 1) % sections.length)}>{locale === 'en' ? 'Explore next section' : 'Section suivante'}</button></div></article>
            <aside className="panel module-side"><PanelTitle title={locale === 'en' ? 'Module status' : 'État du module'} action={<Activity size={17}/>}/><div className="status-list"><div><span>{locale === 'en' ? 'Access' : 'Accès'}</span><b>{can('*') ? 'Administrator' : 'Role controlled'}</b></div><div><span>{locale === 'en' ? 'Data scope' : 'Portée'}</span><b>{locale === 'en' ? 'Current factory only' : 'Usine actuelle'}</b></div><div><span>{locale === 'en' ? 'Audit trail' : 'Audit'}</span><b className="success">{locale === 'en' ? 'Enabled' : 'Activé'}</b></div></div><button className="link-card" onClick={() => onNavigate('reports')}><Activity size={18}/><span>{locale === 'en' ? 'Open reports' : 'Ouvrir les rapports'}</span><ChevronRight size={17}/></button></aside>
        </section>
    </section>;
}

function App() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api<{ user: AuthUser }>('/api/auth/me').then(data => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="boot-screen"><div className="brand-mark"><Factory size={20}/></div><span>ICYEREKEZO OMS</span></div>;
    if (!user) return <AuthScreen onAuthenticated={setUser}/>;

    const logout = async () => {
        await api('/api/auth/logout', { method: 'POST' });
        setUser(null);
    };
    return <Dashboard user={user} onLogout={logout}/>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [locale, setLocale] = useState<Locale>('en');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '', factory_name: '', industry_type: 'general_manufacturing', industry_other: '', remember: false });
    const update = (key: string, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));
    const submit = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const data = await api<{ user: AuthUser }>(endpoint, { method: 'POST', body: JSON.stringify({ ...form, industry_type: form.industry_type === 'other' ? form.industry_other : form.industry_type, locale }) });
            onAuthenticated(data.user);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to continue.'); }
        finally { setBusy(false); }
    };
    const words = locale === 'en' ? {
        title: mode === 'login' ? 'Welcome back' : 'Create your factory workspace', subtitle: mode === 'login' ? 'Sign in to manage your operations.' : 'Start your secure ICYEREKEZO OMS workspace.',
        name: 'Full name', factory: 'Factory name', industry: 'Industry type', specifyIndustry: 'Specify the factory industry', email: 'Email address', password: 'Password', confirm: 'Confirm password', remember: 'Remember me',
        action: mode === 'login' ? 'Sign in securely' : 'Create workspace', switchText: mode === 'login' ? 'New to ICYEREKEZO?' : 'Already have an account?', switchAction: mode === 'login' ? 'Create a workspace' : 'Sign in',
    } : {
        title: mode === 'login' ? 'Bon retour' : 'Creez votre espace usine', subtitle: mode === 'login' ? 'Connectez-vous pour gerer vos operations.' : 'Demarrez votre espace ICYEREKEZO OMS securise.',
        name: 'Nom complet', factory: "Nom de l'usine", industry: "Type d'industrie", specifyIndustry: "Precisez le type d'industrie", email: 'Adresse e-mail', password: 'Mot de passe', confirm: 'Confirmer le mot de passe', remember: 'Se souvenir de moi',
        action: mode === 'login' ? 'Se connecter' : "Creer l'espace", switchText: mode === 'login' ? 'Nouveau sur ICYEREKEZO ?' : 'Vous avez deja un compte ?', switchAction: mode === 'login' ? 'Creer un espace' : 'Se connecter',
    };

    return <main className="auth-page">
        <section className="auth-story"><Logo/><div className="auth-story-copy"><span className="auth-kicker"><ShieldCheck size={15}/> Secure factory operations</span><h1>From raw material<br/>to final delivery.</h1><p>One connected workspace for production, inventory, quality, sales, and traceability.</p><div className="auth-points"><span><PackageCheck/>Batch traceability</span><span><Activity/>Real-time operations</span><span><ShieldCheck/>Tenant-level security</span></div></div><small>ICYEREKEZO means direction. Every operation, clearly guided.</small></section>
        <section className="auth-form-side"><button className="auth-language" onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}><Languages size={16}/>{locale === 'en' ? 'Francais' : 'English'}</button><form className="auth-card" onSubmit={submit}><div className="auth-mobile-logo"><Logo/></div><h2>{words.title}</h2><p>{words.subtitle}</p>{error && <div className="form-error">{error}</div>}
            {mode === 'register' && <><label>{words.name}<input value={form.name} onChange={e => update('name', e.target.value)} required autoComplete="name"/></label><label>{words.factory}<input value={form.factory_name} onChange={e => update('factory_name', e.target.value)} required/></label><label>{words.industry}<select value={form.industry_type} onChange={e => update('industry_type', e.target.value)}>
                <option value="general_manufacturing">{locale === 'en' ? 'General manufacturing' : 'Fabrication generale'}</option>
                <option value="clothing_textiles">{locale === 'en' ? 'Clothing and textiles' : 'Vetements et textiles'}</option>
                <option value="food_processing">{locale === 'en' ? 'Food processing' : 'Transformation alimentaire'}</option>
                <option value="beverages">{locale === 'en' ? 'Beverages and drinks' : 'Boissons'}</option>
                <option value="dairy">{locale === 'en' ? 'Milk and dairy products' : 'Lait et produits laitiers'}</option>
                <option value="pharmaceuticals_medicines">{locale === 'en' ? 'Medicines and pharmaceuticals' : 'Medicaments et produits pharmaceutiques'}</option>
                <option value="plastics_rubber">{locale === 'en' ? 'Plastics and rubber materials' : 'Matieres plastiques et caoutchouc'}</option>
                <option value="steel_metals">{locale === 'en' ? 'Steel and metal products' : 'Acier et produits metalliques'}</option>
                <option value="grain_flour_milling">{locale === 'en' ? 'Maize, grain and flour milling' : 'Mouture de mais, cereales et farine'}</option>
                <option value="agriculture_animal_feed">{locale === 'en' ? 'Agriculture and animal feed' : 'Agriculture et alimentation animale'}</option>
                <option value="construction_materials">{locale === 'en' ? 'Construction materials, cement and bricks' : 'Materiaux de construction, ciment et briques'}</option>
                <option value="furniture_wood">{locale === 'en' ? 'Furniture and wood products' : 'Meubles et produits du bois'}</option>
                <option value="paper_packaging_printing">{locale === 'en' ? 'Paper, packaging and printing' : 'Papier, emballage et imprimerie'}</option>
                <option value="chemicals_cosmetics_soap">{locale === 'en' ? 'Chemicals, cosmetics and soap' : 'Produits chimiques, cosmetiques et savon'}</option>
                <option value="electronics_electrical">{locale === 'en' ? 'Electronics and electrical products' : 'Produits electroniques et electriques'}</option>
                <option value="automotive_machinery">{locale === 'en' ? 'Automotive parts and machinery' : 'Pieces automobiles et machines'}</option>
                <option value="recycling_waste">{locale === 'en' ? 'Recycling and waste processing' : 'Recyclage et traitement des dechets'}</option>
                <option value="other">{locale === 'en' ? 'Other type of factory' : "Autre type d'usine"}</option>
            </select></label>{form.industry_type === 'other' && <label>{words.specifyIndustry}<input value={form.industry_other} onChange={e => update('industry_other', e.target.value)} required maxLength={80}/></label>}</>}
            <label>{words.email}<input type="email" value={form.email} onChange={e => update('email', e.target.value)} required autoComplete="email"/></label><label>{words.password}<input type="password" value={form.password} onChange={e => update('password', e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>
            {mode === 'register' && <label>{words.confirm}<input type="password" value={form.password_confirmation} onChange={e => update('password_confirmation', e.target.value)} required autoComplete="new-password"/></label>}
            {mode === 'login' && <label className="check-row"><input type="checkbox" checked={form.remember} onChange={e => update('remember', e.target.checked)}/><span>{words.remember}</span></label>}
            <button className="auth-submit" disabled={busy}>{busy ? 'Please wait...' : words.action}<ChevronRight size={17}/></button><div className="auth-switch"><span>{words.switchText}</span><button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{words.switchAction}</button></div>
        </form></section>
    </main>;
}

function Metric({ icon, label, value, suffix, detail, trend, tone }: { icon: React.ReactNode; label: string; value: string; suffix?: string; detail: string; trend: string; tone: string }) {
    return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><div><strong>{value}</strong>{suffix && <small>{suffix}</small>}</div><p><b className={tone}>{trend}</b>{detail}</p></div></article>;
}
function PanelTitle({ title, action }: { title: string; action: React.ReactNode }) { return <div className="panel-title"><h2>{title}</h2>{action}</div>; }
function ActivityItem({ icon, tone, title, text, time }: { icon: React.ReactNode; tone: string; title: string; text: string; time: string }) { return <div className="activity-item"><span className={`activity-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time></div>; }

createRoot(document.getElementById('app')!).render(<React.StrictMode><App/></React.StrictMode>);
