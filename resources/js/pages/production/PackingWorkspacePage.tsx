import React, { useEffect, useState } from 'react';
import { Package, PackageCheck, RefreshCw, Scissors } from 'lucide-react';
import { EditRecordModal, EditRecordForm, Locale, productionApi, StockPopupModal } from './shared';

type PackingTab = 'request' | 'finish';
type AuthUser = {
    id: number; name: string;
    current_factory: { name?: string; currency_code?: string } | null;
    system?: { currency_code?: string };
};

const copy = {
    en: {
        title: 'Packing workspace',
        subtitle: 'Manage received pieces, record packing output.',
        eyebrow: 'PACKING DATA',
        tabs: { request: 'Receive pieces', finish: 'Pack pieces' },
        requestTitle: 'Receive pieces from Finishing',
        selectItem: 'Select piece/material', quantity: 'Quantity received', reason: 'Reason / Notes',
        pendingRequests: 'Accepted items', noRequests: 'No items accepted yet.',
        finishedTitle: 'Record packed items',
        finishedDesc: 'Log the items you have successfully packed in this session.',
        finishedPlaceholder: 'e.g., 50',
        recordFinished: 'Record packing output', recording: 'Recording...',
        recentFinished: 'Recent packing records', noFinished: 'No packing records yet. Record your first packing output above.',
        refresh: 'Refresh data', updated: 'Updated', connecting: 'Connecting...', loading: 'Loading...',
    },
    fr: {
        title: 'Espace d\'emballage',
        subtitle: 'Gérez les pièces reçues et enregistrez l\'emballage.',
        eyebrow: 'DONNÉES D\'EMBALLAGE',
        tabs: { request: 'Réceptionner', finish: 'Emballer' },
        requestTitle: 'Réceptionner les pièces de la finition',
        selectItem: 'Sélectionner la pièce', quantity: 'Quantité reçue', reason: 'Motif / Notes',
        pendingRequests: 'Articles acceptés', noRequests: 'Aucun article accepté.',
        finishedTitle: 'Enregistrer les articles emballés',
        finishedDesc: 'Enregistrez les articles que vous avez emballés avec succès.',
        finishedPlaceholder: 'ex : 50',
        recordFinished: 'Enregistrer l\'emballage', recording: 'Enregistrement...',
        recentFinished: 'Emballages récents', noFinished: 'Aucun emballage enregistré.',
        refresh: 'Actualiser', updated: 'Mis à jour', connecting: 'Connexion...', loading: 'Chargement...',
    },
};

export default function PackingWorkspacePage({ user, locale, initialTab = 'request' }: { user: AuthUser; locale: Locale; initialTab?: PackingTab }) {
    const t = copy[locale];
    const [tab, setTab] = useState<PackingTab>(initialTab);
    const [items, setItems] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [finishedPieces, setFinishedPieces] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [stockPopup, setStockPopup] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    const [finishForm, setFinishForm] = useState({ item_id: '', finished_item_id: '', quantity: '', notes: '' });
    const [editForm, setEditForm] = useState<EditRecordForm | null>(null);
    const [newProductName, setNewProductName] = useState('');
    const [addingProduct, setAddingProduct] = useState(false);

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const overview = await productionApi<any>('/api/inventory/overview');
            setStock(overview.stock || []);
            setItems(overview.catalog || []);
            setTransactions(overview.recent_transactions || overview.transactions || []);
            setFinishedPieces(overview.finished_pieces || []);
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

    const packingWarehouseId = warehouses.find(w => w.code === 'SEW' || /packing/i.test(w.name))?.id || 1;
    const num = (v: any) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

    const finishedProducts = items.filter((item: any) => item.type === 'finished_good');

    const packingTransactions = transactions.filter((tx: any) =>
        ['issue', 'production_output', 'waste', 'adjustment_out', 'reserve', 'receipt'].includes(String(tx.type || ''))
    );
    const packOutputTransactions = packingTransactions.filter((tx: any) =>
        tx.type === 'issue' && tx.warehouse_id === packingWarehouseId && String(tx.reason || '').startsWith('[Packing Output]')
    );
    const acceptedFinishedPieces = packingTransactions.filter((tx: any) =>
        tx.type === 'receipt' && String(tx.reason || '').includes('FinishedID:')
    );

    // Rebuilds "what's on the packing floor, ready to pack" from the accepted-receipt
    // and issue/waste transactions tagged with a shared FinishedID, since the backend
    // doesn't expose a per-warehouse breakdown of finished_pieces here.
    const packingVirtualStock = new Map<string, { id: string; item_id: number; name: string; available_qty: number }>();
    acceptedFinishedPieces.forEach((tx: any) => {
        const match = String(tx.reason).match(/FinishedID:\s*([^\s|]+)/i);
        if (!match) return;
        const finishedId = match[1];
        if (!packingVirtualStock.has(finishedId)) {
            const parts = finishedId.split('-');
            packingVirtualStock.set(finishedId, {
                id: finishedId,
                item_id: tx.item_id,
                name: `${parts[1] || ''}${parts[2] ? ` / ${parts[2]}` : ''} (${parts[3] || ''}) - ${tx.item_name}`,
                available_qty: 0,
            });
        }
        packingVirtualStock.get(finishedId)!.available_qty += Math.abs(tx.quantity_delta);
    });
    packingTransactions.forEach((tx: any) => {
        if (!['issue', 'waste'].includes(tx.type) || !String(tx.reason).includes('FinishedID:')) return;
        const match = String(tx.reason).match(/FinishedID:\s*([^\s|]+)/i);
        if (match && packingVirtualStock.has(match[1])) {
            packingVirtualStock.get(match[1])!.available_qty -= Math.abs(tx.quantity_delta);
        }
    });
    const availablePackingStock = Array.from(packingVirtualStock.values()).filter(item => item.available_qty > 0);

    const todayPacked = packOutputTransactions.filter((tx: any) => new Date(tx.occurred_at).toDateString() === new Date().toDateString());

    const clearMsg = () => { setError(''); setSuccess(''); };

    const acceptFinishedPiece = async (piece: any) => {
        clearMsg();
        setBusy(true);
        try {
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(piece.item_id), warehouse_id: packingWarehouseId, batch_id: Number(piece.id), type: 'receipt', quantity: Number(piece.available_qty), reason: `[Packing Receipt] FinishedID: ${piece.id} | Accepted from Finishing` }),
            });
            setSuccess(locale === 'en' ? 'Finished pieces received successfully!' : 'Pièces finies reçues avec succès !');
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setBusy(false); }
    };

    const submitFinish = async () => {
        clearMsg();
        if (!finishForm.item_id || !finishForm.quantity) {
            setError(locale === 'en' ? 'Please select a finished piece and enter the quantity packed.' : 'Veuillez sélectionner une pièce finie et entrer la quantité emballée.');
            return;
        }
        if (!finishForm.finished_item_id) {
            setError(locale === 'en' ? 'Please choose which product this batch is (or add a new one).' : 'Veuillez choisir le produit correspondant à ce lot.');
            return;
        }

        const selectedPiece = availablePackingStock.find(s => s.id === finishForm.item_id);
        const available = selectedPiece?.available_qty || 0;
        if (Number(finishForm.quantity) > available) {
            setStockPopup(locale === 'en' ? `Insufficient stock. You only have ${num(available)} available on the packing floor.` : `Stock insuffisant. Vous n'avez que ${num(available)} disponible.`);
            return;
        }

        setBusy(true);
        try {
            const reason = `[Packing Output] FinishedID: ${selectedPiece!.id} | ${finishForm.quantity} items finished. ${finishForm.notes || ''}`;
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(selectedPiece!.item_id), warehouse_id: packingWarehouseId, batch_id: Number(selectedPiece!.id), type: 'issue', quantity: Number(finishForm.quantity), reason }),
            });
            await productionApi('/api/inventory/transactions', {
                method: 'POST',
                body: JSON.stringify({ item_id: Number(finishForm.finished_item_id), warehouse_id: packingWarehouseId, batch_id: Number(selectedPiece!.id), production_stage: 'packed', type: 'production_output', quantity: Number(finishForm.quantity), reason }),
            });
            setSuccess(locale === 'en' ? 'Packing record saved successfully!' : 'Enregistrement d\'emballage sauvegardé !');
            setFinishForm({ item_id: '', finished_item_id: '', quantity: '', notes: '' });
            await load(true);
        } catch (r: any) {
            if (/insufficient stock|stock insuffisant/i.test(String(r.message || ''))) setStockPopup(r.message);
            else setError(r.message);
        } finally { setBusy(false); }
    };

    const addFinishedProduct = async () => {
        clearMsg();
        if (!newProductName.trim()) return;
        setAddingProduct(true);
        try {
            const product = await productionApi<any>('/api/inventory/finished-items', { method: 'POST', body: JSON.stringify({ name: newProductName.trim() }) });
            setNewProductName('');
            setFinishForm(f => ({ ...f, finished_item_id: String(product.id) }));
            await load(true);
        } catch (r: any) { setError(r.message); } finally { setAddingProduct(false); }
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
        <section className="module-page packing-workspace">
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
                {(['request', 'finish'] as PackingTab[]).map(key => (
                    <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); clearMsg(); }}>
                        {key === 'request' && <Package size={16} />}
                        {key === 'finish' && <PackageCheck size={16} />}
                        <span>{t.tabs[key]}</span>
                    </button>
                ))}
            </div>

            {loading && !stock.length ? (
                <div className="panel" style={{ padding: '3rem', textAlign: 'center', opacity: .7 }}>{t.loading}</div>
            ) : tab === 'request' ? (
                <div className="sewing-tab-content">
                    <article className="panel">
                        <div className="panel-title"><h2>{locale === 'en' ? 'Pending finished pieces' : 'Pièces finies en attente'}</h2></div>
                        <p className="cutting-form-desc" style={{ padding: '0 20px' }}>
                            {locale === 'en' ? 'Accept finished pieces from the Finishing department to start packing.' : 'Acceptez les pièces finies du département de finition pour commencer à emballer.'}
                        </p>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Finished batch details' : 'Détails du lot'}</th><th>{locale === 'en' ? 'Quantity' : 'Quantité'}</th><th>{locale === 'en' ? 'Action' : 'Action'}</th></tr></thead>
                                <tbody>
                                    {finishedPieces.length ? finishedPieces.map((item: any) => (
                                        <tr key={item.id}>
                                            <td><b>{item.name}</b></td>
                                            <td>{num(item.available_qty)}</td>
                                            <td><button className="primary-btn" disabled={busy} onClick={() => acceptFinishedPiece(item)}>{locale === 'en' ? 'Accept' : 'Accepter'}</button></td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="empty-cell">{locale === 'en' ? 'No pending pieces from Finishing.' : 'Aucune pièce en attente de la finition.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.pendingRequests}</h2><span>{acceptedFinishedPieces.length} {locale === 'en' ? 'records' : 'enregistrements'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Finished product' : 'Produit fini'}</th><th>{t.quantity}</th><th>{t.reason}</th></tr></thead>
                                <tbody>
                                    {acceptedFinishedPieces.length ? acceptedFinishedPieces.map((tx: any) => {
                                        let productName = tx.item_name;
                                        const match = String(tx.reason || '').match(/FinishedID:\s*\d+-([^-]+)-([^-]*)-([^\s|]+)/);
                                        if (match) productName = `${match[1]}${match[2] ? ` / ${match[2]}` : ''} (${match[3]}) - ${tx.item_name}`;
                                        return (
                                            <tr key={tx.id}>
                                                <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                                <td><b>{productName}</b></td>
                                                <td>{num(Math.abs(tx.quantity_delta))} {tx.unit || ''}</td>
                                                <td>{String(tx.reason || '').replace('[Packing Receipt] ', '')}</td>
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
            ) : (
                <div className="sewing-tab-content">
                    <article className="panel cutting-form-panel">
                        <div className="panel-title"><h2>{t.finishedTitle}</h2></div>
                        <p className="cutting-form-desc">{t.finishedDesc}</p>
                        <div className="cutting-form-grid">
                            <label>
                                <span>{locale === 'en' ? 'Material used (accepted finished pieces)' : 'Matériel utilisé (pièces finies acceptées)'}</span>
                                <select value={finishForm.item_id} onChange={e => setFinishForm({ ...finishForm, item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose finished piece —' : '— Choisir une pièce finie —'}</option>
                                    {availablePackingStock.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({num(s.available_qty)} items)</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Number of items packed' : 'Nombre d\'articles emballés'}</span>
                                <input type="number" min="1" step="1" placeholder={t.finishedPlaceholder} value={finishForm.quantity} onChange={e => setFinishForm({ ...finishForm, quantity: e.target.value })} />
                            </label>
                            <label>
                                <span>{locale === 'en' ? 'Finished product' : 'Produit fini'}</span>
                                <select value={finishForm.finished_item_id} onChange={e => setFinishForm({ ...finishForm, finished_item_id: e.target.value })}>
                                    <option value="">{locale === 'en' ? '— Choose product —' : '— Choisir un produit —'}</option>
                                    {finishedProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </label>
                            <label className="cutting-full-width">
                                <span>{locale === 'en' ? 'New product (if not listed above)' : 'Nouveau produit (si absent ci-dessus)'}</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="text" placeholder={locale === 'en' ? 'e.g., T-Shirt' : 'ex : T-Shirt'} value={newProductName} onChange={e => setNewProductName(e.target.value)} maxLength={160} />
                                    <button type="button" className="secondary-btn" disabled={addingProduct || !newProductName.trim()} onClick={addFinishedProduct}>
                                        {addingProduct ? (locale === 'en' ? 'Adding…' : 'Ajout…') : (locale === 'en' ? 'Add' : 'Ajouter')}
                                    </button>
                                </div>
                            </label>
                            <label className="cutting-full-width">
                                <span>{locale === 'en' ? 'Packing notes' : 'Notes d\'emballage'}</span>
                                <textarea rows={3} placeholder={locale === 'en' ? 'Any issues or observations...' : 'Tout problème ou observation...'} value={finishForm.notes} onChange={e => setFinishForm({ ...finishForm, notes: e.target.value })} maxLength={500} />
                            </label>
                        </div>
                        <div className="cutting-form-actions">
                            <button className="primary-btn" disabled={busy} onClick={submitFinish}><Scissors size={17} />{busy ? t.recording : t.recordFinished}</button>
                        </div>
                    </article>
                    <article className="panel">
                        <div className="panel-title"><h2>{t.recentFinished}</h2><span>{todayPacked.length} {locale === 'en' ? 'records today' : 'enregistrements aujourd\'hui'}</span></div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th>{locale === 'en' ? 'Date' : 'Date'}</th><th>{locale === 'en' ? 'Output' : 'Sortie'}</th><th>{locale === 'en' ? 'Quantity packed' : 'Quantité emballée'}</th><th>{locale === 'en' ? 'Details' : 'Détails'}</th><th></th></tr></thead>
                                <tbody>
                                    {todayPacked.length ? todayPacked.map((tx: any) => (
                                        <tr key={tx.id}>
                                            <td>{new Date(tx.occurred_at).toLocaleString()}</td>
                                            <td><b>{tx.item_name}</b></td>
                                            <td>{num(Math.abs(tx.quantity_delta))}</td>
                                            <td>{String(tx.reason || '').replace('[Packing Output] ', '')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="secondary-btn" style={{ padding: '4px 8px' }} onClick={() => setEditForm({ id: tx.id, quantity: String(Math.abs(tx.quantity_delta)), reason: String(tx.reason || '') })}>
                                                    {locale === 'en' ? 'Edit' : 'Modifier'}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="empty-cell">{t.noFinished}</td></tr>
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
