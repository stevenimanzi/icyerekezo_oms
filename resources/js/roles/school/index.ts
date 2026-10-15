import { Building2, CreditCard, FileSignature, FileText, LayoutDashboard, Plus, RefreshCw, RotateCcw, ShoppingCart } from 'lucide-react';
import type { NavGroup, RoleContext, RoleModule } from '../types';

export const SCHOOL_PAGES = [
    'dashboard',
    'new-order',
    'order-history',
    'financials',
    'return-items',
    'returns-history',
    'agreement',
    'school-profile',
];

export const schoolRole: RoleModule = {
    id: 'school',
    matches: ({ flags }) => flags.isSchoolUser,
    nav: ({ labels }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        ['new-order', Plus, labels.placeNewOrder, '*'],
        ['order-history', FileText, labels.orderHistory, '*'],
        ['financials', CreditCard, labels.financialRecords, '*'],
        ['return-items', RotateCcw, labels.returnItems, '*'],
        ['returns-history', RefreshCw, labels.returnsHistory, '*'],
        ['agreement', FileSignature, labels.agreement, '*'],
        ['school-profile', Building2, labels.schoolProfile, '*'],
    ],
};

export const schoolNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    orders: { label: text('Orders', 'Commandes'), icon: ShoppingCart, children: ['new-order', 'order-history'] },
    returns: { label: text('Returns', 'Retours'), icon: RotateCcw, children: ['return-items', 'returns-history'] },
});
