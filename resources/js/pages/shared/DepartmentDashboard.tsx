import React, { useEffect, useState } from 'react';
import { Activity, Boxes, CheckCircle2, CircleAlert, Clock3, Factory, FileText, ListChecks, PackageCheck, PackageOpen, RefreshCw, Scissors, TrendingDown, Truck, Users, Warehouse, ClipboardCheck } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

async function api(url:string,options:RequestInit={}){const response=await fetch(url,{...options,headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})}});const text=await response.text();let data:any;try{data=JSON.parse(text)}catch{throw new Error('The dashboard could not read the server response.')}if(!response.ok)throw new Error(data.message||'The dashboard could not load current data.');return data}
const number=(value:any)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:3});
const englishStatus:Record<string,string>={draft:'Draft',pending:'Pending',confirmed:'Confirmed',approved:'Approved',processing:'Processing',planned:'Planned',ready:'Ready',dispatched:'Dispatched',in_transit:'In transit',delivered:'Delivered',assigned:'Not started',in_progress:'In progress',blocked:'Blocked',completed:'Completed',cancelled:'Cancelled',not_started:'Waiting'};
const frenchStatus:Record<string,string>={draft:'Brouillon',pending:'En attente',confirmed:'ConfirmÃ©e',approved:'ApprouvÃ©e',processing:'En prÃ©paration',planned:'PlanifiÃ©e',ready:'PrÃªte',dispatched:'ExpÃ©diÃ©e',in_transit:'En livraison',delivered:'LivrÃ©e',assigned:'Pas encore commencÃ©',in_progress:'En cours',blocked:'BloquÃ©',completed:'TerminÃ©',cancelled:'AnnulÃ©',not_started:'En attente'};

export default function DepartmentDashboard({user,locale,onNavigate}:any){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState<number|null>(null),[loading,setLoading]=useState(true),[updated,setUpdated]=useState<Date|null>(null);
 const load=async(silent=false)=>{if(!silent)setLoading(true);try{setData(await api('/api/department/dashboard'));setError('');setUpdated(new Date())}catch(reason:any){setError(reason.message)}finally{if(!silent)setLoading(false)}};
 useEffect(()=>{load();const timer=window.setInterval(()=>load(true),5000);return()=>window.clearInterval(timer)},[]);
 const update=async(id:number,statusValue:string)=>{setBusy(id);setError('');try{await api('/api/team/assignments/'+id,{method:'PATCH',body:JSON.stringify({status:statusValue})});await load()}catch(reason:any){setError(reason.message)}finally{setBusy(null)}};
 const department=data?.department,metrics=data?.metrics||{},warehouseMetrics=data?.warehouse_metrics||{},logisticsMetrics=data?.logistics_metrics||{},logisticsTrends=data?.logistics_trends||[],assignments=data?.assignments||[],stages=data?.stage_activity||[],stock=data?.recent_stock||[],stockStatus=data?.stock_status||[];
 const fr=locale==='fr',production=user.workspace==='production',warehouse=data?.dashboard_type==='warehouse',logistics=data?.dashboard_type==='logistics';
 const currency=user.current_factory?.currency_code||user.system?.currency_code||'RWF',money=(value:any,currencyCode=currency)=>`${currencyCode} ${Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
 const status=(value:string)=>(fr?frenchStatus:englishStatus)[value]||String(value||'').replaceAll('_',' ');
 const isNoguchiFactory = user?.current_factory?.name?.trim().toLowerCase()==='noguchi holdings ltd';
 const isNoguchiSewing = isNoguchiFactory && user?.workspace === 'sewing';
 const isFinishingManager = isNoguchiFactory && (user?.workspace === 'finishing' || user?.roles?.some((r:any) => r.slug === 'finishing-manager'));
 const isPackingManager = isNoguchiFactory && (user?.workspace === 'packing' || user?.workspace === 'packaging' || user?.roles?.some((r:any) => r.slug === 'packing-manager' || r.slug === 'packaging-manager' || r.slug === 'packaging-operator'));
 const isQualityManager = data?.is_quality_user || false;

 const title = logistics ? (fr ? 'Tableau de bord logistique' : 'Logistics dashboard')
     : warehouse ? (fr ? 'Tableau de bord du stock' : 'Warehouse dashboard')
     : isQualityManager ? (fr ? 'Tableau de bord Qualité' : 'Quality Control dashboard')
     : production ? (fr ? 'Vue de la production' : 'Production overview')
     : `${department?.name || user.workspace.replaceAll('_', ' ')} dashboard`;
 const description = logistics ? (fr ? `Bonjour ${user.name}. Suivez les commandes clients, les expéditions et les livraisons.` : `Hello ${user.name}. Track incoming customer orders, dispatches and deliveries.`)
     : warehouse ? (fr ? `Bonjour ${user.name}. Voici l'état actuel du stock et les travaux à traiter.` : `Hello ${user.name}. Here is the current stock position and work that needs attention.`)
     : isQualityManager ? (fr ? `Bonjour ${user.name}. Voici les inspections en attente et les derniers résultats de contrôle.` : `Hello ${user.name}. Here are the pending inspections and latest quality results.`)
     : (fr ? `Bonjour ${user.name}. Voici les travaux importants et les résultats actuels.` : `Hello ${user.name}. Here is the work that needs attention and the latest production results.`);

 // These roles get their own dedicated panels below (metrics/charts/quick-actions);
 // everyone else falls through to the generic production quick-actions + team-work view.
 const hasDedicatedPanels = logistics || isNoguchiSewing || isFinishingManager || isPackingManager || isQualityManager;

 return (
  <section className={`department-dashboard ${user.workspace === 'cutting' ? 'cutting-dashboard' : ''}`}>
   <div className="page-heading">
    <div><h1>{title}</h1><p>{description}</p></div>
    <button className="secondary-btn" disabled={loading} onClick={() => load()}>
     <RefreshCw className={loading ? 'spin' : ''} size={16} />{loading ? (fr ? 'Actualisation…' : 'Refreshing…') : (fr ? 'Actualiser' : 'Refresh')}
    </button>
   </div>
   {error && <div className="admin-alert error">{error}</div>}

   {logistics ? <LogisticsMetrics values={logisticsMetrics} fr={fr} />
    : warehouse ? <WarehouseMetrics values={warehouseMetrics} fr={fr} money={money} />
    : isPackingManager ? <PackingMetrics values={data?.packing_metrics || {}} fr={fr} />
    : isFinishingManager ? <FinishingMetrics values={data?.finishing_metrics || {}} fr={fr} />
    : isQualityManager ? <QualityMetrics values={data?.quality_metrics || {}} fr={fr} />
    : <ProductionMetrics values={metrics} fr={fr} user={user} />}

   {logistics && <LogisticsCharts trends={logisticsTrends} fr={fr} money={money} />}
   {(isNoguchiSewing || (!hasDedicatedPanels && !warehouse)) && <ProductionCharts trends={data?.production_trends || []} fr={fr} />}
   {warehouse && <WarehouseStockChart trends={data?.stock_trends || []} fr={fr} number={number} />}

   {!hasDedicatedPanels && !warehouse && (
    <div className="production-quick-actions">
     <button onClick={() => onNavigate('production')}><Factory /><span><b>{fr ? 'Gérer la production' : 'Manage production'}</b><small>{fr ? 'Créer des commandes et suivre chaque étape' : 'Create orders and update production steps'}</small></span></button>
     <button onClick={() => onNavigate('reports')}><FileText /><span><b>{fr ? 'Voir les rapports' : 'View reports'}</b><small>{fr ? 'Comparer les résultats par étape' : 'Review results for every production step'}</small></span></button>
    </div>
   )}

   {isQualityManager && (
    <div className="production-quick-actions">
     <button onClick={() => onNavigate('quality')}><ClipboardCheck /><span><b>{fr ? 'Démarrer l\'inspection' : 'Start inspection'}</b><small>{fr ? 'Inspecter les matériaux et la production' : 'Inspect materials and production'}</small></span></button>
     <button onClick={() => onNavigate('reports')}><FileText /><span><b>{fr ? 'Voir les rapports de qualité' : 'View quality reports'}</b><small>{fr ? 'Consulter les journaux d\'inspection' : 'Review recorded inspection logs'}</small></span></button>
    </div>
   )}

   {!hasDedicatedPanels && (
    <OperationalPanels warehouse={warehouse} assignments={assignments} stock={stock} stockStatus={stockStatus} stages={stages} data={data} user={user} fr={fr} status={status} number={number} busy={busy} update={update} />
   )}
   {isFinishingManager && data?.finishing_progress && <FinishingCharts data={data.finishing_progress} fr={fr} number={number} />}
   {isPackingManager && data?.packing_progress && <PackingCharts data={data.packing_progress} fr={fr} number={number} />}
   {isQualityManager && data?.quality_progress && <QualityCharts data={data.quality_progress} fr={fr} number={number} />}
   {isQualityManager && <QualityRecentInspections inspections={data?.recent_inspections || []} fr={fr} status={status} number={number} />}
  </section>
 );
}

function LogisticsMetrics({values,fr}:any){return <section className="department-metrics"><Metric icon={<PackageOpen/>} label={fr?'Commandes entrantes':'Incoming orders'} value={number(values.incoming_orders)} tone="blue"/><Metric icon={<PackageCheck/>} label={fr?'PrÃªtes Ã  expÃ©dier':'Ready to dispatch'} value={number(values.ready_to_dispatch)} tone="violet"/><Metric icon={<Truck/>} label={fr?'En cours de livraison':'In transit'} value={number(values.in_transit)} tone="amber"/><Metric icon={<CheckCircle2/>} label={fr?'LivrÃ©es aujourdâ€™hui':'Delivered today'} value={number(values.delivered_today)} tone="green"/><Metric icon={<CircleAlert/>} label={fr?'Livraisons en retard':'Delayed deliveries'} value={number(values.delayed)} tone="red"/><Metric icon={<Truck/>} label={fr?'VÃ©hicules disponibles':'Available vehicles'} value={number(values.available_vehicles)} tone="blue"/></section>}
function LogisticsCharts({trends,fr,money}:any){
 const monthNames=fr?['Jan','FÃ©v','Mar','Avr','Mai','Juin','Juil','AoÃ»','Sep','Oct','Nov','DÃ©c']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const chartData=trends.map((item:any)=>({...item,month:monthNames[Number(item.month_number)-1]||item.month}));
 const tooltipStyle={background:'var(--panel)',border:'1px solid var(--line)',borderRadius:10,boxShadow:'0 12px 30px rgba(15,23,42,.12)',color:'var(--text)'};
 return <section className="department-grid logistics-charts">
  <article className="panel chart-panel"><header className="department-panel-head"><div><h2>{fr?'Croissance des commandes':'Monthly order growth'}</h2><p>{fr?'Commandes clients reÃ§ues au cours des six derniers mois':'Customer orders received over the last six months'}</p></div><PackageOpen size={20}/></header><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}><defs><linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={.32}/><stop offset="100%" stopColor="#2563eb" stopOpacity={.03}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value:any,name:any)=>[name==='order_value'?money(value):number(value),name==='order_value'?(fr?'Valeur des commandes':'Order value'):(fr?'Commandes':'Orders')]}/><Area type="monotone" dataKey="orders" name={fr?'Commandes':'Orders'} stroke="#2563eb" fill="url(#ordersFill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>
  <article className="panel chart-panel"><header className="department-panel-head"><div><h2>{fr?'Performance des livraisons':'Delivery performance'}</h2><p>{fr?'ExpÃ©ditions envoyÃ©es et livraisons terminÃ©es par mois':'Shipments dispatched and completed each month'}</p></div><Truck size={20}/></header><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="dispatched" name={fr?'ExpÃ©diÃ©es':'Dispatched'} fill="#8b5cf6" radius={[5,5,0,0]}/><Bar dataKey="delivered" name={fr?'LivrÃ©es':'Delivered'} fill="#10b981" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>
 </section>
}

function ProductionCharts({trends,fr}:any){
 const monthNames=fr?['Jan','FÃ©v','Mar','Avr','Mai','Juin','Juil','AoÃ»','Sep','Oct','Nov','DÃ©c']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const chartData=trends.map((item:any)=>({...item,month:monthNames[Number(item.month_number)-1]||item.month}));
 const tooltipStyle={background:'var(--panel)',border:'1px solid var(--line)',borderRadius:10,boxShadow:'0 12px 30px rgba(15,23,42,.12)',color:'var(--text)'};
 return <section className="department-grid logistics-charts">
  <article className="panel chart-panel"><header className="department-panel-head"><div><h2>{fr?'Production mensuelle':'Monthly production'}</h2><p>{fr?'UnitÃ©s produites au cours des six derniers mois':'Units produced over the last six months'}</p></div><Factory size={20}/></header><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}><defs><linearGradient id="outputFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={.32}/><stop offset="100%" stopColor="#10b981" stopOpacity={.03}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value:any)=>[number(value),fr?'Produit':'Produced']}/><Area type="monotone" dataKey="output" name={fr?'Produit':'Produced'} stroke="#10b981" fill="url(#outputFill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>
  <article className="panel chart-panel"><header className="department-panel-head"><div><h2>{fr?'Taux de rejet':'Rejection rate'}</h2><p>{fr?'PiÃ¨ces endommagÃ©es ou rejetÃ©es par mois':'Damaged or rejected pieces each month'}</p></div><Activity size={20}/></header><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="rejected" name={fr?'EndommagÃ©':'Damaged'} fill="#ef4444" radius={[5,5,0,0]}/><Bar dataKey="waste" name={fr?'DÃ©chets':'Waste'} fill="#f59e0b" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>
 </section>
}
function WarehouseMetrics({values,fr,money}:any){return <section className="department-metrics"><Metric icon={<PackageCheck/>} label={fr?'Articles en stock':'Stock items'} value={number(values.stock_items)} tone="blue"/><Metric icon={<TrendingDown/>} label={fr?'Articles en stock faible':'Low-stock items'} value={number(values.low_stock)} tone="red"/><Metric icon={<Warehouse/>} label={fr?'EntrepÃ´ts actifs':'Active warehouses'} value={number(values.warehouses)} tone="violet"/><Metric icon={<Activity/>} label={fr?'Valeur du stock':'Stock value'} value={money(values.stock_value)} tone="green"/><Metric icon={<CheckCircle2/>} label={fr?'QuantitÃ© reÃ§ue aujourdâ€™hui':'Quantity received today'} value={number(values.received_today)} tone="blue"/><Metric icon={<TrendingDown/>} label={fr?'QuantitÃ© sortie aujourdâ€™hui':'Quantity issued today'} value={number(values.issued_today)} tone="amber"/></section>}
function ProductionMetrics({values,fr,user}:any){
    const isNoguchiFactory = user?.current_factory?.name?.trim().toLowerCase()==='noguchi holdings ltd';
    if (isNoguchiFactory && user?.workspace === 'sewing') {
        return <section className="department-metrics cols-4">
            <Metric icon={<Scissors/>} label={fr?'Articles coupÃ©s non cousus':'Items from cutting not used in sewing'} value={number(values.cutting_not_sewn)} tone="blue"/>
            <Metric icon={<PackageCheck/>} label={fr?'UnitÃ©s produites':'Produced'} value={number(values.output_today)} tone="green"/>
            <Metric icon={<Activity/>} label={fr?'EndommagÃ© (RejetÃ©)':'Damaged'} value={number(values.rejected_today)} tone="red"/>
            <Metric icon={<Clock3/>} label={fr?'Travaux en cours':'Work in progress'} value={number(values.work_in_progress)} tone="amber"/>
        </section>;
    }
    return <section className="department-metrics"><Metric icon={<ListChecks/>} label={fr?'Travaux Ã  commencer':'Work to start'} value={number(values.assigned_work)} tone="blue"/><Metric icon={<Clock3/>} label={fr?'Travaux en cours':'Work in progress'} value={number(values.work_in_progress)} tone="amber"/><Metric icon={<CheckCircle2/>} label={fr?'TerminÃ© aujourdâ€™hui':'Completed today'} value={number(values.completed_today)} tone="green"/><Metric icon={<Factory/>} label={fr?'Ã‰tapes de production actives':'Active production steps'} value={number(values.stages_in_progress)} tone="violet"/><Metric icon={<PackageCheck/>} label={fr?'UnitÃ©s produites aujourdâ€™hui':'Units produced today'} value={number(values.output_today)} tone="blue"/><Metric icon={<Activity/>} label={fr?'UnitÃ©s rejetÃ©es aujourdâ€™hui':'Units rejected today'} value={number(values.rejected_today)} tone="red"/></section>
}

function WarehouseStockChart({ trends, fr, number }: any) {
    const tooltipStyle = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,23,42,.12)', color: 'var(--text)' };
    return (
        <section className="department-grid logistics-charts">
            <article className="panel chart-panel" style={{ gridColumn: '1 / -1' }}>
                <header className="department-panel-head">
                    <div>
                        <h2>{fr ? 'Mouvements de stock (7 jours)' : 'Stock movement (7 days)'}</h2>
                        <p>{fr ? 'Quantités reçues et sorties chaque jour' : 'Quantity received and issued each day'}</p>
                    </div>
                    <Activity size={20} />
                </header>
                <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends} margin={{ top: 12, right: 18, left: -18, bottom: 2 }}>
                            <CartesianGrid vertical={false} stroke="var(--line)" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [number(value), '']} />
                            <Bar dataKey="received" name={fr ? 'Reçu' : 'Received'} fill="#10b981" radius={[5, 5, 0, 0]} />
                            <Bar dataKey="issued" name={fr ? 'Sorti' : 'Issued'} fill="#ef4444" radius={[5, 5, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </article>
        </section>
    );
}

function OperationalPanels({ warehouse, assignments, stock, stockStatus, stages, data, user, fr, status, number, busy, update }: any) {
    if (warehouse) {
        return (
            <section className="department-grid">
                <StockStatusPanel items={stockStatus} fr={fr} number={number} />
            </section>
        );
    }
    return (
        <section className="department-grid">
            <article className="panel">
                <header className="department-panel-head">
                    <div>
                        <h2>{fr ? "Travaux de l'équipe" : 'Team work'}</h2>
                        <p>{data?.is_department_manager ? (fr ? 'Travail de toute votre équipe' : 'Work for everyone in your department') : (fr ? 'Travail qui vous est attribué' : 'Work assigned directly to you')}</p>
                    </div>
                    <Users size={20} />
                </header>
                <div className="assignment-list">
                    {assignments.length ? assignments.map((item: any) => (
                        <article key={item.id}>
                            <div>
                                <span className={'priority ' + item.priority}>{item.priority}</span>
                                <h3>{item.title}</h3>
                                <p>{item.instructions || (fr ? 'Aucune instruction supplémentaire.' : 'No extra instructions.')}</p>
                                <small>{item.user?.name || user.name}{item.due_at ? ` · ${fr ? 'À terminer avant' : 'Due'} ${new Date(item.due_at).toLocaleString()}` : ''}</small>
                            </div>
                            <div className="assignment-actions">
                                <label>
                                    {fr ? 'État du travail' : 'Work status'}
                                    <select aria-label={`Status for ${item.title}`} disabled={busy === item.id} value={item.status} onChange={(event) => update(item.id, event.target.value)}>
                                        <option value="assigned">{status('assigned')}</option>
                                        <option value="ready">{status('ready')}</option>
                                        <option value="in_progress">{status('in_progress')}</option>
                                        <option value="blocked">{status('blocked')}</option>
                                        <option value="completed">{status('completed')}</option>
                                    </select>
                                </label>
                            </div>
                        </article>
                    )) : <Empty text={fr ? 'Aucun travail attribué pour le moment.' : 'No work needs attention right now.'} />}
                </div>
            </article>
            <article className="panel">
                <header className="department-panel-head">
                    <div>
                        <h2>{fr ? 'Dernières étapes de production' : 'Latest production steps'}</h2>
                        <p>{fr ? 'Quantités enregistrées pour votre département' : 'Recent quantities recorded by your department'}</p>
                    </div>
                    <Activity size={20} />
                </header>
                <div className="stage-activity-list">
                    {stages.length ? stages.map((item: any) => (
                        <article key={item.id}>
                            <div>
                                <b>{item.stage?.name || 'Production step'}</b>
                                <span>{item.order?.order_number || 'Order'} · {status(item.status)}</span>
                            </div>
                            <div>
                                <strong>{number(item.output_quantity)}</strong>
                                <small>{fr ? 'unités produites' : 'units produced'}</small>
                            </div>
                        </article>
                    )) : <Empty text={fr ? 'Aucune production enregistrée pour le moment.' : 'No production has been recorded yet.'} />}
                </div>
            </article>
        </section>
    );
}

function StockStatusPanel({ items, fr, number }: any) {
    const list = items || [];
    return (
        <article className="panel" style={{ gridColumn: '1 / -1' }}>
            <header className="department-panel-head">
                <div>
                    <h2>{fr ? 'État du stock' : 'Stock status'}</h2>
                    <p>{fr ? "Quantité actuelle par article, triée pour montrer d'abord les stocks faibles" : 'Current quantity by item, with low-stock items surfaced first'}</p>
                </div>
                <Boxes size={20} />
            </header>
            <div className="stage-activity-list">
                {list.length ? list.map((item: any) => {
                    const low = Number(item.reorder_level) > 0 && Number(item.quantity_on_hand) <= Number(item.reorder_level);
                    return (
                        <article key={item.id}>
                            <div>
                                <b>{item.name}</b>
                                <span>{item.sku}{low && <em className="admin-status warning" style={{ marginLeft: 8 }}>{fr ? 'Stock faible' : 'Low stock'}</em>}</span>
                            </div>
                            <div>
                                <strong>{number(item.quantity_on_hand)}</strong>
                                <small>{item.unit || (fr ? 'unités' : 'units')}{Number(item.reorder_level) > 0 ? ` · ${fr ? 'seuil' : 'reorder at'} ${number(item.reorder_level)}` : ''}</small>
                            </div>
                        </article>
                    );
                }) : <Empty text={fr ? 'Aucun article en stock pour le moment.' : 'No stock items yet.'} />}
            </div>
        </article>
    );
}
function Metric({icon,label,value,tone}:any){return <article className="department-metric panel"><span className={'metric-icon '+tone}>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>}
function Empty({text}:{text:string}){return <div className="department-empty"><PackageCheck size={26}/><span>{text}</span></div>}
function FinishingCharts({data, fr, number}:any){
 const [filter, setFilter] = useState<'weekly'|'monthly'|'annually'>('weekly');
 const tooltipStyle={background:'var(--panel)',border:'1px solid var(--line)',borderRadius:10,boxShadow:'0 12px 30px rgba(15,23,42,.12)',color:'var(--text)'};
 
 const dataList = data && typeof data === 'object' && data[filter] ? data[filter] : [];
 const chartData = Array.isArray(dataList) ? dataList.slice().reverse() : [];

 return <section className="department-grid">
  <article className="panel chart-panel" style={{gridColumn: '1 / -1'}}>
   <header className="department-panel-head" style={{alignItems: 'flex-start'}}>
    <div><h2>{fr?'Progression de la finition':'Finishing Working Progress'}</h2><p>{fr?'QuantitÃ© de finition par pÃ©riode':'Finishing output quantity per period'}</p></div>
    <div style={{display:'flex',gap:10,background:'var(--background)',padding:4,borderRadius:8}}>
     <button className={filter==='weekly'?'primary-btn':'secondary-btn'} style={{margin:0,padding:'4px 12px',minHeight:30}} onClick={()=>setFilter('weekly')}>{fr?'Hebdomadaire':'Weekly'}</button>
     <button className={filter==='monthly'?'primary-btn':'secondary-btn'} style={{margin:0,padding:'4px 12px',minHeight:30}} onClick={()=>setFilter('monthly')}>{fr?'Mensuel':'Monthly'}</button>
     <button className={filter==='annually'?'primary-btn':'secondary-btn'} style={{margin:0,padding:'4px 12px',minHeight:30}} onClick={()=>setFilter('annually')}>{fr?'Annuel':'Annually'}</button>
    </div>
   </header>
   <div className="chart-wrap" style={{height: 300, marginTop: 15}}>
    <ResponsiveContainer width="100%" height="100%">
     <BarChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}>
      <CartesianGrid vertical={false} stroke="var(--line)"/>
      <XAxis dataKey="period" tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value:any)=>[number(value), fr?'Produit':'Output']}/>
      <Bar dataKey="output" name={fr?'Sortie':'Output'} fill="#8b5cf6" radius={[4,4,0,0]} barSize={filter==='monthly'?15:40}/>
     </BarChart>
    </ResponsiveContainer>
   </div>
  </article>
 </section>
}

function FinishingMetrics({values,fr}:any){
    const number=(value:any)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:3});
    return <section className="department-metrics">
        <Metric icon={<ListChecks/>} label={fr?"Pièces en attente":"Pending from Sewing"} value={number(values.pending_finishing)} tone="amber"/>
        <Metric icon={<PackageCheck/>} label={fr?"Finition aujourd'hui":"Finished today"} value={number(values.finished_today)} tone="blue"/>
        <Metric icon={<Activity/>} label={fr?"Rejeté aujourd'hui":"Rejected today"} value={number(values.rejected_today)} tone="red"/>
    </section>;
}

function PackingMetrics({values,fr}:any){
    const number=(value:any)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:3});
    return <section className="department-metrics">
        <Metric icon={<PackageOpen/>} label={fr?"Pièces en attente":"Pending Sewing/Finishing"} value={number(values.pending_packing)} tone="amber"/>
        <Metric icon={<PackageCheck/>} label={fr?"Emballé aujourd'hui":"Packed today"} value={number(values.packed_today)} tone="blue"/>
        <Metric icon={<Warehouse/>} label={fr?"Déposé à l'entrepôt":"Deposited to warehouse"} value={number(values.deposited_to_warehouse)} tone="green"/>
    </section>;
}

function QualityCharts({data, fr, number}:any){
 const [filter, setFilter] = useState<"weekly"|"monthly"|"annually">("weekly");
 const tooltipStyle={background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 12px 30px rgba(15,23,42,.12)",color:"var(--text)"};
 
 const dataList = data && typeof data === "object" && data[filter] ? data[filter] : [];
 const chartData = Array.isArray(dataList) ? dataList.slice().reverse() : [];

 return <section className="department-grid">
  <article className="panel chart-panel" style={{gridColumn: "1 / -1"}}>
   <header className="department-panel-head" style={{alignItems: "flex-start"}}>
    <div><h2>{fr?"Rapports d'inspection":"Inspection Reports"}</h2><p>{fr?"Résultats de qualité par période":"Quality results per period"}</p></div>
    <div style={{display:"flex",gap:10,background:"var(--background)",padding:4,borderRadius:8}}>
     <button className={filter==="weekly"?"primary-btn":"secondary-btn"} style={{margin:0,padding:"4px 12px",minHeight:30}} onClick={()=>setFilter("weekly")}>{fr?"Hebdomadaire":"Weekly"}</button>
     <button className={filter==="monthly"?"primary-btn":"secondary-btn"} style={{margin:0,padding:"4px 12px",minHeight:30}} onClick={()=>setFilter("monthly")}>{fr?"Mensuel":"Monthly"}</button>
     <button className={filter==="annually"?"primary-btn":"secondary-btn"} style={{margin:0,padding:"4px 12px",minHeight:30}} onClick={()=>setFilter("annually")}>{fr?"Annuel":"Annually"}</button>
    </div>
   </header>
   <div className="chart-wrap" style={{height: 300, marginTop: 15}}>
    <ResponsiveContainer width="100%" height="100%">
     <BarChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}>
      <CartesianGrid vertical={false} stroke="var(--line)"/>
      <XAxis dataKey="period" tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={tooltipStyle} />
      <Bar dataKey="passed" name={fr?"Réussi":"Passed"} fill="#10b981" radius={[4,4,0,0]} barSize={filter==='monthly'?15:40}/>
      <Bar dataKey="failed" name={fr?"Échoué":"Failed"} fill="#ef4444" radius={[4,4,0,0]} barSize={filter==='monthly'?15:40}/>
     </BarChart>
    </ResponsiveContainer>
   </div>
  </article>
 </section>
}

function PackingCharts({data, fr, number}:any){
 const [filter, setFilter] = useState<"weekly"|"monthly"|"annually">("weekly");
 const tooltipStyle={background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 12px 30px rgba(15,23,42,.12)",color:"var(--text)"};
 
 const dataList = data && typeof data === "object" && data[filter] ? data[filter] : [];
 const chartData = Array.isArray(dataList) ? dataList.slice().reverse() : [];

 return <section className="department-grid">
  <article className="panel chart-panel" style={{gridColumn: "1 / -1"}}>
   <header className="department-panel-head" style={{alignItems: "flex-start"}}>
    <div><h2>{fr?"Progression de l'emballage":"Packing Workflow Progress"}</h2><p>{fr?"Quantité emballée par période":"Packed output quantity per period"}</p></div>
    <div style={{display:"flex",gap:10,background:"var(--background)",padding:4,borderRadius:8}}>
     <button className={filter==="weekly"?"primary-btn":"secondary-btn"} style={{margin:0,padding:"4px 12px",minHeight:30}} onClick={()=>setFilter("weekly")}>{fr?"Hebdomadaire":"Weekly"}</button>
     <button className={filter==="monthly"?"primary-btn":"secondary-btn"} style={{margin:0,padding:"4px 12px",minHeight:30}} onClick={()=>setFilter("monthly")}>{fr?"Mensuel":"Monthly"}</button>
     <button className={filter==="annually"?"primary-btn":"secondary-btn"} style={{margin:0,padding:"4px 12px",minHeight:30}} onClick={()=>setFilter("annually")}>{fr?"Annuel":"Annually"}</button>
    </div>
   </header>
   <div className="chart-wrap" style={{height: 300, marginTop: 15}}>
    <ResponsiveContainer width="100%" height="100%">
     <AreaChart data={chartData} margin={{top:12,right:18,left:-18,bottom:2}}>
      <defs>
       <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
       </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="var(--line)"/>
      <XAxis dataKey="period" tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value:any)=>[number(value), fr?"Emballé":"Packed"]}/>
      <Area type="monotone" dataKey="output" name={fr?"Emballé":"Packed"} stroke="#10b981" fillOpacity={1} fill="url(#colorOutput)" strokeWidth={2}/>
     </AreaChart>
    </ResponsiveContainer>
   </div>
  </article>
 </section>
}

function QualityMetrics({values,fr}:any){
    const number=(value:any)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:3});
    return <section className="department-metrics quality-metrics">
        <Metric icon={<ClipboardCheck/>} label={fr?"Inspections en attente":"Pending inspections"} value={number(values.pending_inspections)} tone="amber"/>
        <Metric icon={<CheckCircle2/>} label={fr?"Articles inspectés aujourd'hui":"Items inspected today"} value={number(values.inspections_today)} tone="blue"/>
        <Metric icon={<CircleAlert/>} label={fr?"Articles rejetés aujourd'hui":"Items failed today"} value={number(values.failed_today)} tone="red"/>
        <Metric icon={<PackageCheck/>} label={fr?"Taux de réussite (Mois)":"Pass rate (Month)"} value={`${values.pass_rate}%`} tone="green"/>
    </section>;
}

function QualityRecentInspections({inspections, fr, status}:any){
    return <section className="department-grid">
        <article className="panel" style={{gridColumn: '1 / -1'}}>
            <header className="department-panel-head">
                <div><h2>{fr?"Inspections récentes":"Recent inspections"}</h2><p>{fr?"Dernières inspections de contrôle qualité effectuées":"Latest quality control inspections performed"}</p></div>
                <ClipboardCheck size={20}/>
            </header>
            <div className="stage-activity-list">
                {inspections.length ? inspections.map((item:any)=><article key={item.id}>
                    <div><b>{item.inspection_number}</b><span>{item.order?.order_number||'No order'} · {item.item?.name||'General inspection'} · {new Date(item.inspected_at).toLocaleString()}</span></div>
                    <div>
                        <strong style={{color: item.result==='passed'?'#10b981':item.result==='failed'?'#ef4444':item.result==='pending'?'#f59e0b':'inherit'}}>{status(item.result)}</strong>
                        <small>{item.inspector?.name||'System'}</small>
                    </div>
                </article>) : <Empty text={fr?"Aucune inspection récente.":"No recent inspections recorded."}/>}
            </div>
        </article>
    </section>;
}
