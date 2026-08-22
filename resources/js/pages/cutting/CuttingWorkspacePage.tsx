import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Package, RefreshCw, Scissors, Send } from 'lucide-react';
import { Locale, productionApi, StockPopupModal } from '../production/shared';

type CuttingTab = 'request' | 'cut' | 'damaged' | 'report';
type AuthUser = {
    id: number; name: string;
    current_factory: { name?: string; currency_code?: string } | null;
    system?: { currency_code?: string };
};

const OUTPUT_STYLES = ['Shirt', 'Skirt', 'Short', 'Trousers', 'Dress'];
const OUTPUT_SIZES = ['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const copy = {
    en: {
        title: 'Cutting workspace',
        subtitle: 'Manage fabric requests, record cut output and track damaged materials.',
        eyebrow: 'CUTTING DATA',
        tabs: { request: 'Request fabrics', cut: 'Cut fabrics', damaged: 'Damaged fabrics', report: 'Cutting report' },
        requestTitle: 'Request fabrics from warehouse',
        requestDesc: 'Submit a request for fabric materials needed for your cutting operations.',
        selectItem: 'Select fabric', quantity: 'Quantity needed', reason: 'Reason / Notes',
        quantityPlaceholder: 'Enter quantity', reasonPlaceholder: 'Describe why you need this fabric…',
        sendRequest: 'Submit request', sending: 'Submitting…',
        pendingRequests: 'Pending requests', noRequests: 'No fabric requests submitted yet.',
        cutTitle: 'Record cut fabrics',
        cutDesc: 'Log the fabrics you have successfully cut in this session.',
        cutItem: 'Fabric used', cutQuantity: 'Amount of fabric cut',
        outputQuantity: 'Number of pieces produced', cutNotes: 'Cutting notes',
        cutPlaceholder: 'e.g., 5.5', outputPlaceholder: 'e.g., 100',
        notesPlaceholder: 'Any notes about this cutting session…',
        recordCut: 'Record cut output', recording: 'Recording…',
        recentCuts: 'Recent cutting records', noCuts: 'No cutting records yet. Record your first cut above.',
        damagedTitle: 'Report damaged fabrics',
        damagedDesc: 'Record fabric materials that were damaged or wasted during cutting.',
        damagedQuantity: 'Quantity damaged', damagedReason: 'Damage reason',
        damagedPlaceholder: 'Amount damaged', damagedReasonPlaceholder: 'Describe what happened (tear, miscut, stain…)',
        reportDamage: 'Report damage', reporting: 'Reporting…',
        recentDamage: 'Recent damage records', noDamage: 'No damage records. Good job keeping waste low!',
        totalCut: 'Total cut today', totalDamaged: 'Total damaged today', wasteRate: 'Waste rate',
        pendingReqs: 'Pending requests',
        period: 'Today',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting…', loading: 'Loading…',
    },
    fr: {
        title: 'Espace de coupe',
        subtitle: 'Gérez les demandes de tissu, enregistrez les découpes et suivez les matériaux endommagés.',
        eyebrow: 'DONNÉES DE COUPE',
        tabs: { request: 'Demander des tissus', cut: 'Tissus coupés', damaged: 'Tissus endommagés', report: 'Rapport de coupe' },
        requestTitle: 'Demander des tissus de l\'entrepôt',
        requestDesc: 'Soumettez une demande de matériaux tissus nécessaires pour vos opérations de coupe.',
        selectItem: 'Sélectionner le tissu', quantity: 'Quantité nécessaire', reason: 'Motif / Notes',
        quantityPlaceholder: 'Saisissez la quantité', reasonPlaceholder: 'Décrivez pourquoi vous avez besoin de ce tissu…',
        sendRequest: 'Soumettre la demande', sending: 'Envoi en cours…',
        pendingRequests: 'Demandes en attente', noRequests: 'Aucune demande de tissu soumise.',
        cutTitle: 'Enregistrer les tissus coupés',
        cutDesc: 'Enregistrez les tissus que vous avez découpés avec succès dans cette session.',
        cutItem: 'Tissu utilisé', cutQuantity: 'Quantité de tissu coupé',
        outputQuantity: 'Nombre de pièces', cutNotes: 'Notes de coupe',
        cutPlaceholder: 'ex : 5.5', outputPlaceholder: 'ex : 100',
        notesPlaceholder: 'Notes sur cette session de coupe…',
        recordCut: 'Enregistrer la coupe', recording: 'Enregistrement…',
        recentCuts: 'Coupes récentes', noCuts: 'Aucune coupe enregistrée. Enregistrez votre première coupe ci-dessus.',
        damagedTitle: 'Signaler les tissus endommagés',
        damagedDesc: 'Enregistrez les matériaux endommagés ou gaspillés pendant la coupe.',
        damagedQuantity: 'Quantité endommagée', damagedReason: 'Motif du dommage',
        damagedPlaceholder: 'Quantité endommagée', damagedReasonPlaceholder: 'Décrivez ce qui s\'est passé (déchirure, mauvaise coupe, tache…)',
        reportDamage: 'Signaler le dommage', reporting: 'Signalement…',
        recentDamage: 'Dommages récents', noDamage: 'Aucun dommage enregistré. Bravo pour la réduction des déchets !',
        totalCut: 'Total coupé aujourd\'hui', totalDamaged: 'Total endommagé aujourd\'hui', wasteRate: 'Taux de déchet',
        pendingReqs: 'Demandes en attente',
        period: 'Aujourd\'hui',
        refresh: 'Actualiser', updated: 'Mis à jour', connecting: 'Connexion…', loading: 'Chargement…',
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
    const [reportFrom, setReportFrom] = useState('');
    const [reportTo, setReportTo] = useState('');

    const [requestForm, setRequestForm] = useState({ item_id: '', quantity: '', reason: '' });
    const [cutForm, setCutForm] = useState({ item_id: '', quantity: '', output_style: '', output_color: '', output_size: '', output_quantity: '', notes: '' });
    const [damageForm, setDamageForm] = useState({ item_id: '', quantity: '', reason: '' });

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await productionApi<any>('/api/inventory/overview');
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
        .map((item: any) => ({ ...item, available_qty: Number(stock.find(s => s.item_id === item.id && s.warehouse_id === mainWarehouseId)?.quantity_on_hand || 0) }))
        .filter((item: any) => item.available_qty > 0);

    const cuttingStock = stock.filter(s => s.warehouse_id === cuttingWarehouseId && s.quantity_on_hand > 0);
    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const cuttingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve'].includes(String(tx.type || ''))
    );
    const cutOutputTransactions = cuttingTransactions.filter((tx: any) =>
        tx.type === 'issue' && tx.warehouse_id === cuttingWarehouseId && String(tx.reason || '').startsWith('[Cut Output]')
    );
    const pendingRequests = cuttingTransactions.filter(tx => tx.type === 'reserve');
    const damageRecords = cuttingTransactions.filter(tx => ['waste', 'adjustment_out'].includes(tx.type));

    // Parses the style/color/size/qty produced back out of a cut record's reason
    // text for the printable report — the fabric's own color is guessed from its
    // name since the input side doesn't track color as a separate field.
    const cutReportRows = cutOutputTransactions.map((tx: any) => {
        const details = String(tx.reason || '').replace('[Cut Output] ', '');
        const output = details.match(/\|\s*([\d,.]+)x\s+(.+?)(?:\s+\/\s+(.+?))?\s+\(([^)]+)\)\s+produced/i);
        const fabricColor = String(tx.item_name || '').match(/\b(green|blue|red|yellow|black|white|navy|grey|gray|brown|orange|purple|pink|beige|cream)\b/i)?.[1] || '—';
        return {
            ...tx,
            inputColor: fabricColor,
            outputStyle: output?.[2]?.trim() || '—',
            outputColor: fabricColor,
            outputSize: output?.[4]?.trim() || '—',
            outputQuantity: output?.[1] ? num(Number(output[1].replaceAll(',', ''))) : '—',
        };
    });
    const filteredCutReportRows = cutReportRows.filter((row: any) => {
        const date = new Date(row.occurred_at);
        const from = reportFrom ? new Date(`${reportFrom}T00:00:00`) : null;
        const to = reportTo ? new Date(`${reportTo}T23:59:59.999`) : null;
        return (!from || date >= from) && (!to || date <= to);
    });

    const isToday = (tx: any) => new Date(tx.occurred_at).toDateString() === new Date().toDateString();
    const todayCuts = cutOutputTransactions.filter(isToday);
    const todayDamage = cuttingTransactions.filter((tx: any) => isToday(tx) && ['waste', 'adjustment_out'].includes(tx.type));

    const totalCutQty = todayCuts.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const totalDamagedQty = todayDamage.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const wastePercent = totalCutQty + totalDamagedQty > 0 ? ((totalDamagedQty / (totalCutQty + totalDamagedQty)) * 100).toFixed(1) : '0.0';

    const clearMsg = () => { setError(''); setSuccess(''); };

    const submitRequest = async () => {
        clearMsg();
        if (!requestForm.item_id || !requestForm.quantity) {
            setError(locale === 'en' ? 'Please select a fabric and enter the quantity.' : 'Veuillez sélectionner un tissu et entrer la quantité.');
            return;
        }
        const available = requestableItems.find(i => i.id === Number(requestForm.item_id))?.available_qty || 0;
        if (Number(requestForm.quantity) > available) {
            setError(locale === 'en' ? `Insufficient stock in the main warehouse. Only ${num(available)} available.` : `Stock insuffisant. Seulement ${num(available)} disponible.`);
            return;
        }
        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(requestForm.item_id), warehouse_id: mainWarehouseId, type: 'reserve', quantity: Number(requestForm.quantity), reason: `[Cutting Request] ${requestForm.reason || 'Fabric needed for cutting operations'}` }),
            });
            setSuccess(locale === 'en' ? 'Fabric request submitted successfully! Pending storekeeper approval.' : 'Demande de tissu soumise avec succès ! En attente d\'approbation.');
            setRequestForm({ item_id: '', quantity: '', reason: '' });
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    // Cutting is where a lot originates: the fabric-consuming issue is always
    // posted, and — only when a style/quantity-produced was actually entered —
    // a real Batch is minted and a matching production_output posted against it,
    // so Sewing has a real lot to receive rather than just free-text.
    const submitCut = async () => {
        clearMsg();
        if (!cutForm.item_id || !cutForm.quantity) {
            setError(locale === 'en' ? 'Please select a fabric and enter the quantity cut.' : 'Veuillez sélectionner un tissu et entrer la quantité coupée.');
            return;
        }

        const available = cuttingStock.find(s => s.item_id === Number(cutForm.item_id))?.quantity_on_hand || 0;
        if (Number(cutForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the cutting floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            const reason = `[Cut Output] ${cutForm.notes || 'Fabric cut for production'}${cutForm.output_quantity ? ` | ${cutForm.output_quantity}x ${cutForm.output_style}${cutForm.output_color ? ` / ${cutForm.output_color}` : ''} (${cutForm.output_size}) produced` : ''}`;
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(cutForm.item_id), warehouse_id: cuttingWarehouseId, type: 'issue', quantity: Number(cutForm.quantity), reason }),
            });
            if (cutForm.output_quantity && Number(cutForm.output_quantity) > 0) {
                const batch = await productionApi<any>('/api/inventory/batches', {
                    method: 'POST',
                    body: JSON.stringify({ item_id: Number(cutForm.item_id), metadata: { style: cutForm.output_style, color: cutForm.output_color, size: cutForm.output_size } }),
                });
                await productionApi('/api/inventory/transactions', {
                    method: 'POST',
                    body: JSON.stringify({ item_id: Number(cutForm.item_id), warehouse_id: cuttingWarehouseId, batch_id: batch.id, production_stage: 'cut', type: 'production_output', quantity: Number(cutForm.output_quantity), reason }),
                });
            }
            setSuccess(locale === 'en' ? 'Cut record saved successfully!' : 'Enregistrement de coupe sauvegardé !');
            setCutForm({ item_id: '', quantity: '', output_style: '', output_color: '', output_size: '', output_quantity: '', notes: '' });
            await load(true);
        } catch (r: any) {
            if (/insufficient stock|stock insuffisant/i.test(String(r.message || ''))) setStockPopup(r.message);
            else setError(r.message);
        } finally { setBusy(false); }
    };

    const submitDamage = async () => {
        clearMsg();
        if (!damageForm.item_id || !damageForm.quantity) {
            setError(locale === 'en' ? 'Please select a fabric and enter the damaged quantity.' : 'Veuillez sélectionner un tissu et entrer la quantité endommagée.');
            return;
        }
        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(damageForm.item_id), warehouse_id: cuttingWarehouseId, type: 'waste', quantity: Number(damageForm.quantity), reason: `[Cutting Damage] ${damageForm.reason || 'Material damaged during cutting'}` }),
            });
            setSuccess(locale === 'en' ? 'Damage report submitted successfully!' : 'Rapport de dommage soumis avec succès !');
            setDamageForm({ item_id: '', quantity: '', reason: '' });
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    return (
        <section className="module-page cutting-workspace">
            <StockPopupModal message={stockPopup} onClose={() => setStockPopup('')} locale={locale} />

            <div className="module-hero">
                <div className="module-title">
                    <span><Scissors size={22} /></span>
                    <div><div className="eyebrow"><i></i>{t.eyebrow}</div><h1>{t.title}</h1><p>{t.subtitle}</p></div>
                </div>
                <div className="support-actions">
                    <span className="support-live"><i></i>{updated ? `${t.updated} ${updated.toLocaleTimeString()}` : t.connecting}</span>
                    <button className="secondary-btn" disabled={loading} onClick={() => load()}><RefreshCw size={17} />{t.refresh}</button>
                </div>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {success && <div className="admin-alert success">{success}</div>}

            <div className="module-tabs" role="tablist">
                {(['request', 'cut', 'damaged', 'report'] as CuttingTab[]).map(key => (
                    <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                        {key === 'request' && <Package size={16} />}
                        {key === 'cut' && <Scissors size={16} />}
                        {key === 'damaged' && <AlertTriangle size={16} />}
                        {key === 'report' && <FileText size={16} />}
                        <span>{t.tabs[key]}</span>
                    </button>
                ))}
            </div>

            {loading && !stock.length ? (
                <div className="panel" style={{ padding: '3rem', textAlign: 'center', opacity: .7 }}>{t.loading}</div>
            ) : tab === 'request' ? (
                <div className="cutting-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.requestTitle}</h2></div>
                        <p className="cutting-form-desc">{t.requestDesc}</p>
                        <div className="cutting-form-grid">
                            <label>
                                <span>{t.selectItem}</span>
                                <select value={requestForm.item_id} onChange={e => setRequestForm({ ...requestForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose fabric —' : '— Choisir un tissu —'}</option>
                                    {requestableItems.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({num(item.available_qty)} {locale === 'en' ? 'in stock' : 'en stock'})</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{t.quantity}</span>
                                <input type="number" min="0.001" step="any" placeholder={t.quantityPlaceholder} value={requestForm.quantity} onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })} />
                            </label>
                            <label className="cutting-full-width">
                                <span>{t.reason}</span>
                                <textarea rows={3} placeholder={t.reasonPlaceholder} value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} maxLength={500} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn" disabled={busy} onClick={submitRequest}><Send size={17} />{busy ? t.sending : t.sendRequest}</button>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{pendingRequests.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead>
                                <tbody>
                                    {pendingRequests.length ? pendingRequests.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td>
                                            <td>{String(tx.reason || '').replace('[Cutting Request] ', '')}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="empty-cell">{t.noRequests}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </div>
            ) : tab === 'cut' ? (
                <div className="cutting-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.cutTitle}</h2></div>
                        <p className="cutting-form-desc">{t.cutDesc}</p>
                        <div className="cutting-form-grid cut-3-cols">
                            <label>
                                <span>{t.cutItem}</span>
                                <select value={cutForm.item_id} onChange={e => setCutForm({ ...cutForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose fabric in stock —' : '— Choisir un tissu en stock —'}</option>
                                    {cuttingStock.map((s: any) => <option key={s.item_id} value={s.item_id}>{s.item_name} ({num(s.quantity_on_hand)} {s.unit})</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{t.cutQuantity}</span>
                                <input type="number" min="0.001" step="any" placeholder={t.cutPlaceholder} value={cutForm.quantity} onChange={e => setCutForm({ ...cutForm, quantity: e.target.value })} />
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Style produced' : 'Style produit'}</span>
                                <select value={cutForm.output_style} onChange={e => setCutForm({ ...cutForm, output_style: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose style —' : '— Choisir un style —'}</option>
                                    {OUTPUT_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Size' : 'Taille'}</span>
                                <select value={cutForm.output_size} onChange={e => setCutForm({ ...cutForm, output_size: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose size —' : '— Choisir la taille —'}</option>
                                    {OUTPUT_SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{t.outputQuantity}</span>
                                <input type="number" min="1" step="1" placeholder={t.outputPlaceholder} value={cutForm.output_quantity} onChange={e => setCutForm({ ...cutForm, output_quantity: e.target.value })} />
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Color produced' : 'Couleur produite'}</span>
                                <input type="text" placeholder={locale === 'en' ? 'e.g., Green' : 'ex : Vert'} value={cutForm.output_color} onChange={e => setCutForm({ ...cutForm, output_color: e.target.value })} maxLength={80} />
                            </label>
                            <label className="cutting-full-width">
                                <span>{t.cutNotes}</span>
                                <textarea rows={2} placeholder={t.notesPlaceholder} value={cutForm.notes} onChange={e => setCutForm({ ...cutForm, notes: e.target.value })} maxLength={500} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn" disabled={busy} onClick={submitCut}><Scissors size={17} />{busy ? t.recording : t.recordCut}</button>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.recentCuts}</h2><span>{cutOutputTransactions.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity used' : 'Quantité utilisée'}</th><th>{locale === 'en' ? 'Details' : 'Détails'}</th></tr></thead>
                                <tbody>
                                    {cutOutputTransactions.length ? cutOutputTransactions.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td>
                                            <td>{String(tx.reason || '').replace('[Cut Output] ', '')}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="empty-cell">{t.noCuts}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </div>
            ) : tab === 'damaged' ? (
                <div className="cutting-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.damagedTitle}</h2></div>
                        <p className="cutting-form-desc">{t.damagedDesc}</p>
                        <div className="cutting-form-grid">
                            <label>
                                <span>{locale === 'en' ? 'Damaged fabric' : 'Tissu endommagé'}</span>
                                <select value={damageForm.item_id} onChange={e => setDamageForm({ ...damageForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose fabric in stock —' : '— Choisir un tissu en stock —'}</option>
                                    {cuttingStock.map((s: any) => <option key={s.item_id} value={s.item_id}>{s.item_name} ({num(s.quantity_on_hand)} {s.unit})</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{t.damagedQuantity}</span>
                                <input type="number" min="0.001" step="any" placeholder={t.damagedPlaceholder} value={damageForm.quantity} onChange={e => setDamageForm({ ...damageForm, quantity: e.target.value })} />
                            </label>
                            <label className="cutting-full-width">
                                <span>{t.damagedReason}</span>
                                <textarea rows={3} placeholder={t.damagedReasonPlaceholder} value={damageForm.reason} onChange={e => setDamageForm({ ...damageForm, reason: e.target.value })} maxLength={500} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn cutting-damage-btn" disabled={busy} onClick={submitDamage}><AlertTriangle size={17} />{busy ? t.reporting : t.reportDamage}</button>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.recentDamage}</h2><span>{damageRecords.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity wasted' : 'Quantité perdue'}</th><th>{locale === 'en' ? 'Reason' : 'Motif'}</th></tr></thead>
                                <tbody>
                                    {damageRecords.length ? damageRecords.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td><span className="admin-status warning">{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</span></td>
                                            <td>{String(tx.reason || '').replace('[Cutting Damage] ', '')}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="empty-cell">{t.noDamage}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </div>
            ) : (
                <div className="cutting-tab-content">
                    <div className="cutting-report-metrics">
                        <article className="panel cutting-metric"><div className="cutting-metric-icon blue"><Scissors size={22} /></div><div><small>{t.totalCut}</small><strong>{num(totalCutQty)}</strong><p>{t.period}</p></div></article>
                        <article className="panel cutting-metric"><div className="cutting-metric-icon amber"><AlertTriangle size={22} /></div><div><small>{t.totalDamaged}</small><strong>{num(totalDamagedQty)}</strong><p>{t.period}</p></div></article>
                        <article className="panel cutting-metric"><div className="cutting-metric-icon green"><CheckCircle2 size={22} /></div><div><small>{t.wasteRate}</small><strong>{wastePercent}%</strong><p>{Number(wastePercent) < 5 ? 'Excellent' : Number(wastePercent) < 10 ? (locale === 'en' ? 'Good' : 'Bon') : (locale === 'en' ? 'Needs attention' : 'À surveiller')}</p></div></article>
                        <article className="panel cutting-metric"><div className="cutting-metric-icon violet"><Package size={22} /></div><div><small>{t.pendingReqs}</small><strong>{pendingRequests.length}</strong><p>{locale === 'en' ? 'Awaiting' : 'En attente'}</p></div></article>
                    </div>
                    <section className="panel cutting-report-filters no-print">
                        <div>
                            <label><span>{locale === 'en' ? 'From date' : 'Date de début'}</span><input type="date" value={reportFrom} max={reportTo || undefined} onChange={event => setReportFrom(event.target.value)} /></label>
                            <label><span>{locale === 'en' ? 'To date' : 'Date de fin'}</span><input type="date" value={reportTo} min={reportFrom || undefined} onChange={event => setReportTo(event.target.value)} /></label>
                            <button className="secondary-btn" onClick={() => { setReportFrom(''); setReportTo(''); }}>{locale === 'en' ? 'Clear filters' : 'Effacer les filtres'}</button>
                        </div>
                        <button className="primary-btn" onClick={() => window.print()}><FileText size={17} />{locale === 'en' ? 'Print filtered report' : 'Imprimer le rapport filtré'}</button>
                    </section>
                    <article className="panel noguchi-cutting-report">
                        <header>
                            <div><small>OFFICIAL FACTORY REGISTER</small><h2>{user.current_factory?.name || 'NOGUCHI HOLDINGS LTD'}</h2><p>{locale === 'en' ? 'Cutting input and output report' : 'Rapport des entrées et sorties de coupe'}</p></div>
                            <div><span>{locale === 'en' ? 'REPORT DATE' : 'DATE DU RAPPORT'}<b>{new Date().toLocaleDateString()}</b></span><span>{locale === 'en' ? 'PREPARED BY' : 'PRÉPARÉ PAR'}<b>{user.name}</b></span></div>
                        </header>
                        <div className="noguchi-cutting-table-wrap">
                            <table>
                                <thead>
                                    <tr><th rowSpan={2}>{locale === 'en' ? 'DATE' : 'DATE'}</th><th colSpan={3}>{locale === 'en' ? 'INPUT' : 'ENTRÉE'}</th><th colSpan={4}>{locale === 'en' ? 'OUTPUT' : 'SORTIE'}</th></tr>
                                    <tr><th>{locale === 'en' ? 'FABRIC' : 'TISSU'}</th><th>{locale === 'en' ? 'COLOR' : 'COULEUR'}</th><th>{locale === 'en' ? 'METERS' : 'MÈTRES'}</th><th>{locale === 'en' ? 'STYLE' : 'STYLE'}</th><th>{locale === 'en' ? 'COLOR' : 'COULEUR'}</th><th>{locale === 'en' ? 'SIZE' : 'TAILLE'}</th><th>{locale === 'en' ? 'QTY' : 'QTÉ'}</th></tr>
                                </thead>
                                <tbody>
                                    {filteredCutReportRows.length ? filteredCutReportRows.map((row: any) => (
                                        <tr key={row.id}>
                                            <td>{new Date(row.occurred_at).toLocaleDateString()}</td>
                                            <td><b>{row.item_name}</b></td>
                                            <td>{row.inputColor}</td>
                                            <td>{num(Math.abs(row.quantity_delta))} {row.unit || 'm'}</td>
                                            <td>{row.outputStyle}</td>
                                            <td>{row.outputColor}</td>
                                            <td>{row.outputSize}</td>
                                            <td><b>{row.outputQuantity}</b></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={8} className="empty-cell">{locale === 'en' ? 'No cutting records match the selected dates.' : 'Aucun enregistrement ne correspond aux dates sélectionnées.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <footer><span>{user.current_factory?.name || 'NOGUCHI HOLDINGS LTD'} · CUTTING OPERATIONS</span><span>Generated by ICYEREKEZO OMS</span></footer>
                    </article>
                </div>
            )}
        </section>
    );
}
