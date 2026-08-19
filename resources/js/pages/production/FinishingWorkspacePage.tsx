import React, { useEffect, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, FileText,
    Package, RefreshCw, Scissors, Send,
} from 'lucide-react';

type Locale = 'en' | 'fr';
type FinishingTab = 'request' | 'materials' | 'finish';
type AuthUser = {
    id: number; name: string;
    current_factory: { name?: string; currency_code?: string } | null;
    system?: { currency_code?: string };
};

const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf(), ...(options.headers ?? {}) },
    });
    const text = await response.text();
    let payload: any = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { throw new Error('The server returned an invalid response.'); }
    if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat().join(' ') || 'Something went wrong.');
    return payload;
}

const copy = {
    en: {
        title: 'Finishing workspace',
        subtitle: 'Manage received pieces, record finishn output.',
        eyebrow: 'LIVE FINISHING DATA',
        tabs: { request: 'Receive pieces', materials: 'Request materials', finish: 'Finish pieces' },
        materialsTitle: 'Request raw materials',
        materialsDesc: 'Request materials like buttons, thread, or labels from the main warehouse.',
        requestMaterials: 'Submit request', requesting: 'Submitting...',
        requestTitle: 'Receive pieces from sewing',
        requestDesc: 'Log the receipt of sewn pieces needed for your finishing operations.',
        selectItem: 'Select piece/material', quantity: 'Quantity received', reason: 'Reason / Notes',
        quantityPlaceholder: 'Enter quantity', reasonPlaceholder: 'Describe what you received...',
        sendRequest: 'Log receipt', sending: 'Logging...',
        pendingRequests: 'Accepted items', noRequests: 'No items accepted yet.',
        sewnTitle: 'Record finishn items',
        sewnDesc: 'Log the items you have successfully finishn in this session.',
        sewnItem: 'Material used', sewnQuantity: 'Quantity used',
        outputQuantity: 'Number of items finishn', sewnNotes: 'Finishing notes',
        sewnPlaceholder: 'e.g., 50', outputPlaceholder: 'e.g., 50',
        notesPlaceholder: 'Any notes about this finishing session...',
        recordSewn: 'Record finishing output', recording: 'Recording...',
        recentSewns: 'Recent finishing records', noSewns: 'No finishing records yet. Record your first finish above.',
        period: 'Today',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting...', loading: 'Loading...',
    },
    fr: {
        title: 'Espace de finition',
        subtitle: 'G\u00e9rez les pi\u00e8ces re\u00e7ues et enregistrez la finition.',
        eyebrow: 'DONN\u00c9ES DE FINITION EN DIRECT',
        tabs: { request: 'R\u00e9ceptionner', materials: 'Demander mat\u00e9riels', finish: 'Finition' },
        materialsTitle: 'Demander des mati\u00e8res premi\u00e8res',
        materialsDesc: 'Demandez des mat\u00e9riaux (boutons, fils, etc.) de l\'entrep\u00f4t principal.',
        requestMaterials: 'Soumettre', requesting: 'Soumission...',
        requestTitle: "R\u00e9ceptionner les pi\u00e8ces de la couture",
        requestDesc: 'Enregistrez la r\u00e9ception des pi\u00e8ces cousues n\u00e9cessaires pour la finition.',
        selectItem: 'S\u00e9lectionner la pi\u00e8ce', quantity: 'Quantit\u00e9 re\u00e7ue', reason: 'Motif / Notes',
        quantityPlaceholder: 'Saisissez la quantit\u00e9', reasonPlaceholder: 'D\u00e9crivez ce que vous avez re\u00e7u...',
        sendRequest: 'Enregistrer', sending: 'Enregistrement...',
        pendingRequests: 'Articles accept\u00e9s', noRequests: 'Aucun article accept\u00e9.',
        sewnDesc: 'Enregistrez les articles que vous avez cousus avec succ\u00e8s.',
        sewnItem: 'Mat\u00e9riel utilis\u00e9', sewnQuantity: 'Quantit\u00e9 utilis\u00e9e',
        outputQuantity: 'Nombre d\'articles', sewnNotes: 'Notes de finition',
        sewnPlaceholder: 'ex: 50', outputPlaceholder: 'ex: 50',
        notesPlaceholder: 'Notes sur cette session de finition...',
        recordSewn: 'Enregistrer la finition', recording: 'Enregistrement...',
        recentSewns: 'Finitions r\u00e9centes', noSewns: 'Aucune finition enregistr\u00e9e.',
        period: "Aujourd'hui",
        refresh: 'Actualiser', updated: 'Mis \u00e0 jour', connecting: 'Connexion...', loading: 'Chargement...',
    },
};

export default function FinishingWorkspacePage({ user, locale, initialTab = 'request' }: { user: AuthUser; locale: Locale; initialTab?: FinishingTab }) {
    const t = copy[locale];
    const [tab, setTab] = useState<FinishingTab>(initialTab);
    const [items, setItems] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [sewnPieces, setSewnPieces] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [stockPopup, setStockPopup] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    const [requestForm, setRequestForm] = useState({ item_id: '', quantity: '', reason: '' });
    const [finishForm, setFinishForm] = useState({ item_id: '', quantity: '', notes: '' });
    const [editForm, setEditForm] = useState<{ id: string, quantity: string, reason: string } | null>(null);

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await api<any>('/api/inventory/overview');
            setStock(overview.stock || []);
            setItems(overview.items || []);
            setTransactions(overview.recent_transactions || overview.transactions || []);
            setSewnPieces(overview.sewn_pieces || []);
            setWarehouses(overview.warehouse_list || overview.warehouses || []);
            setUpdated(new Date());
            setError('');
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { load(); const timer = window.setInterval(() => load(true), 10000); return () => window.clearInterval(timer); }, []);

    const finishingWarehouseId = warehouses.find(w => w.code === 'SEW' || /finishing/i.test(w.name))?.id || 1;
    const mainWarehouseId = warehouses.find(w => w.code === 'MAIN' || /main/i.test(w.name))?.id || 1;
    
    const requestableItems = sewnPieces;
    const requestableMaterials = stock.filter((s: any) => s.warehouse_id === mainWarehouseId && s.category === 'Raw Materials' && s.quantity_on_hand > 0);

    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const finishingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve', 'receipt'].includes(String(tx.type || ''))
    );
    const finishOutputTransactions = finishingTransactions.filter((tx: any) =>
        tx.type === 'issue' &&
        tx.warehouse_id === finishingWarehouseId &&
        String(tx.reason || '').startsWith('[Finishing Output]')
    );

    const acceptedSewnPieces = finishingTransactions.filter((tx: any) => tx.type === 'receipt' && String(tx.reason || '').includes('SewnID:'));

    const finishingVirtualStock = new Map();
    acceptedSewnPieces.forEach((tx: any) => {
        const match = String(tx.reason).match(/SewnID:\s*([^\s|]+)/i);
        if (match) {
            const sewnId = match[1];
            if (!finishingVirtualStock.has(sewnId)) {
                const parts = sewnId.split('-');
                finishingVirtualStock.set(sewnId, {
                    id: sewnId,
                    item_id: tx.item_id,
                    name: `${parts[1] || ''}${parts[2] ? ` / ${parts[2]}` : ''} (${parts[3] || ''}) - ${tx.item_name}`,
                    available_qty: 0
                });
            }
            finishingVirtualStock.get(sewnId).available_qty += Math.abs(tx.quantity_delta);
        }
    });
    finishingTransactions.forEach((tx: any) => {
        if ((tx.type === 'issue' || tx.type === 'waste') && String(tx.reason).includes('SewnID:')) {
            const match = String(tx.reason).match(/SewnID:\s*([^\s|]+)/i);
            if (match && finishingVirtualStock.has(match[1])) {
                finishingVirtualStock.get(match[1]).available_qty -= Math.abs(tx.quantity_delta);
            }
        }
    });
    const availableFinishingStock = Array.from(finishingVirtualStock.values()).filter(item => item.available_qty > 0);

    const todayFinishs = finishOutputTransactions.filter((tx: any) => {
        const d = new Date(tx.occurred_at); const n = new Date();
        return d.toDateString() === n.toDateString();
    });

    const clearMsg = () => { setError(''); setSuccess(''); };

    const acceptSewnPiece = async (piece: any) => {
        clearMsg();
        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(piece.item_id), warehouse_id: finishingWarehouseId, type: 'receipt', quantity: Number(piece.available_qty), reason: `[Finishing Receipt] SewnID: ${piece.id} | Accepted from sewing` }) });
            setSuccess(locale === 'en' ? 'Sewn pieces received successfully!' : 'Pi\u00e8ces cousues re\u00e7ues avec succ\u00e8s !');
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitMaterialRequest = async () => {
        clearMsg();
        if (!requestForm.item_id || !requestForm.quantity) { setError(locale === 'en' ? 'Please select a material and enter quantity.' : 'Veuillez s\u00e9lectionner un mat\u00e9riel.'); return; }
        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(requestForm.item_id), warehouse_id: mainWarehouseId, type: 'reserve', quantity: Number(requestForm.quantity), reason: `[Finishing Request] ${requestForm.reason || 'Material requested for finishing'}` }) });
            setSuccess(locale === 'en' ? 'Material request submitted successfully! Pending approval.' : 'Demande soumise avec succ\u00e8s !');
            setRequestForm({ item_id: '', quantity: '', reason: '' }); await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitFinish = async () => {
        clearMsg();
        if (!finishForm.item_id || !finishForm.quantity) { setError(locale === 'en' ? 'Please select a sewn piece and enter the quantity finishn.' : 'Veuillez s\u00e9lectionner une pi\u00e8ce coup\u00e9e et entrer la quantit\u00e9 cousue.'); return; }
        
        const selectedPiece = availableFinishingStock.find(s => s.id === finishForm.item_id);
        const available = selectedPiece?.available_qty || 0;
        if (Number(finishForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the finishing floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(selectedPiece.item_id), warehouse_id: finishingWarehouseId, type: 'issue', quantity: Number(finishForm.quantity), reason: `[Finishing Output] SewnID: ${selectedPiece.id} | ${finishForm.quantity} items finished. ${finishForm.notes || ''}` }) });
            setSuccess(locale === 'en' ? 'Finishing record saved successfully!' : 'Enregistrement de finition sauvegard\u00e9 !');
            setFinishForm({ item_id: '', quantity: '', notes: '' }); await load(true);
        } catch (r: any) {
            if (/insufficient stock|stock insuffisant/i.test(String(r.message || ''))) setStockPopup(r.message);
            else setError(r.message);
        } finally { setBusy(false); }
    };

    const submitEdit = async () => {
        if (!editForm) return;
        clearMsg();
        if (!editForm.quantity) { setError(locale === 'en' ? 'Please enter the corrected quantity.' : 'Veuillez entrer la quantit\u00e9 corrig\u00e9e.'); return; }
        
        setBusy(true);
        try {
            await api(`/api/inventory/transactions/${editForm.id}/correct`, { 
                method: 'PATCH', 
                body: JSON.stringify({ quantity: Number(editForm.quantity), reason: editForm.reason }) 
            });
            setSuccess(locale === 'en' ? 'Transaction corrected successfully!' : 'Transaction corrig\u00e9e avec succ\u00e8s !');
            setEditForm(null);
            await load(true);
        } catch (r: any) {
            setError(r.message);
        } finally { setBusy(false); }
    };


    return <section className="module-page sewing-workspace">
        {stockPopup && <div className="school-modal-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setStockPopup('');
        }}>
            <section className="school-small-modal sewing-stock-popup" role="alertdialog" aria-modal="true" aria-labelledby="sewing-stock-popup-title">
                <header>
                    <span><AlertTriangle size={24}/></span>
                    <div>
                        <h2 id="sewing-stock-popup-title">{locale === 'en' ? 'Insufficient stock' : 'Stock insuffisant'}</h2>
                        <p>{stockPopup}</p>
                    </div>
                </header>
                <footer>
                    <button className="primary-btn" autoFocus onClick={() => setStockPopup('')}>{locale === 'en' ? 'OK' : 'D’accord'}</button>
                </footer>
            </section>
        </div>}

        {editForm && (
            <div className="school-modal-backdrop" role="presentation" onMouseDown={event => {
                if (event.target === event.currentTarget) setEditForm(null);
            }}>
                <section className="school-small-modal">
                    <header>
                        <div>
                            <h2>{locale === 'en' ? 'Edit Record' : 'Modifier l\'enregistrement'}</h2>
                            <p>{locale === 'en' ? 'Adjust the quantity if a mistake was made.' : 'Ajuster la quantité en cas d\'erreur.'}</p>
                        </div>
                    </header>
                    <div className="cutting-form-grid" style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <label><span>{locale === 'en' ? 'Corrected Quantity' : 'Quantit\u00e9 corrig\u00e9e'}</span>
                            <input type="number" min="0.001" step="any" style={{ width: '100%', padding: '10px' }} value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}/>
                        </label>
                        <label className="cutting-full-width"><span>{locale === 'en' ? 'Reason for correction' : 'Raison de la correction'}</span>
                            <textarea rows={3} style={{ width: '100%', padding: '10px' }} value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })}/>
                        </label>
                    </div>
                    <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--soft)', borderRadius: '0 0 18px 18px' }}>
                        <button className="secondary-btn" onClick={() => setEditForm(null)}>{locale === 'en' ? 'Cancel' : 'Annuler'}</button>
                        <button className="primary-btn" disabled={busy} onClick={submitEdit}>{busy ? (locale === 'en' ? 'Saving...' : 'Enregistrement...') : (locale === 'en' ? 'Save Correction' : 'Enregistrer la correction')}</button>
                    </footer>
                </section>
            </div>
        )}

        <div className="module-hero">
            <div className="module-title"><span><Scissors size={22}/></span>
                <div><div className="eyebrow"><i></i>{t.eyebrow}</div><h1>{t.title}</h1><p>{t.subtitle}</p></div>
            </div>
            <div className="support-actions">
                <span className="support-live"><i></i>{updated ? `${t.updated} ${updated.toLocaleTimeString()}` : t.connecting}</span>
                <button className="secondary-btn" disabled={loading} onClick={() => load()}><RefreshCw size={17}/>{t.refresh}</button>
            </div>
        </div>

        {error && <div className="admin-alert error">{error}</div>}
        {success && <div className="admin-alert success">{success}</div>}

        <div className="module-tabs" role="tablist">
            {(['request', 'materials', 'finish'] as FinishingTab[]).map(key => (
                <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                    {key === 'request' && <Package size={16}/>}
                    {key === 'materials' && <Package size={16}/>}
                    {key === 'finish' && <Scissors size={16}/>}
                    <span>{t.tabs[key]}</span>
                </button>
            ))}
        </div>

        {loading && !stock.length ? <div className="panel" style={{padding:'3rem',textAlign:'center',opacity:.7}}>{t.loading}</div> :

        /* ─── Request Fabrics ─── */
        tab === 'request' ? <div className="sewing-tab-content">
            <article className="panel">
                <div className="panel-title"><h2>{locale === 'en' ? 'Pending Sewn Pieces' : 'Pi\u00e8ces cousues en attente'}</h2></div>
                <p className="cutting-form-desc" style={{ padding: '0 20px' }}>{locale === 'en' ? 'Accept sewn pieces from the sewing department to start finishing.' : 'Acceptez les pi\u00e8ces cousues du d\u00e9partement de couture pour commencer \u00e0 finir.'}</p>
                <div className="admin-table-wrap"><table className="admin-table">
                    <thead><tr><th>{locale === 'en' ? 'Sewn Batch Details' : 'D\u00e9tails du lot'}</th><th>{locale === 'en' ? 'Quantity' : 'Quantit\u00e9'}</th><th>{locale === 'en' ? 'Action' : 'Action'}</th></tr></thead>
                    <tbody>
                        {requestableItems.length ? requestableItems.map((item: any) => <tr key={item.id}>
                            <td><b>{item.name}</b></td>
                            <td>{num(item.available_qty)}</td>
                            <td><button className="primary-btn" disabled={busy} onClick={() => acceptSewnPiece(item)}>{locale === 'en' ? 'Accept' : 'Accepter'}</button></td>
                        </tr>) : <tr><td colSpan={3} className="empty-cell">{locale === 'en' ? 'No pending pieces from sewing.' : 'Aucune pi\u00e8ce en attente de la couture.'}</td></tr>}
                    </tbody>
                </table></div>
            </article>
            <article className="panel">
                <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{acceptedSewnPieces.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Sewn Product' : 'Produit cousu'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead><tbody>
                    {acceptedSewnPieces.length ? acceptedSewnPieces.map((tx: any) => {
                        let productName = tx.item_name;
                        const match = String(tx.reason || '').match(/SewnID:\s*\d+-([^-]+)-([^-]*)-([^\s|]+)/);
                        if (match) productName = `${match[1]}${match[2] ? ` / ${match[2]}` : ''} (${match[3]}) - ${tx.item_name}`;
                        return <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{productName}</b></td><td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td><td>{String(tx.reason || '').replace('[Finishing Receipt] ', '')}</td></tr>
                    }) : <tr><td colSpan={4} className="empty-cell">{t.noRequests}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        /* ─── Request Materials ─── */
        : tab === 'materials' ? <div className="sewing-tab-content">
            <article className="panel cutting-form-panel">
                <div className="panel-title"><h2>{t.materialsTitle || 'Request raw materials'}</h2></div>
                <p className="cutting-form-desc">{t.materialsDesc || 'Request materials like buttons, thread, or labels from the main warehouse.'}</p>
                <div className="cutting-form-grid">
                    <label><span>{t.selectItem}</span>
                        <select value={requestForm.item_id} onChange={e => setRequestForm({ ...requestForm, item_id: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose material \u2014' : '\u2014 Choisir un mat\u00e9riel \u2014'}</option>
                            {requestableMaterials.map((item: any) => <option key={item.id} value={item.item_id}>{item.name} ({num(item.quantity_on_hand)} {locale === 'en' ? 'in stock' : 'en stock'})</option>)}
                        </select>
                    </label>
                    <label><span>{t.quantity}</span>
                        <input type="number" min="0.001" step="any" placeholder={t.quantityPlaceholder} value={requestForm.quantity} onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })}/>
                    </label>
                    <label className="cutting-full-width"><span>{t.reason}</span>
                        <input type="text" placeholder={t.reasonPlaceholder} value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })}/>
                    </label>
                </div>
                <div className="cutting-form-actions">
                    <button className="primary-btn" disabled={busy} onClick={submitMaterialRequest}><Send size={17}/>{busy ? (t.requesting || 'Submitting...') : (t.requestMaterials || 'Submit request')}</button>
                </div>
            </article>
        </div>

        /* ─── Sewn Fabrics ─── */
        : tab === 'finish' ? <div className="sewing-tab-content">
            <article className="panel cutting-form-panel">
                <div className="panel-title"><h2>{t.sewnTitle}</h2></div>
                <p className="cutting-form-desc">{t.sewnDesc}</p>
                <div className="cutting-form-grid">
                    <label><span>{locale === 'en' ? 'Material used (Accepted sewn pieces)' : 'Mat\u00e9riel utilis\u00e9 (Pi\u00e8ces coup\u00e9es accept\u00e9es)'}</span>
                        <select value={finishForm.item_id} onChange={e => setFinishForm({ ...finishForm, item_id: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose sewn piece \u2014' : '\u2014 Choisir une pi\u00e8ce coup\u00e9e \u2014'}</option>
                            {availableFinishingStock.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({num(s.available_qty)} items)</option>)}
                        </select>
                    </label>
                    <label><span>{locale === 'en' ? 'Number of items finished' : 'Nombre d\'articles cousus'}</span>
                        <input type="number" min="1" step="1" placeholder={t.sewnPlaceholder} value={finishForm.quantity} onChange={e => setFinishForm({ ...finishForm, quantity: e.target.value })}/>
                    </label>
                    <label className="cutting-full-width"><span>{locale === 'en' ? 'Finishing notes' : 'Notes de finition'}</span>
                        <textarea rows={3} placeholder={locale === 'en' ? 'Any issues or observations...' : 'Tout probl\u00e8me ou observation...'} value={finishForm.notes} onChange={e => setFinishForm({ ...finishForm, notes: e.target.value })} maxLength={500}/>
                    </label>
                </div>
                <div className="cutting-form-actions">
                    <button className="primary-btn" disabled={busy} onClick={submitFinish}><Scissors size={17}/>{busy ? t.recording : t.recordSewn}</button>
                </div>
            </article>
            <article className="panel">
                <div className="panel-title"><h2>{t.recentSewns}</h2><span>{todayFinishs.length} {locale === 'en' ? 'records today' : 'enregistrements aujourd\'hui'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Output' : 'Sortie'}</th><th>{locale === 'en' ? 'Quantity finishn' : 'Quantit\u00e9 cousue'}</th><th>{locale === 'en' ? 'Details' : 'D\u00e9tails'}</th><th></th></tr></thead><tbody>
                    {todayFinishs.length ? todayFinishs.map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td>{num(Math.abs(tx.quantity_delta))}</td><td>{String(tx.reason || '').replace('[Finishing Output] ', '')}</td><td style={{textAlign: 'right'}}><button className="secondary-btn" style={{padding: '4px 8px'}} onClick={() => setEditForm({ id: tx.id, quantity: String(Math.abs(tx.quantity_delta)), reason: String(tx.reason || '') })}>{locale === 'en' ? 'Edit' : 'Modifier'}</button></td></tr>) : <tr><td colSpan={5} className="empty-cell">{t.noSewns}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        : null}
    </section>;
}
