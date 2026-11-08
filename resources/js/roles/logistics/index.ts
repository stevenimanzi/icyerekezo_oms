import {
    Car,
    FileBarChart,
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
                  ['logistics', Truck, text('Deliveries', 'Livraisons'), 'logistics.view'],
                  ['dispatch', Route, text('Send out', 'Départs'), 'logistics.view'],
                  ['vehicles', Car, text('Vehicles and drivers', 'Véhicules et chauffeurs'), 'logistics.view'],
              ];

        return [
            ['dashboard', LayoutDashboard, flags.isNoguchiFactory ? text('Dashboard', 'Tableau de bord') : text('Today', "Aujourd'hui"), '*'],
            ['sales', ClipboardList, text('Customer orders', 'Commandes'), 'sales.view'],
            ...shipping,
            [
                'delivery-confirmation',
                CheckCheck,
                text('Confirm delivery', 'Confirmer la livraison'),
                'logistics.deliver',
            ],
            ...(flags.isNoguchiFactory ? ([['agreement', FileSignature, text('Agreement', 'Accord'), 'logistics.view']] as NavItem[]) : []),
            ['reports', FileBarChart, labels.reports, 'reports.view'],
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
