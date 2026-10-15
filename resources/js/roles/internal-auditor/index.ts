import {
    ClipboardCheck,
    FileText,
    Gauge,
    LayoutDashboard,
    ShoppingCart,
    Warehouse,
} from 'lucide-react';
import type { RoleModule } from '../types';

export const internalAuditorRole: RoleModule = {
    id: 'internal-auditor',
    matches: ({ flags }) => flags.isInternalAuditor,
    nav: ({ labels, text }) => [
        ['dashboard', LayoutDashboard, labels.dashboard, '*'],
        [
            'inventory',
            Warehouse,
            text('Inventory movements', 'Mouvements de stock'),
            'inventory.view',
        ],
        [
            'production',
            Gauge,
            text('Production records', 'Dossiers de production'),
            'production.view',
        ],
        ['quality', ClipboardCheck, text('Quality records', 'Dossiers qualite'), 'quality.view'],
        [
            'procurement',
            ShoppingCart,
            text('Procurement records', 'Dossiers achats'),
            'procurement.view',
        ],
        ['reports', FileText, text('Financial reports', 'Rapports financiers'), 'reports.view'],
    ],
};
