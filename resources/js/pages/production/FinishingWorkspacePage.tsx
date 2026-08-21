import React, { useEffect, useState } from 'react';
import { Package, RefreshCw, Scissors, Send } from 'lucide-react';
import { EditRecordModal, EditRecordForm, Locale, productionApi, StockPopupModal } from './shared';

type FinishingTab = 'request' | 'materials' | 'finish';
type AuthUser = {
    id: number; name: string;
    current_factory: { name?: string; currency_code?: string } | null;
    system?: { currency_code?: string };
};

const copy = {
    en: {
        title: 'Finishing workspace',
        subtitle: 'Manage received pieces, record finishing output.',
        eyebrow: 'LIVE FINISHING DATA',
        tabs: { request: 'Receive pieces', materials: 'Request materials', finish: 'Finish pieces' },
        materialsTitle: 'Request raw materials',
        materialsDesc: 'Request materials like buttons, thread, or labels from the main warehouse.',
        requestMaterials: 'Submit request', requesting: 'Submitting...',
        selectItem: 'Select piece/material', quantity: 'Quantity received', reason: 'Reason / Notes',
        quantityPlaceholder: 'Enter quantity', reasonPlaceholder: 'Describe what you received...',
        pendingRequests: 'Accepted items', noRequests: 'No items accepted yet.',
        finishTitle: 'Record finished items',
        finishDesc: 'Log the items you have successfully finished in this session.',
        finishPlaceholder: 'e.g., 50',
        recordFinish: 'Record finishing output', recording: 'Recording...',
        recentFinish: 'Recent finishing records', noFinish: 'No finishing records yet. Record your first finish above.',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting...', loading: 'Loading...',
    },
    fr: {
        title: 'Espace de finition',
        subtitle: 'Gérez les pièces reçues et enregistrez la finition.',
        eyebrow: 'DONNÉES DE FINITION EN DIRECT',
        tabs: { request: 'Réceptionner', materials: 'Demander matériels', finish: 'Finition' },
        materialsTitle: 'Demander des matières premières',
        materialsDesc: 'Demandez des matériaux (boutons, fils, etc.) de l\'entrepôt principal.',
        requestMaterials: 'Soumettre', requesting: 'Soumission...',
        selectItem: 'Sélectionner la pièce', quantity: 'Quantité reçue', reason: 'Motif / Notes',
        quantityPlaceholder: 'Saisissez la quantité', reasonPlaceholder: 'Décrivez ce que vous avez reçu...',
        pendingRequests: 'Articles acceptés', noRequests: 'Aucun article accepté.',
        finishTitle: 'Enregistrer les articles finis',
        finishDesc: 'Enregistrez les articles que vous avez finis avec succès.',
        finishPlaceholder: 'ex : 50',
        recordFinish: 'Enregistrer la finition', recording: 'Enregistrement...',
        recentFinish: 'Finitions récentes', noFinish: 'Aucune finition enregistrée.',
        refresh: 'Actualiser', updated: 'Mis à jour', connecting: 'Connexion...', loading: 'Chargement...',
    },
};

export default function FinishingWorkspacePage({ user, locale, initialTab = 'request' }: { user: AuthUser; locale: Locale; initialTab?: FinishingTab }) {
    const t = copy[locale];
    const [tab, setTab] = useState<FinishingTab>(initialTab);
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
    const [editForm, setEditForm] = useState<EditRecordForm | null>(null);

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await productionApi<any>('/api/inventory/overview');
            setStock(overview.stock || []);
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
    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const requestableMaterials = stock.filter((s: any) => s.warehouse_id === mainWarehouseId && s.category === 'Raw Materials' && s.quantity_on_hand > 0);

    const finishingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve', 'receipt'].includes(String(tx.type || ''))
    );
    const finishOutputTransactions = finishingTransactions.filter((tx: any) =>
        tx.type === 'issue' && tx.warehouse_id === finishingWarehouseId && String(tx.reason || '').startsWith('[Finishing Output]')
    );
    const acceptedSewnPieces = finishingTransactions.filter((tx: any) =>
        tx.type === 'receipt' && String(tx.reason || '').includes('SewnID:')
    );

    // Rebuilds "what's on the finishing floor, ready to finish" from the accepted-receipt
    // and issue/waste transactions tagged with a shared SewnID.
    const finishingVirtualStock = new Map<string, { id: string; item_id: number; name: string; available_qty: number }>();
    acceptedSewnPieces.forEach((tx: any) => {
        const match = String(tx.reason).match(/SewnID:\s*([^\s|]+)/i);
        if (!match) return;
        const sewnId = match[1];
        if (!finishingVirtualStock.has(sewnId)) {
            const parts = sewnId.split('-');
            finishingVirtualStock.set(sewnId, {
                id: sewnId,
                item_id: tx.item_id,
                name: `${parts[1] || ''}${parts[2] ? ` / ${parts[2]}` : ''} (${parts[3] || ''}) - ${tx.item_name}`,
                available_qty: 0,
            });
        }
        finishingVirtualStock.get(sewnId)!.available_qty += Math.abs(tx.quantity_delta);
    });
    finishingTransactions.forEach((tx: any) => {
        if (!['issue', 'waste'].includes(tx.type) || !String(tx.reason).includes('SewnID:')) return;
        const match = String(tx.reason).match(/SewnID:\s*([^\s|]+)/i);
        if (match && finishingVirtualStock.has(match[1])) {
            finishingVirtualStock.get(match[1])!.available_qty -= Math.abs(tx.quantity_delta);
        }
    });
    const availableFinishingStock = Array.from(finishingVirtualStock.values()).filter(item => item.available_qty > 0);

    const todayFinished = finishOutputTransactions.filter((tx: any) => new Date(tx.occurred_at).toDateString() === new Date().toDateString());

    const clearMsg = () => { setError(''); setSuccess(''); };

    const acceptSewnPiece = async (piece: any) => {
        clearMsg();
        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(piece.item_id), warehouse_id: finishingWarehouseId, batch_id: Number(piece.id), type: 'receipt', quantity: Number(piece.available_qty), reason: `[Finishing Receipt] SewnID: ${piece.id} | Accepted from sewing` }),
            });
            setSuccess(locale === 'en' ? 'Sewn pieces received successfully!' : 'Pièces cousues reçues avec succès !');
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitMaterialRequest = async () => {
        clearMsg();
        if (!requestForm.item_id || !requestForm.quantity) {
            setError(locale === 'en' ? 'Please select a material and enter quantity.' : 'Veuillez sélectionner un matériel.');
            return;
        }
        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(requestForm.item_id), warehouse_id: mainWarehouseId, type: 'reserve', quantity: Number(requestForm.quantity), reason: `[Finishing Request] ${requestForm.reason || 'Material requested for finishing'}` }),
            });
            setSuccess(locale === 'en' ? 'Material request submitted successfully! Pending approval.' : 'Demande soumise avec succès !');
            setRequestForm({ item_id: '', quantity: '', reason: '' });
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitFinish = async () => {
        clearMsg();
        if (!finishForm.item_id || !finishForm.quantity) {
            setError(locale === 'en' ? 'Please select a sewn piece and enter the quantity finished.' : 'Veuillez sélectionner une pièce cousue et entrer la quantité finie.');
            return;
        }

        const selectedPiece = availableFinishingStock.find(s => s.id === finishForm.item_id);
        const available = selectedPiece?.available_qty || 0;
        if (Number(finishForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the finishing floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            const reason = `[Finishing Output] SewnID: ${selectedPiece!.id} | ${finishForm.quantity} items finished. ${finishForm.notes || ''}`;
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(selectedPiece!.item_id), warehouse_id: finishingWarehouseId, batch_id: Number(selectedPiece!.id), type: 'issue', quantity: Number(finishForm.quantity), reason }),
            });
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(selectedPiece!.item_id), warehouse_id: finishingWarehouseId, batch_id: Number(selectedPiece!.id), production_stage: 'finished', type: 'production_output', quantity: Number(finishForm.quantity), reason }),
            });
            setSuccess(locale === 'en' ? 'Finishing record saved successfully!' : 'Enregistrement de finition sauvegardé !');
            setFinishForm({ item_id: '', quantity: '', notes: '' });
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
        <section className="module-page finishing-workspace">
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
                {(['request', 'materials', 'finish'] as FinishingTab[]).map(key => (
                    <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                        {(key === 'request' || key === 'materials') && <Package size={16} />}
                        {key === 'finish' && <Scissors size={16} />}
                        <span>{t.tabs[key]}</span>
                    </button>
                ))}
            </div>

            {loading && !stock.length ? (
                <div className="panel" style={{ padding: '3rem', textAlign: 'center', opacity: .7 }}>{t.loading}</div>
            ) : tab === 'request' ? (
                <div className="sewing-tab-content">
                    <article className="panel">
                        <div className="panel-title"><h2>{locale === 'en' ? 'Pending sewn pieces' : 'Pièces cousues en attente'}</h2></div>
                        <p className="cutting-form-desc" style={{ padding: '0 20px' }}>
                            {locale === 'en' ? 'Accept sewn pieces from the sewing department to start finishing.' : 'Acceptez les pièces cousues du département de couture pour commencer à finir.'}
                        </p>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Sewn batch details' : 'Détails du lot'}</th><th>{locale === 'en' ? 'Quantity' : 'Quantité'}</th><th>{locale === 'en' ? 'Action' : 'Action'}</th></tr></thead>
                                <tbody>
                                    {sewnPieces.length ? sewnPieces.map((item: any) => (
                                        <tr key={item.id}>
                                            <td><b>{item.name}</b></td>
                                            <td>{num(item.available_qty)}</td>
                                            <td><button className="primary-btn" disabled={busy} onClick={() => acceptSewnPiece(item)}>{locale === 'en' ? 'Accept' : 'Accepter'}</button></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="empty-cell">{locale === 'en' ? 'No pending pieces from sewing.' : 'Aucune pièce en attente de la couture.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{acceptedSewnPieces.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Sewn product' : 'Produit cousu'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead>
                                <tbody>
                                    {acceptedSewnPieces.length ? acceptedSewnPieces.map((tx: any) => {
                                        let productName = tx.item_name;
                                        const match = String(tx.reason || '').match(/SewnID:\s*\d+-([^-]+)-([^-]*)-([^\s|]+)/);
                                        if (match) productName = `${match[1]}${match[2] ? ` / ${match[2]}` : ''} (${match[3]}) - ${tx.item_name}`;
                                        return (
                                            <tr key={tx.id}>
                                                <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                                <td><b>{productName}</b></td>
                                                <td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td>
                                                <td>{String(tx.reason || '').replace('[Finishing Receipt] ', '')}</td>
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
            ) : tab === 'materials' ? (
                <div className="sewing-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.materialsTitle}</h2></div>
                        <p className="cutting-form-desc">{t.materialsDesc}</p>
                        <div className="cutting-form-grid">
                            <label>
                                <span>{t.selectItem}</span>
                                <select value={requestForm.item_id} onChange={e => setRequestForm({ ...requestForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose material —' : '— Choisir un matériel —'}</option>
                                    {requestableMaterials.map((item: any) => <option key={item.id} value={item.item_id}>{item.name} ({num(item.quantity_on_hand)} {locale === 'en' ? 'in stock' : 'en stock'})</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{t.quantity}</span>
                                <input type="number" min="0.001" step="any" placeholder={t.quantityPlaceholder} value={requestForm.quantity} onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })} />
                            </label>
                            <label className="cutting-full-width">
                                <span>{t.reason}</span>
                                <input type="text" placeholder={t.reasonPlaceholder} value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn" disabled={busy} onClick={submitMaterialRequest}><Send size={17} />{busy ? t.requesting : t.requestMaterials}</button>
                        </div>
                    </article>
                </div>
            ) : (
                <div className="sewing-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.finishTitle}</h2></div>
                        <p className="cutting-form-desc">{t.finishDesc}</p>
                        <div className="cutting-form-grid">
                            <label>
                                <span>{locale === 'en' ? 'Material used (accepted sewn pieces)' : 'Matériel utilisé (pièces cousues acceptées)'}</span>
                                <select value={finishForm.item_id} onChange={e => setFinishForm({ ...finishForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose sewn piece —' : '— Choisir une pièce cousue —'}</option>
                                    {availableFinishingStock.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({num(s.available_qty)} items)</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Number of items finished' : 'Nombre d\'articles finis'}</span>
                                <input type="number" min="1" step="1" placeholder={t.finishPlaceholder} value={finishForm.quantity} onChange={e => setFinishForm({ ...finishForm, quantity: e.target.value })} />
                            </label>
                            <label className="cutting-full-width">
                                <span>{locale === 'en' ? 'Finishing notes' : 'Notes de finition'}</span>
                                <textarea rows={3} placeholder={locale === 'en' ? 'Any issues or observations...' : 'Tout problème ou observation...'} value={finishForm.notes} onChange={e => setFinishForm({ ...finishForm, notes: e.target.value })} maxLength={500} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn" disabled={busy} onClick={submitFinish}><Scissors size={17} />{busy ? t.recording : t.recordFinish}</button>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.recentFinish}</h2><span>{todayFinished.length} {locale === 'en' ? 'records today' : 'enregistrements aujourd\'hui'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Output' : 'Sortie'}</th><th>{locale === 'en' ? 'Quantity finished' : 'Quantité finie'}</th><th>{locale === 'en' ? 'Details' : 'Détails'}</th><th></th></tr></thead>
                                <tbody>
                                    {todayFinished.length ? todayFinished.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td>{num(Math.abs(tx.quantity_delta))}</td>
                                            <td>{String(tx.reason || '').replace('[Finishing Output] ', '')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="secondary-btn" style={{ padding: '4px 8px' }} onClick={() => setEditForm({ id: tx.id, quantity: String(Math.abs(tx.quantity_delta)), reason: String(tx.reason || '') })}>
                                                    {locale === 'en' ? 'Edit' : 'Modifier'}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="empty-cell">{t.noFinish}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </div>
            )}
        </section>
    );
}
