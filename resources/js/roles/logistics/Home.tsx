import LogisticsWorkspacePage from '../../pages/logistics/LogisticsWorkspacePage';
import type { HomeProps } from '../types';

export default function LogisticsHome({ user, onNavigate }: HomeProps) {
    const can = (permission: string) => user.permissions.includes('*') || user.permissions.includes(permission);

    return <LogisticsWorkspacePage view="dashboard" can={can} onNavigate={onNavigate} />;
}
