import type { AuthUser, Locale } from '../../../core/types';
import { FinishedGoodsPanel } from './FinishedGoodsPanel';
import MovementsPage from './MovementsPage';

type Props = { user: AuthUser; locale: Locale };

export default function StockInPage({ user, locale }: Props) {
    return (
        <>
            <FinishedGoodsPanel locale={locale} />
            <MovementsPage user={user} locale={locale} direction="in" />
        </>
    );
}
