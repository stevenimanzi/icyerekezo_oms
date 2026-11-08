import MaintenanceWorkspacePage from '../../pages/maintenance/MaintenanceWorkspacePage';
import type { HomeProps } from '../types';

export default function MaintenanceHome({ user, onNavigate }: HomeProps) {
    const can = (permission: string) => user.permissions.includes('*') || user.permissions.includes(permission);

    return <MaintenanceWorkspacePage view="dashboard" can={can} onNavigate={onNavigate} />;
}
