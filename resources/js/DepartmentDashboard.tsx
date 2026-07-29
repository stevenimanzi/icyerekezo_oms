import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Factory, FileText, ListChecks, PackageCheck, RefreshCw, Users } from 'lucide-react';

async function api(url:string,options:RequestInit={}) {
    const response=await fetch(url,{...options,headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})}});
    const text=await response.text();let data:any;
    try{data=JSON.parse(text)}catch{throw new Error('The dashboard could not read the server response.')}
    if(!response.ok)throw new Error(data.message||'The dashboard could not load production data.');
    return data;
}
const number=(value:any)=>Number(value||0).toLocaleString();
const englishStatus:Record<string,string>={assigned:'Not started',ready:'Ready to start',in_progress:'In progress',blocked:'Blocked',completed:'Completed',cancelled:'Cancelled',not_started:'Waiting'};
const frenchStatus:Record<string,string>={assigned:'Pas encore commencé',ready:'Prêt à commencer',in_progress:'En cours',blocked:'Bloqué',completed:'Terminé',cancelled:'Annulé',not_started:'En attente'};

export default function DepartmentDashboard({user,locale,onNavigate}:any){
    const [data,setData]=useState<any>(null);const [error,setError]=useState('');const [busy,setBusy]=useState<number|null>(null);const [loading,setLoading]=useState(true);const [updated,setUpdated]=useState<Date|null>(null);
    const load=async()=>{setLoading(true);try{setData(await api('/api/department/dashboard'));setError('');setUpdated(new Date())}catch(reason:any){setError(reason.message)}finally{setLoading(false)}};
    useEffect(()=>{load();const timer=window.setInterval(()=>load(),5000);return()=>window.clearInterval(timer)},[]);
    const update=async(id:number,status:string)=>{setBusy(id);setError('');try{await api('/api/team/assignments/'+id,{method:'PATCH',body:JSON.stringify({status})});await load()}catch(reason:any){setError(reason.message)}finally{setBusy(null)}};
    const department=data?.department;const metrics=data?.metrics||{};const assignments=data?.assignments||[];const stages=data?.stage_activity||[];const fr=locale==='fr';const production=user.workspace==='production';
    const status=(value:string)=>(fr?frenchStatus:englishStatus)[value]||value.replaceAll('_',' ');
    return <section className="department-dashboard">
        <div className="page-heading"><div><div className="eyebrow"><span></span>{fr?'DONNÉES DE PRODUCTION EN DIRECT':'LIVE PRODUCTION DATA'}</div><h1>{production?(fr?'Vue de la production':'Production overview'):`${department?.name||user.workspace.replaceAll('_',' ')} dashboard`}</h1><p>{fr?`Bonjour ${user.name}. Voici les travaux importants et les résultats actuels.`:`Hello ${user.name}. Here is the work that needs attention and the latest production results.`}</p></div><button className="secondary-btn" disabled={loading} onClick={load}><RefreshCw className={loading?'spin':''} size={16}/>{loading?(fr?'Actualisation…':'Refreshing…'):(fr?'Actualiser':'Refresh')}</button></div>
        {error&&<div className="admin-alert error">{error}</div>}
        <section className="workspace-banner"><div><span>{fr?'VOTRE ÉQUIPE':'YOUR TEAM'}</span><strong>{department?.name||(fr?'Aucun département attribué':'No department assigned')}</strong><small>{department?.code||user.workspace.toUpperCase()} · {data?.is_department_manager?(fr?'Responsable du département':'Department manager'):(data?.profile?.job_title||user.roles?.[0]?.name||'Employee')}</small></div><div className="department-live"><i></i>{updated?(fr?'Mis à jour à ':'Updated at ')+updated.toLocaleTimeString():(fr?'Connexion…':'Connecting…')}</div></section>
        <section className="department-metrics">
            <Metric icon={<ListChecks/>} label={fr?'Travaux à commencer':'Work to start'} value={number(metrics.assigned_work)} tone="blue"/>
            <Metric icon={<Clock3/>} label={fr?'Travaux en cours':'Work in progress'} value={number(metrics.work_in_progress)} tone="amber"/>
            <Metric icon={<CheckCircle2/>} label={fr?'Terminé aujourd’hui':'Completed today'} value={number(metrics.completed_today)} tone="green"/>
            <Metric icon={<Factory/>} label={fr?'Étapes de production actives':'Active production steps'} value={number(metrics.stages_in_progress)} tone="violet"/>
            <Metric icon={<PackageCheck/>} label={fr?'Unités produites aujourd’hui':'Units produced today'} value={number(metrics.output_today)} tone="blue"/>
            <Metric icon={<Activity/>} label={fr?'Unités rejetées aujourd’hui':'Units rejected today'} value={number(metrics.rejected_today)} tone="red"/>
        </section>
        <div className="production-quick-actions"><button onClick={()=>onNavigate('production')}><Factory/><span><b>{fr?'Gérer la production':'Manage production'}</b><small>{fr?'Créer des commandes et suivre chaque étape':'Create orders and update production steps'}</small></span></button><button onClick={()=>onNavigate('reports')}><FileText/><span><b>{fr?'Voir les rapports':'View reports'}</b><small>{fr?'Comparer les résultats par étape':'Review results for every production step'}</small></span></button></div>
        <section className="department-grid">
            <article className="panel"><header className="department-panel-head"><div><h2>{fr?'Travaux de l’équipe':'Team work'}</h2><p>{data?.is_department_manager?(fr?'Travail de toute votre équipe':'Work for everyone in your department'):(fr?'Travail qui vous est attribué':'Work assigned directly to you')}</p></div><Users size={20}/></header><div className="assignment-list">{assignments.length?assignments.map((item:any)=><article key={item.id}><div><span className={'priority '+item.priority}>{item.priority}</span><h3>{item.title}</h3><p>{item.instructions||(fr?'Aucune instruction supplémentaire.':'No extra instructions.')}</p><small>{item.user?.name||user.name}{item.due_at?` · ${fr?'À terminer avant':'Due'} ${new Date(item.due_at).toLocaleString()}`:''}</small></div><div className="assignment-actions"><label>{fr?'État du travail':'Work status'}<select aria-label={`Status for ${item.title}`} disabled={busy===item.id} value={item.status} onChange={event=>update(item.id,event.target.value)}><option value="assigned">{status('assigned')}</option><option value="ready">{status('ready')}</option><option value="in_progress">{status('in_progress')}</option><option value="blocked">{status('blocked')}</option><option value="completed">{status('completed')}</option></select></label></div></article>):<Empty text={fr?'Aucun travail attribué pour le moment.':'No work needs attention right now.'}/>}</div></article>
            <article className="panel"><header className="department-panel-head"><div><h2>{fr?'Dernières étapes de production':'Latest production steps'}</h2><p>{fr?'Quantités enregistrées pour votre département':'Recent quantities recorded by your department'}</p></div><Activity size={20}/></header><div className="stage-activity-list">{stages.length?stages.map((item:any)=><article key={item.id}><div><b>{item.stage?.name||'Production step'}</b><span>{item.order?.order_number||'Order'} · {status(item.status)}</span></div><div><strong>{number(item.output_quantity)}</strong><small>{fr?'unités produites':'units produced'}</small></div></article>):<Empty text={fr?'Aucune production enregistrée pour le moment.':'No production has been recorded yet.'}/>}</div></article>
        </section>
    </section>
}
function Metric({icon,label,value,tone}:any){return <article className="department-metric panel"><span className={'metric-icon '+tone}>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>}
function Empty({text}:{text:string}){return <div className="department-empty"><PackageCheck size={26}/><span>{text}</span></div>}
