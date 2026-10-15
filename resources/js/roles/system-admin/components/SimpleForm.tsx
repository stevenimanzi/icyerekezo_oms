import { Save } from 'lucide-react';

export function SimpleForm({ open, fields, form, setForm, submit }: any) {
    if (!open) return null;
    const values = { ...form };
    fields.forEach(([key, , type = 'text', options]: any) => {
        if (type === 'select' && !values[key]) values[key] = options[0];
    });
    return (
        <form
            className="admin-form panel"
            onSubmit={(e) => {
                e.preventDefault();
                submit(values);
            }}
        >
            <h2>Enter details</h2>
            <div className="form-grid">
                {fields.map(([key, label, type = 'text', options]: any) => (
                    <label key={key}>
                        {label}
                        {type === 'textarea' ? (
                            <textarea
                                required
                                value={form[key] || ''}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            />
                        ) : type === 'select' ? (
                            <select
                                required
                                value={values[key]}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            >
                                {options.map((o: string) => (
                                    <option key={o} value={o}>
                                        {o.replaceAll('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                required
                                type={type}
                                value={form[key] || ''}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            />
                        )}
                    </label>
                ))}
            </div>
            <button className="primary-btn" type="submit">
                <Save size={16} />
                Save
            </button>
        </form>
    );
}
