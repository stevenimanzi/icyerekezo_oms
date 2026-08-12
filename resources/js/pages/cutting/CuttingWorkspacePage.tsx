import React, { useEffect, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, FileText,
    Package, RefreshCw, Scissors, Send,
} from 'lucide-react';

type Locale = 'en' | 'fr';
type CuttingTab = 'request' | 'cut' | 'damaged' | 'report';
type AuthUser = {
    id: number; name: string;
    current_factory: { currency_code?: string } | null;
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
        title: 'Cutting workspace',
        subtitle: 'Manage fabric requests, record cut output and track damaged materials.',
        eyebrow: 'LIVE CUTTING DATA',
        tabs: { request: 'Request fabrics', cut: 'Cut fabrics', damaged: 'Damaged fabrics', report: 'Cutting report' },
        requestTitle: 'Request fabrics from warehouse',
        requestDesc: 'Submit a request for fabric materials needed for your cutting operations.',
        selectItem: 'Select fabric', quantity: 'Quantity needed', reason: 'Reason / Notes',
        quantityPlaceholder: 'Enter quantity', reasonPlaceholder: 'Describe why you need this fabric\u2026',
        sendRequest: 'Submit request', sending: 'Submitting\u2026',
        pendingRequests: 'Pending requests', noRequests: 'No fabric requests submitted yet.',
        cutTitle: 'Record cut fabrics',
        cutDesc: 'Log the fabrics you have successfully cut in this session.',
        cutItem: 'Fabric used', cutQuantity: 'Amount of fabric cut',
        outputQuantity: 'Number of pieces produced', cutNotes: 'Cutting notes',
        cutPlaceholder: 'e.g., 5.5', outputPlaceholder: 'e.g., 100',
        notesPlaceholder: 'Any notes about this cutting session\u2026',
        recordCut: 'Record cut output', recording: 'Recording\u2026',
        recentCuts: 'Recent cutting records', noCuts: 'No cutting records yet. Record your first cut above.',
        damagedTitle: 'Report damaged fabrics',
        damagedDesc: 'Record fabric materials that were damaged or wasted during cutting.',
        damagedItem: 'Damaged fabric', damagedQuantity: 'Quantity damaged', damagedReason: 'Damage reason',
        damagedPlaceholder: 'Amount damaged', damagedReasonPlaceholder: 'Describe what happened (tear, miscut, stain\u2026)',
        reportDamage: 'Report damage', reporting: 'Reporting\u2026',
        recentDamage: 'Recent damage records', noDamage: 'No damage records. Good job keeping waste low!',
        reportTitle: 'Cutting summary report',
        reportDesc: 'Overview of your cutting performance, material usage, and waste tracking.',
        totalCut: 'Total cut today', totalDamaged: 'Total damaged today', wasteRate: 'Waste rate',
        pendingReqs: 'Pending requests',
        period: 'Today',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting\u2026', loading: 'Loading\u2026',
    },
    fr: {
        title: 'Espace de coupe',
        subtitle: 'G\u00e9rez les demandes de tissu, enregistrez les d\u00e9coupes et suivez les mat\u00e9riaux endommag\u00e9s.',
        eyebrow: 'DONN\u00c9ES DE COUPE EN DIRECT',
        tabs: { request: 'Demander des tissus', cut: 'Tissus coup\u00e9s', damaged: 'Tissus endommag\u00e9s', report: 'Rapport de coupe' },
        requestTitle: "Demander des tissus de l'entrep\u00f4t",
        requestDesc: 'Soumettez une demande de mat\u00e9riaux tissus n\u00e9cessaires pour vos op\u00e9rations de coupe.',
        selectItem: 'S\u00e9lectionner le tissu', quantity: 'Quantit\u00e9 n\u00e9cessaire', reason: 'Motif / Notes',
        quantityPlaceholder: 'Saisissez la quantit\u00e9', reasonPlaceholder: 'D\u00e9crivez pourquoi vous avez besoin de ce tissu\u2026',
        sendRequest: 'Soumettre la demande', sending: 'Envoi en cours\u2026',
        pendingRequests: 'Demandes en attente', noRequests: 'Aucune demande de tissu soumise.',
        cutTitle: 'Enregistrer les tissus coup\u00e9s',
        cutDesc: 'Enregistrez les tissus que vous avez d\u00e9coup\u00e9s avec succ\u00e8s dans cette session.',
        cutItem: 'Tissu utilisé', cutQuantity: 'Quantité de tissu coupé',
        outputQuantity: 'Nombre de pièces', cutNotes: 'Notes de coupe',
        cutPlaceholder: 'ex: 5.5', outputPlaceholder: 'ex: 100',
        notesPlaceholder: 'Notes sur cette session de coupe\u2026',
        recordCut: 'Enregistrer la coupe', recording: 'Enregistrement\u2026',
        recentCuts: 'Coupes r\u00e9centes', noCuts: 'Aucune coupe enregistr\u00e9e. Enregistrez votre premi\u00e8re coupe ci-dessus.',
        damagedTitle: 'Signaler les tissus endommag\u00e9s',
        damagedDesc: 'Enregistrez les mat\u00e9riaux endommag\u00e9s ou gaspill\u00e9s pendant la coupe.',
        damagedItem: 'Tissu endommag\u00e9', damagedQuantity: 'Quantit\u00e9 endommag\u00e9e', damagedReason: 'Motif du dommage',
        damagedPlaceholder: 'Quantit\u00e9 endommag\u00e9e', damagedReasonPlaceholder: "D\u00e9crivez ce qui s'est pass\u00e9 (d\u00e9chirure, mauvaise coupe, tache\u2026)",
        reportDamage: 'Signaler le dommage', reporting: 'Signalement\u2026',
        recentDamage: 'Dommages r\u00e9cents', noDamage: 'Aucun dommage enregistr\u00e9. Bravo pour la r\u00e9duction des d\u00e9chets !',
        reportTitle: 'Rapport de coupe',
        reportDesc: "Aper\u00e7u de vos performances de coupe, utilisation des mat\u00e9riaux et suivi des d\u00e9chets.",
        totalCut: "Total coup\u00e9 aujourd'hui", totalDamaged: "Total endommag\u00e9 aujourd'hui", wasteRate: 'Taux de d\u00e9chet',
        pendingReqs: 'Demandes en attente',
        period: "Aujourd'hui",
        refresh: 'Actualiser', updated: 'Mis \u00e0 jour', connecting: 'Connexion\u2026', loading: 'Chargement\u2026',
    },
};

export default function CuttingWorkspacePage({ user, locale, initialTab = 'request' }: { user: AuthUser; locale: Locale; initialTab?: CuttingTab }) {
    const t = copy[locale];
    const [tab, setTab] = useState<CuttingTab>(initialTab);
    const [items, setItems] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [stockPopup, setStockPopup] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    const [requestForm, setRequestForm] = useState({ item_id: '', quantity: '', reason: '' });
    const [cutForm, setCutForm] = useState({ item_id: '', quantity: '', output_style: '', output_size: '', output_quantity: '', notes: '' });
    const [damageForm, setDamageForm] = useState({ item_id: '', quantity: '', reason: '' });

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await api<any>('/api/inventory/overview');
            setStock(overview.stock || []);
            setTransactions(overview.recent_transactions || overview.transactions || []);
            setItems(overview.catalog || []);
            setWarehouses(overview.warehouse_list || []);
            setUpdated(new Date());
            setError('');
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { load(); const timer = window.setInterval(() => load(true), 10000); return () => window.clearInterval(timer); }, []);

    const fabricItems = items.filter((item: any) =>
        ['raw_material', 'component', 'material'].includes(String(item.type || '').toLowerCase()) ||
        /fabric|tissu|cloth|cotton|silk|linen|polyester|textile|material/i.test(String(item.name || ''))
    );
    const cuttingWarehouseId = warehouses.find(w => w.code === 'CUT' || /cutting/i.test(w.name))?.id || 1;
    const mainWarehouseId = warehouses.find(w => w.code === 'MAIN' || /main/i.test(w.name))?.id || 1;
    
    const requestableItems = (fabricItems.length > 0 ? fabricItems : items)
        .map((item: any) => {
            const qty = stock.find(s => s.item_id === item.id && s.warehouse_id === mainWarehouseId)?.quantity_on_hand || 0;
            return { ...item, available_qty: Number(qty) };
        })
        .filter((item: any) => item.available_qty > 0);

    const cuttingStock = stock.filter(s => s.warehouse_id === cuttingWarehouseId && s.quantity_on_hand > 0);

    const cuttingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve'].includes(String(tx.type || ''))
    );
    const cutOutputTransactions = cuttingTransactions.filter((tx: any) =>
        tx.type === 'issue' &&
        tx.warehouse_id === cuttingWarehouseId &&
        String(tx.reason || '').startsWith('[Cut Output]')
    );
    const todayCuts = cutOutputTransactions.filter((tx: any) => {
        const d = new Date(tx.occurred_at); const n = new Date();
        return d.toDateString() === n.toDateString();
    });
    const todayDamage = cuttingTransactions.filter((tx: any) => {
        const d = new Date(tx.occurred_at); const n = new Date();
        return d.toDateString() === n.toDateString() && ['waste', 'adjustment_out'].includes(tx.type);
    });

    const totalCutQty = todayCuts.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const totalDamagedQty = todayDamage.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const wastePercent = totalCutQty + totalDamagedQty > 0 ? ((totalDamagedQty / (totalCutQty + totalDamagedQty)) * 100).toFixed(1) : '0.0';
    const clearMsg = () => { setError(''); setSuccess(''); };
    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const submitRequest = async () => {
        clearMsg();
        if (!requestForm.item_id || !requestForm.quantity) { setError(locale === 'en' ? 'Please select a fabric and enter the quantity.' : 'Veuillez s\u00e9lectionner un tissu et entrer la quantit\u00e9.'); return; }
        const available = requestableItems.find(i => i.id === Number(requestForm.item_id))?.available_qty || 0;
        if (Number(requestForm.quantity) > available) {
            setError(locale === 'en' ? `Insufficient stock in the main warehouse. Only ${num(available)} available.` : `Stock insuffisant. Seulement ${num(available)} disponible.`);
            return;
        }
        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(requestForm.item_id), warehouse_id: mainWarehouseId, type: 'reserve', quantity: Number(requestForm.quantity), reason: `[Cutting Request] ${requestForm.reason || 'Fabric needed for cutting operations'}` }) });
            setSuccess(locale === 'en' ? 'Fabric request submitted successfully! Pending storekeeper approval.' : 'Demande de tissu soumise avec succ\u00e8s ! En attente d\'approbation.');
            setRequestForm({ item_id: '', quantity: '', reason: '' }); await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitCut = async () => {
        clearMsg();
        if (!cutForm.item_id || !cutForm.quantity) { setError(locale === 'en' ? 'Please select a fabric and enter the quantity cut.' : 'Veuillez s\u00e9lectionner un tissu et entrer la quantit\u00e9 coup\u00e9e.'); return; }
        
        const available = cuttingStock.find(s => s.item_id === Number(cutForm.item_id))?.quantity_on_hand || 0;
        if (Number(cutForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the cutting floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(cutForm.item_id), warehouse_id: cuttingWarehouseId, type: 'issue', quantity: Number(cutForm.quantity), reason: `[Cut Output] ${cutForm.notes || 'Fabric cut for production'}${cutForm.output_quantity ? ` | ${cutForm.output_quantity}x ${cutForm.output_style} (${cutForm.output_size}) produced` : ''}` }) });
            setSuccess(locale === 'en' ? 'Cut record saved successfully!' : 'Enregistrement de coupe sauvegard\u00e9 !');
            setCutForm({ item_id: '', quantity: '', output_style: '', output_size: '', output_quantity: '', notes: '' }); await load(true);
        } catch (r: any) {
            if (/insufficient stock|stock insuffisant/i.test(String(r.message || ''))) setStockPopup(r.message);
            else setError(r.message);
        } finally { setBusy(false); }
    };

    const submitDamage = async () => {
        clearMsg();
        if (!damageForm.item_id || !damageForm.quantity) { setError(locale === 'en' ? 'Please select a fabric and enter the damaged quantity.' : 'Veuillez s\u00e9lectionner un tissu et entrer la quantit\u00e9 endommag\u00e9e.'); return; }
        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(damageForm.item_id), warehouse_id: cuttingWarehouseId, type: 'waste', quantity: Number(damageForm.quantity), reason: `[Cutting Damage] ${damageForm.reason || 'Material damaged during cutting'}` }) });
            setSuccess(locale === 'en' ? 'Damage report submitted successfully!' : 'Rapport de dommage soumis avec succ\u00e8s !');
            setDamageForm({ item_id: '', quantity: '', reason: '' }); await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    return <section className="module-page cutting-workspace">
        {stockPopup && <div className="school-modal-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setStockPopup('');
        }}>
            <section className="school-small-modal cutting-stock-popup" role="alertdialog" aria-modal="true" aria-labelledby="cutting-stock-popup-title">
                <header>
                    <span><AlertTriangle size={24}/></span>
                    <div>
                        <h2 id="cutting-stock-popup-title">{locale === 'en' ? 'Insufficient stock' : 'Stock insuffisant'}</h2>
                        <p>{stockPopup}</p>
                    </div>
                </header>
                <footer>
                    <button className="primary-btn" autoFocus onClick={() => setStockPopup('')}>{locale === 'en' ? 'OK' : 'D’accord'}</button>
                </footer>
            </section>
        </div>}
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
            {(['request', 'cut', 'damaged', 'report'] as CuttingTab[]).map(key => (
                <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                    {key === 'request' && <Package size={16}/>}
                    {key === 'cut' && <Scissors size={16}/>}
                    {key === 'damaged' && <AlertTriangle size={16}/>}
                    {key === 'report' && <FileText size={16}/>}
                    <span>{t.tabs[key]}</span>
                </button>
            ))}
        </div>

        {loading && !stock.length ? <div className="panel" style={{padding:'3rem',textAlign:'center',opacity:.7}}>{t.loading}</div> :

        /* ─── Request Fabrics ─── */
        tab === 'request' ? <div className="cutting-tab-content">
            <article className="panel cutting-form-panel">
                <div className="panel-title"><h2>{t.requestTitle}</h2></div>
                <p className="cutting-form-desc">{t.requestDesc}</p>
                <div className="cutting-form-grid">
                    <label><span>{t.selectItem}</span>
                        <select value={requestForm.item_id} onChange={e => setRequestForm({ ...requestForm, item_id: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose fabric \u2014' : '\u2014 Choisir un tissu \u2014'}</option>
                            {requestableItems.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({num(item.available_qty)} {locale === 'en' ? 'in stock' : 'en stock'})</option>)}
                        </select>
                    </label>
                    <label><span>{t.quantity}</span>
                        <input type="number" min="0.001" step="any" placeholder={t.quantityPlaceholder} value={requestForm.quantity} onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })}/>
                    </label>
                    <label className="cutting-full-width"><span>{t.reason}</span>
                        <textarea rows={3} placeholder={t.reasonPlaceholder} value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} maxLength={500}/>
                    </label>
                </div>
                <div className="cutting-form-actions">
                    <button className="primary-btn" disabled={busy} onClick={submitRequest}><Send size={17}/>{busy ? t.sending : t.sendRequest}</button>
                </div>
            </article>
            <article className="panel">
                <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{cuttingTransactions.filter(tx => tx.type === 'reserve').length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead><tbody>
                    {cuttingTransactions.filter(tx => tx.type === 'reserve').length ? cuttingTransactions.filter(tx => tx.type === 'reserve').map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td><td>{String(tx.reason || '').replace('[Cutting Request] ', '')}</td></tr>) : <tr><td colSpan={4} className="empty-cell">{t.noRequests}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        /* ─── Cut Fabrics ─── */
        : tab === 'cut' ? <div className="cutting-tab-content">
            <article className="panel cutting-form-panel">
                <div className="panel-title"><h2>{t.cutTitle}</h2></div>
                <p className="cutting-form-desc">{t.cutDesc}</p>
                <div className="cutting-form-grid cut-3-cols">
                    <label><span>{t.cutItem}</span>
                        <select value={cutForm.item_id} onChange={e => setCutForm({ ...cutForm, item_id: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose fabric in stock \u2014' : '\u2014 Choisir un tissu en stock \u2014'}</option>
                            {cuttingStock.map((s: any) => <option key={s.item_id} value={s.item_id}>{s.item_name} ({num(s.quantity_on_hand)} {s.unit})</option>)}
                        </select>
                    </label>
                    <label><span>{t.cutQuantity}</span>
                        <input type="number" min="0.001" step="any" placeholder={t.cutPlaceholder} value={cutForm.quantity} onChange={e => setCutForm({ ...cutForm, quantity: e.target.value })}/>
                    </label>
                    <label><span>{locale === 'en' ? 'Style produced' : 'Style produit'}</span>
                        <select value={cutForm.output_style} onChange={e => setCutForm({ ...cutForm, output_style: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose style \u2014' : '\u2014 Choisir un style \u2014'}</option>
                            <option value="Shirt">Shirt / Chemise</option>
                            <option value="Skirt">Skirt / Jupe</option>
                            <option value="Short">Short</option>
                            <option value="Trousers">Trousers / Pantalon</option>
                            <option value="Dress">Dress / Robe</option>
                        </select>
                    </label>
                    <label><span>{locale === 'en' ? 'Size' : 'Taille'}</span>
                        <select value={cutForm.output_size} onChange={e => setCutForm({ ...cutForm, output_size: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose size \u2014' : '\u2014 Choisir la taille \u2014'}</option>
                            {['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                        </select>
                    </label>
                    <label><span>{t.outputQuantity}</span>
                        <input type="number" min="1" step="1" placeholder={t.outputPlaceholder} value={cutForm.output_quantity} onChange={e => setCutForm({ ...cutForm, output_quantity: e.target.value })}/>
                    </label>
                    <label className="cutting-full-width"><span>{t.cutNotes}</span>
                        <textarea rows={2} placeholder={t.notesPlaceholder} value={cutForm.notes} onChange={e => setCutForm({ ...cutForm, notes: e.target.value })} maxLength={500}/>
                    </label>
                </div>
                <div className="cutting-form-actions">
                    <button className="primary-btn" disabled={busy} onClick={submitCut}><Scissors size={17}/>{busy ? t.recording : t.recordCut}</button>
                </div>
            </article>
            <article className="panel">
                <div className="panel-title"><h2>{t.recentCuts}</h2><span>{cutOutputTransactions.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity used' : 'Quantit\u00e9 utilis\u00e9e'}</th><th>{locale === 'en' ? 'Details' : 'D\u00e9tails'}</th></tr></thead><tbody>
                    {cutOutputTransactions.length ? cutOutputTransactions.map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td><td>{String(tx.reason || '').replace('[Cut Output] ', '')}</td></tr>) : <tr><td colSpan={4} className="empty-cell">{t.noCuts}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        /* ─── Damaged Fabrics ─── */
        : tab === 'damaged' ? <div className="cutting-tab-content">
            <article className="panel cutting-form-panel">
                <div className="panel-title"><h2>{t.damagedTitle}</h2></div>
                <p className="cutting-form-desc">{t.damagedDesc}</p>
                <div className="cutting-form-grid">
                    <label><span>{locale === 'en' ? 'Damaged fabric' : 'Tissu endommag\u00e9'}</span>
                        <select value={damageForm.item_id} onChange={e => setDamageForm({ ...damageForm, item_id: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose fabric in stock \u2014' : '\u2014 Choisir un tissu en stock \u2014'}</option>
                            {cuttingStock.map((s: any) => <option key={s.item_id} value={s.item_id}>{s.item_name} ({num(s.quantity_on_hand)} {s.unit})</option>)}
                        </select>
                    </label>
                    <label><span>{t.damagedQuantity}</span>
                        <input type="number" min="0.001" step="any" placeholder={t.damagedPlaceholder} value={damageForm.quantity} onChange={e => setDamageForm({ ...damageForm, quantity: e.target.value })}/>
                    </label>
                    <label className="cutting-full-width"><span>{t.damagedReason}</span>
                        <textarea rows={3} placeholder={t.damagedReasonPlaceholder} value={damageForm.reason} onChange={e => setDamageForm({ ...damageForm, reason: e.target.value })} maxLength={500}/>
                    </label>
                </div>
                <div className="cutting-form-actions">
                    <button className="primary-btn cutting-damage-btn" disabled={busy} onClick={submitDamage}><AlertTriangle size={17}/>{busy ? t.reporting : t.reportDamage}</button>
                </div>
            </article>
            <article className="panel">
                <div className="panel-title"><h2>{t.recentDamage}</h2><span>{cuttingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type)).length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity wasted' : 'Quantit\u00e9 perdue'}</th><th>{locale === 'en' ? 'Reason' : 'Motif'}</th></tr></thead><tbody>
                    {cuttingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type)).length ? cuttingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type)).map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td><span className="admin-status warning">{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</span></td><td>{String(tx.reason || '').replace('[Cutting Damage] ', '')}</td></tr>) : <tr><td colSpan={4} className="empty-cell">{t.noDamage}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        /* ─── Report ─── */
        : <div className="cutting-tab-content">
            <div className="cutting-report-metrics">
                <article className="panel cutting-metric"><div className="cutting-metric-icon blue"><Scissors size={22}/></div><div><small>{t.totalCut}</small><strong>{num(totalCutQty)}</strong><p>{t.period}</p></div></article>
                <article className="panel cutting-metric"><div className="cutting-metric-icon amber"><AlertTriangle size={22}/></div><div><small>{t.totalDamaged}</small><strong>{num(totalDamagedQty)}</strong><p>{t.period}</p></div></article>
                <article className="panel cutting-metric"><div className="cutting-metric-icon green"><CheckCircle2 size={22}/></div><div><small>{t.wasteRate}</small><strong>{wastePercent}%</strong><p>{Number(wastePercent) < 5 ? 'Excellent' : Number(wastePercent) < 10 ? (locale === 'en' ? 'Good' : 'Bon') : (locale === 'en' ? 'Needs attention' : '\u00c0 surveiller')}</p></div></article>
                <article className="panel cutting-metric"><div className="cutting-metric-icon violet"><Package size={22}/></div><div><small>{t.pendingReqs}</small><strong>{cuttingTransactions.filter(tx => tx.type === 'reserve').length}</strong><p>{locale === 'en' ? 'Awaiting' : 'En attente'}</p></div></article>
            </div>
            <article className="panel">
                <div className="panel-title"><h2>{locale === 'en' ? 'All cutting activity' : "Toute l'activit\u00e9 de coupe"}</h2><span>{cuttingTransactions.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Type' : 'Type'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity' : 'Quantit\u00e9'}</th><th>{locale === 'en' ? 'Details' : 'D\u00e9tails'}</th></tr></thead><tbody>
                    {cuttingTransactions.length ? cuttingTransactions.map((tx: any) => {
                        const lbl = tx.type === 'issue' ? (locale === 'en' ? 'Cut' : 'Coup\u00e9') : tx.type === 'waste' ? (locale === 'en' ? 'Damaged' : 'Endommag\u00e9') : tx.type === 'reserve' ? (locale === 'en' ? 'Requested' : 'Demand\u00e9') : tx.type === 'production_output' ? (locale === 'en' ? 'Output' : 'Produit') : String(tx.type).replaceAll('_', ' ');
                        const tone = tx.type === 'waste' || tx.type === 'adjustment_out' ? 'warning' : tx.type === 'issue' ? 'active' : 'info';
                        return <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><span className={`admin-status ${tone}`}>{lbl}</span></td><td><b>{tx.item_name}</b></td><td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td><td>{String(tx.reason || '\u2014').replace(/\[.*?\]\s*/, '')}</td></tr>;
                    }) : <tr><td colSpan={5} className="empty-cell">{locale === 'en' ? 'No cutting activity recorded yet.' : "Aucune activit\u00e9 de coupe enregistr\u00e9e."}</td></tr>}
                </tbody></table></div>
            </article>
        </div>}
    </section>;
}
