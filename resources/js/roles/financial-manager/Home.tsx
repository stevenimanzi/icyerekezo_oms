import FinanceOverviewPage from '../../pages/finance/FinanceOverviewPage';
import type { HomeProps } from '../types';

export default function FinancialManagerHome({ onNavigate }: HomeProps) {
    return <FinanceOverviewPage compact onNavigate={onNavigate} />;
}
