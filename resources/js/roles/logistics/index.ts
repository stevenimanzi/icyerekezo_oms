import { Activity, FileSignature, FileText, LayoutDashboard, PackageCheck, PackageOpen, Truck, Warehouse } from 'lucide-react';
import type { NavGroup, NavItem, RoleContext, RoleModule } from '../types';

export const logisticsRole: RoleModule = {
    id: 'logistics',
    matches: ({ flags }) => flags.isLogisticsUser,
    nav: ({ labels, text, flags }) => {
        const shipping: NavItem[] = flags.isNoguchiFactory
            ? []
            : [
                  ['inventory', Warehouse, text('Available goods', 'Produits disponibles'), 'inventory.view'],
                  ['logistics', Truck, text('Shipments', 'Expéditions'), 'logistics.view'],
                  ['dispatch', Activity, text('Dispatch board', 'Planification'), 'logistics.dispatch'],
                  ['vehicles', Truck, text('Vehicles & drivers', 'Véhicules et chauffeurs'), 'logistics.view'],
              ];

        return [
            ['dashboard', LayoutDashboard, text('Dashboard', 'Tableau de bord'), '*'],
            ['sales', PackageOpen, text('Incoming orders', 'Commandes entrantes'), 'sales.view'],
            ...shipping,
            ['delivery-confirmation', PackageCheck, text('Delivery confirmation', 'Confirmation de livraison'), 'logistics.deliver'],
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
