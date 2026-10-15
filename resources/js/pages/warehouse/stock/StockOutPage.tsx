import { useState } from 'react';
import { useLiveData } from '../../../core/liveData';
import type { AuthUser, Locale } from '../../../core/types';
import RequestsQueue from '../../production/flow/requests/RequestsQueue';
import type { RequestsOverview } from '../../production/flow/types';
import MovementsPage from './MovementsPage';
import { stockText } from './text';

type Props = { user: AuthUser; locale: Locale; showRequests: boolean };
type Tab = 'requests' | 'history';

function StockOutWithRequests({ user, locale }: Omit<Props, 'showRequests'>) {
    const text = stockText[locale];
    const [tab, setTab] = useState<Tab>('requests');
    const { data } = useLiveData<RequestsOverview>('/api/flow/requests?status=pending');
    const waiting = data?.requests.length ?? 0;

    const tabs = (
        <div className="ui-tabs" role="tablist">
            {(['requests', 'history'] as Tab[]).map((key) => (
                <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    className={tab === key ? 'active' : ''}
                    onClick={() => setTab(key)}
                >
                    {text.stockOut.tabs[key]}
                    {key === 'requests' && waiting > 0 ? ` (${waiting})` : ''}
                </button>
            ))}
        </div>
    );

    return (
        <MovementsPage
            user={user}
            locale={locale}
            direction="out"
            tabs={tabs}
            alternate={tab === 'requests' ? <RequestsQueue user={user} locale={locale} /> : undefined}
        />
    );
}

export default function StockOutPage({ user, locale, showRequests }: Props) {
    return showRequests ? (
        <StockOutWithRequests user={user} locale={locale} />
    ) : (
        <MovementsPage user={user} locale={locale} direction="out" />
    );
}
