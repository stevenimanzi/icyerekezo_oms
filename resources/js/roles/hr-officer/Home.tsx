import HrWorkspacePage from '../../pages/hr/HrWorkspacePage';
import type { HomeProps } from '../types';

export default function HrOfficerHome({ onNavigate }: HomeProps) {
    return <HrWorkspacePage view="dashboard" onNavigate={onNavigate} />;
}
