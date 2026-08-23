import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, FileSignature, FileUp, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';

async function api(url: string, options: RequestInit = {}) {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, ...(options.headers || {}) } });
    const text = await response.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Agreement data could not be read. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || 'Agreement data could not be loaded.');
    return data;
}

export default function AgreementWorkspacePage({ can = () => true }: { can?: (permission: string) => boolean }) {
    const [tab, setTab] = useState<'upload' | 'view'>('upload');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [filters, setFilters] = useState({ status: '', district: '', sector: '', search: '' });
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
            const result = await api(`/api/logistics/agreements?${params.toString()}`);
            setData(result);
            setError('');
        } catch (reason: any) {
            if (!silent) setError(reason.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        const wait = window.setTimeout(() => void load(), filters.search ? 300 : 0);
        return () => window.clearTimeout(wait);
    }, [filters.status, filters.district, filters.sector, filters.search]);

    const upload = async () => {
        if (!file) return;
        setBusy(true);
        setError('');
        setSuccess('');
        try {
            const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
            const form = new FormData();
            form.append('agreement', file);
            const response = await fetch('/api/logistics/agreements', { method: 'POST', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf }, body: form });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat().join(' ') || 'The agreement could not be uploaded.');
            setSuccess(payload.message);
            setFile(null);
            await load();
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    };

    const current = data?.current;
    const schools = data?.schools || [];
    const summary = data?.summary || {};
    const districts = data?.filters?.districts || [];
    const sectors = filters.district ? (data?.filters?.sectors_by_district?.[filters.district] || []) : [];

    return (
        <section className="module-page logistics-live-page">
            <div className="module-hero">
                <div className="module-title">
                    <div>
                        <div className="eyebrow"><i />SCHOOL AGREEMENTS</div>
                        <h1>Agreement</h1>
                        <p>Upload the school agreement and track which schools have signed and returned it.</p>
                    </div>
                </div>
                <div className="workflow-actions">
                    <button className="secondary-btn" disabled={loading} onClick={() => load()}><RefreshCw className={loading ? 'spin' : ''} size={16} />Refresh</button>
                </div>
            </div>

            {error && <div className="admin-alert error"><AlertTriangle size={18} />{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <div className="module-tabs sales-tabs">
                <button className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>Upload agreement</button>
                <button className={tab === 'view' ? 'active' : ''} onClick={() => setTab('view')}>View agreements<span>{Number(summary.total_schools || 0).toLocaleString()}</span></button>
            </div>

            {tab === 'upload' ? (
                <section className="panel sales-records">
                    <header><div><h2>Current agreement</h2><p>The document every school must download, sign and return.</p></div></header>
                    <div style={{ padding: '0 20px 20px' }}>
                        {current ? (
                            <div className="school-agreement-file">
                                <FileSignature />
                                <div><b>{current.original_name}</b><small>Uploaded {new Date(current.created_at).toLocaleDateString()} by {current.uploaded_by?.name || 'Logistics'}</small></div>
                                <a className="secondary-btn" href={current.file_url} download={current.original_name} target="_blank" rel="noreferrer"><Download size={16} />Download</a>
                            </div>
                        ) : (
                            <div className="sales-empty"><b>No agreement uploaded yet</b><span>Upload the agreement document below so schools can see and sign it.</span></div>
                        )}
                        {can('logistics.plan') && (
                            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <label className="secondary-btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <FileUp size={15} />{file ? file.name : (current ? 'Choose a replacement file' : 'Choose agreement file')}
                                    <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                                </label>
                                <button className="primary-btn" disabled={busy || !file} onClick={upload}>{busy ? 'Uploading…' : (current ? 'Upload new version' : 'Upload agreement')}</button>
                            </div>
                        )}
                    </div>
                </section>
            ) : (
                <>
                    <div className="sales-metrics">
                        <article className="panel"><small>Total schools</small><strong>{Number(summary.total_schools || 0).toLocaleString()}</strong></article>
                        <article className="panel"><small>Signed</small><strong>{Number(summary.signed || 0).toLocaleString()}</strong></article>
                        <article className="panel"><small>Unsigned</small><strong>{Number(summary.unsigned || 0).toLocaleString()}</strong></article>
                    </div>

                    <section className="panel school-filter-panel">
                        <header>
                            <div><SlidersHorizontal size={20} /><span><b>Filter schools</b><small>Find schools by status, district or sector.</small></span></div>
                            <button className="text-btn" onClick={() => setFilters({ status: '', district: '', sector: '', search: '' })}>Clear all</button>
                        </header>
                        <div className="school-filter-grid">
                            <label className="school-search"><Search size={18} /><input placeholder="Search school name" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></label>
                            <label>
                                <span>Status</span>
                                <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                                    <option value="">All schools</option>
                                    <option value="signed">Signed</option>
                                    <option value="unsigned">Unsigned</option>
                                </select>
                            </label>
                            <label>
                                <span>District</span>
                                <select value={filters.district} onChange={e => setFilters({ ...filters, district: e.target.value, sector: '' })}>
                                    <option value="">All districts</option>
                                    {districts.map((d: string) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>Sector</span>
                                <select disabled={!filters.district} value={filters.sector} onChange={e => setFilters({ ...filters, sector: e.target.value })}>
                                    <option value="">{filters.district ? 'All sectors' : 'Choose a district first'}</option>
                                    {sectors.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>
                        </div>
                    </section>

                    <section className="panel sales-records">
                        <header><div><h2>Schools</h2><p>{schools.length} school{schools.length === 1 ? '' : 's'} match your filters.</p></div></header>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>School</th><th>District</th><th>Sector</th><th>Status</th><th>Signed on</th><th>File</th></tr></thead>
                                <tbody>
                                    {schools.length ? schools.map((school: any) => (
                                        <tr key={school.id}>
                                            <td><b>{school.name}</b></td>
                                            <td>{school.district || '—'}</td>
                                            <td>{school.sector || '—'}</td>
                                            <td><span className={'admin-status ' + (school.signed ? 'accepted' : 'pending')}>{school.signed ? 'Signed' : 'Unsigned'}</span></td>
                                            <td>{school.signed_at ? new Date(school.signed_at).toLocaleDateString() : '—'}</td>
                                            <td>{school.file_url ? <a href={school.file_url} target="_blank" rel="noreferrer">View</a> : '—'}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6}><div className="sales-empty"><b>No schools found</b><span>No schools match these filters.</span></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </section>
    );
}
