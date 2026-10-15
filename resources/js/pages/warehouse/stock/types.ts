export type StockItemOption = {
    id: number;
    name: string;
    sku: string;
    type: string;
    unit: string | null;
    cost: number;
    batch_tracked: boolean;
    expiry_tracked: boolean;
    available: number;
};

export type Movement = {
    id: number;
    at: string | null;
    type: string;
    item: string | null;
    sku: string | null;
    item_type: string | null;
    unit: string | null;
    warehouse: string | null;
    quantity: number;
    unit_cost: number;
    value: number;
    batch: string | null;
    expires_on: string | null;
    note: string | null;
    by: string | null;
};

export type MovementsResponse = {
    direction: 'in' | 'out';
    period: { from: string; to: string };
    summary: { entries: number; items: number; value: number; today: number };
    movements: { data: Movement[]; current_page: number; last_page: number; total: number };
    items: StockItemOption[];
    warehouses: { id: number; name: string }[];
    reasons: string[];
};

export type ItemStatus = 'ok' | 'low' | 'out';

export type StockRow = {
    id: number;
    name: string;
    sku: string;
    type: string;
    unit: string | null;
    on_hand: number;
    available: number;
    reserved: number;
    held: number;
    reorder_level: number;
    value: number;
    status: ItemStatus;
};

export type StockAnalytics = {
    days: number;
    kpis: {
        items_in_stock: number;
        total_value: number;
        raw_value: number;
        finished_value: number;
        other_value: number;
        low_stock: number;
        out_of_stock: number;
        held_for_quality: number;
    };
    movement: {
        daily: { day: string; received: number; issued: number }[];
        received_value: number;
        issued_value: number;
        wasted_value: number;
    };
    by_type: { key: 'raw_materials' | 'finished_goods' | 'other'; items: number; value: number }[];
    top_items: StockRow[];
    attention: StockRow[];
    raw_materials: StockRow[];
    finished_goods: StockRow[];
    other: StockRow[];
    warehouses: { id: number; name: string }[];
};
