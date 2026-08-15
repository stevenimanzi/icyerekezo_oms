import React, { useEffect, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, FileText,
    Package, RefreshCw, Scissors, Send,
} from 'lucide-react';

type Locale = 'en' | 'fr';
type SewingTab = 'request' | 'sew' | 'damaged' | 'report';
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
        title: 'Sewing workspace',
        subtitle: 'Manage received pieces, record sewn output and track damaged materials.',
        eyebrow: 'LIVE SEWING DATA',
        tabs: { request: 'Receive pieces', sew: 'Sew pieces', damaged: 'Damaged pieces', report: 'Sewing report' },
        requestTitle: 'Receive pieces from cutting',
        requestDesc: 'Log the receipt of cut pieces needed for your sewing operations.',
        selectItem: 'Select piece/material', quantity: 'Quantity received', reason: 'Reason / Notes',
        quantityPlaceholder: 'Enter quantity', reasonPlaceholder: 'Describe what you received...',
        sendRequest: 'Log receipt', sending: 'Logging...',
        pendingRequests: 'Recent receipts', noRequests: 'No piece receipts logged yet.',
        cutTitle: 'Record sewn items',
        cutDesc: 'Log the items you have successfully sewn in this session.',
        cutItem: 'Material used', cutQuantity: 'Quantity used',
        outputQuantity: 'Number of items sewn', cutNotes: 'Sewing notes',
        cutPlaceholder: 'e.g., 50', outputPlaceholder: 'e.g., 50',
        notesPlaceholder: 'Any notes about this sewing session...',
        recordCut: 'Record sewing output', recording: 'Recording...',
        recentCuts: 'Recent sewing records', noCuts: 'No sewing records yet. Record your first sew above.',
        damagedTitle: 'Report damaged pieces',
        damagedDesc: 'Record materials that were damaged or rejected during sewing.',
        damagedItem: 'Damaged item', damagedQuantity: 'Quantity damaged', damagedReason: 'Damage reason',
        damagedPlaceholder: 'Amount damaged', damagedReasonPlaceholder: 'Describe what happened (stitch error, tear...)',
        reportDamage: 'Report damage', reporting: 'Reporting...',
        recentDamage: 'Recent damage records', noDamage: 'No damage records. Good job keeping waste low!',
        reportTitle: 'Sewing summary report',
        reportDesc: 'Overview of your sewing performance, material usage, and waste tracking.',
        totalCut: 'Total sewn today', totalDamaged: 'Total damaged today', wasteRate: 'Rejection rate',
        pendingReqs: 'Recent receipts',
        period: 'Today',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting...', loading: 'Loading...',
    },
    fr: {
        title: 'Espace de couture',
        subtitle: 'G\u00e9rez les pi\u00e8ces re\u00e7ues, enregistrez la couture et suivez les rejets.',
        eyebrow: 'DONN\u00c9ES DE COUTURE EN DIRECT',
        tabs: { request: 'R\u00e9ceptionner', sew: 'Coudre', damaged: 'Pi\u00e8ces endommag\u00e9es', report: 'Rapport de couture' },
        requestTitle: "R\u00e9ceptionner les pi\u00e8ces de la coupe",
        requestDesc: 'Enregistrez la r\u00e9ception des pi\u00e8ces coup\u00e9es n\u00e9cessaires pour la couture.',
        selectItem: 'S\u00e9lectionner la pi\u00e8ce', quantity: 'Quantit\u00e9 re\u00e7ue', reason: 'Motif / Notes',
        quantityPlaceholder: 'Saisissez la quantit\u00e9', reasonPlaceholder: 'D\u00e9crivez ce que vous avez re\u00e7u...',
        sendRequest: 'Enregistrer', sending: 'Enregistrement...',
        pendingRequests: 'R\u00e9ceptions r\u00e9centes', noRequests: 'Aucune r\u00e9ception enregistr\u00e9e.',
        cutTitle: 'Enregistrer les articles cousus',
        cutDesc: 'Enregistrez les articles que vous avez cousus avec succ\u00e8s.',
        cutItem: 'Mat\u00e9riel utilis\u00e9', cutQuantity: 'Quantit\u00e9 utilis\u00e9e',
        outputQuantity: 'Nombre d\'articles', cutNotes: 'Notes de couture',
        cutPlaceholder: 'ex: 50', outputPlaceholder: 'ex: 50',
        notesPlaceholder: 'Notes sur cette session de couture...',
        recordCut: 'Enregistrer la couture', recording: 'Enregistrement...',
        recentCuts: 'Coutures r\u00e9centes', noCuts: 'Aucune couture enregistr\u00e9e.',
        damagedTitle: 'Signaler les pi\u00e8ces endommag\u00e9es',
        damagedDesc: 'Enregistrez les mat\u00e9riaux endommag\u00e9s ou rejet\u00e9s pendant la couture.',
        damagedItem: 'Article endommag\u00e9', damagedQuantity: 'Quantit\u00e9', damagedReason: 'Motif du dommage',
        damagedPlaceholder: 'Quantit\u00e9', damagedReasonPlaceholder: "D\u00e9crivez ce qui s'est pass\u00e9",
        reportDamage: 'Signaler', reporting: 'Signalement...',
        recentDamage: 'Dommages r\u00e9cents', noDamage: 'Aucun dommage enregistr\u00e9.',
        reportTitle: 'Rapport de couture',
        reportDesc: "Aper\u00e7u de vos performances de couture.",
        totalCut: "Cousu aujourd'hui", totalDamaged: "Rejet\u00e9 aujourd'hui", wasteRate: 'Taux de rejet',
        pendingReqs: 'R\u00e9ceptions',
        period: "Aujourd'hui",
        refresh: 'Actualiser', updated: 'Mis \u00e0 jour', connecting: 'Connexion...', loading: 'Chargement...',
    },
};

export default function SewingWorkspacePage({ user, locale, initialTab = 'request' }: { user: AuthUser; locale: Locale; initialTab?: SewingTab }) {
    const t = copy[locale];
    const [tab, setTab] = useState<SewingTab>(initialTab);
    const [items, setItems] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [cutPieces, setCutPieces] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [stockPopup, setStockPopup] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);
    const [reportFrom, setReportFrom] = useState('');
    const [reportTo, setReportTo] = useState('');

    const [requestForm, setRequestForm] = useState({ item_id: '', quantity: '', reason: '' });
    const [sewForm, setSewForm] = useState({ item_id: '', quantity: '', output_style: '', output_color: '', output_size: '', output_quantity: '', notes: '' });
    const [damageForm, setDamageForm] = useState({ item_id: '', quantity: '', reason: '' });

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await api<any>('/api/inventory/overview');
            setStock(overview.stock || []);
            setItems(overview.items || []);
            setTransactions(overview.recent_transactions || overview.transactions || []);
            setCutPieces(overview.cut_pieces || []);
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

    const sewingWarehouseId = warehouses.find(w => w.code === 'SEW' || /sewing/i.test(w.name))?.id || 1;
    
    const requestableItems = cutPieces;

    const sewingStock = stock.filter(s => s.warehouse_id === sewingWarehouseId && s.quantity_on_hand > 0);
    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const sewingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve', 'receipt'].includes(String(tx.type || ''))
    );
    const sewOutputTransactions = sewingTransactions.filter((tx: any) =>
        tx.type === 'issue' &&
        tx.warehouse_id === sewingWarehouseId &&
        String(tx.reason || '').startsWith('[Sewing Output]')
    );
    const sewReportRows = sewOutputTransactions.map((tx: any) => {
        const details = String(tx.reason || '').replace('[Sewing Output] ', '');
        const output = details.match(/\|\s*([\d,.]+)x\s+(.+?)(?:\s+\/\s+(.+?))?\s+\(([^)]+)\)\s+produced/i);
        const fabricName = String(tx.item_name || '');
        const color = fabricName.match(/\b(green|blue|red|yellow|black|white|navy|grey|gray|brown|orange|purple|pink|beige|cream)\b/i)?.[1] || '\u2014';
        return {
            ...tx,
            inputColor: color,
            outputStyle: output?.[2]?.trim() || '\u2014',
            outputColor: color,
            outputSize: output?.[4]?.trim() || '\u2014',
            outputQuantity: output?.[1] ? num(Number(output[1].replaceAll(',', ''))) : '\u2014',
        };
    });
    const filteredSewReportRows = sewReportRows.filter((row: any) => {
        const date = new Date(row.occurred_at);
        const from = reportFrom ? new Date(`${reportFrom}T00:00:00`) : null;
        const to = reportTo ? new Date(`${reportTo}T23:59:59.999`) : null;
        return (!from || date >= from) && (!to || date <= to);
    });

    const todaySews = sewOutputTransactions.filter((tx: any) => {
        const d = new Date(tx.occurred_at); const n = new Date();
        return d.toDateString() === n.toDateString();
    });
    const todayDamage = sewingTransactions.filter((tx: any) => {
        const d = new Date(tx.occurred_at); const n = new Date();
        return d.toDateString() === n.toDateString() && ['waste', 'adjustment_out'].includes(tx.type);
    });

    const totalSewnQty = todaySews.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const totalDamagedQty = todayDamage.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const wastePercent = totalSewnQty + totalDamagedQty > 0 ? ((totalDamagedQty / (totalSewnQty + totalDamagedQty)) * 100).toFixed(1) : '0.0';
    const clearMsg = () => { setError(''); setSuccess(''); };

    const submitRequest = async () => {
        clearMsg();
        if (!requestForm.item_id || !requestForm.quantity) { setError(locale === 'en' ? 'Please select an item and enter the quantity.' : 'Veuillez s\u00e9lectionner un article et entrer la quantit\u00e9.'); return; }
        const selectedPiece = requestableItems.find(i => i.id === requestForm.item_id);
        if (!selectedPiece) return;
        const available = selectedPiece.available_qty || 0;
        if (Number(requestForm.quantity) > available) { setError(locale === 'en' ? `Cannot request more than ${available} available in stock.` : `Impossible de demander plus que ${available} disponible en stock.`); return; }
        setBusy(true);
        try {
            const originalItemId = selectedPiece.item_id;
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(originalItemId), warehouse_id: sewingWarehouseId, type: 'receipt', quantity: Number(requestForm.quantity), reason: `[Sewing Receipt] CutID: ${selectedPiece.id} | ${requestForm.reason || 'Received cut pieces for sewing'}` }) });
            setSuccess(locale === 'en' ? 'Cut pieces received successfully!' : 'Pi\u00e8ces coup\u00e9es re\u00e7ues avec succ\u00e8s !');
            setRequestForm({ item_id: '', quantity: '', reason: '' }); await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitSew = async () => {
        clearMsg();
        if (!sewForm.item_id || !sewForm.quantity) { setError(locale === 'en' ? 'Please select a fabric and enter the quantity cut.' : 'Veuillez s\u00e9lectionner un tissu et entrer la quantit\u00e9 coup\u00e9e.'); return; }
        
        const available = sewingStock.find(s => s.item_id === Number(sewForm.item_id))?.quantity_on_hand || 0;
        if (Number(sewForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the cutting floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(sewForm.item_id), warehouse_id: sewingWarehouseId, type: 'issue', quantity: Number(sewForm.quantity), reason: `[Sewing Output] ${sewForm.notes || 'Fabric cut for production'}${sewForm.output_quantity ? ` | ${sewForm.output_quantity}x ${sewForm.output_style}${sewForm.output_color ? ` / ${sewForm.output_color}` : ''} (${sewForm.output_size}) produced` : ''}` }) });
            setSuccess(locale === 'en' ? 'Cut record saved successfully!' : 'Enregistrement de coupe sauvegard\u00e9 !');
            setSewForm({ item_id: '', quantity: '', output_style: '', output_color: '', output_size: '', output_quantity: '', notes: '' }); await load(true);
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
            await api('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({ item_id: Number(damageForm.item_id), warehouse_id: sewingWarehouseId, type: 'waste', quantity: Number(damageForm.quantity), reason: `[Sewing Damage] ${damageForm.reason || 'Material damaged during cutting'}` }) });
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
            {(['request', 'sew', 'damaged', 'report'] as SewingTab[]).map(key => (
                <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                    {key === 'request' && <Package size={16}/>}
                    {key === 'sew' && <Scissors size={16}/>}
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
                <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{sewingTransactions.filter(tx => tx.type === 'receipt').length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead><tbody>
                    {sewingTransactions.filter(tx => tx.type === 'receipt').length ? sewingTransactions.filter(tx => tx.type === 'receipt').map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td><td>{String(tx.reason || '').replace('[Sewing Receipt] ', '')}</td></tr>) : <tr><td colSpan={4} className="empty-cell">{t.noRequests}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        /* ─── Cut Fabrics ─── */
        : tab === 'sew' ? <div className="cutting-tab-content">
            <article className="panel cutting-form-panel">
                <div className="panel-title"><h2>{t.cutTitle}</h2></div>
                <p className="cutting-form-desc">{t.cutDesc}</p>
                <div className="cutting-form-grid sew-3-cols">
                    <label><span>{t.cutItem}</span>
                        <select value={sewForm.item_id} onChange={e => setSewForm({ ...sewForm, item_id: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose fabric in stock \u2014' : '\u2014 Choisir un tissu en stock \u2014'}</option>
                            {sewingStock.map((s: any) => <option key={s.item_id} value={s.item_id}>{s.item_name} ({num(s.quantity_on_hand)} {s.unit})</option>)}
                        </select>
                    </label>
                    <label><span>{t.cutQuantity}</span>
                        <input type="number" min="0.001" step="any" placeholder={t.cutPlaceholder} value={sewForm.quantity} onChange={e => setSewForm({ ...sewForm, quantity: e.target.value })}/>
                    </label>
                    <label><span>{locale === 'en' ? 'Style produced' : 'Style produit'}</span>
                        <select value={sewForm.output_style} onChange={e => setSewForm({ ...sewForm, output_style: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose style \u2014' : '\u2014 Choisir un style \u2014'}</option>
                            <option value="Shirt">Shirt / Chemise</option>
                            <option value="Skirt">Skirt / Jupe</option>
                            <option value="Short">Short</option>
                            <option value="Trousers">Trousers / Pantalon</option>
                            <option value="Dress">Dress / Robe</option>
                        </select>
                    </label>
                    <label><span>{locale === 'en' ? 'Size' : 'Taille'}</span>
                        <select value={sewForm.output_size} onChange={e => setSewForm({ ...sewForm, output_size: e.target.value })}>
                            <option value="">{locale === 'en' ? '\u2014 Choose size \u2014' : '\u2014 Choisir la taille \u2014'}</option>
                            {['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                        </select>
                    </label>
                    <label><span>{t.outputQuantity}</span>
                        <input type="number" min="1" step="1" placeholder={t.outputPlaceholder} value={sewForm.output_quantity} onChange={e => setSewForm({ ...sewForm, output_quantity: e.target.value })}/>
                    </label>
                    <label><span>{locale === 'en' ? 'Color produced' : 'Couleur produite'}</span>
                        <input type="text" placeholder={locale === 'en' ? 'e.g., Green' : 'ex: Vert'} value={sewForm.output_color} onChange={e => setSewForm({ ...sewForm, output_color: e.target.value })} maxLength={80}/>
                    </label>
                    <label className="cutting-full-width"><span>{t.cutNotes}</span>
                        <textarea rows={2} placeholder={t.notesPlaceholder} value={sewForm.notes} onChange={e => setSewForm({ ...sewForm, notes: e.target.value })} maxLength={500}/>
                    </label>
                </div>
                <div className="cutting-form-actions">
                    <button className="primary-btn" disabled={busy} onClick={submitSew}><Scissors size={17}/>{busy ? t.recording : t.recordCut}</button>
                </div>
            </article>
            <article className="panel">
                <div className="panel-title"><h2>{t.recentCuts}</h2><span>{sewOutputTransactions.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity used' : 'Quantit\u00e9 utilis\u00e9e'}</th><th>{locale === 'en' ? 'Details' : 'D\u00e9tails'}</th></tr></thead><tbody>
                    {sewOutputTransactions.length ? sewOutputTransactions.map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td><td>{String(tx.reason || '').replace('[Sewing Output] ', '')}</td></tr>) : <tr><td colSpan={4} className="empty-cell">{t.noCuts}</td></tr>}
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
                            {sewingStock.map((s: any) => <option key={s.item_id} value={s.item_id}>{s.item_name} ({num(s.quantity_on_hand)} {s.unit})</option>)}
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
                <div className="panel-title"><h2>{t.recentDamage}</h2><span>{sewingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type)).length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity wasted' : 'Quantit\u00e9 perdue'}</th><th>{locale === 'en' ? 'Reason' : 'Motif'}</th></tr></thead><tbody>
                    {sewingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type)).length ? sewingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type)).map((tx: any) => <tr key={tx.id}><td>{new Date(tx.occurred_at).toLocaleString()}</td><td><b>{tx.item_name}</b></td><td><span className="admin-status warning">{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</span></td><td>{String(tx.reason || '').replace('[Sewing Damage] ', '')}</td></tr>) : <tr><td colSpan={4} className="empty-cell">{t.noDamage}</td></tr>}
                </tbody></table></div>
            </article>
        </div>

        /* ─── Report ─── */
        : <div className="cutting-tab-content">
            <div className="cutting-report-metrics">
                <article className="panel cutting-metric"><div className="cutting-metric-icon blue"><Scissors size={22}/></div><div><small>{t.totalCut}</small><strong>{num(totalSewnQty)}</strong><p>{t.period}</p></div></article>
                <article className="panel cutting-metric"><div className="cutting-metric-icon amber"><AlertTriangle size={22}/></div><div><small>{t.totalDamaged}</small><strong>{num(totalDamagedQty)}</strong><p>{t.period}</p></div></article>
                <article className="panel cutting-metric"><div className="cutting-metric-icon green"><CheckCircle2 size={22}/></div><div><small>{t.wasteRate}</small><strong>{wastePercent}%</strong><p>{Number(wastePercent) < 5 ? 'Excellent' : Number(wastePercent) < 10 ? (locale === 'en' ? 'Good' : 'Bon') : (locale === 'en' ? 'Needs attention' : '\u00c0 surveiller')}</p></div></article>
                <article className="panel cutting-metric"><div className="cutting-metric-icon violet"><Package size={22}/></div><div><small>{t.pendingReqs}</small><strong>{sewingTransactions.filter(tx => tx.type === 'receipt').length}</strong><p>{locale === 'en' ? 'Awaiting' : 'En attente'}</p></div></article>
            </div>
            <section className="panel cutting-report-filters no-print">
                <div>
                    <label><span>{locale === 'en' ? 'From date' : 'Date de d\u00e9but'}</span><input type="date" value={reportFrom} max={reportTo || undefined} onChange={event => setReportFrom(event.target.value)}/></label>
                    <label><span>{locale === 'en' ? 'To date' : 'Date de fin'}</span><input type="date" value={reportTo} min={reportFrom || undefined} onChange={event => setReportTo(event.target.value)}/></label>
                    <button className="secondary-btn" onClick={() => { setReportFrom(''); setReportTo(''); }}>{locale === 'en' ? 'Clear filters' : 'Effacer les filtres'}</button>
                </div>
                <button className="primary-btn" onClick={() => window.print()}><FileText size={17}/>{locale === 'en' ? 'Print filtered report' : 'Imprimer le rapport filtr\u00e9'}</button>
            </section>
            <article className="panel noguchi-cutting-report">
                <header>
                    <div><small>OFFICIAL FACTORY REGISTER</small><h2>{user.current_factory?.name || 'NOGUCHI HOLDINGS LTD'}</h2><p>{locale === 'en' ? 'Cutting input and output report' : 'Rapport des entr\u00e9es et sorties de coupe'}</p></div>
                    <div><span>{locale === 'en' ? 'REPORT DATE' : 'DATE DU RAPPORT'}<b>{new Date().toLocaleDateString()}</b></span><span>{locale === 'en' ? 'PREPARED BY' : 'PR\u00c9PAR\u00c9 PAR'}<b>{user.name}</b></span></div>
                </header>
                <div className="noguchi-cutting-table-wrap"><table><thead>
                    <tr><th rowSpan={2}>{locale === 'en' ? 'DATE' : 'DATE'}</th><th colSpan={3}>{locale === 'en' ? 'INPUT' : 'ENTR\u00c9E'}</th><th colSpan={4}>{locale === 'en' ? 'OUTPUT' : 'SORTIE'}</th></tr>
                    <tr><th>{locale === 'en' ? 'FABRIC' : 'TISSU'}</th><th>{locale === 'en' ? 'COLOR' : 'COULEUR'}</th><th>{locale === 'en' ? 'METERS' : 'M\u00c8TRES'}</th><th>{locale === 'en' ? 'STYLE' : 'STYLE'}</th><th>{locale === 'en' ? 'COLOR' : 'COULEUR'}</th><th>{locale === 'en' ? 'SIZE' : 'TAILLE'}</th><th>{locale === 'en' ? 'QTY' : 'QT\u00c9'}</th></tr>
                </thead><tbody>
                    {filteredSewReportRows.length ? filteredSewReportRows.map((row: any) => <tr key={row.id}><td>{new Date(row.occurred_at).toLocaleDateString()}</td><td><b>{row.item_name}</b></td><td>{row.inputColor}</td><td>{num(Math.abs(row.quantity_delta))} {row.unit || 'm'}</td><td>{row.outputStyle}</td><td>{row.outputColor}</td><td>{row.outputSize}</td><td><b>{row.outputQuantity}</b></td></tr>) : <tr><td colSpan={8} className="empty-cell">{locale === 'en' ? 'No cutting records match the selected dates.' : 'Aucun enregistrement ne correspond aux dates s\u00e9lectionn\u00e9es.'}</td></tr>}
                </tbody></table></div>
                <footer><span>{user.current_factory?.name || 'NOGUCHI HOLDINGS LTD'} \u00b7 CUTTING OPERATIONS</span><span>Generated by ICYEREKEZO OMS</span></footer>
            </article>
        </div>}
    </section>;
}
