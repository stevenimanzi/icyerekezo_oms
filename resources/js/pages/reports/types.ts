export type Section =
    'cutting' | 'sewing' | 'finishing' | 'packing' | 'warehouse' | 'quality' | 'sales';

export type StageBlock = {
    key: 'cutting' | 'sewing' | 'finishing' | 'packing';
    label: { en: string; fr: string };
    good: number;
    damaged: number;
    received: number;
    sent: number;
    missing: number;
    waiting_now: number;
    ready_now: number;
    waiting_quality_now: number;
    daily: { day: string; good: number; damaged: number }[];
    lots: {
        lot_number: string | null;
        product: string | null;
        color: string | null;
        size: string | null;
        fabric: string | null;
        good: number;
        damaged: number;
    }[];
    fabric?: { name: string | null; color: string | null; used: number; waste: number }[];
    lots_cut?: number;
    requests: { total: number; pending: number; approved: number; rejected: number };
};

export type WarehouseBlock = {
    stock_in: { entries: number; value: number };
    stock_out: { entries: number; value: number };
    wasted_value: number;
    requests: { total: number; pending: number; approved: number; rejected: number };
    low_stock: number;
    out_of_stock: number;
    stock_value: number;
    items: { name: string | null; color: string | null; received: number; taken_out: number }[];
};

export type QualityBlock = {
    checks: number;
    inspected: number;
    passed: number;
    rejected: number;
    pass_rate: number | null;
    by_stage: {
        key: string;
        label: { en: string; fr: string };
        checks: number;
        inspected: number;
        passed: number;
        rejected: number;
        pass_rate: number | null;
    }[];
    on_hold: {
        lot_number: string;
        product: string | null;
        reason: string | null;
        since: string | null;
    }[];
    recent: {
        number: string;
        lot_number: string | null;
        stage: string;
        inspected: number;
        passed: number;
        rejected: number;
        result: string;
        defects: string | null;
        by: string | null;
        at: string;
    }[];
};

export type SalesBlock = {
    revenue: number;
    sales: number;
    items_sold: number;
    collected: number;
    outstanding: number;
    top_products: { name: string; quantity: number; revenue: number }[];
};

export type RegisterBlock = 'wh' | 'cut' | 'prod' | 'fin' | 'stock';

export type RegisterData = {
    sections: RegisterBlock[];
    days: { date: string; groups: (string | number)[][][] }[];
    truncated: boolean;
};

export type FactoryReportData = {
    register: RegisterData;
    period: { from: string; to: string };
    available: Section[];
    shown: Section[];
    summary: Partial<
        Record<
            | 'pieces_cut'
            | 'pieces_packed'
            | 'damaged'
            | 'stock_in_value'
            | 'stock_out_value'
            | 'quality_checks'
            | 'quality_pass_rate'
            | 'revenue',
            number
        >
    >;
    cutting?: StageBlock;
    sewing?: StageBlock;
    finishing?: StageBlock;
    packing?: StageBlock;
    warehouse?: WarehouseBlock;
    quality?: QualityBlock;
    sales?: SalesBlock;
};
