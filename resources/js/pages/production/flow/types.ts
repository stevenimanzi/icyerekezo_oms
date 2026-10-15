export type StageKey = 'cutting' | 'sewing' | 'finishing' | 'packing';

export type StageInfo = {
    key: StageKey;
    label: { en: string; fr: string };
    previous: StageKey | null;
    next: StageKey | null;
};

export type LotRow = {
    id: number;
    lot_number: string;
    product: string | null;
    style: string | null;
    color: string | null;
    size: string | null;
    cut_on: string | null;
    held: boolean;
    hold_reason: string | null;
    cut: number;
    wip: number;
    outbox: number;
    incoming: number;
    awaiting_quality: number;
    good: number;
    damaged: number;
    sent: number;
};

export type TransferRow = {
    id: number;
    lot_id: number;
    lot_number: string | null;
    product: string | null;
    color: string | null;
    size: string | null;
    from: StageKey;
    to: StageKey;
    quantity_sent: number;
    quantity_received: number | null;
    status: 'sent' | 'received' | 'cancelled';
    note: string | null;
    receive_note: string | null;
    sent_by: string | null;
    received_by: string | null;
    sent_at: string | null;
    received_at: string | null;
    direction?: 'in' | 'out';
};

export type EntryRow = {
    id: number;
    lot_id: number | null;
    lot_number: string | null;
    date: string | null;
    good: number;
    damaged: number;
    fabric: string | null;
    fabric_used: number;
    fabric_waste: number;
    note: string | null;
    by: string | null;
    at: string;
    voided: boolean;
    void_reason: string | null;
    can_void: boolean;
};

export type RequestRow = {
    id: number;
    number: string;
    stage: StageKey;
    item_id: number;
    item: string | null;
    unit: string | null;
    quantity: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    requested_by: string | null;
    decided_by: string | null;
    decision_note: string | null;
    warehouse: string | null;
    at: string;
    decided_at: string | null;
    stock?: { warehouse_id: number; warehouse: string; available: number }[];
    own?: boolean;
};

export type MaterialRow = {
    item_id: number;
    name: string;
    unit: string | null;
    issued: number;
    used: number;
    on_hand: number;
};

export type OptionItem = { id: number; name: string; sku: string; unit: string | null };

export type StageOverview = {
    stage: StageInfo;
    capabilities: { work: boolean; inspect: boolean; manage: boolean; stages: StageKey[] };
    summary: {
        incoming: number;
        in_work: number;
        ready_to_send: number;
        awaiting_quality: number;
        done_today: number;
        damaged_today: number;
        sent_today: number;
    };
    lots: LotRow[];
    incoming: TransferRow[];
    entries: EntryRow[];
    transfers: TransferRow[];
    requests: RequestRow[];
    materials: MaterialRow[];
    options: { requestable: OptionItem[]; fabrics: OptionItem[]; products: OptionItem[] };
};

export type StageBalance = {
    good: number;
    damaged: number;
    received: number;
    incoming: number;
    shortage: number;
    wip: number;
    outbox: number;
    awaiting_quality: number;
    quality_passed: number;
    quality_rejected: number;
    inspections: number;
    sent: number;
};

export type LotBalances = {
    stages: Record<StageKey, StageBalance>;
    cut: number;
    in_progress: number;
    finished: number;
    damaged: number;
    rejected: number;
    shortage: number;
    complete: boolean;
};

export type MonitorLot = {
    id: number;
    lot_number: string;
    product: string | null;
    style: string | null;
    color: string | null;
    size: string | null;
    cut_on: string | null;
    status: 'open' | 'held' | 'completed' | 'cancelled';
    hold_reason: string | null;
    age_days: number;
    idle_days: number;
    cut: number;
    in_progress: number;
    finished: number;
    damaged: number;
    rejected: number;
    shortage: number;
    stages: Record<StageKey, { here: number; arriving: number }>;
};

export type InspectionRow = {
    id: number;
    number: string;
    lot_id: number;
    lot_number: string | null;
    stage: StageKey;
    inspected: number;
    passed: number;
    rejected: number;
    result: string;
    defects: string | null;
    notes: string | null;
    who: string | null;
    at: string;
};

export type FlowMonitor = {
    flow: (StageInfo & {
        here: number;
        arriving: number;
        in_work: number;
        ready_to_send: number;
        awaiting_quality: number;
        damaged: number;
        rejected: number;
        shortage: number;
    })[];
    lots: MonitorLot[];
    alerts: {
        held: {
            id: number;
            lot_number: string;
            product: string | null;
            reason: string | null;
            since: string | null;
        }[];
        awaiting_final_check: {
            id: number;
            lot_number: string;
            product: string | null;
            pieces: number;
        }[];
        stuck_deliveries: number;
        idle_lots: { id: number; lot_number: string; idle_days: number }[];
        missing_pieces: number;
    };
    inspections: InspectionRow[];
    filters: { status: string; q: string };
    capabilities: { inspect: boolean };
    stages: StageInfo[];
};

export type TimelineItem =
    | {
          kind: 'entry';
          at: string;
          stage: StageKey;
          who: string | null;
          good: number;
          damaged: number;
          fabric: string | null;
          fabric_used: number;
          fabric_waste: number;
          note: string | null;
          voided: boolean;
          void_reason: string | null;
      }
    | {
          kind: 'transfer';
          at: string;
          from: StageKey;
          to: StageKey;
          sent: number;
          received: number | null;
          status: string;
          who: string | null;
          received_by: string | null;
          received_at: string | null;
          note: string | null;
          receive_note: string | null;
      }
    | (InspectionRow & { kind: 'inspection' });

export type LotDetail = {
    lot: {
        id: number;
        lot_number: string;
        product: string | null;
        style: string | null;
        color: string | null;
        size: string | null;
        cut_on: string | null;
        status: string;
        hold_reason: string | null;
        held_since: string | null;
        created_by: string | null;
        notes: string | null;
        fabric: string | null;
    };
    balances: LotBalances;
    timeline: TimelineItem[];
};

export type FlowReport = {
    period: { from: string; to: string };
    stages: (StageInfo & {
        good: number;
        damaged: number;
        damage_rate: number | null;
        sent: number;
        missing: number;
        checks: number;
        inspected: number;
        passed: number;
        rejected: number;
    })[];
    daily: ({ day: string } & Record<StageKey, { good: number; damaged: number }>)[];
    fabric: {
        name: string;
        unit: string | null;
        used: number;
        waste: number;
        waste_rate: number | null;
    }[];
};

export type RequestsOverview = {
    capabilities: { approve: boolean };
    requests: RequestRow[];
    warehouses: { id: number; name: string }[];
};
