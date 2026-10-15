<?php

namespace App\Services;

use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class StockAnalytics
{
    public const IN_TYPES = ['receipt', 'return_in', 'production_output', 'adjustment_in'];

    public const OUT_TYPES = ['issue', 'dispatch', 'waste', 'adjustment_out'];

    private const GROUPS = [
        'raw_material' => 'raw_materials',
        'finished_good' => 'finished_goods',
    ];

    public function report(Collection $warehouseIds, int $days): array
    {
        $items = $this->itemRows($warehouseIds);
        $groups = ['raw_materials' => [], 'finished_goods' => [], 'other' => []];

        foreach ($items as $row) {
            $groups[self::GROUPS[$row['type']] ?? 'other'][] = $row;
        }

        $value = fn (array $rows) => round(array_sum(array_column($rows, 'value')), 2);

        return [
            'days' => $days,
            'kpis' => [
                'items_in_stock' => $items->where('on_hand', '>', 0)->count(),
                'total_value' => $value($items->all()),
                'raw_value' => $value($groups['raw_materials']),
                'finished_value' => $value($groups['finished_goods']),
                'other_value' => $value($groups['other']),
                'low_stock' => $items->where('status', 'low')->count(),
                'out_of_stock' => $items->where('status', 'out')->count(),
                'held_for_quality' => round($items->sum('held'), 2),
            ],
            'movement' => $this->movement($warehouseIds, $days),
            'by_type' => $this->byType($groups, $value),
            'top_items' => $items->where('value', '>', 0)->sortByDesc('value')->take(6)->values()->all(),
            'attention' => $items->whereIn('status', ['low', 'out'])->where('reorder_level', '>', 0)->sortBy('on_hand')->take(8)->values()->all(),
            'raw_materials' => $groups['raw_materials'],
            'finished_goods' => $groups['finished_goods'],
            'other' => $groups['other'],
        ];
    }

    public function itemRows(Collection $warehouseIds): Collection
    {
        $totals = StockBalance::query()
            ->whereIn('warehouse_id', $warehouseIds)
            ->selectRaw('item_id, SUM(quantity_on_hand) as on_hand, SUM(quantity_reserved) as reserved, SUM(quantity_quarantined) as held')
            ->groupBy('item_id')
            ->get()
            ->keyBy('item_id');

        return Item::with('unit:id,symbol')
            ->where('is_active', true)
            ->where('type', '!=', 'service')
            ->orderBy('name')
            ->get()
            ->map(function (Item $item) use ($totals) {
                $row = $totals->get($item->id);
                $onHand = (float) ($row->on_hand ?? 0);
                $reserved = (float) ($row->reserved ?? 0);
                $held = (float) ($row->held ?? 0);
                $reorder = (float) $item->reorder_level;

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'type' => $item->type,
                    'unit' => $item->unit?->symbol,
                    'on_hand' => $onHand,
                    'available' => $onHand - $reserved - $held,
                    'reserved' => $reserved,
                    'held' => $held,
                    'reorder_level' => $reorder,
                    'value' => round($onHand * (float) $item->standard_cost, 2),
                    'status' => $onHand <= 0 ? 'out' : ($reorder > 0 && $onHand <= $reorder ? 'low' : 'ok'),
                ];
            });
    }

    private function movement(Collection $warehouseIds, int $days): array
    {
        $start = CarbonImmutable::today()->subDays($days - 1);

        $rows = StockTransaction::query()
            ->whereIn('warehouse_id', $warehouseIds)
            ->whereIn('type', [...self::IN_TYPES, ...self::OUT_TYPES])
            ->where('occurred_at', '>=', $start->startOfDay())
            ->get(['type', 'quantity_delta', 'unit_cost', 'occurred_at']);

        $daily = [];
        for ($i = 0; $i < $days; $i++) {
            $day = $start->addDays($i);
            $daily[$day->toDateString()] = ['day' => $day->toDateString(), 'received' => 0.0, 'issued' => 0.0];
        }

        $totals = ['received' => 0.0, 'issued' => 0.0, 'wasted' => 0.0];

        foreach ($rows as $row) {
            $amount = abs((float) $row->quantity_delta) * (float) $row->unit_cost;
            $key = $row->occurred_at->toDateString();
            $bucket = in_array($row->type, self::IN_TYPES, true) ? 'received' : 'issued';

            if (isset($daily[$key])) {
                $daily[$key][$bucket] += $amount;
            }
            $totals[$bucket] += $amount;

            if ($row->type === 'waste') {
                $totals['wasted'] += $amount;
            }
        }

        return [
            'daily' => array_map(fn (array $d) => ['day' => $d['day'], 'received' => round($d['received'], 2), 'issued' => round($d['issued'], 2)], array_values($daily)),
            'received_value' => round($totals['received'], 2),
            'issued_value' => round($totals['issued'], 2),
            'wasted_value' => round($totals['wasted'], 2),
        ];
    }

    private function byType(array $groups, callable $value): array
    {
        return collect($groups)
            ->map(fn (array $rows, string $key) => ['key' => $key, 'items' => count($rows), 'value' => $value($rows)])
            ->values()
            ->all();
    }
}
