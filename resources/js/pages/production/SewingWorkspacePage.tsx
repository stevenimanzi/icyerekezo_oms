import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Package, RefreshCw, Scissors } from 'lucide-react';
import { EditRecordModal, EditRecordForm, Locale, productionApi, StockPopupModal } from './shared';

type SewingTab = 'request' | 'sew' | 'damaged' | 'report';
type AuthUser = {
    id: number; name: string;
    current_factory: { name?: string; currency_code?: string } | null;
    system?: { currency_code?: string };
};

const copy = {
    en: {
        title: 'Sewing workspace',
        subtitle: 'Manage received pieces, record sewn output and track damaged materials.',
        eyebrow: 'SEWING DATA',
        tabs: { request: 'Receive pieces', sew: 'Sew pieces', damaged: 'Damaged pieces', report: 'Sewing report' },
        quantity: 'Quantity received', reason: 'Reason / Notes',
        pendingRequests: 'Accepted items', noRequests: 'No items accepted yet.',
        sewTitle: 'Record sewn items',
        sewDesc: 'Log the items you have successfully sewn in this session.',
        sewPlaceholder: 'e.g., 50',
        recordSew: 'Record sewing output', recording: 'Recording...',
        recentSew: 'Recent sewing records', noSew: 'No sewing records yet. Record your first sew above.',
        damagedTitle: 'Report damaged pieces',
        damagedDesc: 'Record materials that were damaged or rejected during sewing.',
        damagedQuantity: 'Quantity damaged', damagedReason: 'Damage reason',
        damagedPlaceholder: 'Amount damaged', damagedReasonPlaceholder: 'Describe what happened (stitch error, tear...)',
        reportDamage: 'Report damage', reporting: 'Reporting...',
        recentDamage: 'Recent damage records', noDamage: 'No damage records. Good job keeping waste low!',
        totalSew: 'Total sewn today', totalDamaged: 'Total damaged today', wasteRate: 'Rejection rate',
        pendingReqs: 'Recent receipts',
        period: 'Today',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting...', loading: 'Loading...',
    },
    fr: {
        title: 'Espace de couture',
        subtitle: 'Gérez les pièces reçues, enregistrez la couture et suivez les rejets.',
        eyebrow: 'DONNÉES DE COUTURE',
        tabs: { request: 'Réceptionner', sew: 'Coudre', damaged: 'Pièces endommagées', report: 'Rapport de couture' },
        quantity: 'Quantité reçue', reason: 'Motif / Notes',
        pendingRequests: 'Articles acceptés', noRequests: 'Aucun article accepté.',
        sewTitle: 'Enregistrer les articles cousus',
        sewDesc: 'Enregistrez les articles que vous avez cousus avec succès.',
        sewPlaceholder: 'ex : 50',
        recordSew: 'Enregistrer la couture', recording: 'Enregistrement...',
        recentSew: 'Coutures récentes', noSew: 'Aucune couture enregistrée.',
        damagedTitle: 'Signaler les pièces endommagées',
        damagedDesc: 'Enregistrez les matériaux endommagés ou rejetés pendant la couture.',
        damagedQuantity: 'Quantité', damagedReason: 'Motif du dommage',
        damagedPlaceholder: 'Quantité', damagedReasonPlaceholder: 'Décrivez ce qui s\'est passé',
        reportDamage: 'Signaler', reporting: 'Signalement...',
        recentDamage: 'Dommages récents', noDamage: 'Aucun dommage enregistré.',
        totalSew: 'Cousu aujourd\'hui', totalDamaged: 'Rejeté aujourd\'hui', wasteRate: 'Taux de rejet',
        pendingReqs: 'Réceptions',
        period: 'Aujourd\'hui',
        refresh: 'Actualiser', updated: 'Mis à jour', connecting: 'Connexion...', loading: 'Chargement...',
    },
};

export default function SewingWorkspacePage({ user, locale, initialTab = 'request' }: { user: AuthUser; locale: Locale; initialTab?: SewingTab }) {
    const t = copy[locale];
    const [tab, setTab] = useState<SewingTab>(initialTab);
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

    const [sewForm, setSewForm] = useState({ item_id: '', quantity: '', notes: '' });
    const [damageForm, setDamageForm] = useState({ item_id: '', quantity: '', reason: '' });
    const [editForm, setEditForm] = useState<EditRecordForm | null>(null);

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await productionApi<any>('/api/inventory/overview');
            setStock(overview.stock || []);
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
    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const sewingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve', 'receipt'].includes(String(tx.type || ''))
    );
    const sewOutputTransactions = sewingTransactions.filter((tx: any) =>
        tx.type === 'issue' && tx.warehouse_id === sewingWarehouseId && String(tx.reason || '').startsWith('[Sewing Output]')
    );
    const reportTransactions = sewingTransactions.filter((tx: any) => {
        if (!['receipt', 'issue', 'waste'].includes(tx.type)) return false;
        if (!String(tx.reason || '').includes('CutID:')) return false;
        const date = new Date(tx.occurred_at);
        const from = reportFrom ? new Date(`${reportFrom}T00:00:00`) : null;
        const to = reportTo ? new Date(`${reportTo}T23:59:59.999`) : null;
        return (!from || date >= from) && (!to || date <= to);
    });

    // Builds the printable sewing report: one row per cut lot (CutID), summing
    // received/sewn/wasted quantities within the selected date range.
    const reportRowsMap = new Map<string, any>();
    reportTransactions.forEach((tx: any) => {
        const match = String(tx.reason).match(/CutID:\s*([^\s|]+)/i);
        if (!match) return;
        const cutId = match[1];
        const parts = cutId.split('-');
        const dateStr = new Date(tx.occurred_at).toLocaleDateString();
        const key = `${dateStr}-${cutId}`;
        if (!reportRowsMap.has(key)) {
            const fabricColor = String(tx.item_name || '').match(/\b(green|blue|red|yellow|black|white|navy|grey|gray|brown|orange|purple|pink|beige|cream)\b/i)?.[1];
            reportRowsMap.set(key, {
                id: key, date: dateStr, fabric: tx.item_name,
                style: parts[1] || '—', color: parts[2] || fabricColor || '—', size: parts[3] || '—',
                input: 0, output: 0, waste: 0,
            });
        }
        const row = reportRowsMap.get(key);
        if (tx.type === 'receipt') row.input += Math.abs(tx.quantity_delta);
        else if (tx.type === 'issue') row.output += Math.abs(tx.quantity_delta);
        else if (tx.type === 'waste') row.waste += Math.abs(tx.quantity_delta);
    });
    const filteredSewReportRows = Array.from(reportRowsMap.values()).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const acceptedCutPieces = sewingTransactions.filter((tx: any) => tx.type === 'receipt' && String(tx.reason || '').includes('CutID:'));

    // Rebuilds "what's on the sewing floor, ready to sew" from the accepted-receipt
    // and issue/waste transactions tagged with a shared CutID.
    const sewingVirtualStock = new Map<string, { id: string; item_id: number; name: string; available_qty: number }>();
    acceptedCutPieces.forEach((tx: any) => {
        const match = String(tx.reason).match(/CutID:\s*([^\s|]+)/i);
        if (!match) return;
        const cutId = match[1];
        if (!sewingVirtualStock.has(cutId)) {
            const parts = cutId.split('-');
            sewingVirtualStock.set(cutId, {
                id: cutId,
                item_id: tx.item_id,
                name: `${parts[1] || ''}${parts[2] ? ` / ${parts[2]}` : ''} (${parts[3] || ''}) - ${tx.item_name}`,
                available_qty: 0,
            });
        }
        sewingVirtualStock.get(cutId)!.available_qty += Math.abs(tx.quantity_delta);
    });
    sewingTransactions.forEach((tx: any) => {
        if (!['issue', 'waste'].includes(tx.type) || !String(tx.reason).includes('CutID:')) return;
        const match = String(tx.reason).match(/CutID:\s*([^\s|]+)/i);
        if (match && sewingVirtualStock.has(match[1])) {
            sewingVirtualStock.get(match[1])!.available_qty -= Math.abs(tx.quantity_delta);
        }
    });
    const availableSewingStock = Array.from(sewingVirtualStock.values()).filter(item => item.available_qty > 0);

    const isToday = (tx: any) => new Date(tx.occurred_at).toDateString() === new Date().toDateString();
    const todaySewn = sewOutputTransactions.filter(isToday);
    const todayDamage = sewingTransactions.filter((tx: any) => isToday(tx) && ['waste', 'adjustment_out'].includes(tx.type));
    const todayAccepted = acceptedCutPieces.filter(isToday);
    const damageRecords = sewingTransactions.filter((tx: any) => ['waste', 'adjustment_out'].includes(tx.type));

    const totalSewnQty = todaySewn.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const totalDamagedQty = todayDamage.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const totalAcceptedQty = todayAccepted.reduce((s: number, tx: any) => s + Math.abs(Number(tx.quantity_delta || 0)), 0);
    const wastePercent = totalSewnQty + totalDamagedQty > 0 ? ((totalDamagedQty / (totalSewnQty + totalDamagedQty)) * 100).toFixed(1) : '0.0';

    const clearMsg = () => { setError(''); setSuccess(''); };

    const acceptCutPiece = async (piece: any) => {
        clearMsg();
        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(piece.item_id), warehouse_id: sewingWarehouseId, batch_id: Number(piece.id), type: 'receipt', quantity: Number(piece.available_qty), reason: `[Sewing Receipt] CutID: ${piece.id} | Accepted from cutting` }),
            });
            setSuccess(locale === 'en' ? 'Cut pieces received successfully!' : 'Pièces coupées reçues avec succès !');
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitSew = async () => {
        clearMsg();
        if (!sewForm.item_id || !sewForm.quantity) {
            setError(locale === 'en' ? 'Please select a cut piece and enter the quantity sewn.' : 'Veuillez sélectionner une pièce coupée et entrer la quantité cousue.');
            return;
        }

        const selectedPiece = availableSewingStock.find(s => s.id === sewForm.item_id);
        const available = selectedPiece?.available_qty || 0;
        if (Number(sewForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the sewing floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            const reason = `[Sewing Output] CutID: ${selectedPiece!.id} | ${sewForm.quantity} items sewn. ${sewForm.notes || ''}`;
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(selectedPiece!.item_id), warehouse_id: sewingWarehouseId, batch_id: Number(selectedPiece!.id), type: 'issue', quantity: Number(sewForm.quantity), reason }),
            });
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(selectedPiece!.item_id), warehouse_id: sewingWarehouseId, batch_id: Number(selectedPiece!.id), production_stage: 'sewn', type: 'production_output', quantity: Number(sewForm.quantity), reason }),
            });
            setSuccess(locale === 'en' ? 'Sewing record saved successfully!' : 'Enregistrement de couture sauvegardé !');
            setSewForm({ item_id: '', quantity: '', notes: '' });
            await load(true);
        } catch (r: any) {
            if (/insufficient stock|stock insuffisant/i.test(String(r.message || ''))) setStockPopup(r.message);
            else setError(r.message);
        } finally { setBusy(false); }
    };

    const submitDamage = async () => {
        clearMsg();
        if (!damageForm.item_id || !damageForm.quantity) {
            setError(locale === 'en' ? 'Please select a cut piece and enter the damaged quantity.' : 'Veuillez sélectionner une pièce coupée et entrer la quantité endommagée.');
            return;
        }

        const selectedPiece = availableSewingStock.find(s => s.id === damageForm.item_id);
        const available = selectedPiece?.available_qty || 0;
        if (Number(damageForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the sewing floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(selectedPiece!.item_id), warehouse_id: sewingWarehouseId, batch_id: Number(selectedPiece!.id), type: 'waste', quantity: Number(damageForm.quantity), reason: `[Sewing Damage] CutID: ${selectedPiece!.id} | ${damageForm.reason || 'Material damaged during sewing'}` }),
            });
            setSuccess(locale === 'en' ? 'Damage report submitted successfully!' : 'Rapport de dommage soumis avec succès !');
            setDamageForm({ item_id: '', quantity: '', reason: '' });
            await load(true);
        } catch (r: any) {
            if (/insufficient stock|stock insuffisant/i.test(String(r.message || ''))) setStockPopup(r.message);
            else setError(r.message);
        } finally { setBusy(false); }
    };

    const submitEdit = async () => {
        if (!editForm) return;
        clearMsg();
        if (!editForm.quantity) {
            setError(locale === 'en' ? 'Please enter the corrected quantity.' : 'Veuillez entrer la quantité corrigée.');
            return;
        }
        setBusy(true);
        try {
            await productionApi(`/api/inventory/transactions/${editForm.id}/correct`, {
                method: 'PATCH',
                body: JSON.stringify({ quantity: Number(editForm.quantity), reason: editForm.reason }),
            });
            setSuccess(locale === 'en' ? 'Transaction corrected successfully!' : 'Transaction corrigée avec succès !');
            setEditForm(null);
            await load(true);
        } catch (r: any) {
            setError(r.message);
        } finally { setBusy(false); }
    };

    return (
        <section className="module-page cutting-workspace">
            <StockPopupModal message={stockPopup} onClose={() => setStockPopup('')} locale={locale} />
            {editForm && <EditRecordModal form={editForm} onChange={setEditForm} onCancel={() => setEditForm(null)} onSave={submitEdit} busy={busy} locale={locale} />}

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
                {(['request', 'sew', 'damaged'] as SewingTab[]).map(key => (
                    <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                        {key === 'request' && <Package size={16} />}
                        {key === 'sew' && <Scissors size={16} />}
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
                    <article className="panel">
                        <div className="panel-title"><h2>{locale === 'en' ? 'Pending cut pieces' : 'Pièces coupées en attente'}</h2></div>
                        <p className="cutting-form-desc" style={{ padding: '0 20px' }}>
                            {locale === 'en' ? 'Accept cut pieces from the cutting department to start sewing.' : 'Acceptez les pièces coupées du département de coupe pour commencer à coudre.'}
                        </p>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Cut batch details' : 'Détails du lot'}</th><th>{locale === 'en' ? 'Quantity' : 'Quantité'}</th><th>{locale === 'en' ? 'Action' : 'Action'}</th></tr></thead>
                                <tbody>
                                    {cutPieces.length ? cutPieces.map((item: any) => (
                                        <tr key={item.id}>
                                            <td><b>{item.name}</b></td>
                                            <td>{num(item.available_qty)}</td>
                                            <td><button className="primary-btn" disabled={busy} onClick={() => acceptCutPiece(item)}>{locale === 'en' ? 'Accept' : 'Accepter'}</button></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="empty-cell">{locale === 'en' ? 'No pending pieces from cutting.' : 'Aucune pièce en attente de la coupe.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{acceptedCutPieces.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Cut piece' : 'Pièce coupée'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead>
                                <tbody>
                                    {acceptedCutPieces.length ? acceptedCutPieces.map((tx: any) => {
                                        let productName = tx.item_name;
                                        const match = String(tx.reason || '').match(/CutID:\s*\d+-([^-]+)-([^-]*)-([^\s|]+)/);
                                        if (match) productName = `${match[1]}${match[2] ? ` / ${match[2]}` : ''} (${match[3]}) - ${tx.item_name}`;
                                        return (
                                            <tr key={tx.id}>
                                                <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                                <td><b>{productName}</b></td>
                                                <td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td>
                                                <td>{String(tx.reason || '').replace('[Sewing Receipt] ', '')}</td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={4} className="empty-cell">{t.noRequests}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </div>
            ) : tab === 'sew' ? (
                <div className="cutting-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.sewTitle}</h2></div>
                        <p className="cutting-form-desc">{t.sewDesc}</p>
                        <div className="cutting-form-grid">
                            <label>
                                <span>{locale === 'en' ? 'Material used (accepted cut pieces)' : 'Matériel utilisé (pièces coupées acceptées)'}</span>
                                <select value={sewForm.item_id} onChange={e => setSewForm({ ...sewForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose cut piece —' : '— Choisir une pièce coupée —'}</option>
                                    {availableSewingStock.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({num(s.available_qty)} items)</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Number of items sewn' : 'Nombre d\'articles cousus'}</span>
                                <input type="number" min="1" step="1" placeholder={t.sewPlaceholder} value={sewForm.quantity} onChange={e => setSewForm({ ...sewForm, quantity: e.target.value })} />
                            </label>
                            <label className="cutting-full-width">
                                <span>{locale === 'en' ? 'Sewing notes' : 'Notes de couture'}</span>
                                <textarea rows={3} placeholder={locale === 'en' ? 'Any issues or observations...' : 'Tout problème ou observation...'} value={sewForm.notes} onChange={e => setSewForm({ ...sewForm, notes: e.target.value })} maxLength={500} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn" disabled={busy} onClick={submitSew}><Scissors size={17} />{busy ? t.recording : t.recordSew}</button>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.recentSew}</h2><span>{todaySewn.length} {locale === 'en' ? 'records today' : 'enregistrements aujourd\'hui'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Output' : 'Sortie'}</th><th>{locale === 'en' ? 'Quantity sewn' : 'Quantité cousue'}</th><th>{locale === 'en' ? 'Details' : 'Détails'}</th><th></th></tr></thead>
                                <tbody>
                                    {todaySewn.length ? todaySewn.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td>{num(Math.abs(tx.quantity_delta))}</td>
                                            <td>{String(tx.reason || '').replace('[Sewing Output] ', '')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="secondary-btn" style={{ padding: '4px 8px' }} onClick={() => setEditForm({ id: tx.id, quantity: String(Math.abs(tx.quantity_delta)), reason: String(tx.reason || '') })}>
                                                    {locale === 'en' ? 'Edit' : 'Modifier'}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="empty-cell">{t.noSew}</td></tr>
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
                                <span>{locale === 'en' ? 'Damaged cut piece' : 'Pièce coupée endommagée'}</span>
                                <select value={damageForm.item_id} onChange={e => setDamageForm({ ...damageForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose cut piece —' : '— Choisir une pièce coupée —'}</option>
                                    {availableSewingStock.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({num(s.available_qty)} items)</option>)}
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
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Fabric' : 'Tissu'}</th><th>{locale === 'en' ? 'Quantity wasted' : 'Quantité perdue'}</th><th>{locale === 'en' ? 'Reason' : 'Motif'}</th><th></th></tr></thead>
                                <tbody>
                                    {damageRecords.length ? damageRecords.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td><span className="admin-status warning">{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</span></td>
                                            <td>{String(tx.reason || '').replace('[Sewing Damage] ', '')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="secondary-btn" style={{ padding: '4px 8px' }} onClick={() => setEditForm({ id: tx.id, quantity: String(Math.abs(tx.quantity_delta)), reason: String(tx.reason || '') })}>
                                                    {locale === 'en' ? 'Edit' : 'Modifier'}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="empty-cell">{t.noDamage}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </div>
            ) : (
                <div className="cutting-tab-content">
                    <div className="cutting-report-metrics">
                        <article className="panel cutting-metric"><div className="cutting-metric-icon blue"><Package size={22} /></div><div><small>{t.pendingReqs}</small><strong>{num(totalAcceptedQty)}</strong><p>{locale === 'en' ? 'Accepted today' : 'Acceptés aujourd\'hui'}</p></div></article>
                        <article className="panel cutting-metric"><div className="cutting-metric-icon green"><Scissors size={22} /></div><div><small>{t.totalSew}</small><strong>{num(totalSewnQty)}</strong><p>{locale === 'en' ? 'Sewn today' : 'Cousus aujourd\'hui'}</p></div></article>
                        <article className="panel cutting-metric"><div className="cutting-metric-icon amber"><AlertTriangle size={22} /></div><div><small>{t.totalDamaged}</small><strong>{num(totalDamagedQty)}</strong><p>{t.period}</p></div></article>
                        <article className="panel cutting-metric"><div className="cutting-metric-icon violet"><CheckCircle2 size={22} /></div><div><small>{t.wasteRate}</small><strong>{wastePercent}%</strong><p>{Number(wastePercent) < 5 ? 'Excellent' : Number(wastePercent) < 10 ? (locale === 'en' ? 'Good' : 'Bon') : (locale === 'en' ? 'Needs attention' : 'À surveiller')}</p></div></article>
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
                            <div><small>OFFICIAL FACTORY REGISTER</small><h2>{user.current_factory?.name || 'NOGUCHI HOLDINGS LTD'}</h2><p>{locale === 'en' ? 'Sewing input and output report' : 'Rapport des entrées et sorties de couture'}</p></div>
                            <div><span>{locale === 'en' ? 'REPORT DATE' : 'DATE DU RAPPORT'}<b>{new Date().toLocaleDateString()}</b></span><span>{locale === 'en' ? 'PREPARED BY' : 'PRÉPARÉ PAR'}<b>{user.name}</b></span></div>
                        </header>
                        <div className="noguchi-cutting-table-wrap">
                            <table>
                                <thead>
                                    <tr><th rowSpan={2}>{locale === 'en' ? 'DATE' : 'DATE'}</th><th colSpan={4}>{locale === 'en' ? 'CUT PIECE DETAILS' : 'DÉTAILS DE LA PIÈCE'}</th><th colSpan={3}>{locale === 'en' ? 'QUANTITIES' : 'QUANTITÉS'}</th></tr>
                                    <tr><th>{locale === 'en' ? 'FABRIC' : 'TISSU'}</th><th>{locale === 'en' ? 'STYLE' : 'STYLE'}</th><th>{locale === 'en' ? 'COLOR' : 'COULEUR'}</th><th>{locale === 'en' ? 'SIZE' : 'TAILLE'}</th><th>{locale === 'en' ? 'INPUT (ACCEPTED)' : 'ENTRÉE (ACCEPTÉ)'}</th><th>{locale === 'en' ? 'OUTPUT (SEWN)' : 'SORTIE (COUSUS)'}</th><th>{locale === 'en' ? 'WASTE' : 'DÉCHETS'}</th></tr>
                                </thead>
                                <tbody>
                                    {filteredSewReportRows.length ? filteredSewReportRows.map((row: any) => (
                                        <tr key={row.id}>
                                            <td>{row.date}</td>
                                            <td><b>{row.fabric}</b></td>
                                            <td>{row.style}</td>
                                            <td>{row.color}</td>
                                            <td>{row.size}</td>
                                            <td>{row.input > 0 ? <b>{num(row.input)}</b> : '—'}</td>
                                            <td>{row.output > 0 ? <b style={{ color: '#10b981' }}>{num(row.output)}</b> : '—'}</td>
                                            <td>{row.waste > 0 ? <span className="admin-status warning">{num(row.waste)}</span> : '—'}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={8} className="empty-cell">{locale === 'en' ? 'No sewing records match the selected dates.' : 'Aucun enregistrement ne correspond aux dates sélectionnées.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <footer><span>{user.current_factory?.name || 'NOGUCHI HOLDINGS LTD'} · {locale === 'en' ? 'SEWING OPERATIONS' : 'OPÉRATIONS DE COUTURE'}</span><span>Generated by ICYEREKEZO OMS</span></footer>
                    </article>
                </div>
            )}
        </section>
    );
}
