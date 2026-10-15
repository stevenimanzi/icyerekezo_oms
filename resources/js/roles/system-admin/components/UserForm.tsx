import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

export function UserForm({ open, factories, roles, submit, editUser, cancel }: any) {
    const [values, setValues] = useState<any>({});

    useEffect(() => {
        if (open && editUser) {
            const factory = editUser.factories?.[0] || editUser.school;
            setValues({
                id: editUser.id,
                name: editUser.name,
                email: editUser.email,
                factory_id: factory?.id || '',
                role_slug: editUser.roles?.[0]?.slug || '',
            });
        } else if (open && !editUser) {
            setValues({});
        }
    }, [open, editUser]);

    const selected = factories.find((f: any) => String(f.id) === String(values.factory_id));
    if (!open) return null;

    const userFields: [string, string, string, boolean][] = [
        ['name', 'Full name', 'text', true],
        ['email', 'Email address', 'email', true],
        ...(!editUser
            ? ([
                  ['employee_number', 'Employee number', 'text', true],
                  ['job_title', 'Job title', 'text', false],
              ] as any)
            : []),
        [
            'password',
            editUser ? 'New Password (leave blank to keep current)' : 'Temporary password',
            'password',
            !editUser,
        ],
    ];

    return (
        <form
            className="admin-form panel"
            onSubmit={(e) => {
                e.preventDefault();
                submit(values);
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                }}
            >
                <h2 style={{ margin: 0 }}>{editUser ? 'Edit user' : 'Create factory user'}</h2>
                <button type="button" className="secondary-btn" onClick={cancel}>
                    Cancel
                </button>
            </div>
            <div className="form-grid">
                <label>
                    Factory / Assignment
                    <select
                        required={!editUser}
                        disabled={!!editUser}
                        value={values.factory_id || ''}
                        onChange={(e) =>
                            setValues({
                                ...values,
                                factory_id: e.target.value,
                                role_slug: '',
                                role_id: '',
                            })
                        }
                    >
                        <option value="">
                            {editUser && values.factory_id ? 'Assigned' : 'Select factory'}
                        </option>
                        {factories.map((f: any) => (
                            <option key={f.id} value={f.id}>
                                {f.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Role
                    <select
                        required={!editUser}
                        value={values.role_slug || values.role_id || ''}
                        onChange={(e) =>
                            setValues({
                                ...values,
                                [editUser ? 'role_slug' : 'role_id']: e.target.value,
                            })
                        }
                    >
                        <option value="">Select role</option>
                        {(editUser ? roles : selected?.roles || []).map((r: any) => (
                            <option key={r.slug || r.id} value={editUser ? r.slug : r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </label>
                {userFields.map(([key, label, type, req]) => (
                    <label key={key}>
                        {label}
                        <input
                            required={req}
                            type={type as string}
                            value={values[key] || ''}
                            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        />
                    </label>
                ))}
            </div>
            <button className="primary-btn">
                <Save size={16} /> {editUser ? 'Save changes' : 'Create user account'}
            </button>
        </form>
    );
}
