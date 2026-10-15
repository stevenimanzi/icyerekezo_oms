import type { AuthUser, Locale } from '../../../core/types';
import MovementsPage from './MovementsPage';

type Props = { user: AuthUser; locale: Locale };

export default function StockInPage({ user, locale }: Props) {
    return <MovementsPage user={user} locale={locale} direction="in" />;
}
