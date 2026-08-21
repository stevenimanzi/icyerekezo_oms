import React from 'react';
import { AlertTriangle } from 'lucide-react';

export type Locale = 'en' | 'fr';

const csrfToken = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

/**
 * Shared fetch wrapper for the Cutting/Sewing/Finishing/Packing workspace pages:
 * attaches the CSRF header, parses JSON, and turns a non-2xx response (or a
 * non-JSON one, e.g. a session-expired HTML redirect) into a thrown Error with
 * a message the calling page's catch block can show directly.
 */
export async function productionApi<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), ...(options.headers ?? {}) },
    });
    const text = await response.text();
    let payload: any = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('The server returned an invalid response.');
    }
    if (!response.ok) throw new Error(payload.message || Object.values(payload.errors || {}).flat().join(' ') || 'Something went wrong.');
    return payload;
}

/**
 * The "insufficient stock" alert every workspace page shows when a submitted
 * quantity exceeds what's actually available on the floor.
 */
export function StockPopupModal({ message, onClose, locale }: { message: string; onClose: () => void; locale: Locale }) {
    if (!message) return null;
    return (
        <div className="school-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <section className="school-small-modal" role="alertdialog" aria-modal="true" aria-labelledby="stock-popup-title">
                <header>
                    <span><AlertTriangle size={24} /></span>
                    <div>
                        <h2 id="stock-popup-title">{locale === 'en' ? 'Insufficient stock' : 'Stock insuffisant'}</h2>
                        <p>{message}</p>
                    </div>
                </header>
                <footer>
                    <button className="primary-btn" autoFocus onClick={onClose}>{locale === 'en' ? 'OK' : 'D’accord'}</button>
                </footer>
            </section>
        </div>
    );
}

export type EditRecordForm = { id: string; quantity: string; reason: string };

/**
 * The quantity-correction modal every workspace page offers on its own recent
 * records (posts to /api/inventory/transactions/{id}/correct).
 */
export function EditRecordModal({ form, onChange, onCancel, onSave, busy, locale }: {
    form: EditRecordForm;
    onChange: (form: EditRecordForm) => void;
    onCancel: () => void;
    onSave: () => void;
    busy: boolean;
    locale: Locale;
}) {
    return (
        <div className="school-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
            <section className="school-small-modal">
                <header>
                    <div>
                        <h2>{locale === 'en' ? 'Edit Record' : 'Modifier l\'enregistrement'}</h2>
                        <p>{locale === 'en' ? 'Adjust the quantity if a mistake was made.' : 'Ajuster la quantité en cas d\'erreur.'}</p>
                    </div>
                </header>
                <div className="cutting-form-grid" style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <label>
                        <span>{locale === 'en' ? 'Corrected Quantity' : 'Quantité corrigée'}</span>
                        <input type="number" min="0.001" step="any" style={{ width: '100%', padding: '10px' }} value={form.quantity} onChange={e => onChange({ ...form, quantity: e.target.value })} />
                    </label>
                    <label className="cutting-full-width">
                        <span>{locale === 'en' ? 'Reason for correction' : 'Raison de la correction'}</span>
                        <textarea rows={3} style={{ width: '100%', padding: '10px' }} value={form.reason} onChange={e => onChange({ ...form, reason: e.target.value })} />
                    </label>
                </div>
                <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--soft)', borderRadius: '0 0 18px 18px' }}>
                    <button className="secondary-btn" onClick={onCancel}>{locale === 'en' ? 'Cancel' : 'Annuler'}</button>
                    <button className="primary-btn" disabled={busy} onClick={onSave}>{busy ? (locale === 'en' ? 'Saving...' : 'Enregistrement...') : (locale === 'en' ? 'Save Correction' : 'Enregistrer la correction')}</button>
                </footer>
            </section>
        </div>
    );
}
