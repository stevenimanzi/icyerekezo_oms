import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/auth-premium.css';
import {
    Activity, Bell, Boxes, Building2, ChevronDown, ChevronRight, CircleAlert, CircleDollarSign, ClipboardCheck, CreditCard, Database,
    Eye, EyeOff, Factory, Gauge, HelpCircle, Languages, LayoutDashboard, LockKeyhole, Mail, Megaphone, Menu, MessageSquare, Moon, PackageCheck,
    PackageOpen, RefreshCw, Search, Send, Settings, ShieldCheck, ShoppingCart, Sun, Truck, Users, Warehouse,
    UserRound, Wrench, X, Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PlatformAdminPage from './PlatformAdminPage';
import ExecutiveDashboard from './ExecutiveDashboard';
import DepartmentDashboard from './DepartmentDashboard';
import ProductionOperations from './ProductionOperations';
import QualityControlPage from './QualityControlPage';
import MachinesPage from './MachinesPage';
import FactorySettingsPage from './FactorySettingsPage';
import ReportsPage from './ClearReportsPage';
import InventoryManagementPage from './InventoryManagementPage';
import SalesOverviewPage from './SalesOverviewPage';
import LogisticsOverviewPage from './LogisticsOverviewPage';
import ProcurementOverviewPage from './ProcurementOverviewPage';
import ProfileSettingsPage from './ProfileSettingsPage';
import ProductCatalogPage from './ProductCatalogPage';
import GlobalOperationToasts from './GlobalOperationToasts';
import { FlowSetupPage, ProductionFlowPage, TeamManagementPage } from './FactoryManagerModules';

type Locale = 'en' | 'fr';
const DEFAULT_SYSTEM_LOGO = '/assets/images/icyerekezo_oms_logo.svg';
type AuthUser = {
    id: number; name: string; email: string; locale: Locale; timezone?: string;
    current_factory: { id: number; name: string; slug: string; industry_type?: string; currency_code?: string } | null;
    is_platform_admin: boolean; permissions: string[]; workspace: string;
    roles: { id: number; name: string; slug: string; dashboard_key: string }[];
    employee_profile?: { job_title?: string; department?: { name: string }; workstation?: { name: string; type: string } } | null;
    active_assignments: { id: number; assignment_type: string; title: string; priority: string; status: string; due_at?: string }[];
    announcements?: { id: number; title: string; message: string; severity: string; published_at: string }[];
    subscription?: { id: number; status: string; plan?: { id: number; name: string; code: string; features: string[] } } | null;
    system?: { name: string; tagline?: string; logo_url?: string; support_email?: string; support_phone?: string; currency_code?: string; timezone?: string };
};

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf(), ...(options.headers ?? {}) },
    });
    const text = await response.text();
    let payload: any = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { const error:any = new Error('The server returned a web page instead of data. Please refresh and sign in again.'); error.status=response.status; throw error; }
    if (!response.ok) { const error:any=new Error(payload.message || 'Something went wrong.');error.status=response.status;throw error; }
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

function Logo({ name = 'ICYEREKEZO OMS', logoUrl = DEFAULT_SYSTEM_LOGO }: { name?: string; logoUrl?: string } = {}) {
    const words = name.split(' '); const suffix = words.length > 1 ? words.pop() : 'OMS';
    return <div className="brand">{logoUrl === DEFAULT_SYSTEM_LOGO ? <img className="brand-logo" src={logoUrl} alt={name}/> : <><div className="brand-mark"><img src={logoUrl} alt=""/></div><div><strong>{words.join(' ')}</strong><span>{suffix}</span></div></>}</div>;
}

const adminPagePaths: Record<string, string> = { 'platform-dashboard': '/admin', factories: '/admin/factories', 'platform-users': '/admin/users', subscriptions: '/admin/subscriptions', announcements: '/admin/announcements', notifications: '/admin/notifications', 'support-center': '/admin/support', backups: '/admin/backups', 'system-settings': '/admin/settings' };
const adminPathPages = Object.fromEntries(Object.entries(adminPagePaths).map(([page, path]) => [path, page]));
function pageFromLocation(user: AuthUser): string {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (user.is_platform_admin) return path === '/admin/profile' ? 'profile' : (adminPathPages[path] || 'platform-dashboard');
    const parts = path.split('/').filter(Boolean); const page = parts.length > 1 ? parts[1] : 'dashboard'; return ({ report: 'reports', users: 'team', products_bom: 'products' } as Record<string,string>)[page] || page;
}
function pathForPage(user: AuthUser, page: string): string {
    if (user.is_platform_admin) return page === 'profile' ? '/admin/profile' : (adminPagePaths[page] || '/admin');
    const workspace = user.workspace || 'operations'; return page === 'dashboard' ? `/${workspace}` : `/${workspace}/${page}`;
}

class PageBoundary extends React.Component<{resetKey:string;children:React.ReactNode},{failed:boolean;attempts:number}> {
    state={failed:false,attempts:0};
    private recoveryTimer?: number;
    static getDerivedStateFromError(){return {failed:true}}
    componentDidCatch(error:Error){console.error('Page render failed',error);if(this.state.attempts<2){this.recoveryTimer=window.setTimeout(()=>this.setState(state=>({failed:false,attempts:state.attempts+1})),350)}}
    componentDidUpdate(previous:{resetKey:string}){if(previous.resetKey!==this.props.resetKey){window.clearTimeout(this.recoveryTimer);if(this.state.failed||this.state.attempts)this.setState({failed:false,attempts:0})}}
    componentWillUnmount(){window.clearTimeout(this.recoveryTimer)}
    retry=()=>{window.clearTimeout(this.recoveryTimer);this.setState(state=>({failed:false,attempts:state.attempts+1}))};
    render(){
        if(!this.state.failed)return this.props.children;
        if(this.state.attempts<2)return <div className="panel page-recovery page-reconnecting" role="status"><RefreshCw size={30}/><h2>Loading your page</h2><p>Connecting to the latest factory data…</p></div>;
        return <div className="panel page-recovery" role="alert"><span className="recovery-warning"><CircleAlert size={30}/></span><h2>We could not load this page</h2><p>Please check your connection, then try again. Your data is safe.</p><button className="primary-btn" onClick={this.retry}><RefreshCw size={17}/>Try again</button></div>
    }
}

function Dashboard({ user, onLogout, onMaintenance }: { user: AuthUser; onLogout: () => void; onMaintenance: (message:string) => void }) {
    const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem('icy_locale') as Locale) || 'en');
    const [dark, setDark] = useState(() => localStorage.getItem('icy_theme') === 'dark');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [activePage, setActivePage] = useState(() => pageFromLocation(user));
    const skipHistory = useRef(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [liveAnnouncements,setLiveAnnouncements]=useState(user.announcements||[]);
    const [lowStockCount,setLowStockCount]=useState(0);
    const [searchQuery,setSearchQuery]=useState('');
    const [searchResults,setSearchResults]=useState<any[]>([]);
    const [profileOpen, setProfileOpen] = useState(false);
    const t = copy[locale];
    const can = (permission: string) => user.permissions.includes('*') || user.permissions.includes(permission);
    const isExecutiveUser = user.is_platform_admin || user.workspace === 'executive' || user.roles.some(role => ['factory-owner', 'factory-administrator', 'factory-manager'].includes(role.slug));
    const isFactoryOwner = user.roles.some(role => role.slug === 'factory-owner');
    const workspaceName = ({ platform_admin: 'Platform administration', executive: t.overview, production: locale === 'en' ? 'Production command centre' : 'Centre de production', warehouse: locale === 'en' ? 'Warehouse workspace' : 'Espace entrepot', procurement: locale === 'en' ? 'Procurement workspace' : 'Espace achats', quality: locale === 'en' ? 'Quality control workspace' : 'Espace controle qualite', cutting: locale === 'en' ? 'Cutting workstation' : 'Poste de coupe', workstation: locale === 'en' ? 'Operator workstation' : 'Poste operateur', logistics: locale === 'en' ? 'Logistics workspace' : 'Espace logistique', sales: locale === 'en' ? 'Sales workspace' : 'Espace ventes', finance: locale === 'en' ? 'Finance workspace' : 'Espace finances' } as Record<string,string>)[user.workspace] || t.overview;
    useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('icy_theme', dark ? 'dark' : 'light'); }, [dark]);
    useEffect(() => { document.documentElement.lang = locale; localStorage.setItem('icy_locale', locale); }, [locale]);
    useEffect(() => {
        const path = pathForPage(user, activePage); document.title = `${activePage.replaceAll('-', ' ')} | ${user.system?.name || 'ICYEREKEZO OMS'}`;
        if (skipHistory.current) { skipHistory.current = false; if (window.location.pathname !== path) window.history.replaceState({ page: activePage }, '', path); }
        else if (window.location.pathname !== path) window.history.pushState({ page: activePage }, '', path);
    }, [activePage, user]);
    useEffect(() => { const back = () => { skipHistory.current = true; setActivePage(pageFromLocation(user)); }; window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, [user]);
    useEffect(()=>{const refresh=()=>api<{user:AuthUser}>('/api/auth/me').then(result=>setLiveAnnouncements(result.user.announcements||[])).catch((reason:any)=>{if(reason?.status===503)onMaintenance(reason.message)});const timer=window.setInterval(refresh,5000);return()=>window.clearInterval(timer)},[onMaintenance]);
    useEffect(()=>{
        if(user.is_platform_admin||!can('inventory.view')){setLowStockCount(0);return;}
        const refresh=()=>api<{low_stock:number}>('/api/inventory/overview').then(result=>setLowStockCount(Number(result.low_stock)||0)).catch(()=>setLowStockCount(0));
        refresh(); const timer=window.setInterval(refresh,15000); return()=>window.clearInterval(timer);
    },[user.is_platform_admin,user.permissions]);
    useEffect(()=>{if(searchQuery.trim().length<2){setSearchResults([]);return}const timer=window.setTimeout(()=>api<{data:any[]}>(`/api/search?q=${encodeURIComponent(searchQuery)}`).then(result=>setSearchResults(result.data)).catch(()=>setSearchResults([])),250);return()=>window.clearTimeout(timer)},[searchQuery]);
    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault(); document.querySelector<HTMLInputElement>('.search input')?.focus();
            }
            if (event.key === 'Escape') { setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false); }
        };
        window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
    }, []);

    const subscribedFeatures = user.subscription?.plan?.features;
    const featureForPage:Record<string,string>={dashboard:'dashboard',procurement:'procurement',inventory:'inventory',products:'products',production:'production',quality:'quality',sales:'sales',logistics:'logistics',dispatch:'logistics',vehicles:'logistics','delivery-confirmation':'logistics',team:'team',machines:'maintenance',reports:'reports'};
    const hasFeature=(page:string)=>!subscribedFeatures||subscribedFeatures.includes(featureForPage[page]||page);
    const isLogisticsUser=user.workspace==='logistics'||user.roles.some(role=>role.slug==='logistics-officer');
    const nav = useMemo(() => (user.is_platform_admin ? [
        ['platform-dashboard', LayoutDashboard, locale === 'en' ? 'Platform overview' : 'Vue plateforme', '*'], ['factories', Building2, locale === 'en' ? 'Factories' : 'Usines', '*'], ['platform-users', Users, locale === 'en' ? 'All users' : 'Tous les utilisateurs', '*'], ['subscriptions', CreditCard, locale === 'en' ? 'Subscriptions' : 'Abonnements', '*'], ['announcements', Megaphone, locale === 'en' ? 'Announcements' : 'Annonces', '*'], ['notifications', Bell, locale === 'en' ? 'Notifications' : 'Notifications', '*'], ['support-center', MessageSquare, locale === 'en' ? 'Support centre' : 'Centre de support', '*'], ['backups', Database, locale === 'en' ? 'Database backups' : 'Sauvegardes', '*'], ['system-settings', Settings, locale === 'en' ? 'System settings' : 'Paramètres système', '*'],
    ] as const : isFactoryOwner ? [
        ['dashboard', LayoutDashboard, locale === 'en' ? 'Factory performance' : 'Performance de l\u2019usine', '*'],
        ['procurement', ShoppingCart, locale === 'en' ? 'Purchasing overview' : 'Vue des achats', 'procurement.view'],
        ['inventory', Warehouse, locale === 'en' ? 'Stock overview' : 'Vue du stock', 'inventory.view'],
        ['production', Gauge, locale === 'en' ? 'Production performance' : 'Performance de production', 'production.view'],
        ['quality', ClipboardCheck, locale === 'en' ? 'Quality results' : 'R\u00e9sultats qualit\u00e9', 'quality.view'],
        ['sales', PackageOpen, locale === 'en' ? 'Sales overview' : 'Vue des ventes', 'sales.view'],
        ['logistics', Truck, locale === 'en' ? 'Delivery overview' : 'Vue des livraisons', 'logistics.view'],
        ['reports', Activity, locale === 'en' ? 'Factory reports' : 'Rapports de l\u2019usine', 'reports.view'],
    ] as const : isLogisticsUser ? [
        ['dashboard', LayoutDashboard, locale === 'en' ? 'Dashboard' : 'Tableau de bord', '*'],
        ['sales', PackageOpen, locale === 'en' ? 'Incoming orders' : 'Commandes entrantes', 'sales.view'],
        ['inventory', Warehouse, locale === 'en' ? 'Available stock' : 'Stock disponible', 'inventory.view'],
        ['logistics', Truck, locale === 'en' ? 'Shipments' : 'Expéditions', 'logistics.view'],
        ['dispatch', Activity, locale === 'en' ? 'Dispatch board' : 'Planification', 'logistics.dispatch'],
        ['vehicles', Truck, locale === 'en' ? 'Vehicles & drivers' : 'Véhicules et chauffeurs', 'logistics.view'],
        ['delivery-confirmation', PackageCheck, locale === 'en' ? 'Delivery confirmation' : 'Confirmation de livraison', 'logistics.deliver'],
    ] as const : [
        ['dashboard', LayoutDashboard, t.dashboard, '*'], ['procurement', ShoppingCart, t.procurement, 'procurement.view'], ['inventory', Warehouse, t.warehouse, 'inventory.view'], ['products', Boxes, t.products, 'products.view'],
        ['production', Gauge, user.roles.some(role => role.slug === 'factory-manager') ? (locale === 'en' ? 'Production Configuration' : 'Configuration de production') : t.planning, 'production.view'], ['quality', ClipboardCheck, t.control, 'quality.view'], ['sales', PackageOpen, t.sales, 'sales.view'], ['logistics', Truck, t.logistics, 'logistics.view'],
        ['team', Users, t.people, 'users.view'], ['machines', Wrench, t.machines, 'maintenance.view'], ['reports', Activity, t.reports, 'reports.view'],
    ] as const).filter(([page, , , permission]) => (permission === '*' || can(permission)) && (user.is_platform_admin || hasFeature(page))), [t, locale, user.is_platform_admin, user.permissions, user.roles, subscribedFeatures, isFactoryOwner, isLogisticsUser]);
    useEffect(() => {
        const allowed = nav.map(([key]) => key as string); allowed.push('profile'); if (!user.is_platform_admin) { if(hasFeature('support'))allowed.push('support');allowed.push('notifications'); if (can('factory.manage')) allowed.push('settings'); }
        if (!allowed.includes(activePage)) setActivePage(user.is_platform_admin ? 'platform-dashboard' : (allowed[0]||'notifications'));
    }, [activePage, nav, user.is_platform_admin]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.querySelector('.page')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [activePage]);

    const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 2600); };

    return <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-head"><Logo/><button className="icon-btn mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
            <nav>
                <p className="nav-label">{t.general}</p>
                {nav.map(([key, Icon, label]) => <button key={key} className={`nav-item ${activePage === key ? 'active' : ''}`} onClick={() => { setActivePage(key); setSidebarOpen(false); }}><Icon size={18}/><span>{label}</span>{key === 'inventory' && lowStockCount > 0 && <i title={locale==='en'?'Low-stock items that need attention':'Articles en stock faible nécessitant une attention'}>{lowStockCount}</i>}</button>)}
                {!user.is_platform_admin && <><p className="nav-label">{isFactoryOwner ? 'ASSISTANCE' : t.management}</p>{!isFactoryOwner && can('factory.manage') && <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => { setActivePage('settings'); setSidebarOpen(false); }}><Settings size={18}/><span>{t.settings}</span></button>}{hasFeature('support')&&<button className={`nav-item ${activePage === 'support' ? 'active' : ''}`} onClick={() => { setActivePage('support'); setSidebarOpen(false); }}><HelpCircle size={18}/><span>{t.support}</span></button>}</>}
            </nav>
            <button className="factory-card" onClick={() => setActivePage(user.is_platform_admin ? 'system-settings' : isFactoryOwner ? 'dashboard' : 'settings')}><div className="factory-avatar">{user.current_factory?.name.slice(0, 2).toUpperCase() || 'IC'}</div><div><strong>{user.current_factory?.name || user.system?.name || 'ICYEREKEZO OMS'}</strong><span>{user.is_platform_admin ? (locale === 'en' ? 'System administration' : 'Administration système') : isFactoryOwner ? (locale === 'en' ? 'Performance overview' : 'Vue des performances') : (locale === 'en' ? 'Factory workspace' : 'Espace usine')}</span></div><ChevronRight size={17}/></button>
        </aside>
        {sidebarOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)}/>} 
        <main className="main-area">
            <header className="topbar">
                <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21}/></button>
                <label className="search"><Search size={18}/><input aria-label={t.search} placeholder={t.search} value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} onFocus={() => setSearchOpen(true)}/><kbd>Ctrl K</kbd>{searchOpen && <div className="top-popover search-popover"><strong>{locale === 'en' ? 'Live search results' : 'Résultats en direct'}</strong>{searchQuery.trim().length<2?<span>{locale==='en'?'Type at least 2 letters':'Saisissez au moins 2 lettres'}</span>:searchResults.length?searchResults.map((item,index)=><button key={`${item.type}-${item.title}-${index}`} onMouseDown={()=>{setActivePage(item.page);setSearchOpen(false);setSearchQuery('')}}><b>{item.title}</b><small>{item.type} · {item.subtitle}</small></button>):<span>{locale==='en'?'No matching records':'Aucun résultat'}</span>}</div>}</label>
                <div className="top-actions">
                    <button className="locale-btn" onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}><Languages size={17}/><span>{locale === 'en' ? 'FR' : 'EN'}</span></button>
                    <button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
                    <div className="popover-anchor"><button className="icon-btn notification" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19}/><b>{liveAnnouncements.length}</b></button>{notificationsOpen && <div className="top-popover notification-menu"><strong>{locale === 'en' ? 'Notifications' : 'Notifications'}</strong>{liveAnnouncements.length ? liveAnnouncements.slice(0,4).map(item => <span key={item.id}><b>{item.title}</b>{item.message}</span>) : <span>{locale === 'en' ? 'No new announcements' : 'Aucune nouvelle annonce'}</span>}<button onClick={() => { setNotificationsOpen(false); setActivePage('notifications'); }}>{locale==='en'?'View all notifications':'Voir toutes les notifications'}</button></div>}</div>
                    <div className="popover-anchor"><button className="user-menu" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar">{user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="user-copy"><strong>{user.name}</strong><small>{user.employee_profile?.job_title || user.roles[0]?.name || (user.is_platform_admin ? 'Platform administrator' : 'Team member')}</small></span><ChevronDown size={16}/></button>{profileOpen && <div className="top-popover profile-menu"><button onClick={() => { setActivePage('profile'); setProfileOpen(false); }}>{locale === 'en' ? 'Profile & settings' : 'Profil et paramètres'}</button><button onClick={onLogout}>{locale === 'en' ? 'Sign out' : 'Se déconnecter'}</button></div>}</div>
                </div>
            </header>
            <div className="page">
                <PageBoundary resetKey={activePage}>{activePage==='profile'?<ProfileSettingsPage user={user} locale={locale} dark={dark} onLocaleChange={setLocale} onThemeChange={setDark}/>:activePage==='notifications'?<NotificationsPage announcements={liveAnnouncements} locale={locale}/>:user.is_platform_admin ? <PlatformAdminPage page={activePage} locale={locale}/> : activePage === 'support' ? <UserSupportChat user={user} locale={locale}/> : activePage === 'dashboard' ? (isExecutiveUser?<ExecutiveDashboard user={user} locale={locale} onNavigate={setActivePage}/>:<DepartmentDashboard user={user} locale={locale} onNavigate={setActivePage}/>) : activePage === 'inventory' ? <InventoryOverviewPage user={user} locale={locale}/> : activePage === 'products' ? <ProductCatalogPage user={user} locale={locale}/> : activePage === 'procurement' ? <ProcurementOverviewPage/> : activePage === 'sales' ? <SalesOverviewPage/> : ['logistics','dispatch','vehicles','delivery-confirmation'].includes(activePage) ? <LogisticsOverviewPage initialTab={({dispatch:'dispatch',vehicles:'vehicles','delivery-confirmation':'proof'} as Record<string,string>)[activePage]||'shipments'}/> : activePage === 'settings' ? <FactorySettingsPage/> : activePage === 'team' ? <TeamManagementPage/> : activePage === 'reports' ? <ReportsPage canExport={can('reports.export')} productionOnly={user.workspace==='production'&&!isExecutiveUser}/> : activePage === 'quality' ? <QualityControlPage can={can}/> : activePage === 'machines' ? <MachinesPage can={can}/> : activePage === 'production' ? (can('factory.manage')?<ProductionFlowPage/>:<ProductionOperations can={can}/>) : activePage !== 'dashboard' ? <ModulePage page={activePage} locale={locale} can={can} onNavigate={setActivePage}/> : <>
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
                </>}</PageBoundary>
            </div>
        </main>
        {notice && <div className="toast">{notice}</div>}
    </div>;
}

const moduleContent = {
    'platform-dashboard': { icon: LayoutDashboard, en: ['System overview', 'View every factory, subscription, user, support request and system service.', ['System status', 'Factory activity', 'Subscription status', 'Security alerts']], fr: ['Vue du système', 'Consultez les usines, abonnements, utilisateurs, demandes et services.', ['État du système', 'Activité des usines', 'État des abonnements', 'Alertes de sécurité']] },
    factories: { icon: Building2, en: ['Factory administration', 'Register, approve, activate, suspend and monitor every factory account.', ['All factories', 'Pending approval', 'Active factories', 'Suspended factories']], fr: ['Administration des usines', 'Enregistrez, approuvez, activez, suspendez et surveillez chaque usine.', ['Toutes les usines', 'En attente', 'Usines actives', 'Usines suspendues']] },
    'platform-users': { icon: Users, en: ['Platform users', 'Search all accounts, control status and grant trusted platform administrators.', ['All users', 'Factory owners', 'Platform administrators', 'Inactive accounts']], fr: ['Utilisateurs plateforme', 'Recherchez les comptes, contrôlez leur état et les administrateurs.', ['Tous les utilisateurs', 'Propriétaires', 'Administrateurs', 'Comptes inactifs']] },
    subscriptions: { icon: CreditCard, en: ['Subscriptions & plans', 'Configure plans, limits, billing periods, renewals and automatic suspension.', ['Subscription plans', 'Active subscriptions', 'Expiring soon', 'Payment history']], fr: ['Abonnements et forfaits', 'Configurez forfaits, limites, périodes, renouvellements et suspensions.', ['Forfaits', 'Abonnements actifs', 'Expiration proche', 'Historique paiements']] },
    announcements: { icon: Megaphone, en: ['Platform announcements', 'Send operational, billing or emergency messages to all platform users.', ['Compose message', 'Published', 'Scheduled', 'Expired']], fr: ['Annonces plateforme', 'Envoyez des messages opérationnels, financiers ou urgents à tous.', ['Composer', 'Publiées', 'Planifiées', 'Expirées']] },
    'support-center': { icon: MessageSquare, en: ['Support centre', 'Receive factory problems, reply to conversations and track resolution.', ['Open tickets', 'In progress', 'Waiting customer', 'Resolved']], fr: ['Centre de support', 'Recevez les problèmes, répondez et suivez leur résolution.', ['Tickets ouverts', 'En cours', 'Attente client', 'Résolus']] },
    backups: { icon: Database, en: ['System backups', 'Create secure copies of system data and check when each copy is ready.', ['Backup history', 'Create backup', 'Schedule', 'Backup status']], fr: ['Sauvegardes du système', 'Créez des copies sécurisées des données et vérifiez leur état.', ['Historique', 'Créer une sauvegarde', 'Planification', 'État de sauvegarde']] },
    'system-settings': { icon: Settings, en: ['System configuration', 'Manage platform identity, logo, registration, maintenance and support contacts.', ['Identity & branding', 'Registration', 'Maintenance mode', 'Security']], fr: ['Configuration système', 'Gérez identité, logo, inscriptions, maintenance et contacts.', ['Identité et marque', 'Inscription', 'Mode maintenance', 'Sécurité']] },
    procurement: { icon: ShoppingCart, en: ['Purchasing', 'Manage suppliers, purchase requests, prices, orders and received goods.', ['Purchase requests', 'Supplier prices', 'Purchase orders', 'Received goods']], fr: ['Achats', 'Gérez les fournisseurs, demandes, prix, commandes et réceptions.', ['Demandes d’achat', 'Prix fournisseurs', 'Bons de commande', 'Produits reçus']] },
    inventory: { icon: Warehouse, en: ['Stock and warehouses', 'Track stock in every warehouse, location and batch.', ['Current stock', 'Stock movements', 'Transfers', 'Stock counts']], fr: ['Stock et entrepôts', 'Suivez le stock dans chaque entrepôt, emplacement et lot.', ['Stock actuel', 'Mouvements de stock', 'Transferts', 'Comptages de stock']] },
    products: { icon: Boxes, en: ['Products and materials', 'Manage raw materials, finished products and what is needed to make each product.', ['Products and item codes', 'Categories', 'Materials needed', 'Units and conversions']], fr: ['Produits et matières', 'Gérez les matières premières, produits finis et besoins de fabrication.', ['Produits et codes', 'Catégories', 'Matières nécessaires', 'Unités et conversions']] },
    production: { icon: Gauge, en: ['Production', 'Plan demand, check materials and execute configurable factory workflows.', ['Production orders', 'Planning', 'Workflow templates', 'Stage execution']], fr: ['Production', 'Planifiez la demande, vérifiez les matières et exécutez les flux configurables.', ['Ordres de production', 'Planification', 'Modèles de flux', 'Exécution des étapes']] },
    quality: { icon: ClipboardCheck, en: ['Quality control', 'Inspect incoming materials, production stages and finished batches.', ['Inspection queue', 'Test templates', 'Defects & rework', 'Certificates']], fr: ['Contrôle qualité', 'Inspectez les matières reçues, les étapes et les lots finis.', ['File d’inspection', 'Modèles de test', 'Défauts et retouches', 'Certificats']] },
    sales: { icon: PackageOpen, en: ['Sales & orders', 'Manage customers, quotations, orders, invoices and returns.', ['Customer orders', 'Quotations', 'Invoices', 'Returns']], fr: ['Ventes et commandes', 'Gérez les clients, devis, commandes, factures et retours.', ['Commandes clients', 'Devis', 'Factures', 'Retours']] },
    logistics: { icon: Truck, en: ['Logistics', 'Plan packing, dispatch, routes, vehicles and proof of delivery.', ['Shipments', 'Dispatch board', 'Vehicles & drivers', 'Proof of delivery']], fr: ['Logistique', 'Planifiez emballage, expédition, routes, véhicules et preuve de livraison.', ['Expéditions', 'Tableau d’envoi', 'Véhicules et chauffeurs', 'Preuve de livraison']] },
    team: { icon: Users, en: ['Employees and work schedules', 'Manage employees, access, departments, schedules and attendance.', ['Employees', 'Roles and access', 'Work assignments', 'Schedules and attendance']], fr: ['Employés et horaires', 'Gérez les employés, accès, départements, horaires et présences.', ['Employés', 'Rôles et accès', 'Affectations', 'Horaires et présence']] },
    machines: { icon: Wrench, en: ['Machines & maintenance', 'Track machine availability, maintenance plans, breakdowns and downtime.', ['Machine register', 'Maintenance schedule', 'Repair requests', 'Downtime']], fr: ['Machines et maintenance', 'Suivez disponibilité, maintenance, pannes et temps d’arrêt.', ['Registre machines', 'Plan de maintenance', 'Demandes de réparation', 'Temps d’arrêt']] },
    reports: { icon: Activity, en: ['Factory reports', 'View completed work and save clear business reports.', ['Factory summary', 'Stock reports', 'Production reports', 'Money reports']], fr: ['Rapports de l’usine', 'Consultez le travail effectué et enregistrez des rapports clairs.', ['Résumé de l’usine', 'Rapports de stock', 'Rapports de production', 'Rapports financiers']] },
    settings: { icon: Settings, en: ['Factory settings', 'Configure factory identity, branches, departments, approvals and numbering.', ['Factory profile', 'Branches & departments', 'Approval rules', 'Security settings']], fr: ['Paramètres de l’usine', 'Configurez identité, sites, départements, validations et numérotation.', ['Profil usine', 'Sites et départements', 'Règles de validation', 'Paramètres de sécurité']] },
    support: { icon: HelpCircle, en: ['Help & support', 'Find guidance, report a problem or contact the ICYEREKEZO support team.', ['Getting started', 'User guide', 'Support tickets', 'System status']], fr: ['Aide et support', 'Consultez les guides, signalez un problème ou contactez le support.', ['Bien démarrer', 'Guide utilisateur', 'Tickets support', 'État du système']] },
} as const;

function NotificationsPage({announcements,locale}:{announcements:NonNullable<AuthUser['announcements']>;locale:Locale}) {
    return <section className="module-page"><div className="module-hero"><div className="module-title"><span><Bell size={22}/></span><div><div className="eyebrow"><i></i>{locale==='en'?'Live updates':'Mises à jour'}</div><h1>{locale==='en'?'Notifications':'Notifications'}</h1><p>{locale==='en'?'System messages appear here automatically.':'Les messages système apparaissent automatiquement ici.'}</p></div></div></div><div className="notification-page">{announcements.length?announcements.map(item=><article className="panel" key={item.id}><span className={`notice-icon ${item.severity}`}><Megaphone size={20}/></span><div><div><h3>{item.title}</h3><span className={`admin-status ${item.severity}`}>{item.severity}</span></div><p>{item.message}</p><time>{new Date(item.published_at).toLocaleString()}</time></div></article>):<div className="panel empty-state"><span><Bell size={28}/></span><h3>{locale==='en'?'No notifications':'Aucune notification'}</h3><p>{locale==='en'?'New system messages will appear here automatically.':'Les nouveaux messages apparaîtront ici automatiquement.'}</p></div>}</div></section>
}

function UserSupportChat({user,locale}:{user:AuthUser;locale:Locale}) {
    const [tickets,setTickets]=useState<any[]>([]);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [message,setMessage]=useState('');const [lastUpdated,setLastUpdated]=useState<Date|null>(null);const messageEnd=useRef<HTMLDivElement|null>(null);
    const normalize=(item:any)=>({...item,id:Number(item?.id||0),subject:String(item?.subject||'Support request'),ticket_number:String(item?.ticket_number||''),status:String(item?.status||'open'),category:String(item?.category||'general'),priority:String(item?.priority||'normal'),messages:Array.isArray(item?.messages)?item.messages.filter(Boolean):[]});
    const load=async(silent=false)=>{if(!silent)setLoading(true);try{const result:any=await api('/api/support/tickets');setTickets(Array.isArray(result?.data)?result.data.map(normalize):[]);setError('');setLastUpdated(new Date())}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load support messages.')}finally{if(!silent)setLoading(false)}};
    useEffect(()=>{load();const timer=window.setInterval(()=>load(true),3000);return()=>window.clearInterval(timer)},[]);
    const active=tickets[0]||null;
    useEffect(()=>{messageEnd.current?.scrollIntoView?.({behavior:'smooth',block:'end'})},[active?.messages?.length]);
    const send=async()=>{const text=message.trim();if(!text||busy)return;setBusy(true);setError('');try{if(active){await api(`/api/support/tickets/${active.id}/reply`,{method:'POST',body:JSON.stringify({message:text})})}else{await api('/api/support/tickets',{method:'POST',body:JSON.stringify({subject:'Support conversation',message:text,category:'general',priority:'normal'})})}setMessage('');await load(true)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to send your message.')}finally{setBusy(false)}};
    const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'U';
    const messages=active?.messages||[];
    const firstDate=messages[0]?.created_at?new Date(messages[0].created_at):new Date();
    return <section className="module-page support-page">
        <div className="module-hero support-page-hero">
            <div className="module-title"><div><div className="eyebrow"><i></i>{locale==='en'?'SUPPORT ONLINE':'SUPPORT EN LIGNE'}</div><h1>{locale==='en'?'Chat with support':'Discuter avec le support'}</h1><p>{locale==='en'?'Get help directly from the ICYEREKEZO system administration team.':"Obtenez de l'aide directement auprès de l'équipe ICYEREKEZO."}</p></div></div>
            <div className="support-actions"><span className="support-live"><i></i>{lastUpdated?(locale==='en'?'Updated ':'Actualisé ')+lastUpdated.toLocaleTimeString():(locale==='en'?'Connecting...':'Connexion...')}</span><button className="secondary-btn" disabled={loading} onClick={()=>load()}><RefreshCw size={17}/>{locale==='en'?'Refresh':'Actualiser'}</button></div>
        </div>
        {error&&<div className="admin-alert error">{error}</div>}
        <div className="support-room user-support-room panel"><section className="chat-window" aria-label={locale==='en'?'Support conversation':'Conversation avec le support'}>
            <header className="support-conversation-header"><div className="support-contact"><div className="support-admin-avatar"><MessageSquare size={22}/></div><div className="support-admin-name"><h3>{locale==='en'?'ICYEREKEZO Support':'Support ICYEREKEZO'}</h3><p><i></i>{locale==='en'?'System administrator online':'Administrateur système en ligne'}</p></div></div><div className="support-private"><ShieldCheck size={18}/><span><b>{locale==='en'?'Private support':'Support privé'}</b><small>{locale==='en'?'Only you and support can see this chat':'Visible uniquement par vous et le support'}</small></span></div></header>
            <div className="chat-messages professional-chat-messages" role="log" aria-live="polite">{loading&&!active?<div className="chat-empty">{locale==='en'?'Loading your conversation...':'Chargement de votre conversation...'}</div>:messages.length?<><div className="support-date-divider"><span>{firstDate.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span></div>{messages.map((item:any)=>{const mine=Number(item.user_id)===user.id;const sender=mine?user.name:(item.user?.name||'ICYEREKEZO Support');return <div key={item.id} className={`support-message-row ${mine?'mine':'theirs'}`}>{!mine&&<div className="support-message-avatar support-avatar-admin">IC</div>}<div className="support-message-stack"><div className="support-message-meta"><b>{mine?(locale==='en'?'You':'Vous'):sender}</b><time>{item.created_at?new Date(item.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</time></div><div className="support-message-bubble"><p>{String(item.message||'')}</p></div></div>{mine&&<div className="support-message-avatar">{initials(user.name)}</div>}</div>})}</>:<div className="chat-welcome-simple"><span className="welcome-support-icon"><MessageSquare size={30}/></span><h3>{locale==='en'?'Start a conversation':'Commencer une conversation'}</h3><p>{locale==='en'?'Write your message below. The system administrator will reply in this secure chat.':"Écrivez votre message ci-dessous. L'administrateur système répondra dans cette discussion sécurisée."}</p></div>}<div ref={messageEnd}/></div>
            <form className="chat-compose professional-chat-compose" onSubmit={event=>{event.preventDefault();send()}}><div className="support-input-wrap"><textarea aria-label={locale==='en'?'Message':'Message'} maxLength={10000} rows={1} placeholder={locale==='en'?'Write your message here...':'Écrivez votre message ici...'} value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><small>{locale==='en'?'Enter to send · Shift + Enter for a new line':'Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne'}</small></div><button className="support-send-btn" type="submit" disabled={busy||!message.trim()}><span>{busy?(locale==='en'?'Sending':'Envoi'):(locale==='en'?'Send':'Envoyer')}</span><Send size={19}/></button></form>
        </section></div>
    </section>
}

function InventoryOverviewPage({user,locale}:{user:AuthUser;locale:Locale}) {
    return <InventoryManagementPage user={user} locale={locale}/>;
    const [data,setData]=useState<any>(null);const [tab,setTab]=useState('stock');const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [updated,setUpdated]=useState<Date|null>(null);
    const load=async(silent=false)=>{if(!silent)setLoading(true);try{setData(await api('/api/inventory/overview'));setError('');setUpdated(new Date())}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load stock data.')}finally{if(!silent)setLoading(false)}};
    useEffect(()=>{load();const timer=window.setInterval(()=>load(true),15000);return()=>window.clearInterval(timer)},[]);
    const currency=user.current_factory?.currency_code||user.system?.currency_code||'RWF';
    const money=(value:any)=>`${currency} ${Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
    const quantity=(value:any,unit?:string)=>`${Number(value||0).toLocaleString(undefined,{maximumFractionDigits:3})}${unit?` ${unit}`:''}`;
    const transactions=(data?.recent_transactions||[]).filter((item:any)=>tab==='transfers'?String(item.type).includes('transfer'):tab==='counts'?['count','adjustment','stock_count'].some(type=>String(item.type).includes(type)):true);
    return <section className="module-page inventory-live-page">
        <div className="module-hero"><div className="module-title"><div><div className="eyebrow"><i></i>{locale==='en'?'LIVE STOCK DATA':'STOCK EN DIRECT'}</div><h1>{locale==='en'?'Stock overview':'Vue du stock'}</h1><p>{locale==='en'?'Current quantities and movements recorded in your factory.':'Quantités et mouvements enregistrés dans votre usine.'}</p></div></div><div className="inventory-live-actions"><span><i></i>{updated?(locale==='en'?'Updated ':'Mis à jour ')+updated.toLocaleTimeString():locale==='en'?'Connecting…':'Connexion…'}</span><button className="secondary-btn" disabled={loading} onClick={()=>load()}><RefreshCw size={16}/>{locale==='en'?'Refresh':'Actualiser'}</button></div></div>
        {error&&<div className="admin-alert error">{error}</div>}
        <div className="inventory-metrics"><article><small>{locale==='en'?'Stock items':'Articles'}</small><strong>{Number(data?.items||0).toLocaleString()}</strong><p>{locale==='en'?'Products and materials':'Produits et matières'}</p></article><article><small>{locale==='en'?'Warehouses':'Entrepôts'}</small><strong>{Number(data?.warehouses||0).toLocaleString()}</strong><p>{locale==='en'?'Active storage locations':'Lieux de stockage actifs'}</p></article><article className={Number(data?.low_stock||0)>0?'warning':''}><small>{locale==='en'?'Low-stock items':'Stock faible'}</small><strong>{Number(data?.low_stock||0).toLocaleString()}</strong><p>{locale==='en'?'Need attention':'Nécessitent une attention'}</p></article><article><small>{locale==='en'?'Total stock value':'Valeur totale du stock'}</small><strong>{money(data?.total_value)}</strong><p>{locale==='en'?'Based on recorded costs':'Selon les coûts enregistrés'}</p></article></div>
        <div className="module-tabs inventory-tabs" role="tablist">{[['stock',locale==='en'?'Current stock':'Stock actuel'],['movements',locale==='en'?'Stock movements':'Mouvements'],['transfers',locale==='en'?'Transfers':'Transferts'],['counts',locale==='en'?'Stock counts':'Comptages']].map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</div>
        <article className="panel inventory-data-panel">{loading&&!data?<div className="admin-loading">{locale==='en'?'Loading stock data…':'Chargement du stock…'}</div>:tab==='stock'?<><PanelTitle title={locale==='en'?'Current stock by warehouse':'Stock actuel par entrepôt'} action={<span>{data?.stock?.length||0} {locale==='en'?'records':'lignes'}</span>}/><div className="admin-table-wrap"><table className="admin-table inventory-table"><thead><tr>{(locale==='en'?['Item','Code','Warehouse','On hand','Reserved','Available','Value','Status']:['Article','Code','Entrepôt','En stock','Réservé','Disponible','Valeur','État']).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data?.stock?.length?data.stock.map((item:any)=><tr key={item.id}><td><b>{item.item_name}</b><small>{String(item.item_type||'').replaceAll('_',' ')}</small></td><td>{item.sku}</td><td>{item.warehouse_name}</td><td>{quantity(item.quantity_on_hand,item.unit)}</td><td>{quantity(item.quantity_reserved,item.unit)}</td><td>{quantity(item.available_quantity,item.unit)}</td><td>{money(item.stock_value)}</td><td><span className={`admin-status ${item.is_low_stock?'warning':'active'}`}>{item.is_low_stock?(locale==='en'?'Low stock':'Stock faible'):(locale==='en'?'Available':'Disponible')}</span></td></tr>):<tr><td colSpan={8} className="empty-cell">{locale==='en'?'No stock balances have been recorded yet.':'Aucun solde de stock enregistré.'}</td></tr>}</tbody></table></div></>:tab==='movements'||tab==='transfers'||tab==='counts'?<><PanelTitle title={tab==='transfers'?(locale==='en'?'Recent transfers':'Transferts récents'):tab==='counts'?(locale==='en'?'Stock count changes':'Modifications de comptage'):(locale==='en'?'Recent stock movements':'Mouvements récents')} action={<span>{transactions.length} {locale==='en'?'records':'lignes'}</span>}/><div className="admin-table-wrap"><table className="admin-table inventory-table"><thead><tr>{(locale==='en'?['Date','Item','Warehouse','Movement','Quantity','Balance','Cost','Reason']:['Date','Article','Entrepôt','Mouvement','Quantité','Solde','Coût','Motif']).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{transactions.length?transactions.map((item:any)=><tr key={item.id}><td>{new Date(item.occurred_at).toLocaleString()}</td><td><b>{item.item_name}</b><small>{item.sku}</small></td><td>{item.warehouse_name}</td><td>{String(item.type).replaceAll('_',' ')}</td><td>{quantity(item.quantity_delta,item.unit)}</td><td>{quantity(item.balance_after,item.unit)}</td><td>{money(item.unit_cost)}</td><td>{item.reason||'—'}</td></tr>):<tr><td colSpan={8} className="empty-cell">{locale==='en'?'No matching stock movements recorded.':'Aucun mouvement correspondant.'}</td></tr>}</tbody></table></div></>:null}</article>
    </section>
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
        <article className="panel module-main"><PanelTitle title={sections[selected]} action={can('reports.export') ? <button className="text-btn">{locale === 'en' ? 'Export' : 'Exporter'}<ChevronRight size={16}/></button> : <span/>}/><div className="empty-state"><span><Icon size={28}/></span><h3>{locale === 'en' ? `${sections[selected]} workspace is ready` : `L’espace ${sections[selected]} est prêt`}</h3><p>{locale === 'en' ? 'Records created in this module will appear here with role-based actions, filters and audit history.' : 'Les enregistrements apparaîtront ici avec actions par rôle, filtres et historique.'}</p><button className="secondary-btn" onClick={() => setSelected((selected + 1) % sections.length)}>{locale === 'en' ? 'Explore next section' : 'Section suivante'}</button></div></article>
    </section>;
}

function App() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [maintenance,setMaintenance]=useState('');

    useEffect(() => {
        api<{ user: AuthUser }>('/api/auth/me').then(data => setUser(data.user)).catch((reason:any) => {setUser(null);if(reason?.status===503)setMaintenance(reason.message)}).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="boot-screen"><Logo/></div>;
    if (maintenance) return <MaintenanceScreen message={maintenance} onRetry={()=>window.location.reload()} onAdmin={()=>setMaintenance('')}/>;
    if (!user) return <AuthScreen onAuthenticated={setUser} onMaintenance={setMaintenance}/>;

    const logout = async () => {
        // Remove the protected interface immediately, then invalidate the
        // server session and replace browser history with the sign-in page.
        setUser(null);
        try {
            await api('/api/auth/logout', { method: 'POST' });
        } finally {
            try { sessionStorage.clear(); } catch {}
            window.history.replaceState(null, '', '/');
            window.location.replace('/');
        }
    };
    return <Dashboard user={user} onLogout={logout} onMaintenance={setMaintenance}/>;
}

function MaintenanceScreen({message,onRetry,onAdmin}:{message:string;onRetry:()=>void;onAdmin:()=>void}){return <main className="maintenance-screen"><Logo/><h1>Scheduled maintenance</h1><p>{message}</p><div><button className="primary-btn" onClick={onRetry}>Check again</button><button className="secondary-btn" onClick={onAdmin}>Administrator sign in</button></div><small>Platform administrators retain access to manage the system.</small></main>}

function AuthScreen({ onAuthenticated,onMaintenance }: { onAuthenticated: (user: AuthUser) => void;onMaintenance:(message:string)=>void }) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [locale, setLocale] = useState<Locale>('en');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '', factory_name: '', industry_type: 'general_manufacturing', industry_other: '', remember: false });
    const update = (key: string, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));
    const submit = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const data = await api<{ user: AuthUser }>(endpoint, { method: 'POST', body: JSON.stringify({ ...form, industry_type: form.industry_type === 'other' ? form.industry_other : form.industry_type, locale }) });
            onAuthenticated(data.user);
        } catch (reason:any) { if(reason?.status===503)onMaintenance(reason.message);else setError(reason instanceof Error ? reason.message : 'Unable to continue.'); }
        finally { setBusy(false); }
    };
    const words = locale === 'en' ? {
        title: mode === 'login' ? 'Welcome back' : 'Create your factory workspace', subtitle: mode === 'login' ? 'Sign in to manage your operations.' : 'Start your secure ICYEREKEZO OMS workspace.',
        name: 'Full name', factory: 'Factory name', industry: 'Industry type', specifyIndustry: 'Specify the factory industry', email: 'Email address', password: 'Password', confirm: 'Confirm password', remember: 'Keep me signed in',
        namePlaceholder: 'Enter your full name', factoryPlaceholder: 'Enter your factory name', industryPlaceholder: 'Describe your factory type', emailPlaceholder: 'name@company.com', passwordPlaceholder: 'Enter your password', confirmPlaceholder: 'Enter the password again',
        action: mode === 'login' ? 'Sign in securely' : 'Create workspace', switchText: mode === 'login' ? 'New to ICYEREKEZO?' : 'Already have an account?', switchAction: mode === 'login' ? 'Create a workspace' : 'Sign in',
    } : {
        title: mode === 'login' ? 'Bon retour' : 'Creez votre espace usine', subtitle: mode === 'login' ? 'Connectez-vous pour gerer vos operations.' : 'Demarrez votre espace ICYEREKEZO OMS securise.',
        name: 'Nom complet', factory: "Nom de l'usine", industry: "Type d'industrie", specifyIndustry: "Precisez le type d'industrie", email: 'Adresse e-mail', password: 'Mot de passe', confirm: 'Confirmer le mot de passe', remember: 'Rester connecte',
        namePlaceholder: 'Saisissez votre nom complet', factoryPlaceholder: "Saisissez le nom de l'usine", industryPlaceholder: "Decrivez le type d'usine", emailPlaceholder: 'nom@entreprise.com', passwordPlaceholder: 'Saisissez votre mot de passe', confirmPlaceholder: 'Saisissez encore le mot de passe',
        action: mode === 'login' ? 'Se connecter' : "Creer l'espace", switchText: mode === 'login' ? 'Nouveau sur ICYEREKEZO ?' : 'Vous avez deja un compte ?', switchAction: mode === 'login' ? 'Creer un espace' : 'Se connecter',
    };

    return <main className="auth-page">
        <section className="auth-story"><div className="auth-orb auth-orb-one"></div><div className="auth-orb auth-orb-two"></div><Logo/><div className="auth-story-copy"><span className="auth-kicker"><ShieldCheck size={16}/> Secure factory operations</span><h1>Every factory move,<br/><em>clearly connected.</em></h1><p>Run production, stock, quality and delivery from one calm, real-time workspace.</p><div className="auth-points"><span><i><PackageCheck/></i><b>Full traceability<small>Follow every batch</small></b></span><span><i><Activity/></i><b>Live operations<small>See work as it happens</small></b></span><span><i><ShieldCheck/></i><b>Protected data<small>Access by responsibility</small></b></span></div></div><div className="auth-story-foot"><span className="auth-live-dot"></span><p>Operations platform online</p><small>ICYEREKEZO means direction.</small></div></section>
        <section className="auth-form-side"><div className="auth-topbar"><div className="auth-mobile-logo"><Logo/></div><button type="button" className="auth-language" onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}><Languages size={18}/>{locale === 'en' ? 'Francais' : 'English'}</button></div><form className="auth-card" onSubmit={submit}><div className="auth-card-mark"><ShieldCheck size={22}/></div><div className="auth-heading"><span>{mode === 'login' ? (locale === 'en' ? 'WELCOME BACK' : 'BON RETOUR') : (locale === 'en' ? 'GET STARTED' : 'COMMENCER')}</span><h2>{words.title}</h2><p>{words.subtitle}</p></div>{error && <div className="form-error">{error}</div>}
            {mode === 'register' && <><AuthInput icon={<UserRound/>} label={words.name}><input placeholder={words.namePlaceholder} value={form.name} onChange={e => update('name', e.target.value)} required autoComplete="name"/></AuthInput><AuthInput icon={<Building2/>} label={words.factory}><input placeholder={words.factoryPlaceholder} value={form.factory_name} onChange={e => update('factory_name', e.target.value)} required/></AuthInput><label className="auth-field auth-select-field"><span>{words.industry}</span><div><Factory/><select aria-label={words.industry} value={form.industry_type} onChange={e => update('industry_type', e.target.value)}>
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
            </select><ChevronDown/></div></label>{form.industry_type === 'other' && <AuthInput icon={<Factory/>} label={words.specifyIndustry}><input placeholder={words.industryPlaceholder} value={form.industry_other} onChange={e => update('industry_other', e.target.value)} required maxLength={80}/></AuthInput>}</>}
            <AuthInput icon={<Mail/>} label={words.email}><input placeholder={words.emailPlaceholder} type="email" value={form.email} onChange={e => update('email', e.target.value)} required autoComplete="email"/></AuthInput>
            <AuthInput icon={<LockKeyhole/>} label={words.password} action={<button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff/> : <Eye/>}</button>}><input placeholder={words.passwordPlaceholder} type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></AuthInput>
            {mode === 'register' && <AuthInput icon={<LockKeyhole/>} label={words.confirm}><input placeholder={words.confirmPlaceholder} type={showPassword ? 'text' : 'password'} value={form.password_confirmation} onChange={e => update('password_confirmation', e.target.value)} required autoComplete="new-password"/></AuthInput>}
            {mode === 'login' && <label className="check-row"><input type="checkbox" checked={form.remember} onChange={e => update('remember', e.target.checked)}/><span>{words.remember}</span></label>}
            <button className="auth-submit" disabled={busy}><span>{busy ? (locale === 'en' ? 'Signing you in...' : 'Connexion...') : words.action}</span><i><ChevronRight size={18}/></i></button><div className="auth-switch"><span>{words.switchText}</span><button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{words.switchAction}</button></div><p className="auth-assurance"><ShieldCheck/> Your connection is encrypted and protected.</p>
        </form></section>
    </main>;
}

function AuthInput({icon,label,action,children}:{icon:React.ReactNode;label:string;action?:React.ReactNode;children:React.ReactNode}) {
    return <label className="auth-field"><span>{label}</span><div>{icon}{children}{action}</div></label>;
}

function Metric({ icon, label, value, suffix, detail, trend, tone }: { icon: React.ReactNode; label: string; value: string; suffix?: string; detail: string; trend: string; tone: string }) {
    return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><div><strong>{value}</strong>{suffix && <small>{suffix}</small>}</div><p><b className={tone}>{trend}</b>{detail}</p></div></article>;
}
function PanelTitle({ title, action }: { title: string; action: React.ReactNode }) { return <div className="panel-title"><h2>{title}</h2>{action}</div>; }
function ActivityItem({ icon, tone, title, text, time }: { icon: React.ReactNode; tone: string; title: string; text: string; time: string }) { return <div className="activity-item"><span className={`activity-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time></div>; }

createRoot(document.getElementById('app')!).render(<React.StrictMode><GlobalOperationToasts/><App/></React.StrictMode>);
