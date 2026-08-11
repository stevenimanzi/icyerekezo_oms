import React, { useEffect, useState, useMemo } from "react";
import { Package, Inbox, RefreshCw } from "lucide-react";

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "";
async function api(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-TOKEN": csrf(), ...(options.headers || {}) },
    });
    if (response.status === 401) window.location.href = "/login";
    if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.message || `HTTP ${response.status}`);
    return response.json();
}

function Empty({ icon: Icon, title, desc }: any) {
    return (
        <tr>
            <td colSpan={10}>
                <div className="empty-state">
                    <Icon className="empty-icon" size={32} />
                    <h4>{title}</h4>
                    <p>{desc}</p>
                </div>
            </td>
        </tr>
    );
}

function Header({ title, count, onRefresh, busy }: any) {
    return (
        <header className="module-header">
            <h3>{title} <span className="count-badge">{count}</span></h3>
            <button className="icon-btn" onClick={onRefresh} disabled={busy}>
                <RefreshCw size={16} className={busy ? "spin" : ""} />
            </button>
        </header>
    );
}

export default function IncomingRequestsPage() {
    const locale = (window as any).Settings?.locale || 'en';
    const [busy, setBusy] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [tools, setTools] = useState<any>({ warehouses: [] });
    const [confirmAction, setConfirmAction] = useState<any>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [filterStatus, setFilterStatus] = useState("Pending");
    
    const load = async (silent = false) => {
        if (!silent) setBusy(true);
        try {
            const [overview, toolsData] = await Promise.all([
                api('/api/inventory/overview'),
                api('/api/inventory/tools')
            ]);
            setTransactions(overview.recent_transactions || []);
            setTools(toolsData);
        } catch (e: any) { alert(e.message); } finally { setBusy(false); }
    };
    
    useEffect(() => { load(); }, []);

    const quantity = (val: any, unit: any) => `${Number(val || 0).toLocaleString()} ${unit?.symbol || ''}`;

    const approveRequest = (tx: any) => {
        setConfirmAction({ type: 'approve', tx });
    };

    const doApprove = async (tx: any) => {
        // Find target warehouse based on request type
        let toWarehouseId = 1;
        if (tx.reason && String(tx.reason).includes("[Cutting Request]")) {
            toWarehouseId = tools.warehouses?.find((w:any) => w.code === 'CUT' || /cutting/i.test(w.name))?.id || 1;
        } else if (tx.reason && String(tx.reason).includes("[Production Request]")) {
            toWarehouseId = tools.warehouses?.find((w:any) => w.code === 'PROD' || /production/i.test(w.name))?.id || 1;
        } else if (tx.reason && String(tx.reason).includes("[Sales Request]")) {
            toWarehouseId = tools.warehouses?.find((w:any) => w.code === 'DISPATCH' || /dispatch/i.test(w.name))?.id || 1;
        }

        setBusy(true);
        try {
            await api('/api/inventory/transfers', {
                method: 'POST',
                body: JSON.stringify({ item_id: tx.item_id, from_warehouse_id: tx.warehouse_id, to_warehouse_id: toWarehouseId, quantity: Math.abs(tx.reserved_delta || tx.quantity_delta), reason: `Approved Request #${tx.id}` })
            });
            await api('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: tx.item_id, warehouse_id: tx.warehouse_id, type: 'release_reservation', quantity: Math.abs(tx.reserved_delta || tx.quantity_delta), reason: `Released Request #${tx.id}` })
            });
            await load(true);
        } catch(e:any) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const rejectRequest = (tx: any) => {
        setConfirmAction({ type: 'reject', tx });
    };

    const doReject = async (tx: any, reason: string) => {
        setBusy(true);
        try {
            await api('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: tx.item_id, warehouse_id: tx.warehouse_id, type: 'release_reservation', quantity: Math.abs(tx.reserved_delta || tx.quantity_delta), reason: `Rejected Request #${tx.id}: ${reason}` })
            });
            await load(true);
        } catch(e:any) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const pendingRequests = useMemo(() => {
        const reserves = transactions.filter((entry: any) => entry.type === 'reserve');
        const releases = transactions.filter((entry: any) => entry.type === 'release_reservation');
        
        return reserves.map(r => {
            const release = releases.find(rel => String(rel.reason).includes(`#${r.id}`));
            let status = 'Pending';
            if (release) {
                status = String(release.reason).includes('Rejected') ? 'Rejected' : 'Approved';
            }
            return { ...r, status };
        });
    }, [transactions]);
    
    const filteredRequests = useMemo(() => pendingRequests.filter(r => r.status === filterStatus || filterStatus === 'All'), [pendingRequests, filterStatus]);

    const activeRequests = pendingRequests.filter(r => r.status === 'Pending');
    const cuttingRequests = activeRequests.filter((tx: any) => String(tx.reason).includes("[Cutting"));
    const productionRequests = activeRequests.filter((tx: any) => String(tx.reason).includes("[Production"));
    const salesRequests = activeRequests.filter((tx: any) => String(tx.reason).includes("[Sales"));

    return (
        <section className="module-page incoming-requests-page">
            <div className="module-hero">
                <div className="module-title">
                    <div>
                        <div className="eyebrow"><Inbox size={14} /> {locale === 'en' ? 'Warehouse Operations' : 'Op\u00e9rations'}</div>
                        <h2>{locale === 'en' ? 'Incoming Requests' : 'Demandes Entrantes'}</h2>
                        <p>{locale === 'en' ? 'Manage material requests from Cutting, Production, and Sales.' : 'G\u00e9rez les demandes de la coupe, production et ventes.'}</p>
                    </div>
                </div>
                <div className="inventory-live-actions">
                    <button className="secondary-btn" disabled={busy} onClick={() => load()}>
                        <RefreshCw size={16} className={busy ? "spin" : ""} />
                        {locale === 'en' ? 'Refresh' : 'Actualiser'}
                    </button>
                </div>
            </div>
            
            <div className="module-content">
                <section className="metric-grid">
                    <article className="metric-card">
                        <div className="metric-icon blue"><Package /></div>
                        <div className="metric-copy">
                            <span>{locale === 'en' ? 'Cutting Floor Requests' : 'Demandes Coupe'}</span>
                            <div><strong>{cuttingRequests.length}</strong></div>
                        </div>
                    </article>
                    <article className="metric-card">
                        <div className="metric-icon amber"><Inbox /></div>
                        <div className="metric-copy">
                            <span>{locale === 'en' ? 'Production Line Requests' : 'Demandes Production'}</span>
                            <div><strong>{productionRequests.length}</strong></div>
                        </div>
                    </article>
                    <article className="metric-card">
                        <div className="metric-icon green"><Package /></div>
                        <div className="metric-copy">
                            <span>{locale === 'en' ? 'Dispatch & Sales Requests' : 'Demandes Ventes'}</span>
                            <div><strong>{salesRequests.length}</strong></div>
                        </div>
                    </article>
                </section>

                <div className="panel-title" style={{ marginTop: '2rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>{locale === 'en' ? 'Requests' : 'Demandes'}</h2>
                    <select className="form-control" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="Pending">{locale === 'en' ? 'Pending' : 'En attente'}</option>
                        <option value="Approved">{locale === 'en' ? 'Approved' : 'Approuvé'}</option>
                        <option value="Rejected">{locale === 'en' ? 'Rejected' : 'Rejeté'}</option>
                        <option value="All">{locale === 'en' ? 'All' : 'Tout'}</option>
                    </select>
                </div>
                <div className="admin-table-wrap">
                    <table className="admin-table inventory-table">
                        <thead>
                            <tr>
                                <th>{locale === 'en' ? 'Date' : 'Date'}</th>
                                <th>{locale === 'en' ? 'Item' : 'Article'}</th>
                                <th>{locale === 'en' ? 'Warehouse' : 'Entrep\u00f4t'}</th>
                                <th>{locale === 'en' ? 'Quantity' : 'Quantit\u00e9'}</th>
                                <th>{locale === 'en' ? 'Request Source / Notes' : 'Source / Notes'}</th>
                                <th>{locale === 'en' ? 'Action' : 'Action'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.length ? filteredRequests.map((entry: any) => (
                                <tr key={entry.id}>
                                    <td>{new Date(entry.occurred_at).toLocaleString()}</td>
                                    <td><b>{entry.item_name}</b></td>
                                    <td>{entry.warehouse_name}</td>
                                    <td><span className="admin-status warning">{quantity(Math.abs(entry.reserved_delta || entry.quantity_delta), entry.unit)}</span></td>
                                    <td>{String(entry.reason || '')}</td>
                                    <td>
                                        {entry.status === 'Pending' ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
                                                <button className="primary-btn" onClick={() => approveRequest(entry)}>{locale === 'en' ? 'Approve & Issue' : 'Approuver'}</button>
                                                <button className="secondary-btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => rejectRequest(entry)}>{locale === 'en' ? 'Reject' : 'Rejeter'}</button>
                                            </div>
                                        ) : (
                                            <span className={`admin-status ${entry.status === 'Approved' ? 'success' : 'danger'}`}>
                                                {locale === 'en' ? entry.status : (entry.status === 'Approved' ? 'Approuv\u00e9' : 'Rejet\u00e9')}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )) : <Empty icon={Package} title={locale === 'en' ? 'No requests found' : 'Aucune demande'} desc={locale === 'en' ? 'Try changing the filter.' : 'Essayez de changer le filtre.'} />}
                        </tbody>
                    </table>
                </div>
            </div>

            {confirmAction && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 1rem 0' }}>{confirmAction.type === 'approve' ? (locale === 'en' ? 'Approve Request' : 'Approuver la demande') : (locale === 'en' ? 'Reject Request' : 'Rejeter la demande')}</h3>
                        <p style={{ margin: '0 0 1rem 0' }}>
                            {confirmAction.type === 'approve' 
                                ? (locale === 'en' ? 'Are you sure you want to approve and issue this request?' : 'Êtes-vous sûr de vouloir approuver et émettre cette demande ?')
                                : (locale === 'en' ? 'Please provide a reason for rejecting this request:' : 'Veuillez fournir une raison pour le rejet :')
                            }
                        </p>
                        
                        {confirmAction.type === 'reject' && (
                            <textarea 
                                className="form-control" 
                                rows={3} 
                                value={rejectReason} 
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder={locale === 'en' ? 'Reason for rejection...' : 'Raison du rejet...'}
                                style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="secondary-btn" onClick={() => { setConfirmAction(null); setRejectReason(''); }}>{locale === 'en' ? 'Cancel' : 'Annuler'}</button>
                            <button 
                                className="primary-btn" 
                                style={confirmAction.type === 'reject' ? { backgroundColor: 'var(--red)', borderColor: 'var(--red)', color: 'white' } : {}}
                                onClick={() => {
                                    if (confirmAction.type === 'reject' && !rejectReason.trim()) {
                                        alert(locale === 'en' ? 'Reason is required' : 'La raison est requise');
                                        return;
                                    }
                                    const tx = confirmAction.tx;
                                    const action = confirmAction.type;
                                    setConfirmAction(null);
                                    setRejectReason('');
                                    if (action === 'approve') doApprove(tx);
                                    else doReject(tx, rejectReason);
                                }}
                            >
                                {locale === 'en' ? 'Confirm' : 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
