<?php

namespace App\Support\Reports;

use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeProfile;
use App\Models\Factory;
use App\Models\LeaveRequest;
use App\Models\Machine;
use App\Models\MaintenanceRecord;
use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionOrder;
use App\Models\ProductionStageExecution;
use App\Models\ProductionTransfer;
use App\Models\PurchaseDocument;
use App\Models\QualityInspection;
use App\Models\SafetyIncident;
use App\Models\SalesDocument;
use App\Models\SalesDocumentLine;
use App\Models\SalesPayment;
use App\Models\SchoolPaymentSubmission;
use App\Models\StockBalance;
use App\Services\ProductionFlow\FlowBalances;
use App\Support\Catalogs\ProductionFlowCatalog;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OwnerOverviewReport
{
    private const NOT_COUNTED_ORDER_STATUSES = ['cancelled', 'rejected'];

    private const OPEN_PRODUCTION_STATUSES = ['draft', 'planned', 'approved', 'in_progress', 'paused'];

    private const BROKEN_MACHINE_STATUSES = ['down', 'broken', 'maintenance'];

    private CarbonInterface $end;

    private CarbonInterface $start;

    private CarbonInterface $previousStart;

    public function __construct(
        private readonly int $factoryId,
        private readonly int $days = 30,
        ?CarbonInterface $from = null,
        ?CarbonInterface $to = null,
    ) {
        if ($from && $to) {
            $this->end = $to->copy()->endOfDay();
            $this->start = $from->copy()->startOfDay();
            $diffDays = max(1, (int) $this->start->diffInDays($this->end) + 1);
            $this->previousStart = $this->start->copy()->subDays($diffDays);
        } else {
            $this->end = now();
            $this->start = $this->end->copy()->subDays($days);
            $this->previousStart = $this->start->copy()->subDays($days);
        }
    }

    public function build(): array
    {
        $cash = $this->cash();
        $production = $this->production();
        $stock = $this->stock();
        $customers = $this->customers();
        $quality = $this->quality();
        $people = $this->people();
        $safety = $this->safety();
        $equipment = $this->equipment();
        $flow = $this->flow();

        return [
            'period' => [
                'days' => $this->days,
                'from' => $this->start->toDateString(),
                'to' => $this->end->toDateString(),
            ],
            'growth' => $this->growth(),
            'trend' => $this->monthlyTrend(),
            'cash' => $cash,
            'production' => $production,
            'flow' => $flow,
            'stock' => $stock,
            'customers' => $customers,
            'quality' => $quality,
            'people' => $people,
            'safety' => $safety,
            'equipment' => $equipment,
            'alerts' => $this->alerts($cash, $production, $stock, $customers, $quality, $safety, $equipment, $flow),
            'activity' => $this->activity(),
        ];
    }

    private function growth(): array
    {
        return [
            'revenue' => $this->compare(fn ($from, $to) => $this->revenueBetween($from, $to)),
            'orders' => $this->compare(
                fn ($from, $to) => $this->countedOrders()
                    ->whereBetween('document_date', [$from->toDateString(), $to->toDateString()])
                    ->count(),
            ),
            'units_delivered' => $this->compare(fn ($from, $to) => $this->unitsDeliveredBetween($from, $to)),
            'output' => $this->compare(fn ($from, $to) => $this->outputBetween($from, $to)),
            'collected' => $this->compare(fn ($from, $to) => $this->collectedBetween($from, $to)),
        ];
    }

    private function monthlyTrend(): array
    {
        $months = collect(range(11, 0))->map(fn (int $monthsAgo) => now()->startOfMonth()->subMonths($monthsAgo))->values();

        $revenue = $this->monthlySums($this->countedOrders(), 'document_date', 'total_amount', $months, dateOnly: true);
        $orders = $this->monthlySums($this->countedOrders(), 'document_date', '1', $months, dateOnly: true);
        $output = $this->monthlySums(
            ProductionStageExecution::withoutGlobalScopes()->where('factory_id', $this->factoryId)->where('status', 'completed'),
            'completed_at',
            'output_quantity',
            $months,
            dateOnly: false,
        );
        $packed = $this->monthlySums($this->packedEntries(), 'entry_date', 'good_quantity', $months, dateOnly: true);
        $output = array_map(fn ($value, $index) => $value + $packed[$index], $output, array_keys($output));

        return $months
            ->map(fn ($month, int $index) => [
                'label' => $month->format('M y'),
                'revenue' => $revenue[$index],
                'orders' => $orders[$index],
                'output' => $output[$index],
            ])
            ->all();
    }

    private function monthlySums($query, string $dateColumn, string $valueExpression, Collection $months, bool $dateOnly): array
    {
        $format = fn ($date) => $dateOnly ? $date->toDateString() : $date->toDateTimeString();

        $selects = [];
        $bindings = [];
        foreach ($months as $index => $start) {
            $selects[] = "COALESCE(SUM(CASE WHEN {$dateColumn} BETWEEN ? AND ? THEN {$valueExpression} ELSE 0 END), 0) AS m{$index}";
            array_push($bindings, $format($start), $format($start->copy()->endOfMonth()));
        }

        $row = $query
            ->whereBetween($dateColumn, [$format($months->first()), $format($months->last()->copy()->endOfMonth())])
            ->selectRaw(implode(', ', $selects), $bindings)
            ->first();

        return $months->keys()->map(fn (int $index) => (float) $row->{"m{$index}"})->all();
    }

    private function cash(): array
    {
        $billed = (float) $this->countedOrders()->sum('total_amount');
        $paid = (float) $this->countedOrders()->sum('paid_amount');

        $overdue = $this->countedOrders()
            ->where('payment_status', '!=', 'paid')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', today());

        $supplierBills = PurchaseDocument::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('document_type', 'purchase_order')
            ->whereNotIn('status', ['cancelled', 'draft']);

        return [
            'billed' => $billed,
            'collected' => $paid,
            'receivable' => max(0, $billed - $paid),
            'collection_rate' => $billed > 0 ? round(($paid / $billed) * 100, 1) : null,
            'overdue_receivable' => (float) (clone $overdue)
                ->selectRaw('COALESCE(SUM(total_amount - paid_amount), 0) as due')
                ->value('due'),
            'overdue_orders' => (clone $overdue)->count(),
            'payable' => max(
                0,
                (float) (clone $supplierBills)->sum('total_amount') -
                    (float) (clone $supplierBills)->sum('paid_amount'),
            ),
            'pending_receipts' => SchoolPaymentSubmission::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->where('status', 'pending')
                ->count(),
            'maintenance_cost' => (float) $this->maintenanceInPeriod()->sum('cost'),
        ];
    }

    private function production(): array
    {
        $orders = ProductionOrder::withoutGlobalScopes()->where('factory_id', $this->factoryId);
        $inPeriod = (clone $orders)->whereBetween('created_at', [$this->start, $this->end]);

        $completed = (float) (clone $inPeriod)->sum('completed_quantity');
        $rejected = (float) (clone $inPeriod)->sum('rejected_quantity');
        $waste = (float) (clone $inPeriod)->sum('waste_quantity');
        $planned = (float) (clone $inPeriod)->sum('planned_quantity');

        $late = (clone $orders)
            ->whereIn('status', self::OPEN_PRODUCTION_STATUSES)
            ->whereNotNull('planned_end')
            ->whereDate('planned_end', '<', today());

        $finished = (clone $orders)
            ->where('status', 'completed')
            ->whereNotNull('planned_end')
            ->whereNotNull('completed_at')
            ->whereBetween('completed_at', [$this->start, $this->end])
            ->get(['planned_end', 'completed_at']);

        return [
            'planned' => $planned,
            'completed' => $completed,
            'completion_rate' => $planned > 0 ? round(($completed / $planned) * 100, 1) : null,
            'rejected' => $rejected,
            'waste' => $waste,
            'reject_rate' => $completed + $rejected > 0 ? round(($rejected / ($completed + $rejected)) * 100, 1) : null,
            'open_orders' => (clone $orders)->whereIn('status', self::OPEN_PRODUCTION_STATUSES)->count(),
            'late_orders' => (clone $late)->count(),
            'on_time_rate' => $finished->count() > 0
                    ? round(
                        ($finished
                            ->filter(
                                fn ($order) => $order->completed_at->toDateString() <=
                                    $order->planned_end->toDateString(),
                            )
                            ->count() /
                            $finished->count()) *
                            100,
                        1,
                    )
                    : null,
            'downtime_minutes' => (int) ProductionStageExecution::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->whereBetween('created_at', [$this->start, $this->end])
                ->sum('downtime_minutes'),
        ];
    }

    /** The live state of the garment production flow, or null for factories that do not use it. */
    private function flow(): ?array
    {
        $factory = Factory::withoutGlobalScopes()->find($this->factoryId);

        if (! $factory?->hasFeature('garment_flow')) {
            return null;
        }

        $done = ProductionEntry::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->whereNull('voided_at')
            ->where('entry_date', '>=', $this->start->toDateString())
            ->where('entry_date', '<=', $this->end->toDateString())
            ->selectRaw('stage, COALESCE(SUM(good_quantity), 0) as good, COALESCE(SUM(damaged_quantity), 0) as damaged')
            ->groupBy('stage')
            ->get()
            ->keyBy('stage');

        $open = ProductionLot::withoutGlobalScopes()->where('factory_id', $this->factoryId)->where('status', 'open')->pluck('id');
        $balances = collect(app(FlowBalances::class)->forLots($open));

        $stages = collect(ProductionFlowCatalog::keys())->map(function (string $stage) use ($done, $balances) {
            $now = $balances->pluck("stages.{$stage}");

            return [
                'key' => $stage,
                'label' => ProductionFlowCatalog::STAGES[$stage]['label'],
                'done' => (int) ($done[$stage]->good ?? 0),
                'damaged' => (int) ($done[$stage]->damaged ?? 0),
                'here' => (int) $now->sum(fn ($row) => $row['wip'] + $row['outbox'] + $row['awaiting_quality']),
            ];
        })->values()->all();

        return [
            'stages' => $stages,
            'lots_open' => $open->count(),
            'lots_held' => ProductionLot::withoutGlobalScopes()->where('factory_id', $this->factoryId)->whereNotNull('held_at')->count(),
            'requests_waiting' => MaterialRequest::withoutGlobalScopes()->where('factory_id', $this->factoryId)->whereNull('from_stage')->where('status', 'pending')->count(),
            'deliveries_waiting' => ProductionTransfer::withoutGlobalScopes()->where('factory_id', $this->factoryId)->where('status', 'sent')->count(),
            'stuck_deliveries' => ProductionTransfer::withoutGlobalScopes()->where('factory_id', $this->factoryId)->where('status', 'sent')->where('sent_at', '<', now()->subDay())->count(),
            'awaiting_final_check' => (int) $balances->sum(fn ($lot) => $lot['stages']['packing']['awaiting_quality'] ?? 0),
        ];
    }

    private function stock(): array
    {
        $balances = StockBalance::withoutGlobalScopes()->where('stock_balances.factory_id', $this->factoryId);

        $levels = DB::table('items')
            ->where('items.factory_id', $this->factoryId)
            ->where('items.is_active', true)
            ->whereNull('items.deleted_at')
            ->leftJoin('stock_balances', 'stock_balances.item_id', '=', 'items.id')
            ->groupBy('items.id', 'items.reorder_level')
            ->selectRaw('items.id, items.reorder_level, COALESCE(SUM(stock_balances.quantity_on_hand), 0) as on_hand')
            ->get();

        $expiringSoon = Batch::withoutGlobalScopes()
            ->where('batches.factory_id', $this->factoryId)
            ->whereNotNull('expires_at')
            ->whereBetween('expires_at', [today(), today()->addDays(30)])
            ->whereExists(function ($query) {
                $query
                    ->select(DB::raw(1))
                    ->from('stock_balances')
                    ->whereColumn('stock_balances.batch_id', 'batches.id')
                    ->where('stock_balances.quantity_on_hand', '>', 0);
            })
            ->count();

        return [
            'value' => (float) (clone $balances)
                ->join('items', 'items.id', '=', 'stock_balances.item_id')
                ->sum(DB::raw('stock_balances.quantity_on_hand * items.standard_cost')),
            'low_stock' => $levels->filter(fn ($row) => (float) $row->on_hand <= (float) $row->reorder_level)->count(),
            'out_of_stock' => $levels->filter(fn ($row) => (float) $row->on_hand <= 0)->count(),
            'expiring_soon' => $expiringSoon,
            'tracked_items' => $levels->count(),
        ];
    }

    private function customers(): array
    {
        $orders = $this->countedOrders();

        $late = (clone $orders)
            ->whereNotIn('status', ['delivered', 'completed'])
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', today());

        $topCustomers = (clone $orders)
            ->whereBetween('document_date', [$this->start->toDateString(), $this->end->toDateString()])
            ->selectRaw(
                'COALESCE(customer_name, \'Unknown\') as name, COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue',
            )
            ->groupBy('customer_name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(
                fn ($row) => ['name' => $row->name, 'orders' => (int) $row->orders, 'revenue' => (float) $row->revenue],
            );

        $ordered = (float) $this->lines()->sum('quantity_ordered');
        $delivered = (float) $this->lines()->sum('quantity_delivered');

        return [
            'received' => (clone $orders)
                ->whereBetween('document_date', [$this->start->toDateString(), $this->end->toDateString()])
                ->count(),
            'open' => (clone $orders)->whereNotIn('status', ['delivered', 'completed'])->count(),
            'late' => (clone $late)->count(),
            'units_ordered' => $ordered,
            'units_delivered' => $delivered,
            'fulfilment_rate' => $ordered > 0 ? round(($delivered / $ordered) * 100, 1) : null,
            'returns' => SalesDocument::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->where('document_type', 'return')
                ->whereBetween('document_date', [$this->start->toDateString(), $this->end->toDateString()])
                ->count(),
            'top' => $topCustomers,
        ];
    }

    private function quality(): array
    {
        $inspections = QualityInspection::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->whereIn('result', ['passed', 'failed', 'conditional']);

        $current = (clone $inspections)->whereBetween('inspected_at', [$this->start, $this->end]);
        $previous = (clone $inspections)->whereBetween('inspected_at', [$this->previousStart, $this->start]);

        $rate = function ($query) {
            $total = (clone $query)->count();

            return $total > 0 ? round(((clone $query)->where('result', 'passed')->count() / $total) * 100, 1) : null;
        };

        return [
            'inspections' => (clone $current)->count(),
            'passed' => (clone $current)->where('result', 'passed')->count(),
            'failed' => (clone $current)->where('result', 'failed')->count(),
            'conditional' => (clone $current)->where('result', 'conditional')->count(),
            'pass_rate' => $rate($current),
            'previous_pass_rate' => $rate($previous),
            'rejected_quantity' => (float) (clone $current)->sum('rejected_quantity'),
            'pending' => QualityInspection::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->where('result', 'pending')
                ->count(),
        ];
    }

    private function people(): array
    {
        $attendance = EmployeeAttendance::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->whereBetween('date', [$this->start->toDateString(), $this->end->toDateString()]);

        $marked = (clone $attendance)->whereIn('status', ['present', 'late', 'absent'])->count();
        $present = (clone $attendance)->whereIn('status', ['present', 'late'])->count();

        return [
            'headcount' => EmployeeProfile::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->where('employment_status', 'active')
                ->count(),
            'attendance_rate' => $marked > 0 ? round(($present / $marked) * 100, 1) : null,
            'late' => (clone $attendance)->where('status', 'late')->count(),
            'absent' => (clone $attendance)->where('status', 'absent')->count(),
            'on_leave_today' => LeaveRequest::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->where('status', 'approved')
                ->whereDate('starts_at', '<=', today())
                ->whereDate('ends_at', '>=', today())
                ->count(),
            'pending_leave' => LeaveRequest::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->where('status', 'pending')
                ->count(),
        ];
    }

    private function safety(): array
    {
        $incidents = SafetyIncident::withoutGlobalScopes()->where('factory_id', $this->factoryId);

        $lastIncident = (clone $incidents)->max('incident_date');

        return [
            'incidents' => (clone $incidents)
                ->whereBetween('incident_date', [$this->start->toDateString(), $this->end->toDateString()])
                ->count(),
            'open' => (clone $incidents)->where('status', '!=', 'resolved')->count(),
            'serious_open' => (clone $incidents)
                ->where('status', '!=', 'resolved')
                ->whereIn('severity', ['severe', 'critical'])
                ->count(),
            'days_without_incident' => $lastIncident ? (int) abs(today()->diffInDays($lastIncident)) : null,
        ];
    }

    private function equipment(): array
    {
        $machines = Machine::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('status', '!=', 'retired');

        $total = (clone $machines)->count();
        $broken = (clone $machines)->whereIn('status', self::BROKEN_MACHINE_STATUSES)->count();

        return [
            'machines' => $total,
            'unavailable' => $broken,
            'availability_rate' => $total > 0 ? round((($total - $broken) / $total) * 100, 1) : null,
            'service_overdue' => (clone $machines)
                ->whereNotNull('next_maintenance_at')
                ->where('next_maintenance_at', '<', now())
                ->count(),
            'downtime_minutes' => (int) $this->maintenanceInPeriod()->sum('downtime_minutes'),
            'open_jobs' => MaintenanceRecord::withoutGlobalScopes()
                ->where('factory_id', $this->factoryId)
                ->whereIn('status', ['open', 'scheduled', 'in_progress'])
                ->count(),
        ];
    }

    private function alerts(
        array $cash,
        array $production,
        array $stock,
        array $customers,
        array $quality,
        array $safety,
        array $equipment,
        ?array $flow = null,
    ): array {
        $rules = [
            ['serious_incident', 'critical', $safety['serious_open'], 'safety'],
            ['machines_down', 'critical', $equipment['unavailable'], 'machines'],
            ['overdue_payments', 'warning', $cash['overdue_orders'], 'finance'],
            ['late_orders', 'warning', $customers['late'], 'sales'],
            ['late_production', 'warning', $production['late_orders'], 'production'],
            ['low_stock', 'warning', $stock['low_stock'], 'inventory'],
            ['expiring_batches', 'warning', $stock['expiring_soon'], 'inventory'],
            ['service_overdue', 'warning', $equipment['service_overdue'], 'machines'],
            ['failed_inspections', 'warning', $quality['failed'], 'quality'],
            ['payment_receipts', 'info', $cash['pending_receipts'], 'finance'],
            ['held_lots', 'warning', $flow['lots_held'] ?? 0, 'production-flow'],
            ['stuck_deliveries', 'warning', $flow['stuck_deliveries'] ?? 0, 'production-flow'],
            ['material_requests', 'info', $flow['requests_waiting'] ?? 0, 'incoming-requests'],
            ['final_check', 'info', $flow['awaiting_final_check'] ?? 0, 'production-flow'],
        ];

        return collect($rules)
            ->filter(fn (array $rule) => $rule[2] > 0)
            ->map(
                fn (array $rule) => [
                    'key' => $rule[0],
                    'level' => $rule[1],
                    'count' => (int) $rule[2],
                    'page' => $rule[3],
                ],
            )
            ->values()
            ->all();
    }

    private function activity(): array
    {
        return AuditLog::where('factory_id', $this->factoryId)
            ->with('user:id,name')
            ->latest()
            ->limit(12)
            ->get(['id', 'user_id', 'event', 'description', 'created_at'])
            ->map(
                fn ($log) => [
                    'id' => $log->id,
                    'who' => $log->user?->name ?? 'System',
                    'event' => $log->event,
                    'description' => $log->description,
                    'at' => $log->created_at?->toIso8601String(),
                ],
            )
            ->all();
    }

    private function compare(callable $measure): array
    {
        $current = (float) $measure($this->start, $this->end);
        $previous = (float) $measure($this->previousStart, $this->start);

        return [
            'current' => $current,
            'previous' => $previous,
            'change' => $previous > 0 ? round((($current - $previous) / $previous) * 100, 1) : null,
        ];
    }

    private function countedOrders()
    {
        return SalesDocument::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('document_type', 'customer_order')
            ->whereNotIn('status', self::NOT_COUNTED_ORDER_STATUSES);
    }

    private function lines()
    {
        return SalesDocumentLine::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->whereHas(
                'document',
                fn ($query) => $query
                    ->withoutGlobalScopes()
                    ->where('document_type', 'customer_order')
                    ->whereNotIn('status', self::NOT_COUNTED_ORDER_STATUSES),
            );
    }

    private function revenueBetween(CarbonInterface $from, CarbonInterface $to): float
    {
        return (float) $this->countedOrders()
            ->whereBetween('document_date', [$from->toDateString(), $to->toDateString()])
            ->sum('total_amount');
    }

    private function unitsDeliveredBetween(CarbonInterface $from, CarbonInterface $to): float
    {
        return (float) $this->lines()
            ->whereBetween('updated_at', [$from, $to])
            ->sum('quantity_delivered');
    }

    private function outputBetween(CarbonInterface $from, CarbonInterface $to): float
    {
        $stages = (float) ProductionStageExecution::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->sum('output_quantity');

        $packed = (float) $this->packedEntries()
            ->where('entry_date', '>=', $from->toDateString())
            ->where('entry_date', '<', $to->copy()->addDay()->toDateString())
            ->sum('good_quantity');

        return $stages + $packed;
    }

    private function packedEntries()
    {
        return ProductionEntry::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('stage', 'packing')
            ->whereNull('voided_at');
    }

    private function collectedBetween(CarbonInterface $from, CarbonInterface $to): float
    {
        $schools = (float) SchoolPaymentSubmission::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('status', 'approved')
            ->whereBetween('reviewed_at', [$from, $to])
            ->sum('amount');

        $counter = (float) SalesPayment::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->where('paid_on', '>=', $from->toDateString())
            ->where('paid_on', '<', $to->copy()->addDay()->toDateString())
            ->sum('amount');

        return $schools + $counter;
    }

    private function maintenanceInPeriod()
    {
        return MaintenanceRecord::withoutGlobalScopes()
            ->where('factory_id', $this->factoryId)
            ->whereBetween('created_at', [$this->start, $this->end]);
    }
}
