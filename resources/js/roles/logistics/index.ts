import {
    Activity,
    FileSignature,
    FileText,
    LayoutDashboard,
    PackageCheck,
    PackageOpen,
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
                  ['dispatch', Activity, text('Dispatch', 'Départs'), 'logistics.dispatch'],
                  ['vehicles', Truck, text('Vehicles', 'Véhicules'), 'logistics.view'],
              ];

        return [
            ['dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
            ['sales', PackageOpen, text('Orders', 'Commandes'), 'sales.view'],
            ...shipping,
            [
                'delivery-confirmation',
                PackageCheck,
                text('Confirm delivery', 'Confirmer la livraison'),
                'logistics.deliver',
            ],
            ['agreement', FileSignature, text('Agreement', 'Accord'), 'logistics.view'],
            ['reports', FileText, labels.reports, 'reports.view'],
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
