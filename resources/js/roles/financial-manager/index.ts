import {
    BookOpen,
    Boxes,
    Banknote,
    FileBarChart,
    HandCoins,
    LayoutDashboard,
    PackageCheck,
    PieChart,
    ReceiptText,
    ShoppingCart,
    Tag,
    Users,
    WalletCards,
} from 'lucide-react';
import type { RoleModule } from '../types';

/**
 * The Finance & Sales Manager runs both the selling side and the money side of the factory, so the
 * menu follows the money: sell, collect, record, pay, buy, then report.
 */
export const financialManagerRole: RoleModule = {
    id: 'financial-manager',
    matches: ({ flags }) => flags.isFinancialManager,
    nav: ({ text }) => [
        ['dashboard', LayoutDashboard, text('Finance & Sales', 'Finance et Ventes'), '*'],
        ['sales', ReceiptText, text('Orders & Invoices', 'Commandes et factures'), 'sales.view'],
        ['clients', Users, text('Clients', 'Clients'), 'finance.view'],
        ['finance', HandCoins, text('Money Collected', 'Encaissements'), 'finance.view'],
        ['cashbook', BookOpen, text('Cash Book', 'Livre de caisse'), 'finance.view'],
        ['expenses', WalletCards, text('Expenses', 'Dépenses'), 'finance.view'],
        ['payroll', Banknote, text('Staff Pay', 'Paie du personnel'), 'finance.view'],
        ['procurement', ShoppingCart, text('Purchases', 'Achats'), 'procurement.view'],
        ['products', Tag, text('Products & Prices', 'Produits et prix'), 'products.view'],
        ['inventory', Boxes, text('Stock Available', 'Stock disponible'), 'inventory.view'],
        ['sold-goods', PackageCheck, text('Goods Sold & Delivered', 'Marchandises vendues'), 'finance.view'],
        ['finance-reports', FileBarChart, text('Finance Reports', 'Rapports financiers'), 'reports.view'],
        ['reports', PieChart, text('Sales & Stock Reports', 'Rapports ventes et stock'), 'reports.view'],
    ],
};
