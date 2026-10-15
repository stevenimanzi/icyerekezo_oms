import { Save } from 'lucide-react';
import { industries } from '../industries';

export function FactoryForm({ open, form, setForm, submit }: any) {
    if (!open) return null;
    const update = (key: string, value: string) => setForm({ ...form, [key]: value });
    const credentialFields: [string, string, string][] = [
        ['owner_name', 'Owner name', 'text'],
        ['owner_email', 'Owner email', 'email'],
        ['owner_password', 'Owner temporary password', 'password'],
        ['manager_name', 'Factory manager name', 'text'],
        ['manager_email', 'Factory manager email', 'email'],
        ['manager_password', 'Manager temporary password', 'password'],
    ];
    return (
        <form
            className="admin-form panel"
            onSubmit={(e) => {
                e.preventDefault();
                submit({
                    ...form,
                    industry_type:
                        form.industry_type === 'other' ? form.industry_other : form.industry_type,
                });
            }}
        >
            <h2>Register factory, owner and manager</h2>
            <div className="form-grid">
                <label>
                    Factory name
                    <input
                        required
                        value={form.factory_name || ''}
                        onChange={(e) => update('factory_name', e.target.value)}
                    />
                </label>
                <label>
                    Industry type
                    <select
                        required
                        value={form.industry_type || ''}
                        onChange={(e) => update('industry_type', e.target.value)}
                    >
                        <option value="">Choose factory industry</option>
                        {industries.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                {form.industry_type === 'other' && (
                    <label>
                        Custom industry name
                        <input
                            required
                            value={form.industry_other || ''}
                            onChange={(e) => update('industry_other', e.target.value)}
                        />
                    </label>
                )}
                {credentialFields.map(([key, label, type]) => (
                    <label key={key}>
                        {label}
                        <input
                            required
                            type={type}
                            value={form[key] || ''}
                            onChange={(e) => update(key, e.target.value)}
                        />
                    </label>
                ))}
            </div>
            <button className="primary-btn">
                <Save size={16} />
                Register factory
            </button>
        </form>
    );
}
