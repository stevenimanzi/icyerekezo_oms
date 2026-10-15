export type SaleLine = {
    id: number;
    item_id: number | null;
    quantity_ordered: number;
    unit_price: string | number;
    line_total: string | number;
    item?: { id: number; name: string; sku: string } | null;
};

export type SalePayment = {
    id: number;
    amount: string | number;
    method: string;
    reference: string | null;
    paid_on: string;
};

export type Sale = {
    id: number;
    document_number: string;
    customer_name: string;
    customer_phone: string | null;
    status: string;
    payment_status: 'unpaid' | 'partially_paid' | 'paid';
    total_amount: string | number;
    discount_amount: string | number;
    paid_amount: string | number;
    item_count: number;
    document_date: string;
    due_date: string | null;
    notes: string | null;
    cancel_reason: string | null;
    lines: SaleLine[];
    payments: SalePayment[];
    creator?: { id: number; name: string } | null;
};

export type SellableItem = {
    id: number;
    name: string;
    sku: string;
    type: string;
    on_hand: string | number;
    last_price: string | number;
    unit: string | null;
};

export type SaleFormOptions = {
    items: SellableItem[];
    customers: { name: string; phone: string | null }[];
    warehouses: { id: number; name: string }[];
    payment_methods: string[];
};

export type SalesOverview = {
    sales: { data: Sale[]; current_page: number; last_page: number; total: number };
    today: { sales: number; revenue: number };
    outstanding: number;
    capabilities: { record: boolean };
    form: SaleFormOptions | null;
    currency: string;
};

export type Comparison = { current: number; previous: number; change: number | null };

export type SalesReportData = {
    period: { from: string; to: string; days: number };
    currency: string;
    summary: {
        revenue: Comparison;
        sales: Comparison;
        average_sale: Comparison;
        items_sold: Comparison;
        discounts: number;
        collected: number;
        outstanding: number;
    };
    trend: { label: string; sales: number; revenue: number }[];
    top_products: { name: string; quantity: number; revenue: number }[];
    top_customers: { name: string; sales: number; revenue: number; owes: number }[];
    payment_methods: { method: string; payments: number; amount: number }[];
    debtors: {
        id: number;
        number: string;
        customer: string;
        phone: string | null;
        sold_on: string;
        due_on: string | null;
        total: number;
        balance: number;
        days_late: number;
    }[];
    sellers: { name: string; sales: number; revenue: number }[];
};
