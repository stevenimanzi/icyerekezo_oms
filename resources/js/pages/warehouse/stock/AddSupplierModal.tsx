import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { postJson } from '../../../core/liveData';
import type { StockText } from './text';
import type { SupplierOption } from './types';

type Props = {
    text: StockText;
    onClose: () => void;
    onSaved: (supplier: SupplierOption) => void;
};

/** Saves a new supplier with every contact detail, so later deliveries can pick it from a list. */
export function AddSupplierModal({ text, onClose, onSaved }: Props) {
    const t = text.supplier;
    const [form, setForm] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        payment_terms_days: '',
        notes: '',
    });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
        setForm({ ...form, [key]: event.target.value });
    const ready = form.name.trim().length > 1 && form.phone.trim().length > 2;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await postJson<{ supplier: SupplierOption }>('/api/stock/suppliers', {
                name: form.name.trim(),
                contact_person: form.contact_person.trim() || null,
                phone: form.phone.trim(),
                email: form.email.trim() || null,
                address: form.address.trim() || null,
                tax_number: form.tax_number.trim() || null,
                payment_terms_days:
                    form.payment_terms_days === '' ? null : Number(form.payment_terms_days),
                notes: form.notes.trim() || null,
            });
            onSaved(result.supplier);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={t.title}
            onClose={onClose}
            footer={
                <>
                    <button className="secondary-btn" onClick={onClose} disabled={busy}>
                        {text.cancel}
                    </button>
                    <button className="primary-btn" onClick={submit} disabled={busy || !ready}>
                        {busy ? text.saving : t.save}
                    </button>
                </>
            }
        >
            {error && <div className="ui-error">{error}</div>}
            <label className="ui-field">
                {t.name}
                <input value={form.name} onChange={set('name')} autoFocus />
            </label>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.contactPerson}
                    <input value={form.contact_person} onChange={set('contact_person')} />
                </label>
                <label className="ui-field">
                    {t.phone}
                    <input type="tel" value={form.phone} onChange={set('phone')} />
                </label>
            </div>
            <div className="ui-grid">
                <label className="ui-field">
                    {t.email}
                    <input type="email" value={form.email} onChange={set('email')} />
                </label>
                <label className="ui-field">
                    {t.tax}
                    <input value={form.tax_number} onChange={set('tax_number')} />
                </label>
            </div>
            <label className="ui-field">
                {t.address}
                <input value={form.address} onChange={set('address')} />
            </label>
            <label className="ui-field">
                {t.terms}
                <input
                    type="number"
                    min={0}
                    max={365}
                    step={1}
                    value={form.payment_terms_days}
                    onChange={set('payment_terms_days')}
                />
                <span className="ui-help">{t.termsHint}</span>
            </label>
            <label className="ui-field">
                {t.notes}
                <textarea rows={2} value={form.notes} onChange={set('notes')} />
            </label>
        </Modal>
    );
}
