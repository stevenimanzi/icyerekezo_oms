import type { HomeProps } from '../../../../roles/types';
import FlowHome from './FlowHome';

export default function StageHome({ user, locale, onNavigate }: HomeProps) {
    return <FlowHome user={user} locale={locale} onNavigate={onNavigate} mode="stage" />;
}
