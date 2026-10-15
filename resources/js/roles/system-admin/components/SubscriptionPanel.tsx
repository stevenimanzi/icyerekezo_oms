import React, { useState } from 'react';
import { CheckCircle2, Clock, CreditCard, Plus, Save, TrendingUp, X } from 'lucide-react';
import { AdminTable } from './AdminTable';
import { Status } from './Status';

export function SubscriptionPanel({
    data,
    open,
    close,
    busy,
    submitPlan,
    updatePlan,
    assign,
    changeSubscription,
}: any) {
    const today = localDate(new Date());
    const catalog = Object.entries(data?.feature_catalog || {});
    const [modalTab, setModalTab] = useState<'assign' | 'plan'>('assign');
    const [template, setTemplate] = useState('');
    const [plan, setPlan] = useState<any>({ currency_code: 'RWF', features: [] });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [subscription, setSubscription] = useState<any>({
        starts_at: today,
        ends_at: dateAfter(today, 1),
        grace_ends_at: dateAfter(today, 1, 7),
    });
    const [changes, setChanges] = useState<Record<number, string>>({});
    const [dateChanges, setDateChanges] = useState<Record<number, string>>({});
    const selectedPlan = (data?.plans || []).find(
        (item: any) => String(item.id) === String(subscription.subscription_plan_id),
    );

    const closeModal = () => {
        setEditingId(null);
        setPlan({ currency_code: 'RWF', features: [] });
        if (close) close();
    };

    const updateStart = (starts_at: string) =>
        setSubscription({
            ...subscription,
            starts_at,
            ends_at: dateAfter(starts_at, 1),
            grace_ends_at: dateAfter(starts_at, 1, 7),
        });
    const updateEnd = (ends_at: string) =>
        setSubscription({ ...subscription, ends_at, grace_ends_at: dateAfter(ends_at, 0, 7) });
    const chooseTemplate = (value: string) => {
        setTemplate(value);
        setPlan(
            value
                ? { ...planTemplates[value], features: [...planTemplates[value].features] }
                : { currency_code: 'RWF', features: [] },
        );
    };
    const edit = (item: any) => {
        setEditingId(item.id);
        setTemplate('');
        setPlan({ ...item, features: item.features || [] });
        setModalTab('plan');
    };
    const toggleFeature = (key: string) =>
        setPlan({
            ...plan,
            features: (plan.features || []).includes(key)
                ? plan.features.filter((item: string) => item !== key)
                : [...(plan.features || []), key],
        });
    const savePlan = async (event: React.FormEvent) => {
        event.preventDefault();
        if (editingId) {
            await updatePlan(editingId, plan);
        } else {
            await submitPlan(plan);
        }
        closeModal();
    };
    const handleAssign = async (event: React.FormEvent) => {
        event.preventDefault();
        await assign(subscription);
        closeModal();
    };
    const planFields: [string, string][] = [
        ['name', 'Plan name'],
        ['code', 'Plan code'],
        ['monthly_price', 'Price per month (RWF)'],
        ['currency_code', 'Currency'],
    ];

    const analytics = data?.analytics || {};
    const subsList = data?.subscriptions?.data || [];
    const activeCount =
        analytics.active_subscriptions ?? subsList.filter((s: any) => s.status === 'active').length;
    const mrr =
        analytics.monthly_recurring_revenue ??
        subsList
            .filter((s: any) => s.status === 'active')
            .reduce((acc: number, s: any) => acc + Number(s.plan?.monthly_price || 0), 0);
    const totalRev = analytics.total_revenue ?? mrr;
    const expiringSoon =
        analytics.expiring_soon ??
        subsList.filter((s: any) => {
            if (s.status !== 'active' || !s.ends_at) return false;
            const diff =
                (new Date(s.ends_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
            return diff >= 0 && diff <= 30;
        }).length;
    const graceCount =
        analytics.grace_period ?? subsList.filter((s: any) => s.status === 'grace_period').length;
    const subRate =
        analytics.subscription_rate ??
        (data?.factories?.length ? Math.round((activeCount / data.factories.length) * 100) : 0);

    return (
        <>
            {(open || editingId) && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                    onClick={closeModal}
                >
                    <div
                        className="panel"
                        style={{
                            width: 'min(780px, 100%)',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: '24px 28px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 18,
                            borderRadius: 18,
                            boxShadow: '0 30px 90px rgba(0,0,0,0.4)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--line)',
                                paddingBottom: 12,
                            }}
                        >
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18 }}>
                                    {editingId
                                        ? 'Edit Subscription Plan'
                                        : modalTab === 'assign'
                                          ? 'Assign or Renew Factory Subscription'
                                          : 'Create Subscription Plan'}
                                </h2>
                                <p
                                    style={{
                                        margin: '4px 0 0',
                                        color: 'var(--muted)',
                                        fontSize: 12,
                                    }}
                                >
                                    {editingId
                                        ? 'Update plan pricing, code and accessible module features.'
                                        : modalTab === 'assign'
                                          ? 'Select a factory and assign a billing period.'
                                          : 'Configure a new subscription pricing tier.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={closeModal}
                                style={{ cursor: 'pointer', padding: 6 }}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {!editingId && (
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    borderBottom: '1px solid var(--line)',
                                    paddingBottom: 12,
                                }}
                            >
                                <button
                                    type="button"
                                    className={
                                        modalTab === 'assign' ? 'primary-btn' : 'secondary-btn'
                                    }
                                    style={{ padding: '8px 16px', fontSize: 13 }}
                                    onClick={() => setModalTab('assign')}
                                >
                                    <CreditCard size={15} /> Assign to Factory
                                </button>
                                <button
                                    type="button"
                                    className={
                                        modalTab === 'plan' ? 'primary-btn' : 'secondary-btn'
                                    }
                                    style={{ padding: '8px 16px', fontSize: 13 }}
                                    onClick={() => setModalTab('plan')}
                                >
                                    <Plus size={15} /> Create Plan Tier
                                </button>
                            </div>
                        )}

                        {!editingId && modalTab === 'assign' ? (
                            <form
                                className="admin-form"
                                style={{ padding: 0 }}
                                onSubmit={handleAssign}
                            >
                                <label>
                                    Factory
                                    <select
                                        required
                                        value={subscription.factory_id || ''}
                                        onChange={(e) =>
                                            setSubscription({
                                                ...subscription,
                                                factory_id: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Select factory</option>
                                        {(data?.factories || []).map((f: any) => (
                                            <option key={f.id} value={f.id}>
                                                {f.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Subscription type
                                    <select
                                        required
                                        value={subscription.subscription_plan_id || ''}
                                        onChange={(e) =>
                                            setSubscription({
                                                ...subscription,
                                                subscription_plan_id: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">Select subscription type</option>
                                        {(data?.plans || []).map((p: any) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} — {p.currency_code}{' '}
                                                {Number(p.monthly_price).toLocaleString()}/month
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {selectedPlan && (
                                    <div className="selected-plan-summary">
                                        <b>{selectedPlan.name}</b>
                                        <span>
                                            {(selectedPlan.features || []).length} features included
                                        </span>
                                    </div>
                                )}
                                <div className="form-grid">
                                    <label>
                                        Subscription starts on
                                        <input
                                            required
                                            type="date"
                                            value={subscription.starts_at}
                                            onChange={(e) => updateStart(e.target.value)}
                                        />
                                    </label>
                                    <label>
                                        Payment is due on
                                        <input
                                            required
                                            type="date"
                                            value={subscription.ends_at}
                                            onChange={(e) => updateEnd(e.target.value)}
                                        />
                                    </label>
                                </div>
                                <label>
                                    Factory access stops on
                                    <input
                                        readOnly
                                        type="date"
                                        value={subscription.grace_ends_at || ''}
                                    />
                                    <small>
                                        The factory gets 7 extra days to pay after the due date.
                                    </small>
                                </label>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 10,
                                        marginTop: 12,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={closeModal}
                                    >
                                        Cancel
                                    </button>
                                    <button className="primary-btn" disabled={busy}>
                                        <CreditCard size={16} />
                                        Activate subscription
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form className="admin-form" style={{ padding: 0 }} onSubmit={savePlan}>
                                {!editingId && (
                                    <label>
                                        Start from template
                                        <select
                                            value={template}
                                            onChange={(e) => chooseTemplate(e.target.value)}
                                        >
                                            <option value="">Empty plan</option>
                                            <option value="starter">
                                                Starter Plan — RWF 100,000
                                            </option>
                                            <option value="professional">
                                                Professional Plan — RWF 200,000
                                            </option>
                                            <option value="enterprise">
                                                Unlimited Enterprise — RWF 300,000
                                            </option>
                                        </select>
                                    </label>
                                )}
                                <div className="form-grid">
                                    {planFields.map(([key, label]) => (
                                        <label key={key}>
                                            {label}
                                            <input
                                                required
                                                type={key === 'monthly_price' ? 'number' : 'text'}
                                                value={plan[key] || ''}
                                                onChange={(e) =>
                                                    setPlan({ ...plan, [key]: e.target.value })
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                                <div className="feature-editor">
                                    <div>
                                        <h3>Included features</h3>
                                        <p>
                                            Select what factories on this subscription type can
                                            access.
                                        </p>
                                    </div>
                                    <div className="feature-options">
                                        {catalog.map(([key, label]: any) => (
                                            <label
                                                className={
                                                    (plan.features || []).includes(key)
                                                        ? 'selected'
                                                        : ''
                                                }
                                                key={key}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={(plan.features || []).includes(key)}
                                                    onChange={() => toggleFeature(key)}
                                                />
                                                <span>
                                                    <CheckCircle2 size={16} />
                                                    {label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 10,
                                        marginTop: 12,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={closeModal}
                                    >
                                        Cancel
                                    </button>
                                    <button className="primary-btn" disabled={busy}>
                                        <Save size={16} />
                                        {editingId
                                            ? 'Save plan changes'
                                            : 'Create subscription type'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <div className="admin-metrics">
                <article>
                    <span>
                        <CheckCircle2 size={20} />
                    </span>
                    <div>
                        <small>Active Subscriptions</small>
                        <strong>{activeCount}</strong>
                        <p>{subRate}% factories active</p>
                    </div>
                </article>
                <article>
                    <span>
                        <TrendingUp size={20} />
                    </span>
                    <div>
                        <small>Monthly Recurring Revenue</small>
                        <strong>RWF {Number(mrr).toLocaleString()}</strong>
                        <p>Active monthly run-rate</p>
                    </div>
                </article>
                <article>
                    <span>
                        <CreditCard size={20} />
                    </span>
                    <div>
                        <small>Total Revenue</small>
                        <strong>RWF {Number(totalRev).toLocaleString()}</strong>
                        <p>Lifetime billing volume</p>
                    </div>
                </article>
                <article>
                    <span>
                        <Clock size={20} />
                    </span>
                    <div>
                        <small>Expiring & In Grace</small>
                        <strong>{expiringSoon + graceCount}</strong>
                        <p>
                            {expiringSoon} next 30 days · {graceCount} in grace
                        </p>
                    </div>
                </article>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    margin: '4px 0 0',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <div>
                    <h2 style={{ margin: 0, fontSize: 16 }}>Factory subscriptions</h2>
                    <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                        Manage billing periods, assign plans and track active factory status.
                    </p>
                </div>
                {(data?.plans || []).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                            style={{
                                padding: '7px 12px',
                                border: '1px solid var(--line)',
                                borderRadius: '8px',
                                background: 'var(--panel)',
                                color: 'var(--text)',
                                fontSize: 13,
                            }}
                            value=""
                            onChange={(e) => {
                                const found = (data?.plans || []).find(
                                    (p: any) => String(p.id) === e.target.value,
                                );
                                if (found) edit(found);
                            }}
                        >
                            <option value="">Edit an existing plan...</option>
                            {(data?.plans || []).map((p: any) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.currency_code}{' '}
                                    {Number(p.monthly_price).toLocaleString()}/mo)
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <AdminTable
                headers={[
                    'Factory',
                    'Current type',
                    'Status',
                    'Starts',
                    'Payment due',
                    'Change subscription type',
                ]}
                rows={(data?.subscriptions?.data || []).map((item: any) => [
                    item.factory?.name,
                    item.plan?.name,
                    <Status value={item.status} />,
                    new Date(item.starts_at).toLocaleDateString(),
                    <input
                        type="date"
                        value={dateChanges[item.id] || item.ends_at.substring(0, 10)}
                        onChange={(e) =>
                            setDateChanges({ ...dateChanges, [item.id]: e.target.value })
                        }
                        style={{
                            padding: '6px 8px',
                            border: '1px solid var(--line)',
                            borderRadius: '8px',
                            background: 'var(--panel)',
                            color: 'var(--text)',
                        }}
                    />,
                    <div className="subscription-change">
                        <select
                            value={changes[item.id] || item.subscription_plan_id}
                            onChange={(e) => setChanges({ ...changes, [item.id]: e.target.value })}
                        >
                            {(data?.plans || []).map((plan: any) => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.name}
                                </option>
                            ))}
                        </select>
                        <button
                            className="table-action"
                            disabled={
                                busy ||
                                (String(changes[item.id] || item.subscription_plan_id) ===
                                    String(item.subscription_plan_id) &&
                                    String(
                                        dateChanges[item.id] || item.ends_at.substring(0, 10),
                                    ) === String(item.ends_at.substring(0, 10)))
                            }
                            onClick={() =>
                                changeSubscription(item.id, {
                                    subscription_plan_id:
                                        changes[item.id] || item.subscription_plan_id,
                                    ends_at: dateChanges[item.id] || item.ends_at.substring(0, 10),
                                })
                            }
                        >
                            Save
                        </button>
                    </div>,
                ])}
            />
        </>
    );
}
