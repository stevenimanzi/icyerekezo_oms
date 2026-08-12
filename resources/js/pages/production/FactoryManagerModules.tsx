import React, { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, Edit3, Factory, FileText, Plus, Printer, RefreshCw, Save, Settings, Trash2, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';

const csrf=()=>document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content??'';
async function api(url:string,options:RequestInit={}){const response=await fetch(url,{...options,headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf(),...(options.headers||{})}});const text=await response.text();let payload:any;try{payload=text?JSON.parse(text):{}}catch{throw new Error('The server returned an invalid response.')}if(!response.ok)throw new Error(payload.message||Object.values(payload.errors||{}).flat().join(' ')||'Request failed.');return payload}
function Alert({error,success}:{error:string;success:string}){return <>{error&&<div className="admin-alert error">{error}</div>}{success&&<div className="admin-alert success">{success}</div>}</>}
function Heading({title,description,action}:any){return <div className="module-hero"><div className="module-title"><div><div className="eyebrow"><i></i>LIVE FACTORY DATA</div><h1>{title}</h1><p>{description}</p></div></div>{action}</div>}

export function FlowSetupPage(){
    const [data,setData]=useState<any>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
    const load=()=>api('/api/factory/flow-suggestion').then(setData).catch(reason=>setError(reason.message));
    useEffect(()=>{void load()},[]);
    const apply=async()=>{setBusy(true);setError('');setSuccess('');try{const result=await api('/api/factory/flow-suggestion/apply',{method:'POST'});setSuccess(result.message||'Recommended departments, workstations and workflow stages are ready.');await load()}catch(reason:any){setError(reason.message)}finally{setBusy(false)}};
    const suggestion=data?.suggestion;return <section className="module-page"><Heading title="Factory departments and work steps" description="Create the departments and ordered work steps used by your factory." action={<button className="primary-btn" disabled={busy||!suggestion} onClick={apply}><Save size={17}/>{busy?'Applying…':'Use recommended setup'}</button>}/><Alert error={error} success={success}/><article className="panel flow-suggestion"><div className="flow-head"><div><small>FACTORY TYPE</small><h2>{String(data?.industry||'').replaceAll('_',' ')}</h2><p>{suggestion?.name}</p></div></div><div className="flow-line">{suggestion?.departments?.map((item:any,index:number)=><div key={item.code}><span>{index+1}</span><b>{item.name}</b><small>{item.workstation_type}</small></div>)}</div></article></section>
}

export function ProductionFlowPage(){
    const blankStage=()=>({name:'',required_workers:1,quality_required:false,approval_required:false});
    const [data,setData]=useState<any>(null);
    const [error,setError]=useState('');
    const [success,setSuccess]=useState('');
    const [busy,setBusy]=useState(false);
    const [editing,setEditing]=useState<any>(null);
    const load=()=>api('/api/manufacturing/overview').then(setData).catch(reason=>setError(reason.message));
    useEffect(()=>{load();const timer=window.setInterval(()=>{if(!editing)load()},5000);return()=>window.clearInterval(timer)},[editing]);
    const create=()=>setEditing({name:'',code:'',description:'',status:'active',stages:[blankStage()]});
    const edit=(workflow:any)=>setEditing({...workflow,stages:workflow.stages.map((stage:any)=>({...stage}))});
    const stage=(index:number,changes:any)=>setEditing({...editing,stages:editing.stages.map((item:any,i:number)=>i===index?{...item,...changes}:item)});
    const move=(index:number,direction:number)=>{const stages=[...editing.stages];const target=index+direction;if(target<0||target>=stages.length)return;[stages[index],stages[target]]=[stages[target],stages[index]];setEditing({...editing,stages})};
    const remove=(index:number)=>editing.stages.length>1&&setEditing({...editing,stages:editing.stages.filter((_:any,i:number)=>i!==index)});
    const save=async(e:React.FormEvent)=>{
        e.preventDefault();setBusy(true);setError('');setSuccess('');
        try{
            const payload={...editing,code:editing.code.toUpperCase(),stages:editing.stages.map((item:any,index:number)=>({...item,sequence:index+1,required_workers:Number(item.required_workers)||1}))};
            await api(editing.id?'/api/manufacturing/workflows/'+editing.id:'/api/manufacturing/workflows',{method:editing.id?'PUT':'POST',body:JSON.stringify(payload)});
            setEditing(null);setSuccess('Factory working flow saved successfully.');await load();
        }catch(reason:any){setError(reason.message)}finally{setBusy(false)}
    };
    const applyRecommended=async()=>{
        setBusy(true);setError('');setSuccess('');
        try{const result=await api('/api/factory/flow-suggestion/apply',{method:'POST'});setSuccess(result.message||'Recommended industry flow applied. You can now customize every stage.');await load()}
        catch(reason:any){setError(reason.message)}finally{setBusy(false)}
    };
    return <section className="module-page">
        <Heading title="Production steps" description="Set the order of work, required employees and quality checks used by your factory." action={<div className="workflow-actions production-step-actions"><button className="secondary-btn" onClick={load}><RefreshCw size={16}/>Refresh</button><button className="secondary-btn" disabled={busy} onClick={applyRecommended}><Factory size={16}/>Use recommended steps</button><button className="primary-btn" onClick={create}><Plus size={16}/>Create work steps</button></div>}/>
        <Alert error={error} success={success}/>
        {editing&&<form className="panel admin-form workflow-editor" onSubmit={save}>
            <header><div><small>FACTORY FLOW CONFIGURATION</small><h2>{editing.id?'Edit working flow':'Create working flow'}</h2></div><button type="button" className="icon-button" onClick={()=>setEditing(null)}><X size={18}/></button></header>
            <div className="form-grid"><label>Workflow name<input required value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label>Workflow code<input required maxLength={40} value={editing.code} onChange={e=>setEditing({...editing,code:e.target.value.toUpperCase()})}/></label><label>Description<textarea value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/></label><label>Status<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
            <div className="stage-editor-head"><div><h3>Working stages</h3><p>Stages run from top to bottom. Stage codes are created automatically from their names.</p></div><button type="button" className="secondary-btn" onClick={()=>setEditing({...editing,stages:[...editing.stages,blankStage()]})}><Plus size={15}/>Add stage</button></div>
            <div className="stage-option-help"><div><b>Quality check</b><span>Enable this when Quality Control must inspect the output and record whether it passes or has defects.</span></div><div><b>Approval</b><span>Enable this when the department manager must review and confirm the stage result.</span></div></div>
            <div className="stage-editor-list">{editing.stages.map((item:any,index:number)=><article key={item.id||index}>
                <b className="stage-number">{index+1}</b>
                <label>Stage name<input required placeholder="For example: Cutting" value={item.name} onChange={e=>stage(index,{name:e.target.value})}/></label>
                <label>Workers<input type="number" min="1" value={item.required_workers??1} onChange={e=>stage(index,{required_workers:e.target.value})}/></label>
                <label className="stage-check"><input type="checkbox" checked={!!item.quality_required} onChange={e=>stage(index,{quality_required:e.target.checked})}/>Quality check</label>
                <label className="stage-check"><input type="checkbox" checked={!!item.approval_required} onChange={e=>stage(index,{approval_required:e.target.checked})}/>Approval</label>
                <div className="stage-order"><button type="button" disabled={index===0} onClick={()=>move(index,-1)} title="Move up"><ArrowUp size={16}/></button><button type="button" disabled={index===editing.stages.length-1} onClick={()=>move(index,1)} title="Move down"><ArrowDown size={16}/></button><button type="button" disabled={editing.stages.length===1} onClick={()=>remove(index)} title="Remove stage"><Trash2 size={16}/></button></div>
            </article>)}</div>
            <button className="primary-btn" disabled={busy}><Save size={16}/>{busy?'Saving...':'Save working flow'}</button>
        </form>}
        <div className="workflow-list">{(data?.workflows||[]).length?data.workflows.map((workflow:any)=><article className="panel" key={workflow.id}><header><div><small>{workflow.code}</small><h2>{workflow.name}</h2><p>{workflow.description}</p></div><div className="workflow-card-actions"><span className={'admin-status '+workflow.status}>{workflow.status}</span><button className="table-action" onClick={()=>edit(workflow)}><Edit3 size={15}/>Configure</button></div></header><div className="flow-line">{workflow.stages.map((stage:any)=><div key={stage.id}><span>{stage.sequence}</span><b>{stage.name}</b><small>{stage.required_workers||1} worker(s){stage.quality_required?' · Quality check':''}{stage.approval_required?' · Approval required':''}</small></div>)}</div></article>):<div className="panel empty-state"><span><Factory size={28}/></span><h3>No workflow configured</h3><p>Use the recommended industry flow or create your own working flow on this page.</p><div className="empty-actions"><button className="secondary-btn" onClick={applyRecommended}>Use suggested flow</button><button className="primary-btn" onClick={create}>Create workflow</button></div></div>}</div>
    </section>
}

export function TeamManagementPage(){
    const emptyUser={name:'',email:'',role_id:'',department_id:'',password:'',password_confirmation:''};
    const [data,setData]=useState<any>(null);
    const [newUser,setNewUser]=useState<any>(emptyUser);
    const [editing,setEditing]=useState<Record<number,any>>({});
    const [error,setError]=useState('');
    const [success,setSuccess]=useState('');
    const [creating,setCreating]=useState(false);
    const [showCreate,setShowCreate]=useState(false);
    const load=()=>api('/api/team/workspaces').then(setData).catch(reason=>setError(reason.message));
    useEffect(()=>{void load()},[]);
    const create=async(e:React.FormEvent)=>{
        e.preventDefault();setCreating(true);setError('');setSuccess('');
        try{
            await api('/api/team/users',{method:'POST',body:JSON.stringify({...newUser,department_id:newUser.department_id||null})});
            setNewUser(emptyUser);setShowCreate(false);setSuccess('Employee account created and assigned successfully.');await load();
        }catch(reason:any){setError(reason.message)}finally{setCreating(false)}
    };
    const save=async(user:any)=>{
        const values=editing[user.id]||{};setError('');setSuccess('');
        try{await api('/api/team/users/'+user.id,{method:'PATCH',body:JSON.stringify(values)});setSuccess('Employee access and assignment updated.');setEditing(current=>{const next={...current};delete next[user.id];return next});await load()}
        catch(reason:any){setError(reason.message)}
    };
    const users=data?.users?.data||[];
    const isActive=(user:any)=>Boolean(Number(user.factories?.[0]?.pivot?.is_active??1));
    const statistics=data?.statistics||{};
    const metrics=[
        {label:'Total users',value:statistics.total_users||0,detail:'People with factory access',icon:<Users/>},
        {label:'Active users',value:statistics.active_users||0,detail:'Can sign in and work',icon:<UserCheck/>,tone:'green'},
        {label:'Assigned users',value:statistics.assigned_users||0,detail:'Placed in a department',icon:<UserPlus/>,tone:'blue'},
        {label:'Not assigned',value:statistics.unassigned_users||0,detail:'Need a department',icon:<UserMinus/>,tone:'amber'},
    ];
    return <section className="module-page team-management-page">
        <Heading title="Employees" description="Create employee accounts and choose each person's role, department and access." action={<button className="primary-btn" onClick={()=>{setError('');setShowCreate(true)}}><Plus size={17}/>Add employee</button>}/>
        <Alert error={error} success={success}/>
        <section className="team-user-metrics">{metrics.map(item=><article className="panel" key={item.label}><span className={item.tone||''}>{item.icon}</span><div><small>{item.label}</small><strong>{item.value}</strong><p>{item.detail}</p></div></article>)}</section>
        <div className="admin-table-wrap team-users-table"><table className="admin-table"><thead><tr><th>Employee</th><th>Status</th><th>Role</th><th>Department</th><th>Action</th></tr></thead><tbody>{users.length?users.map((user:any)=>{
            const current=editing[user.id]||{};
            const selectedDepartment=current.department_id??user.employee_profile?.department_id??'';
            const active=current.is_active??isActive(user);
            return <tr key={user.id}>
                <td><div className="team-user-cell"><span>{String(user.name||'U').split(' ').map((part:string)=>part[0]).join('').slice(0,2).toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div></div></td>
                <td><select value={active?'1':'0'} onChange={e=>setEditing({...editing,[user.id]:{...current,is_active:e.target.value==='1'}})}><option value="1">Active</option><option value="0">Inactive</option></select></td>
                <td><select value={current.role_id||user.roles?.[0]?.id||''} onChange={e=>setEditing({...editing,[user.id]:{...current,role_id:e.target.value}})}><option value="">Choose role</option>{(data?.roles||[]).map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                <td><select value={selectedDepartment} onChange={e=>setEditing({...editing,[user.id]:{...current,department_id:e.target.value||null}})}><option value="">Not assigned</option>{(data?.departments||[]).map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                <td><button className="table-action" disabled={!editing[user.id]} onClick={()=>save(user)}><Save size={15}/>Save changes</button></td>
            </tr>
        }):<tr><td className="empty-cell" colSpan={5}>No users have been created yet.</td></tr>}</tbody></table></div>
        {showCreate&&<div className="team-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setShowCreate(false)}}>
            <section className="team-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
                <header><div><div><h2 id="create-user-title">Create employee account</h2><p>Add login access and assign the employee to the correct team.</p></div></div><button type="button" aria-label="Close" onClick={()=>setShowCreate(false)}><X size={19}/></button></header>
                <form className="admin-form employee-create-form" onSubmit={create}><div className="form-grid employee-form-grid"><label>Full name<input autoFocus required placeholder="Enter employee name" value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})}/></label><label>Email address<input required type="email" placeholder="name@company.com" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/></label><label>Role<select required value={newUser.role_id} onChange={e=>setNewUser({...newUser,role_id:e.target.value})}><option value="">Choose role</option>{(data?.roles||[]).map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Department<select value={newUser.department_id} onChange={e=>setNewUser({...newUser,department_id:e.target.value})}><option value="">Not assigned</option>{(data?.departments||[]).map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Temporary password<input required minLength={10} type="password" placeholder="Create a secure password" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/><small>Use uppercase, lowercase, number and symbol.</small></label><label>Confirm password<input required minLength={10} type="password" placeholder="Enter the password again" value={newUser.password_confirmation} onChange={e=>setNewUser({...newUser,password_confirmation:e.target.value})}/></label></div><footer><button type="button" className="secondary-btn" onClick={()=>setShowCreate(false)}>Cancel</button><button className="primary-btn" disabled={creating}><UserPlus size={16}/>{creating?'Creating account...':'Create employee'}</button></footer></form>
            </section>
        </div>}
    </section>
}

export function ReportsPage({canExport,productionOnly=false}:{canExport:boolean;productionOnly?:boolean}){
    const today=new Date().toISOString().slice(0,10);const [filters,setFilters]=useState({period:'week',type:productionOnly?'production':'all',department_id:'',from:today,to:today});const [data,setData]=useState<any>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
    const load=async(silent=false)=>{if(!silent)setLoading(true);setError('');try{const query=new URLSearchParams(filters);setData(await api('/api/reports?'+query.toString()));setLastUpdated(new Date())}catch(reason:any){setError(reason.message)}finally{if(!silent)setLoading(false)}};useEffect(()=>{let active=true;const refresh=async(silent=false)=>{if(!silent)setLoading(true);try{const query=new URLSearchParams(filters);const result=await api('/api/reports?'+query.toString());if(active){setData(result);setError('');setLastUpdated(new Date())}}catch(reason:any){if(active)setError(reason.message)}finally{if(active&&!silent)setLoading(false)}};const debounce=window.setTimeout(()=>refresh(false),250);const timer=window.setInterval(()=>refresh(true),5000);return()=>{active=false;window.clearTimeout(debounce);window.clearInterval(timer)}},[filters.period,filters.type,filters.department_id,filters.from,filters.to]);
    return <section className="module-page report-page"><div className="no-print"><Heading icon={FileText} title={productionOnly?'Production flow reports':'Factory activity reports'} description={productionOnly?'Review real output, rejection, waste, downtime and progress for every category in the configured production flow.':'Review operational results for every department, including departments with no activity.'} action={canExport?<button className="primary-btn" disabled={!data} onClick={()=>window.print()}><Printer size={17}/>Print / Save PDF</button>:null}/><Alert error={error} success=""/><div className="panel report-filters"><label>Period<select value={filters.period} onChange={e=>setFilters({...filters,period:e.target.value})}><option value="day">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="custom">Custom dates</option></select></label>{!productionOnly&&<label>Activity type<select value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value})}><option value="all">Complete factory activity</option><option value="departments">Department performance</option><option value="production">Production stages</option><option value="inventory">Inventory movements</option><option value="activity">Operational events</option></select></label>}<label>{productionOnly?'Production flow category':'Department'}<select value={filters.department_id} onChange={e=>setFilters({...filters,department_id:e.target.value})}><option value="">{productionOnly?'All production flow categories':'All departments'}</option>{(data?.filters?.departments||[]).map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{filters.period==='custom'&&<><label>From<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>To<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label></>}<button className="secondary-btn" disabled={loading} onClick={()=>load(false)}><RefreshCw size={16}/>{loading?'Updating...':'Refresh now'}</button><div className="live-report-status"><i></i><span>Live data{lastUpdated?' · Updated '+lastUpdated.toLocaleTimeString():''}</span></div></div></div>{data&&<ReportDocument data={data}/>}</section>
}
function ReportDocument({data}:any){const summary=data.summary;const productionOnly=data.report.scope==='production_flow';return <article className="report-document"><header><div><h1>{data.factory.name}</h1><p>{String(data.factory.industry_type).replaceAll('_',' ')}</p></div><div><b>{productionOnly?'PRODUCTION FLOW REPORT':'FACTORY ACTIVITY REPORT'}</b><span>{data.report.from} to {data.report.to}</span></div></header><section className="report-meta"><span>Generated: {new Date(data.report.generated_at).toLocaleString()}</span><span>Prepared by: {data.report.generated_by}</span><span>Scope: {data.report.department_id?'Selected flow category':productionOnly?'All production flow categories':'All departments'}</span></section><div className="report-summary">{Object.entries(summary).map(([key,value]:any)=><div key={key}><span>{key.replaceAll('_',' ')}</span><b>{Number(value).toLocaleString()}</b></div>)}</div>{productionOnly?<ReportTable title="Production flow category performance" headers={['Code','Flow category','Orders','Stages','Completed','In progress','Output','Rejected','Waste','Downtime (min)']} rows={(data.department_activity||[]).map((item:any)=>[item.code,item.name,item.production_orders,item.stages_processed,item.completed_stages,item.in_progress_stages,item.output_quantity,item.rejected_quantity,item.waste_quantity,item.downtime_minutes])}/>:<ReportTable title="Department activity and performance" headers={['Code','Department','Manager','Employees','Orders','Stages','Completed','In progress','Output','Rejected','Waste','Downtime (min)','Events']} rows={(data.department_activity||[]).map((item:any)=>[item.code,item.name,item.manager||'Not assigned',item.employees,item.production_orders,item.stages_processed,item.completed_stages,item.in_progress_stages,item.output_quantity,item.rejected_quantity,item.waste_quantity,item.downtime_minutes,item.operational_events])}/>} {data.production.length>0&&<ReportTable title="Production stage activity" headers={['Updated','Order','Product','Stage','Status','Output','Rejected','Waste','Downtime']} rows={data.production.map((item:any)=>[new Date(item.updated_at).toLocaleString(),item.order_number,item.product_name||'—',item.stage_name,item.status,item.output_quantity,item.rejected_quantity,item.waste_quantity,item.downtime_minutes])}/>} {!productionOnly&&data.inventory.length>0&&<ReportTable title="Inventory movement activity" headers={['Date','Item','SKU','Warehouse','Type','Quantity','Cost','Balance','Reason']} rows={data.inventory.map((item:any)=>[new Date(item.occurred_at).toLocaleString(),item.item_name,item.sku,item.warehouse_name,item.type,item.quantity_delta,item.unit_cost,item.balance_after,item.reason||'—'])}/>} {!productionOnly&&data.activities.length>0&&<ReportTable title="Operational events" headers={['Date','Recorded by','Event','Description']} rows={data.activities.map((item:any)=>[new Date(item.created_at).toLocaleString(),item.user?.name||'System',item.event.replaceAll('.',' / '),item.description])}/>}<footer>{data.factory.name} · Generated by ICYEREKEZO OMS · {new Date(data.report.generated_at).toLocaleDateString()}</footer></article>}

function ReportTable({title,headers,rows}:any){return <section className="report-section"><h2>{title}</h2><table><thead><tr>{headers.map((item:string)=><th key={item}>{item}</th>)}</tr></thead><tbody>{rows.map((row:any[],index:number)=><tr key={index}>{row.map((cell:any,cellIndex:number)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></section>}
