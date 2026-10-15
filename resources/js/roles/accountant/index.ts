import { FileText, LayoutDashboard, PackageOpen, ShoppingCart } from 'lucide-react';
import type { RoleModule } from '../types';

export const accountantRole: RoleModule = {
    id: 'accountant',
    matches: ({ flags }) => flags.isFinanceUser,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['sales', PackageOpen, labels.sales, 'sales.view'],
        ['procurement', ShoppingCart, labels.procurement, 'procurement.view'],
        ['reports', FileText, labels.reports, 'reports.view'],
    ],
};
