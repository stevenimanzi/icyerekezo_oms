export type Comparison = {
    current: number;
    previous: number;
    change: number | null;
};

export type AlertLevel = 'critical' | 'warning' | 'info';

export type OwnerAlert = {
    key: string;
    level: AlertLevel;
    count: number;
    page: string;
};

export type OwnerOverview = {
    period: { days: number; from: string; to: string };
    growth: {
        revenue: Comparison;
        orders: Comparison;
        units_delivered: Comparison;
        output: Comparison;
        collected: Comparison;
    };
    trend: { label: string; revenue: number; orders: number; output: number }[];
    cash: {
        billed: number;
        collected: number;
        receivable: number;
        collection_rate: number | null;
        overdue_receivable: number;
        overdue_orders: number;
        payable: number;
        pending_receipts: number;
        maintenance_cost: number;
    };
    production: {
        planned: number;
        completed: number;
        completion_rate: number | null;
        rejected: number;
        waste: number;
        reject_rate: number | null;
        open_orders: number;
        late_orders: number;
        on_time_rate: number | null;
        downtime_minutes: number;
    };
    flow: {
        stages: {
            key: string;
            label: { en: string; fr: string };
            done: number;
            damaged: number;
            here: number;
        }[];
        lots_open: number;
        lots_held: number;
        requests_waiting: number;
        deliveries_waiting: number;
        stuck_deliveries: number;
        awaiting_final_check: number;
    } | null;
    stock: {
        value: number;
        low_stock: number;
        out_of_stock: number;
        expiring_soon: number;
        tracked_items: number;
    };
    customers: {
        received: number;
        open: number;
        late: number;
        units_ordered: number;
        units_delivered: number;
        fulfilment_rate: number | null;
        returns: number;
        top: { name: string; orders: number; revenue: number }[];
    };
    quality: {
        inspections: number;
        passed: number;
        failed: number;
        conditional: number;
        pass_rate: number | null;
        previous_pass_rate: number | null;
        rejected_quantity: number;
        pending: number;
    };
    people: {
        headcount: number;
        attendance_rate: number | null;
        late: number;
        absent: number;
        on_leave_today: number;
        pending_leave: number;
    };
    safety: {
        incidents: number;
        open: number;
        serious_open: number;
        days_without_incident: number | null;
    };
    equipment: {
        machines: number;
        unavailable: number;
        availability_rate: number | null;
        service_overdue: number;
        downtime_minutes: number;
        open_jobs: number;
    };
    alerts: OwnerAlert[];
    activity: ActivityEntry[];
};

export type ActivityEntry = {
    id: number;
    who: string;
    event: string;
    description: string;
    at: string | null;
};

export type ActivityPage = {
    data: (ActivityEntry & { module: string })[];
    meta: { page: number; last_page: number; total: number };
    modules: string[];
};
