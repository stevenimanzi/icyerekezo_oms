import {
    Car,
    ChartColumn,
    CheckCheck,
    ClipboardList,
    FileSignature,
    LayoutDashboard,
    Route,
    Truck,
    Warehouse,
} from 'lucide-react';
import type { NavGroup, NavItem, RoleContext, RoleModule } from '../types';

export const logisticsRole: RoleModule = {
    id: 'logistics',
    matches: ({ flags }) => flags.isLogisticsUser,
    nav: ({ labels, text, flags }) => {
        const shipping: NavItem[] = flags.isNoguchiFactory
            ? []
            : [
                  ['inventory', Warehouse, text('Stock', 'Stock'), 'inventory.view'],
                  ['logistics', Truck, text('Shipments', 'Expéditions'), 'logistics.view'],
                  ['dispatch', Route, text('Dispatch', 'Départs'), 'logistics.dispatch'],
                  ['vehicles', Car, text('Vehicles', 'Véhicules'), 'logistics.view'],
              ];

        return [
            ['dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
            ['sales', ClipboardList, text('Orders', 'Commandes'), 'sales.view'],
            ...shipping,
            [
                'delivery-confirmation',
                CheckCheck,
                text('Confirm delivery', 'Confirmer la livraison'),
                'logistics.deliver',
            ],
            ['agreement', FileSignature, text('Agreement', 'Accord'), 'logistics.view'],
            ['reports', ChartColumn, labels.reports, 'reports.view'],
        ];
    },
};

export const logisticsNavGroups = ({ text }: RoleContext): Record<string, NavGroup> => ({
    delivery: {
        label: text('Deliveries', 'Livraisons'),
        icon: Truck,
        children: ['logistics', 'dispatch', 'vehicles', 'delivery-confirmation'],
    },
});
