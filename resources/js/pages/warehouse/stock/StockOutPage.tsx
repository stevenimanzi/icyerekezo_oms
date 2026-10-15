import { useState } from 'react';
import { useLiveData } from '../../../core/liveData';
import type { AuthUser, Locale } from '../../../core/types';
import RequestsQueue from '../../production/flow/requests/RequestsQueue';
import type { RequestsOverview } from '../../production/flow/types';
import MovementsPage from './MovementsPage';
import { stockText } from './text';

type Props = { user: AuthUser; locale: Locale; showRequests: boolean };
type Tab = 'requests' | 'history';

export default function StockOutPage({ user, locale, showRequests }: Props) {
    const text = stockText[locale];
    const [tab, setTab] = useState<Tab>(showRequests ? 'requests' : 'history');
    const { data: pending } = useLiveData<RequestsOverview>(showRequests ? '/api/flow/requests?status=pending' : '/api/stock/analytics?days=7');
    const waiting = showRequests ? ((pending as RequestsOverview | null)?.requests.length ?? 0) : 0;

    const tabs = showRequests ? (
        <div className="ui-tabs" role="tablist">
            {(['requests', 'history'] as Tab[]).map((key) => (
                <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                    {text.stockOut.tabs[key]}
                    {key === 'requests' && waiting > 0 ? ` (${waiting})` : ''}
                </button>
            ))}
        </div>
    ) : undefined;

    return (
        <MovementsPage
            user={user}
            locale={locale}
            direction="out"
            tabs={tabs}
            alternate={showRequests && tab === 'requests' ? <RequestsQueue user={user} locale={locale} /> : undefined}
        />
    );
}
