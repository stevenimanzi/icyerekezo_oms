import { ChartColumn, LayoutDashboard, ShoppingCart, TrendingUp } from 'lucide-react';
import type { RoleModule } from '../types';

export const accountantRole: RoleModule = {
    id: 'accountant',
    matches: ({ flags }) => flags.isFinanceUser,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['sales', TrendingUp, labels.sales, 'sales.view'],
        ['procurement', ShoppingCart, labels.procurement, 'procurement.view'],
        ['reports', ChartColumn, labels.reports, 'reports.view'],
    ],
};
