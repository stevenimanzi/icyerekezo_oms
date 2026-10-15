import { useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { AdminTable } from '../components/AdminTable';
import { Toggle } from '../components/Toggle';
import { UserForm } from '../components/UserForm';
import type { AdminContext } from '../useAdminData';

export function UsersScreen({ ctx }: { ctx: AdminContext }) {
    const { data, records, run, form, showForm, setShowForm, usersFilters, setUsersFilters } = ctx;
    const [editUser, setEditUser] = useState<any>(null);
    const [viewUser, setViewUser] = useState<any>(null);

    return (
        <>
            <div
                className="admin-form"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    padding: 16,
                    marginBottom: 14,
                }}
            >
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                    {['all', 'factories', 'schools'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setUsersFilters({ ...usersFilters, tab, page: 1 })}
                            className={`table-action ${usersFilters.tab === tab ? 'active' : ''}`}
                            style={
                                usersFilters.tab === tab
                                    ? {
                                          background: '#2563eb',
                                          color: '#ffffff',
                                          borderColor: '#2563eb',
                                          fontWeight: 'bold',
                                      }
                                    : {}
                            }
                        >
                            {tab === 'all'
                                ? 'All users'
                                : tab === 'factories'
                                  ? 'Factory users'
                                  : 'School users'}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input
                        placeholder="Search users by name or email"
                        value={usersFilters.search}
                        onChange={(e) =>
                            setUsersFilters({
                                ...usersFilters,
                                search: e.target.value,
                                page: 1,
                            })
                        }
                        style={{
                            padding: 9,
                            border: '1px solid var(--line)',
                            borderRadius: 7,
                            background: 'var(--panel)',
                            color: 'var(--text)',
                        }}
                    />
                    <select
                        value={usersFilters.role}
                        onChange={(e) =>
                            setUsersFilters({
                                ...usersFilters,
                                role: e.target.value,
                                page: 1,
                            })
                        }
                    >
                        <option value="">Any position / role</option>
                        {data?.roles?.map((r: any) => (
                            <option key={r.slug} value={r.slug}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={usersFilters.active}
                        onChange={(e) =>
                            setUsersFilters({
                                ...usersFilters,
                                active: e.target.value,
                                page: 1,
                            })
                        }
                    >
                        <option value="">Any status</option>
                        <option value="1">Active only</option>
                        <option value="0">Suspended only</option>
                    </select>
                </div>
            </div>

            {viewUser && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onClick={() => setViewUser(null)}
                >
                    <div
                        className="panel"
                        style={{
                            width: '100%',
                            maxWidth: 500,
                            padding: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h2 style={{ margin: 0 }}>User Details</h2>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => setViewUser(null)}
                            >
                                Close
                            </button>
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 12,
                            }}
                        >
                            <div style={{ gridColumn: '1 / -1' }}>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Name
                                </small>
                                <b>{viewUser.name}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Email
                                </small>
                                <b>{viewUser.email || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Username
                                </small>
                                <b>{viewUser.username || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Phone
                                </small>
                                <b>{viewUser.phone || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Role / Position
                                </small>
                                <b>
                                    {viewUser.roles && viewUser.roles.length > 0
                                        ? viewUser.roles.map((r: any) => r.name).join(', ')
                                        : 'No role'}
                                </b>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Assignment
                                </small>
                                <b>
                                    {viewUser.school
                                        ? `School: ${viewUser.school.name} (Factory: ${viewUser.school.factory?.name || 'Unknown'})`
                                        : viewUser.factories?.map((f: any) => f.name).join(', ') ||
                                          'Not assigned'}
                                </b>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Created at
                                </small>
                                <b>{new Date(viewUser.created_at).toLocaleString()}</b>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <UserForm
                open={showForm || !!editUser}
                factories={data?.factories || []}
                roles={data?.roles || []}
                editUser={editUser}
                cancel={() => {
                    setShowForm(false);
                    setEditUser(null);
                }}
                submit={(values: any) =>
                    editUser
                        ? run(
                              `/api/platform/users/${editUser.id}`,
                              'PATCH',
                              values,
                              'User updated successfully.',
                          ).then(() => setEditUser(null))
                        : run(
                              '/api/platform/users',
                              'POST',
                              values,
                              'Factory user created successfully.',
                          ).then(() => setShowForm(false))
                }
            />
            <AdminTable
                headers={['User', 'Email', 'Role / Position', 'Assignment', 'Active', 'Actions']}
                rows={records.map((item: any) => [
                    <b>{item.name}</b>,
                    item.email,
                    item.roles && item.roles.length > 0 ? (
                        item.roles.map((r: any) => r.name).join(', ')
                    ) : (
                        <span style={{ color: 'var(--muted)' }}>No role</span>
                    ),
                    item.school ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>School: {item.school.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                Factory: {item.school.factory?.name || 'Unknown'}
                            </span>
                        </div>
                    ) : (
                        item.factories?.map((f: any) => f.name).join(', ') || 'Not assigned'
                    ),
                    <Toggle
                        checked={item.is_active}
                        onChange={(value) =>
                            run(`/api/platform/users/${item.id}`, 'PATCH', {
                                is_active: value,
                            })
                        }
                    />,
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                            className="table-action"
                            style={{
                                border: 'none',
                                background: 'transparent',
                                padding: 4,
                            }}
                            title="View details"
                            onClick={() => setViewUser(item)}
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            className="table-action"
                            title="Edit User"
                            onClick={() => setEditUser(item)}
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            className="table-action"
                            style={{
                                border: 'none',
                                background: 'transparent',
                                padding: 4,
                            }}
                            title="Delete user"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        `Are you sure you want to completely delete ${item.email}? This action cannot be undone.`,
                                    )
                                )
                                    run(
                                        `/api/platform/users/${item.id}`,
                                        'DELETE',
                                        null,
                                        'User deleted successfully.',
                                    );
                            }}
                        >
                            <Trash2 size={16} color="red" />
                        </button>
                    </div>,
                ])}
            />

            {data?.users && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 14,
                    }}
                >
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Showing page {data.users.current_page || 1} of {data.users.last_page || 1} (
                        {data.users.total || 0} total)
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="secondary-btn"
                            disabled={!data.users.current_page || data.users.current_page === 1}
                            onClick={() =>
                                setUsersFilters({
                                    ...usersFilters,
                                    page: (data.users.current_page || 1) - 1,
                                })
                            }
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            className="secondary-btn"
                            disabled={
                                !data.users.last_page ||
                                data.users.current_page === data.users.last_page
                            }
                            onClick={() =>
                                setUsersFilters({
                                    ...usersFilters,
                                    page: (data.users.current_page || 1) + 1,
                                })
                            }
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
