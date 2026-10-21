<?php

namespace App\Services\ProductionFlow;

use App\Models\Item;
use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Models\QualityInspection;
use App\Models\StockBalance;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Catalogs\ProductionFlowCatalog;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class FlowQueries
{
    private const RECENT = 30;

    private const STUCK_AFTER_HOURS = 24;

    private const IDLE_AFTER_DAYS = 3;

    public function __construct(
        private readonly FlowBalances $balances,
        private readonly MaterialRequestService $materials,
    ) {}

    public function stage(User $user, string $stage, array $filters = []): array
    {
        $access = FlowAccess::for($user);
        $period = $filters['period'] ?? 'daily';
        $today = today();

        $fromParam = $filters['from'] ?? ($filters['date'] ?? null);
        $toParam = $filters['to'] ?? ($filters['date'] ?? null);

        $startDate = match ($period) {
            'daily' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfDay(),
            'weekly' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->subDays(6)->startOfDay(),
            'monthly' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfMonth(),
            'yearly', 'anualy' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfYear(),
            'custom' => $fromParam ? Carbon::parse($fromParam)->startOfDay() : $today->copy()->startOfDay(),
            'all_time' => Carbon::parse('2020-01-01')->startOfDay(),
            default => $today->copy()->startOfDay(),
        };

        $endDate = match ($period) {
            'daily' => $toParam ? Carbon::parse($toParam)->endOfDay() : ($fromParam ? Carbon::parse($fromParam)->endOfDay() : $today->copy()->endOfDay()),
            'custom' => $toParam ? Carbon::parse($toParam)->endOfDay() : ($fromParam ? Carbon::parse($fromParam)->endOfDay() : $today->copy()->endOfDay()),
            'weekly' => $toParam ? Carbon::parse($toParam)->endOfDay() : $today->copy()->endOfDay(),
            'monthly' => $toParam ? Carbon::parse($toParam)->endOfDay() : $today->copy()->endOfDay(),
            'yearly', 'anualy' => $toParam ? Carbon::parse($toParam)->endOfDay() : $today->copy()->endOfDay(),
            default => $today->copy()->endOfDay(),
        };

        $lots = ProductionLot::where('status', 'open')->with(['product:id,name', 'fabric:id,name', 'inspections'])->latest('id')->limit(300)->get();
        $balances = $this->balances->forLots($lots->pluck('id'));

        $rows = $lots->map(fn (ProductionLot $lot) => $this->stageRow($lot, $balances[$lot->id], $stage))
            ->filter(fn (array $row) => $row['wip'] + $row['outbox'] + $row['incoming'] + $row['awaiting_quality'] > 0 || ($stage === 'cutting' && $row['cut_on'] >= today()->subDays(14)->toDateString()))
            ->values();

        $entryQuery = ProductionEntry::where('stage', $stage)->whereNull('voided_at');
        if ($period !== 'all_time') {
            $entryQuery->where('entry_date', '>=', $startDate->toDateString())
                ->where('entry_date', '<=', $endDate->toDateString());
        }
        $todayEntry = (clone $entryQuery)
            ->selectRaw('COALESCE(SUM(good_quantity), 0) as good, COALESCE(SUM(damaged_quantity), 0) as damaged')->first();

        $incoming = ProductionTransfer::where('to_stage', $stage)->where('status', 'sent')
            ->with(['lot.product:id,name', 'lot.fabric:id,name', 'sender:id,name'])->orderBy('sent_at')->get()
            ->map(fn (ProductionTransfer $transfer) => $this->transferRow($transfer));

        $sentQuery = ProductionTransfer::where('from_stage', $stage)->whereIn('status', ['sent', 'received']);
        if ($period !== 'all_time') {
            $sentQuery->where('sent_at', '>=', $startDate)->where('sent_at', '<=', $endDate);
        } else {
            $sentQuery->where('sent_at', '>=', today());
        }
        $sentToday = (int) $sentQuery->sum('quantity_sent');

        $incomingSum = (int) $incoming->sum('quantity_sent');
        if ($period !== 'daily' && $period !== 'all_time') {
            $incomingInPeriod = (int) ProductionTransfer::where('to_stage', $stage)
                ->whereIn('status', ['sent', 'received'])
                ->where('sent_at', '>=', $startDate)
                ->where('sent_at', '<=', $endDate)
                ->sum('quantity_sent');
            if ($incomingInPeriod > 0) {
                $incomingSum = $incomingInPeriod;
            }
        }

        return [
            'stage' => $this->stageInfo($stage),
            'capabilities' => $this->capabilities($access, $stage),
            'summary' => [
                'incoming' => $incomingSum,
                'in_work' => (int) $rows->sum('wip'),
                'ready_to_send' => (int) $rows->sum('outbox'),
                'awaiting_quality' => (int) $rows->sum('awaiting_quality'),
                'done_today' => (int) ($todayEntry?->good ?? 0),
                'damaged_today' => (int) ($todayEntry?->damaged ?? 0),
                'sent_today' => $sentToday,
                'period' => $period,
                'from' => $startDate->toDateString(),
                'to' => $endDate->toDateString(),
            ],
            'lots' => $rows,
            'incoming' => $incoming,
            'entries' => (clone $entryQuery)->with(['lot:id,lot_number', 'recorder:id,name', 'fabric:id,name'])->latest('id')->limit(self::RECENT)->get()
                ->map(fn (ProductionEntry $entry) => $this->entryRow($entry, $access)),
            'transfers' => ProductionTransfer::where(fn ($query) => $query->where('from_stage', $stage)->orWhere('to_stage', $stage))
                ->with(['lot:id,lot_number', 'sender:id,name', 'receiver:id,name'])->latest('id')->limit(self::RECENT)->get()
                ->map(fn (ProductionTransfer $transfer) => $this->transferRow($transfer) + ['direction' => $transfer->from_stage === $stage ? 'out' : 'in']),
            'requests' => MaterialRequest::where(fn ($query) => $query->where('stage', $stage)->orWhere('from_stage', $stage))->with(['item.unit:id,symbol', 'lot:id,lot_number', 'requester:id,name', 'decider:id,name'])->latest('id')->limit(self::RECENT)->get()
                ->map(fn (MaterialRequest $request) => $this->requestRow($request)),
            'materials' => $this->materials->onHand($stage),
            'options' => $this->options($stage),
        ];
    }

    public function monitor(array $filters): array
    {
        $status = $filters['status'] ?? 'open';
        $query = ProductionLot::with(['product:id,name', 'creator:id,name', 'fabric:id,name'])->latest('id');

        match ($status) {
            'held' => $query->whereNotNull('held_at'),
            'completed' => $query->where('status', 'completed'),
            'all' => $query->where('status', '!=', 'cancelled'),
            default => $query->where('status', 'open'),
        };

        if (! empty($filters['q'])) {
            $like = '%' . addcslashes($filters['q'], '\\%_') . '%';
            $query->where(fn ($match) => $match->where('lot_number', 'like', $like)->orWhere('color', 'like', $like)->orWhere('style', 'like', $like)
                ->orWhereHas('product', fn ($product) => $product->where('name', 'like', $like)));
        }

        foreach (['color', 'size'] as $column) {
            if (! empty($filters[$column])) {
                $query->where($column, $filters[$column]);
            }
        }
        if (! empty($filters['product_id'])) {
            $query->where('product_item_id', $filters['product_id']);
        }
        if (! empty($filters['fabric_id'])) {
            $query->where('fabric_item_id', $filters['fabric_id']);
        }

        $lots = $query->limit(120)->get();
        $balances = $this->balances->forLots($lots->pluck('id'));
        $moved = $this->lastMovement($lots->pluck('id'));

        $rows = $lots->map(function (ProductionLot $lot) use ($balances, $moved) {
            $b = $balances[$lot->id];
            $last = $moved[$lot->id] ?? $lot->created_at;

            return [
                'id' => $lot->id,
                'lot_number' => $lot->lot_number,
                'product' => $lot->product?->name,
                'fabric' => $lot->fabric?->name,
                'style' => $lot->style,
                'color' => $lot->color,
                'size' => $lot->size,
                'cut_on' => $lot->cut_on?->toDateString(),
                'status' => $lot->held_at ? 'held' : $lot->status,
                'hold_reason' => $lot->hold_reason,
                'age_days' => (int) $lot->created_at->diffInDays(now()),
                'idle_days' => (int) $last->diffInDays(now()),
                'cut' => $b['cut'],
                'in_progress' => $b['in_progress'],
                'finished' => $b['finished'],
                'damaged' => $b['damaged'],
                'rejected' => $b['rejected'],
                'shortage' => $b['shortage'],
                'stages' => collect($b['stages'])->map(fn (array $s) => [
                    'here' => $s['wip'] + $s['outbox'] + $s['awaiting_quality'],
                    'arriving' => $s['incoming'],
                    'awaiting_quality' => $s['awaiting_quality'],
                ])->all(),
            ];
        });

        $open = ProductionLot::where('status', 'open')->get(['id']);
        $openBalances = $this->balances->forLots($open->pluck('id'));
        $flow = collect(ProductionFlowCatalog::keys())->map(function (string $stage) use ($openBalances) {
            $b = collect($openBalances)->pluck("stages.{$stage}");

            return $this->stageInfo($stage) + [
                'here' => (int) $b->sum(fn ($s) => $s['wip'] + $s['outbox'] + $s['awaiting_quality']),
                'arriving' => (int) $b->sum('incoming'),
                'in_work' => (int) $b->sum('wip'),
                'ready_to_send' => (int) $b->sum('outbox'),
                'awaiting_quality' => (int) $b->sum('awaiting_quality'),
                'damaged' => (int) $b->sum('damaged'),
                'rejected' => (int) $b->sum('quality_rejected'),
                'shortage' => (int) $b->sum('shortage'),
            ];
        })->values();

        $held = ProductionLot::whereNotNull('held_at')->with('product:id,name')->get(['id', 'lot_number', 'product_item_id', 'hold_reason', 'held_at']);

        return [
            'flow' => $flow,
            'lots' => $rows,
            'alerts' => [
                'held' => $held->map(fn (ProductionLot $lot) => ['id' => $lot->id, 'lot_number' => $lot->lot_number, 'product' => $lot->product?->name, 'reason' => $lot->hold_reason, 'since' => $lot->held_at?->toIso8601String()]),
                'awaiting_final_check' => $rows->filter(fn ($row) => ($row['stages']['packing']['awaiting_quality'] ?? 0) > 0)->values()
                    ->map(fn ($row) => ['id' => $row['id'], 'lot_number' => $row['lot_number'], 'product' => $row['product'], 'pieces' => $row['stages']['packing']['awaiting_quality']]),
                'stuck_deliveries' => (int) ProductionTransfer::where('status', 'sent')->where('sent_at', '<', now()->subHours(self::STUCK_AFTER_HOURS))->count(),
                'idle_lots' => $rows->filter(fn ($row) => $row['status'] === 'open' && $row['in_progress'] > 0 && $row['idle_days'] >= self::IDLE_AFTER_DAYS)->values()
                    ->map(fn ($row) => ['id' => $row['id'], 'lot_number' => $row['lot_number'], 'idle_days' => $row['idle_days']]),
                'missing_pieces' => (int) collect($openBalances)->sum('shortage'),
            ],
            'inspections' => QualityInspection::whereNotNull('lot_id')->with(['lot:id,lot_number', 'inspector:id,name'])->latest('id')->limit(15)->get()
                ->map(fn (QualityInspection $i) => $this->inspectionRow($i)),
            'filters' => ['status' => $status, 'q' => $filters['q'] ?? ''],
            'filter_options' => $this->lotFilterOptions(),
        ];
    }

    private function lotFilterOptions(): array
    {
        $lots = ProductionLot::where('status', '!=', 'cancelled')->with(['product:id,name', 'fabric:id,name'])->get(['id', 'product_item_id', 'fabric_item_id', 'color', 'size']);
        $unique = fn (string $column) => $lots->pluck($column)->filter()->unique()->sort()->values()->all();
        $named = fn (string $relation) => $lots->pluck($relation)->filter()->unique('id')->sortBy('name')->map(fn ($item) => ['id' => $item->id, 'name' => $item->name])->values()->all();

        return ['colors' => $unique('color'), 'sizes' => $unique('size'), 'products' => $named('product'), 'fabrics' => $named('fabric')];
    }

    public function lot(ProductionLot $lot): array
    {
        $lot->load(['product:id,name', 'creator:id,name', 'fabric:id,name']);
        $balances = $this->balances->forLot($lot->id);

        $timeline = collect()
            ->merge($lot->entries()->with(['recorder:id,name', 'fabric:id,name'])->get()->map(fn (ProductionEntry $e) => [
                'kind' => 'entry', 'at' => $e->created_at->toIso8601String(), 'stage' => $e->stage, 'who' => $e->recorder?->name,
                'good' => $e->good_quantity, 'damaged' => $e->damaged_quantity, 'fabric' => $e->fabric?->name, 'fabric_used' => (float) $e->fabric_used, 'fabric_waste' => (float) $e->fabric_waste,
                'note' => $e->notes, 'voided' => $e->voided_at !== null, 'void_reason' => $e->void_reason,
            ]))
            ->merge($lot->transfers()->with(['sender:id,name', 'receiver:id,name'])->get()->map(fn (ProductionTransfer $t) => [
                'kind' => 'transfer', 'at' => $t->created_at->toIso8601String(), 'from' => $t->from_stage, 'to' => $t->to_stage,
                'sent' => $t->quantity_sent, 'received' => $t->quantity_received, 'status' => $t->status, 'who' => $t->sender?->name, 'received_by' => $t->receiver?->name,
                'received_at' => $t->received_at?->toIso8601String(), 'note' => $t->note, 'receive_note' => $t->receive_note,
            ]))
            ->merge($lot->inspections()->with('inspector:id,name')->get()->map(fn (QualityInspection $i) => $this->inspectionRow($i) + ['kind' => 'inspection', 'at' => $i->created_at->toIso8601String()]))
            ->sortBy('at')->values();

        return [
            'lot' => [
                'id' => $lot->id, 'lot_number' => $lot->lot_number, 'product' => $lot->product?->name, 'style' => $lot->style, 'color' => $lot->color, 'size' => $lot->size,
                'cut_on' => $lot->cut_on?->toDateString(), 'status' => $lot->held_at ? 'held' : $lot->status, 'hold_reason' => $lot->hold_reason,
                'held_since' => $lot->held_at?->toIso8601String(), 'created_by' => $lot->creator?->name, 'notes' => $lot->notes, 'fabric' => $lot->fabric?->name,
            ],
            'balances' => $balances,
            'timeline' => $timeline,
        ];
    }

    public function requests(User $user, string $status, array $filters = []): array
    {
        $access = FlowAccess::for($user);
        $stage = $filters['stage'] ?? null;
        $like = ! empty($filters['q']) ? '%' . addcslashes($filters['q'], '\\%_') . '%' : null;

        $asked = $stage !== null && ($filters['direction'] ?? 'mine') === 'asked';
        $scope = fn ($query) => $stage === null
            ? $query->whereNull('from_stage')
            : ($asked ? $query->where('from_stage', $stage) : $query->where('stage', $stage));

        $requests = MaterialRequest::with(['item.unit:id,symbol', 'lot:id,lot_number', 'requester:id,name', 'decider:id,name', 'warehouse:id,name'])
            ->where($scope)
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when(! empty($filters['from']), fn ($query) => $query->where('created_at', '>=', Carbon::parse($filters['from'])->startOfDay()))
            ->when(! empty($filters['to']), fn ($query) => $query->where('created_at', '<=', Carbon::parse($filters['to'])->endOfDay()))
            ->when($like, fn ($query) => $query->where(fn ($match) => $match
                ->where('request_number', 'like', $like)
                ->orWhere('reason', 'like', $like)
                ->orWhereHas('item', fn ($item) => $item->where('name', 'like', $like))))
            ->latest('id')->limit(200)->get();

        $counts = MaterialRequest::query()
            ->where($scope)
            ->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        $available = StockBalance::whereIn('item_id', $requests->pluck('item_id')->filter())
            ->selectRaw('item_id, warehouse_id, SUM(quantity_on_hand - quantity_reserved - quantity_quarantined) as available')
            ->groupBy('item_id', 'warehouse_id')->get()->groupBy('item_id');

        $warehouses = Warehouse::where('is_active', true)->get(['id', 'name'])->keyBy('id');

        return [
            'capabilities' => [
                'approve' => $access->canApproveRequests(),
                'request' => $stage !== null && $access->canWork($stage),
                'previous' => $stage ? ProductionFlowCatalog::previous($stage) : null,
                'answer' => $asked && $access->canWork($stage),
                'asked_of_us' => $stage !== null && ProductionFlowCatalog::next($stage) !== null,
            ],
            'counts' => [
                'pending' => (int) ($counts['pending'] ?? 0),
                'approved' => (int) ($counts['approved'] ?? 0),
                'rejected' => (int) ($counts['rejected'] ?? 0),
                'cancelled' => (int) ($counts['cancelled'] ?? 0),
                'all' => (int) $counts->sum(),
            ],
            'options' => $stage ? $this->options($stage)['requestable'] : [],
            'lots' => $stage && ! $asked ? $this->lotsReadyBefore($stage) : [],
            'requests' => $requests->map(fn (MaterialRequest $request) => $this->requestRow($request) + [
                'stock' => $available->get($request->item_id, collect())->map(fn ($row) => [
                    'warehouse_id' => (int) $row->warehouse_id,
                    'warehouse' => $warehouses[$row->warehouse_id]->name ?? 'Warehouse',
                    'available' => (float) $row->available,
                ])->filter(fn ($row) => $row['available'] > 0)->values(),
                'own' => (int) $request->requested_by === (int) $user->id,
            ]),
            'warehouses' => $warehouses->values(),
        ];
    }

    public function report(CarbonInterface $from, CarbonInterface $to): array
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->addDay()->startOfDay();

        $entries = ProductionEntry::whereNull('voided_at')->where('entry_date', '>=', $start->toDateString())->where('entry_date', '<', $end->toDateString());

        $byStage = (clone $entries)->selectRaw('stage, COALESCE(SUM(good_quantity), 0) as good, COALESCE(SUM(damaged_quantity), 0) as damaged, COALESCE(SUM(fabric_used), 0) as fabric_used, COALESCE(SUM(fabric_waste), 0) as fabric_waste')
            ->groupBy('stage')->get()->keyBy('stage');

        $quality = QualityInspection::whereNotNull('lot_id')->where('created_at', '>=', $start)->where('created_at', '<', $end)
            ->selectRaw('stage, COUNT(*) as checks, COALESCE(SUM(inspected_quantity), 0) as inspected, COALESCE(SUM(passed_quantity), 0) as passed, COALESCE(SUM(rejected_quantity), 0) as rejected')
            ->groupBy('stage')->get()->keyBy('stage');

        $sent = ProductionTransfer::whereIn('status', ['sent', 'received'])->where('sent_at', '>=', $start)->where('sent_at', '<', $end)
            ->selectRaw('from_stage as stage, COALESCE(SUM(quantity_sent), 0) as sent, COALESCE(SUM(quantity_sent - COALESCE(quantity_received, quantity_sent)), 0) as missing')
            ->groupBy('from_stage')->get()->keyBy('stage');

        $received = ProductionTransfer::where('status', 'received')->where('received_at', '>=', $start)->where('received_at', '<', $end)
            ->selectRaw('to_stage as stage, COALESCE(SUM(quantity_received), 0) as received')
            ->groupBy('to_stage')->get()->keyBy('stage');

        $stages = collect(ProductionFlowCatalog::keys())->map(function (string $stage) use ($byStage, $quality, $sent, $received) {
            $row = $byStage->get($stage);
            $q = $quality->get($stage);
            $good = (int) ($row->good ?? 0);
            $damaged = (int) ($row->damaged ?? 0);
            $input = $stage === 'cutting' ? (float) ($row->fabric_used ?? 0) : (int) ($received->get($stage)->received ?? 0);

            return $this->stageInfo($stage) + [
                'input' => $input,
                'input_label' => $stage === 'cutting' ? 'Meters fabric' : 'Pieces received',
                'good' => $good,
                'damaged' => $damaged,
                'damage_rate' => $good + $damaged > 0 ? round($damaged / ($good + $damaged) * 100, 1) : null,
                'sent' => (int) ($sent->get($stage)->sent ?? 0),
                'missing' => (int) ($sent->get($stage)->missing ?? 0),
                'checks' => (int) ($q->checks ?? 0),
                'inspected' => (int) ($q->inspected ?? 0),
                'passed' => (int) ($q->passed ?? 0),
                'rejected' => (int) ($q->rejected ?? 0),
                'qc_status' => (int) ($q->inspected ?? 0) === 0 ? 'pending' : ((int) ($q->rejected ?? 0) === 0 ? 'passed' : 'conditional'),
            ];
        })->values();

        $daily = (clone $entries)->selectRaw('entry_date as day, stage, SUM(good_quantity) as good, SUM(damaged_quantity) as damaged')
            ->groupBy('entry_date', 'stage')->orderBy('entry_date')->get()
            ->groupBy(fn ($row) => substr((string) $row->day, 0, 10))
            ->map(fn (Collection $rows, string $day) => ['day' => $day] + collect(ProductionFlowCatalog::keys())->mapWithKeys(fn (string $stage) => [
                $stage => ['good' => (int) ($rows->firstWhere('stage', $stage)->good ?? 0), 'damaged' => (int) ($rows->firstWhere('stage', $stage)->damaged ?? 0)],
            ])->all())->values();

        $fabric = (clone $entries)->where('stage', 'cutting')->whereNotNull('fabric_item_id')
            ->selectRaw('fabric_item_id, SUM(fabric_used) as used, SUM(fabric_waste) as waste')->groupBy('fabric_item_id')->get();
        $names = Item::with('unit:id,symbol')->whereIn('id', $fabric->pluck('fabric_item_id'))->get()->keyBy('id');

        return [
            'period' => ['from' => $start->toDateString(), 'to' => $to->toDateString()],
            'stages' => $stages,
            'daily' => $daily,
            'fabric' => $fabric->map(fn ($row) => [
                'name' => $names[$row->fabric_item_id]->name ?? 'Fabric',
                'unit' => $names[$row->fabric_item_id]->unit->symbol ?? null,
                'used' => (float) $row->used,
                'waste' => (float) $row->waste,
                'waste_rate' => (float) $row->used + (float) $row->waste > 0 ? round((float) $row->waste / ((float) $row->used + (float) $row->waste) * 100, 1) : null,
            ])->values(),
        ];
    }

    private function stageRow(ProductionLot $lot, array $balance, string $stage): array
    {
        $b = $balance['stages'][$stage];

        $inspections = $lot->relationLoaded('inspections')
            ? $lot->inspections->where('stage', $stage)
            : $lot->inspections()->where('stage', $stage)->get();

        $latestInspection = $inspections->sortByDesc('id')->first();
        $latestFailed = $inspections->where('rejected_quantity', '>', 0)->sortByDesc('id')->first();
        $qcMessage = $latestFailed?->defect_details ?: ($latestFailed?->notes ?: ($latestInspection?->defect_details ?: $latestInspection?->notes));
        $qcStatus = $latestInspection?->result ?: ($b['awaiting_quality'] > 0 ? 'pending' : ($b['quality_passed'] > 0 ? 'passed' : null));

        return [
            'id' => $lot->id,
            'lot_number' => $lot->lot_number,
            'product' => $lot->product?->name,
            'fabric' => $lot->fabric?->name,
            'style' => $lot->style,
            'color' => $lot->color,
            'size' => $lot->size,
            'cut_on' => $lot->cut_on?->toDateString(),
            'held' => $lot->held_at !== null,
            'hold_reason' => $lot->hold_reason,
            'cut' => $balance['cut'],
            'wip' => $b['wip'],
            'outbox' => $b['outbox'],
            'incoming' => $b['incoming'],
            'awaiting_quality' => $b['awaiting_quality'],
            'ready_for_stock' => $b['ready_for_stock'] ?? 0,
            'stock_pending' => $b['stock_pending'] ?? 0,
            'in_stock' => $b['in_stock'] ?? 0,
            'good' => $b['good'],
            'damaged' => $b['damaged'],
            'sent' => $b['sent'],
            'quality_passed' => $b['quality_passed'] ?? 0,
            'quality_rejected' => $b['quality_rejected'] ?? 0,
            'qc_message' => $qcMessage,
            'qc_status' => $qcStatus,
        ];
    }

    private function entryRow(ProductionEntry $entry, FlowAccess $access): array
    {
        $own = (int) $entry->recorded_by === (int) $access->user()->id;

        return [
            'id' => $entry->id,
            'lot_id' => $entry->lot_id,
            'lot_number' => $entry->lot?->lot_number,
            'date' => $entry->entry_date?->toDateString(),
            'good' => $entry->good_quantity,
            'damaged' => $entry->damaged_quantity,
            'fabric' => $entry->fabric?->name,
            'fabric_used' => (float) $entry->fabric_used,
            'fabric_waste' => (float) $entry->fabric_waste,
            'note' => $entry->notes,
            'by' => $entry->recorder?->name,
            'at' => $entry->created_at->toIso8601String(),
            'voided' => $entry->voided_at !== null,
            'void_reason' => $entry->void_reason,
            'can_void' => $entry->voided_at === null && ($access->isManager() || ($own && $entry->created_at->diffInHours(now()) <= 48)),
        ];
    }

    private function transferRow(ProductionTransfer $transfer): array
    {
        return [
            'id' => $transfer->id,
            'lot_id' => $transfer->lot_id,
            'lot_number' => $transfer->lot?->lot_number,
            'product' => $transfer->lot?->product?->name,
            'fabric' => $transfer->lot?->fabric?->name,
            'color' => $transfer->lot?->color,
            'size' => $transfer->lot?->size,
            'from' => $transfer->from_stage,
            'to' => $transfer->to_stage,
            'quantity_sent' => $transfer->quantity_sent,
            'quantity_received' => $transfer->quantity_received,
            'status' => $transfer->status,
            'note' => $transfer->note,
            'receive_note' => $transfer->receive_note,
            'sent_by' => $transfer->sender?->name,
            'received_by' => $transfer->receiver?->name,
            'sent_at' => $transfer->sent_at?->toIso8601String(),
            'received_at' => $transfer->received_at?->toIso8601String(),
        ];
    }

    private function requestRow(MaterialRequest $request): array
    {
        return [
            'id' => $request->id,
            'number' => $request->request_number,
            'stage' => $request->stage,
            'item_id' => $request->item_id,
            'item' => $request->item?->name,
            'unit' => $request->item?->unit?->symbol,
            'kind' => $request->isForPieces() ? 'pieces' : 'material',
            'from_stage' => $request->from_stage,
            'lot_number' => $request->lot?->lot_number,
            'fulfilled' => (int) $request->fulfilled_quantity,
            'quantity' => (float) $request->quantity,
            'reason' => $request->reason,
            'status' => $request->status,
            'requested_by' => $request->requester?->name,
            'decided_by' => $request->decider?->name,
            'decision_note' => $request->decision_note,
            'warehouse' => $request->warehouse?->name,
            'at' => $request->created_at->toIso8601String(),
            'decided_at' => $request->decided_at?->toIso8601String(),
        ];
    }

    private function inspectionRow(QualityInspection $inspection): array
    {
        return [
            'id' => $inspection->id,
            'number' => $inspection->inspection_number,
            'lot_id' => $inspection->lot_id,
            'lot_number' => $inspection->lot?->lot_number,
            'stage' => $inspection->stage,
            'inspected' => (float) $inspection->inspected_quantity,
            'passed' => (float) $inspection->passed_quantity,
            'rejected' => (float) $inspection->rejected_quantity,
            'result' => $inspection->result,
            'defects' => $inspection->defect_details,
            'notes' => $inspection->notes,
            'who' => $inspection->inspector?->name,
            'at' => $inspection->created_at->toIso8601String(),
        ];
    }

    /** Open lots that have pieces at the stage before this one, finished or still being worked, so a team can ask for them before they are sent. */
    private function lotsReadyBefore(string $stage): array
    {
        $previous = ProductionFlowCatalog::previous($stage);

        if ($previous === null) {
            return [];
        }

        $lots = ProductionLot::with('product:id,name')->where('status', 'open')->get();
        $balances = $this->balances->forLots($lots->pluck('id'));

        return $lots->map(fn (ProductionLot $lot) => [
            'id' => $lot->id,
            'lot_number' => $lot->lot_number,
            'product' => $lot->product?->name,
            'color' => $lot->color,
            'size' => $lot->size,
            'ready' => (int) ($balances[$lot->id]['stages'][$previous]['outbox'] ?? 0) + (int) ($balances[$lot->id]['stages'][$previous]['wip'] ?? 0),
        ])->filter(fn (array $row) => $row['ready'] > 0)->values()->all();
    }

    private function stageInfo(string $stage): array
    {
        return [
            'key' => $stage,
            'label' => ProductionFlowCatalog::STAGES[$stage]['label'],
            'previous' => ProductionFlowCatalog::previous($stage),
            'next' => ProductionFlowCatalog::next($stage),
            'destinations' => ProductionFlowCatalog::destinations($stage),
        ];
    }

    private function capabilities(FlowAccess $access, string $stage): array
    {
        return [
            'work' => $access->canWork($stage),
            'inspect' => $access->canInspect(),
            'manage' => $access->isManager(),
            'stages' => $access->workStages(),
        ];
    }

    private function options(string $stage): array
    {
        $items = Item::with('unit:id,symbol')->where('is_active', true)->orderBy('name')->get(['id', 'name', 'sku', 'type', 'unit_id', 'color']);
        $pick = fn (Item $item) => ['id' => $item->id, 'name' => $item->name, 'sku' => $item->sku, 'unit' => $item->unit?->symbol, 'color' => $item->color];

        return [
            'requestable' => $items->whereIn('type', MaterialRequestService::REQUESTABLE_TYPES)->map($pick)->values(),
            'fabrics' => $items->where('type', 'raw_material')->map($pick)->values(),
            'products' => $stage === 'cutting' ? $items->where('type', 'finished_good')->map($pick)->values() : [],
        ];
    }

    private function lastMovement(Collection $lotIds): array
    {
        $latest = [];

        foreach ([ProductionEntry::class, ProductionTransfer::class, QualityInspection::class] as $model) {
            $model::whereIn('lot_id', $lotIds)->selectRaw('lot_id, MAX(updated_at) as moved')->groupBy('lot_id')->get()
                ->each(function ($row) use (&$latest) {
                    $moved = Carbon::parse($row->moved);
                    if (! isset($latest[$row->lot_id]) || $moved->gt($latest[$row->lot_id])) {
                        $latest[$row->lot_id] = $moved;
                    }
                });
        }

        return $latest;
    }
}
