import { Activity, ClipboardCheck, FileText, Gauge, LayoutDashboard, PackageOpen, ShoppingCart, Truck, Warehouse } from 'lucide-react';
import type { RoleModule } from '../types';

export const ownerRole: RoleModule = {
    id: 'owner',
    matches: ({ flags }) => flags.isFactoryOwner,
    nav: ({ text }) => [
        ['dashboard', LayoutDashboard, text('Factory performance', 'Performance de l’usine'), '*'],
        ['activity', Activity, text('Factory activity', 'Activité de l’usine'), 'audit.view'],
        ['procurement', ShoppingCart, text('Purchasing overview', 'Vue des achats'), 'procurement.view'],
        ['inventory', Warehouse, text('Stock overview', 'Vue du stock'), 'inventory.view'],
        ['production', Gauge, text('Production performance', 'Performance de production'), 'production.view'],
        ['quality', ClipboardCheck, text('Quality results', 'Résultats qualité'), 'quality.view'],
        ['sales', PackageOpen, text('Sales overview', 'Vue des ventes'), 'sales.view'],
        ['logistics', Truck, text('Delivery overview', 'Vue des livraisons'), 'logistics.view'],
        ['logistics-reports', Truck, text('Logistics report', 'Rapport logistique'), 'reports.view'],
        ['reports', FileText, text('Factory reports', 'Rapports de l’usine'), 'reports.view'],
    ],
};
