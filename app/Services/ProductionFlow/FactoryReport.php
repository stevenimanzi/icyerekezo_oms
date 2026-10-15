<?php

namespace App\Services\ProductionFlow;

use App\Models\MaterialRequest;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Models\QualityInspection;
use App\Models\StockTransaction;
use App\Models\User;
use App\Services\StockAnalytics;
use App\Support\Catalogs\ProductionFlowCatalog;
use App\Support\Reports\FactoryRegister;
use App\Support\Reports\SalesReport;
use App\Support\Tenancy\OperationalScope;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/** One report for every department of a garment factory: the four stages, warehouse, quality and sales. */
class FactoryReport
{
    private const REGISTER_DAYS = 92;

    private const ALL_SECTIONS = ['cutting', 'sewing', 'finishing', 'packing', 'warehouse', 'quality', 'sales'];

    private const SEE_EVERYTHING = ['factory-owner', 'factory-administrator', 'factory-manager', 'production-manager', 'production-supervisor', 'internal-auditor'];

    private const OWN_SECTION = [
        'cutting-operator' => 'cutting',
        'sewing-operator' => 'sewing',
        'finishing-manager' => 'finishing',
        'finishing-operator' => 'finishing',
        'packing-manager' => 'packing',
        'packing-operator' => 'packing',
        'packaging-manager' => 'packing',
        'packaging-operator' => 'packing',
        'warehouse-keeper' => 'warehouse',
        'quality-officer' => 'quality',
        'quality-manager' => 'quality',
        'sales-officer' => 'sales',
    ];

    public function __construct(private readonly FlowBalances $balances) {}

    /** The sections this person may read: everything for management, otherwise only their own department. */
    public function sectionsFor(User $user): array
    {
        $slugs = $user->roles()->wherePivot('factory_id', $user->current_factory_id)->pluck('slug')->all();

        if ($user->is_platform_admin || array_intersect(self::SEE_EVERYTHING, $slugs)) {
            return self::ALL_SECTIONS;
        }

        $own = collect($slugs)->map(fn (string $slug) => self::OWN_SECTION[$slug] ?? null)->filter()->unique()->values()->all();

        return $own ?: self::ALL_SECTIONS;
    }

    public function build(User $user, CarbonInterface $from, CarbonInterface $to, ?string $only = null): array
    {
        $allowed = $this->sectionsFor($user);
        $sections = $only && in_array($only, $allowed, true) ? [$only] : $allowed;
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        $report = ['period' => ['from' => $start->toDateString(), 'to' => $end->toDateString()], 'available' => $allowed, 'shown' => $sections];

        foreach ($sections as $section) {
            $report[$section] = match ($section) {
                'warehouse' => $this->warehouse($user, $start, $end),
                'quality' => $this->quality($start, $end),
                'sales' => $this->sales($user, $start, $end),
                default => $this->stage($section, $start, $end),
            };
        }

        $report['register'] = $this->register($user, $start, $end, $sections);
        $report['summary'] = $this->summary($report);

        return $report;
    }

    private function register(User $user, CarbonInterface $start, CarbonInterface $end, array $sections): array
    {
        $days = (new FactoryRegister(OperationalScope::for($user)->warehouseIds(), (int) $user->current_factory_id))->days($start, $end, $sections);

        return [
            'sections' => array_values(array_filter(['wh', 'cut', 'prod', 'fin', 'stock', 'quality', 'sales'], fn (string $block) => in_array($block, array_map(fn (string $section) => FactoryRegister::SECTION_FOR[$section] ?? '', $sections), true))),
            'days' => array_slice($days, -self::REGISTER_DAYS),
            'truncated' => count($days) > self::REGISTER_DAYS,
        ];
    }

    private function stage(string $stage, CarbonInterface $start, CarbonInterface $end): array
    {
        $entries = ProductionEntry::where('stage', $stage)->whereNull('voided_at')
            ->where('entry_date', '>=', $start->toDateString())->where('entry_date', '<=', $end->toDateString())
            ->with(['lot.product:id,name', 'lot.fabric:id,name', 'fabric:id,name,color'])->get();

        $received = ProductionTransfer::where('to_stage', $stage)->where('status', 'received')
            ->where('received_at', '>=', $start)->where('received_at', '<=', $end)->get();
        $sent = ProductionTransfer::where('from_stage', $stage)->whereIn('status', ['sent', 'received'])
            ->where('sent_at', '>=', $start)->where('sent_at', '<=', $end)->get();

        $open = ProductionLot::where('status', 'open')->pluck('id');
        $now = collect($this->balances->forLots($open))->pluck("stages.{$stage}");

        $daily = $entries->groupBy(fn (ProductionEntry $entry) => $entry->entry_date->toDateString())
            ->map(fn (Collection $rows, string $day) => ['day' => $day, 'good' => (int) $rows->sum('good_quantity'), 'damaged' => (int) $rows->sum('damaged_quantity')])
            ->sortKeys()->values()->all();

        $lots = $entries->groupBy('lot_id')->map(function (Collection $rows) {
            $lot = $rows->first()->lot;

            return [
                'lot_number' => $lot?->lot_number,
                'product' => $lot?->product?->name,
                'color' => $lot?->color,
                'size' => $lot?->size,
                'fabric' => $lot?->fabric?->name,
                'good' => (int) $rows->sum('good_quantity'),
                'damaged' => (int) $rows->sum('damaged_quantity'),
            ];
        })->sortByDesc('good')->values()->take(60)->all();

        $block = [
            'key' => $stage,
            'label' => ProductionFlowCatalog::STAGES[$stage]['label'],
            'good' => (int) $entries->sum('good_quantity'),
            'damaged' => (int) $entries->sum('damaged_quantity'),
            'received' => (int) $received->sum('quantity_received'),
            'sent' => (int) $sent->sum('quantity_sent'),
            'missing' => (int) $received->sum(fn (ProductionTransfer $transfer) => $transfer->quantity_sent - (int) $transfer->quantity_received),
            'waiting_now' => (int) $now->sum('wip'),
            'ready_now' => (int) $now->sum('outbox'),
            'waiting_quality_now' => (int) $now->sum('awaiting_quality'),
            'daily' => $daily,
            'lots' => $lots,
        ];

        if ($stage === 'cutting') {
            $block['fabric'] = $entries->whereNotNull('fabric_item_id')->groupBy('fabric_item_id')->map(fn (Collection $rows) => [
                'name' => $rows->first()->fabric?->name,
                'color' => $rows->first()->fabric?->color,
                'used' => round((float) $rows->sum('fabric_used'), 3),
                'waste' => round((float) $rows->sum('fabric_waste'), 3),
            ])->values()->all();
            $block['lots_cut'] = $entries->where('good_quantity', '>', 0)->pluck('lot_id')->unique()->count();
        }

        $requests = MaterialRequest::where('stage', $stage)->where('created_at', '>=', $start)->where('created_at', '<=', $end)->get();
        $block['requests'] = [
            'total' => $requests->count(),
            'pending' => $requests->where('status', 'pending')->count(),
            'approved' => $requests->where('status', 'approved')->count(),
            'rejected' => $requests->where('status', 'rejected')->count(),
        ];

        return $block;
    }

    private function warehouse(User $user, CarbonInterface $start, CarbonInterface $end): array
    {
        $warehouseIds = OperationalScope::for($user)->warehouseIds();
        $moves = StockTransaction::whereIn('warehouse_id', $warehouseIds)
            ->whereIn('type', [...StockAnalytics::IN_TYPES, ...StockAnalytics::OUT_TYPES])
            ->where('occurred_at', '>=', $start)->where('occurred_at', '<=', $end)
            ->with('item:id,name,color')->get();

        $value = fn (Collection $rows) => round($rows->sum(fn ($row) => abs((float) $row->quantity_delta) * (float) $row->unit_cost), 2);
        $in = $moves->filter(fn ($row) => in_array($row->type, StockAnalytics::IN_TYPES, true));
        $out = $moves->filter(fn ($row) => in_array($row->type, StockAnalytics::OUT_TYPES, true));
        $requests = MaterialRequest::whereNull('from_stage')->where('created_at', '>=', $start)->where('created_at', '<=', $end)->get();

        $items = $moves->groupBy('item_id')->map(fn (Collection $rows) => [
            'name' => $rows->first()->item?->name,
            'color' => $rows->first()->item?->color,
            'received' => round($rows->filter(fn ($row) => in_array($row->type, StockAnalytics::IN_TYPES, true))->sum(fn ($row) => abs((float) $row->quantity_delta)), 3),
            'taken_out' => round($rows->filter(fn ($row) => in_array($row->type, StockAnalytics::OUT_TYPES, true))->sum(fn ($row) => abs((float) $row->quantity_delta)), 3),
        ])->sortByDesc(fn (array $row) => $row['received'] + $row['taken_out'])->values()->take(15)->all();

        $rows = app(StockAnalytics::class)->itemRows($warehouseIds);

        return [
            'stock_in' => ['entries' => $in->count(), 'value' => $value($in)],
            'stock_out' => ['entries' => $out->count(), 'value' => $value($out)],
            'wasted_value' => $value($out->where('type', 'waste')),
            'requests' => [
                'total' => $requests->count(),
                'pending' => $requests->where('status', 'pending')->count(),
                'approved' => $requests->where('status', 'approved')->count(),
                'rejected' => $requests->where('status', 'rejected')->count(),
            ],
            'low_stock' => $rows->where('status', 'low')->count(),
            'out_of_stock' => $rows->where('status', 'out')->count(),
            'stock_value' => round($rows->sum('value'), 2),
            'items' => $items,
        ];
    }

    private function quality(CarbonInterface $start, CarbonInterface $end): array
    {
        $checks = QualityInspection::whereNotNull('lot_id')->where('created_at', '>=', $start)->where('created_at', '<=', $end)
            ->with(['lot:id,lot_number', 'inspector:id,name'])->latest('id')->get();

        $inspected = (int) $checks->sum('inspected_quantity');
        $passed = (int) $checks->sum('passed_quantity');

        $byStage = collect(ProductionFlowCatalog::keys())->map(function (string $stage) use ($checks) {
            $rows = $checks->where('stage', $stage);
            $inspected = (int) $rows->sum('inspected_quantity');

            return [
                'key' => $stage,
                'label' => ProductionFlowCatalog::STAGES[$stage]['label'],
                'checks' => $rows->count(),
                'inspected' => $inspected,
                'passed' => (int) $rows->sum('passed_quantity'),
                'rejected' => (int) $rows->sum('rejected_quantity'),
                'pass_rate' => $inspected > 0 ? round($rows->sum('passed_quantity') / $inspected * 100, 1) : null,
            ];
        })->values()->all();

        return [
            'checks' => $checks->count(),
            'inspected' => $inspected,
            'passed' => $passed,
            'rejected' => (int) $checks->sum('rejected_quantity'),
            'pass_rate' => $inspected > 0 ? round($passed / $inspected * 100, 1) : null,
            'by_stage' => $byStage,
            'on_hold' => ProductionLot::whereNotNull('held_at')->with('product:id,name')->get()->map(fn (ProductionLot $lot) => [
                'lot_number' => $lot->lot_number,
                'product' => $lot->product?->name,
                'reason' => $lot->hold_reason,
                'since' => $lot->held_at?->toIso8601String(),
            ])->values()->all(),
            'recent' => $checks->take(25)->map(fn (QualityInspection $check) => [
                'number' => $check->inspection_number,
                'lot_number' => $check->lot?->lot_number,
                'stage' => $check->stage,
                'inspected' => (int) $check->inspected_quantity,
                'passed' => (int) $check->passed_quantity,
                'rejected' => (int) $check->rejected_quantity,
                'result' => $check->result,
                'defects' => $check->defect_details,
                'by' => $check->inspector?->name,
                'at' => $check->created_at->toIso8601String(),
            ])->values()->all(),
        ];
    }

    private function sales(User $user, CarbonInterface $start, CarbonInterface $end): array
    {
        $report = (new SalesReport($user->current_factory_id, $start, $end))->build();

        return [
            'revenue' => $report['summary']['revenue']['value'] ?? 0,
            'sales' => $report['summary']['sales']['value'] ?? 0,
            'items_sold' => $report['summary']['items_sold']['value'] ?? 0,
            'collected' => $report['summary']['collected'] ?? 0,
            'outstanding' => $report['summary']['outstanding'] ?? 0,
            'top_products' => array_slice($report['top_products'] ?? [], 0, 8),
        ];
    }

    private function summary(array $report): array
    {
        $stages = collect(ProductionFlowCatalog::keys())->filter(fn (string $key) => isset($report[$key]));

        return array_filter([
            'pieces_cut' => $report['cutting']['good'] ?? null,
            'pieces_packed' => $report['packing']['good'] ?? null,
            'damaged' => $stages->isNotEmpty() ? $stages->sum(fn (string $key) => $report[$key]['damaged']) : null,
            'stock_in_value' => $report['warehouse']['stock_in']['value'] ?? null,
            'stock_out_value' => $report['warehouse']['stock_out']['value'] ?? null,
            'quality_checks' => $report['quality']['checks'] ?? null,
            'quality_pass_rate' => $report['quality']['pass_rate'] ?? null,
            'revenue' => $report['sales']['revenue'] ?? null,
        ], fn ($value) => $value !== null);
    }
}
