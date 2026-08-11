import React, { FormEvent, useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Languages, LockKeyhole, Mail, Moon, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import '../../../css/profile-settings.css';

type Locale = 'en' | 'fr';
type Props = {
    user: { name:string; email:string; timezone?:string; is_platform_admin:boolean; roles:{name:string}[]; current_factory:{name:string;industry_type?:string}|null };
    locale: Locale; dark:boolean; onLocaleChange:(value:Locale)=>void; onThemeChange:(value:boolean)=>void;
};
type Profile = { name:string;email:string;locale:Locale;timezone:string;last_login_at?:string|null;last_login_ip?:string|null;current_ip?:string|null;created_at?:string;factory?:{name:string;industry_type?:string}|null };

const csrf=()=>document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content||'';
async function request<T>(url:string,options:RequestInit={}) {
    const response=await fetch(url,{...options,headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf(),...(options.headers||{})}});
    const payload=await response.json().catch(()=>({message:'The server returned an unexpected response.'}));
    if(!response.ok){const first=payload.errors?Object.values(payload.errors).flat()[0]:null;throw new Error(String(first||payload.message||'Your changes could not be saved.'));}
    return payload as T;
}
const zones=['Africa/Kigali','Africa/Johannesburg','Africa/Nairobi','Africa/Lagos','Europe/London','Europe/Paris','UTC'];

export default function ProfileSettingsPage({user,locale,dark,onLocaleChange,onThemeChange}:Props){
    const [tab,setTab]=useState<'profile'|'security'|'preferences'>('profile');
    const [profile,setProfile]=useState<Profile>({name:user.name,email:user.email,locale,timezone:user.timezone||'Africa/Kigali',factory:user.current_factory});
    const [password,setPassword]=useState({current_password:'',password:'',password_confirmation:''});
    const [showPasswords,setShowPasswords]=useState(false);
    const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
    useEffect(()=>{request<{profile:Profile}>('/api/profile').then(r=>setProfile(r.profile)).catch(e=>setError(e.message));},[]);
    const announce=(text:string)=>{setError('');setMessage(text);window.setTimeout(()=>setMessage(''),3500)};
    const saveProfile=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{const result=await request<{message:string;profile:Profile}>('/api/profile',{method:'PUT',body:JSON.stringify(profile)});setProfile(result.profile);onLocaleChange(result.profile.locale);announce(result.message)}catch(e:any){setError(e.message)}finally{setBusy(false)}};
    const savePassword=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{const result=await request<{message:string}>('/api/profile/password',{method:'PUT',body:JSON.stringify(password)});setPassword({current_password:'',password:'',password_confirmation:''});announce(result.message)}catch(e:any){setError(e.message)}finally{setBusy(false)}};
    const role=user.is_platform_admin?'Platform administrator':user.roles[0]?.name||'System user';
    const formatDate=(value?:string|null)=>value?new Intl.DateTimeFormat(locale==='fr'?'fr-FR':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded yet';

    return <div className="profile-page">
        <div className="page-heading profile-heading"><div><h1>{locale==='fr'?'Profil et paramètres':'Profile and settings'}</h1><p>{locale==='fr'?'Gérez vos informations personnelles, votre sécurité et vos préférences.':'Manage your personal information, security and display preferences.'}</p></div></div>
        {message&&<div className="profile-alert success"><Check size={18}/>{message}</div>}{error&&<div className="profile-alert error">{error}</div>}
        <section className="profile-hero panel"><div className="profile-avatar">{profile.name.split(' ').map(v=>v[0]).join('').slice(0,2).toUpperCase()}</div><div><h2>{profile.name}</h2><p>{profile.email}</p><div className="profile-badges"><span>{role}</span>{profile.factory?.name&&<span>{profile.factory.name}</span>}</div></div><div className="profile-security"><ShieldCheck/><span><b>Account protected</b><small>Secure sign-in is active</small></span></div></section>
        <div className="profile-tabs panel" role="tablist"><button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}>Personal details</button><button className={tab==='security'?'active':''} onClick={()=>setTab('security')}>Password and security</button><button className={tab==='preferences'?'active':''} onClick={()=>setTab('preferences')}>Preferences</button></div>
        {tab==='profile'&&<div className="profile-layout"><form className="panel profile-form" onSubmit={saveProfile}><header><h2>Personal details</h2><p>Keep your name and contact email up to date.</p></header><label>Full name<div className="profile-input"><UserRound/><input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})} placeholder="Enter your full name" required/></div></label><label>Email address<div className="profile-input"><Mail/><input type="email" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})} placeholder="name@company.com" required/></div></label><label>Time zone<select value={profile.timezone} onChange={e=>setProfile({...profile,timezone:e.target.value})}>{zones.map(zone=><option key={zone}>{zone}</option>)}</select></label><button className="primary-btn" disabled={busy}><Save size={18}/>{busy?'Saving...':'Save profile'}</button></form><aside className="panel account-summary"><h2>Account information</h2><dl><div><dt>Role</dt><dd>{role}</dd></div><div><dt>Factory</dt><dd>{profile.factory?.name||'Platform account'}</dd></div><div><dt>Member since</dt><dd>{formatDate(profile.created_at)}</dd></div><div><dt>Last sign in</dt><dd>{formatDate(profile.last_login_at)}</dd></div><div><dt>Current IP address</dt><dd>{profile.current_ip||'Unavailable'}</dd></div></dl></aside></div>}
        {tab==='security'&&<form className="panel profile-form security-form" onSubmit={savePassword}><header><h2>Change password</h2><p>Use at least 10 characters with uppercase, lowercase, a number and a symbol.</p></header>{(['current_password','password','password_confirmation'] as const).map((field,index)=><label key={field}>{['Current password','New password','Confirm new password'][index]}<div className="profile-input"><LockKeyhole/><input type={showPasswords?'text':'password'} value={password[field]} onChange={e=>setPassword({...password,[field]:e.target.value})} placeholder={['Enter your current password','Create a strong new password','Enter the new password again'][index]} required/><button type="button" onClick={()=>setShowPasswords(!showPasswords)} aria-label="Show or hide passwords">{showPasswords?<EyeOff/>:<Eye/>}</button></div></label>)}<button className="primary-btn" disabled={busy}><ShieldCheck size={18}/>{busy?'Changing...':'Change password'}</button></form>}
        {tab==='preferences'&&<section className="panel preferences-card"><header><h2>Display preferences</h2><p>Choose how the system looks and which language it uses.</p></header><div className="preference-row"><span><Languages/><span><b>Language</b><small>Used across menus and supported pages</small></span></span><div className="choice-buttons"><button className={locale==='en'?'active':''} onClick={()=>{onLocaleChange('en');setProfile({...profile,locale:'en'})}}>English</button><button className={locale==='fr'?'active':''} onClick={()=>{onLocaleChange('fr');setProfile({...profile,locale:'fr'})}}>Français</button></div></div><div className="preference-row"><span>{dark?<Moon/>:<Sun/>}<span><b>Appearance</b><small>Switch between light and dark display</small></span></span><div className="choice-buttons"><button className={!dark?'active':''} onClick={()=>onThemeChange(false)}><Sun/>Light</button><button className={dark?'active':''} onClick={()=>onThemeChange(true)}><Moon/>Dark</button></div></div><button className="primary-btn" disabled={busy} onClick={saveProfile as any}><Save size={18}/>Save preferences</button></section>}
    </div>;
}
