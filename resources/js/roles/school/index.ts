import {
    CirclePlus,
    ClipboardList,
    FileSignature,
    History,
    LayoutDashboard,
    School,
    ShoppingCart,
    Undo2,
    Wallet,
} from 'lucide-react';
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
        ['new-order', CirclePlus, labels.placeNewOrder, '*'],
        ['order-history', ClipboardList, labels.orderHistory, '*'],
        ['financials', Wallet, labels.financialRecords, '*'],
        ['return-items', Undo2, labels.returnItems, '*'],
        ['returns-history', History, labels.returnsHistory, '*'],
        ['agreement', FileSignature, labels.agreement, '*'],
        ['school-profile', School, labels.schoolProfile, '*'],
    ],
};

export const schoolNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    orders: {
        label: text('Orders', 'Commandes'),
        icon: ShoppingCart,
        children: ['new-order', 'order-history'],
    },
    returns: {
        label: text('Returns', 'Retours'),
        icon: Undo2,
        children: ['return-items', 'returns-history'],
    },
});
