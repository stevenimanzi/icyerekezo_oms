import { useEffect, useState } from 'react';
import { CreditCard, Eye, Save, Trash2, Users } from 'lucide-react';
import { request } from '../api';
import { AdminTable } from '../components/AdminTable';
import { Status } from '../components/Status';
import { FactoryForm } from '../components/FactoryForm';
import type { AdminContext } from '../useAdminData';

export function FactoriesScreen({ ctx }: { ctx: AdminContext }) {
    const { records, run, form, setForm, showForm } = ctx;
    const [viewFactory, setViewFactory] = useState<any>(null);
    const [subscriptionFactory, setSubscriptionFactory] = useState<any>(null);
    const [subPlans, setSubPlans] = useState<any[]>([]);

    useEffect(() => {
        if (subscriptionFactory && subPlans.length === 0) {
            request('/api/platform/subscriptions').then((res) => setSubPlans(res.plans || []));
        }
    }, [subscriptionFactory]);

    return (
        <>
            <FactoryForm
                open={showForm}
                form={form}
                setForm={setForm}
                submit={(values: any) =>
                    run(
                        '/api/platform/factories',
                        'POST',
                        values,
                        'Factory registered and awaiting approval.',
                    )
                }
            />
            <AdminTable
                headers={['Factory', 'Industry', 'Users', 'Status', 'Action']}
                rows={records.map((item: any) => [
                    <b>{item.name}</b>,
                    item.industry_type || '—',
                    item.users_count,
                    <Status value={item.status} />,
                    <div
                        style={{
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                            width: '100%',
                        }}
                    >
                        <select
                            value={item.status}
                            onChange={(event) =>
                                run(
                                    `/api/platform/factories/${item.id}`,
                                    'PATCH',
                                    { status: event.target.value },
                                    'Factory status updated.',
                                )
                            }
                        >
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <div style={{ flex: 1 }}></div>
                        <button
                            type="button"
                            className="table-action"
                            title="Change subscription"
                            onClick={() => setSubscriptionFactory(item)}
                        >
                            <CreditCard size={16} />
                        </button>
                        <button
                            type="button"
                            className="table-action"
                            title="View details"
                            onClick={() => setViewFactory(item)}
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            type="button"
                            className="table-action"
                            title="Delete factory"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        'Are you sure you want to completely delete this factory?',
                                    )
                                )
                                    run(
                                        `/api/platform/factories/${item.id}`,
                                        'DELETE',
                                        undefined,
                                        'Factory deleted.',
                                    );
                            }}
                        >
                            <Trash2 size={16} color="red" />
                        </button>
                    </div>,
                ])}
            />
            {subscriptionFactory && (
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
                    onClick={() => setSubscriptionFactory(null)}
                >
                    <form
                        className="panel admin-form"
                        style={{
                            width: '100%',
                            maxWidth: 500,
                            padding: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(
                                `/api/platform/factories/${subscriptionFactory.id}/subscriptions`,
                                'POST',
                                {
                                    subscription_plan_id: e.currentTarget.plan_id.value,
                                    starts_at: e.currentTarget.starts_at.value,
                                    ends_at: e.currentTarget.ends_at.value,
                                    status: 'active',
                                },
                                'Subscription extended',
                            ).then(() => setSubscriptionFactory(null));
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h2 style={{ margin: 0 }}>Extend Subscription</h2>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => setSubscriptionFactory(null)}
                            >
                                Close
                            </button>
                        </div>
                        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                            <label>
                                Plan
                                <select
                                    name="plan_id"
                                    defaultValue={
                                        subscriptionFactory.subscriptions?.[0]
                                            ?.subscription_plan_id || ''
                                    }
                                    required
                                >
                                    <option value="">Select plan</option>
                                    {subPlans.map((p: any) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Start Date
                                <input
                                    type="date"
                                    name="starts_at"
                                    defaultValue={
                                        subscriptionFactory.subscriptions?.[0]?.starts_at
                                            ? new Date(
                                                  subscriptionFactory.subscriptions[0].starts_at,
                                              )
                                                  .toISOString()
                                                  .slice(0, 10)
                                            : new Date().toISOString().slice(0, 10)
                                    }
                                    required
                                />
                            </label>
                            <label>
                                End Date
                                <input
                                    type="date"
                                    name="ends_at"
                                    defaultValue={
                                        subscriptionFactory.subscriptions?.[0]?.ends_at
                                            ? new Date(subscriptionFactory.subscriptions[0].ends_at)
                                                  .toISOString()
                                                  .slice(0, 10)
                                            : ''
                                    }
                                    required
                                />
                            </label>
                        </div>
                        <button className="primary-btn">Save Changes</button>
                    </form>
                </div>
            )}
            {viewFactory && (
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
                    onClick={() => setViewFactory(null)}
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
                            <h2 style={{ margin: 0 }}>Factory Details</h2>
                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => setViewFactory(null)}
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
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Name
                                </small>
                                <b>{viewFactory.name}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Industry
                                </small>
                                <b>{viewFactory.industry_type || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Email
                                </small>
                                <b>{viewFactory.email || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Phone
                                </small>
                                <b>{viewFactory.phone || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Currency
                                </small>
                                <b>{viewFactory.currency_code || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Timezone
                                </small>
                                <b>{viewFactory.timezone || '-'}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Users Count
                                </small>
                                <b>{viewFactory.users_count || 0}</b>
                            </div>
                            <div>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Status
                                </small>
                                <b>{viewFactory.status || '-'}</b>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                    Created at
                                </small>
                                <b>{new Date(viewFactory.created_at).toLocaleString()}</b>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
