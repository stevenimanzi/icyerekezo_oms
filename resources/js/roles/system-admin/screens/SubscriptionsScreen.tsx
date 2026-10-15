import { SubscriptionPanel } from '../components/SubscriptionPanel';
import type { AdminContext } from '../useAdminData';

export function SubscriptionsScreen({ ctx }: { ctx: AdminContext }) {
    const { data, busy, run, showForm, setShowForm } = ctx;
    return (
        <SubscriptionPanel
            data={data}
            open={showForm}
            close={() => setShowForm(false)}
            busy={busy}
            submitPlan={(values: any) =>
                run('/api/platform/plans', 'POST', values, 'Subscription plan created.').then(() =>
                    setShowForm(false),
                )
            }
            updatePlan={(id: number, values: any) =>
                run(`/api/platform/plans/${id}`, 'PUT', values, 'Subscription plan updated.').then(
                    () => setShowForm(false),
                )
            }
            assign={(values: any) =>
                run(
                    `/api/platform/factories/${values.factory_id}/subscriptions`,
                    'POST',
                    values,
                    'Subscription assigned and factory activated.',
                ).then(() => setShowForm(false))
            }
            changeSubscription={(id: number, values: any) =>
                run(
                    `/api/platform/subscriptions/${id}`,
                    'PATCH',
                    values,
                    'Factory subscription changed.',
                )
            }
        />
    );
}
