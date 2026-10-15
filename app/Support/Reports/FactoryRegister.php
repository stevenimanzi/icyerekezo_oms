<?php

namespace App\Support\Reports;

use App\Models\ProductionEntry;
use App\Models\ProductionTransfer;
use App\Models\StockTransaction;
use App\Services\StockAnalytics;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * The daily register of a garment factory in the layout management already knows from the paper and Excel register:
 * one band per day, with the warehouse, cutting, sewing, finishing and packing side by side, broken down by colour, style and size.
 * The rows use the same group layout as NoguchiDailyRegister so the Excel export can draw them.
 */
final class FactoryRegister
{
    private const FABRIC_UNITS = ['m', 'meter', 'meters', 'metre', 'metres', 'yd', 'yard', 'yards'];

    /** Which register block each allowed department unlocks. */
    public const SECTION_FOR = ['warehouse' => 'wh', 'cutting' => 'cut', 'sewing' => 'prod', 'finishing' => 'fin', 'packing' => 'stock'];

    public function __construct(private readonly Collection $warehouseIds) {}

    /** @return array<int, array{date: string, groups: array<int, array<int, array<int, mixed>>>}> */
    public function days(CarbonInterface $from, CarbonInterface $to, array $allowed): array
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();
        $days = [];

        $add = function (string $date, int $group, array $row) use (&$days) {
            $days[$date] ??= array_fill(0, 10, []);
            $days[$date][$group][] = $row;
        };

        if (in_array('warehouse', $allowed, true)) {
            $this->warehouse($start, $end, $add);
        }

        $entries = ProductionEntry::whereNull('voided_at')
            ->where('entry_date', '>=', $start->toDateString())->where('entry_date', '<=', $end->toDateString())
            ->with(['lot.product:id,name', 'fabric:id,name,color'])->get();

        foreach ($entries as $entry) {
            $date = $entry->entry_date->toDateString();
            $lot = $entry->lot;
            $colour = (string) ($lot?->color ?: $entry->fabric?->color);
            $style = (string) $lot?->product?->name;
            $size = (string) $lot?->size;
            $good = (float) $entry->good_quantity;

            match ($entry->stage) {
                'cutting' => in_array('cutting', $allowed, true) ? $add($date, 4, [$colour, (float) $entry->fabric_used, $style, $size, $good]) : null,
                'sewing' => in_array('sewing', $allowed, true) && $good > 0 ? $add($date, 6, [$colour, $style, $size, $good]) : null,
                'finishing' => in_array('finishing', $allowed, true) && $good > 0 ? $add($date, 8, [$colour, $style, $size, $good]) : null,
                'packing' => in_array('packing', $allowed, true) && $good > 0 ? $add($date, 9, [$colour, $style, $size, $good]) : null,
                default => null,
            };
        }

        $received = ProductionTransfer::where('status', 'received')->whereIn('to_stage', ['sewing', 'finishing'])
            ->where('received_at', '>=', $start)->where('received_at', '<=', $end)
            ->with('lot.product:id,name')->get();

        foreach ($received as $transfer) {
            $stage = $transfer->to_stage === 'sewing' ? 'sewing' : 'finishing';
            if (! in_array($stage, $allowed, true)) {
                continue;
            }
            $lot = $transfer->lot;
            $add($transfer->received_at->toDateString(), $stage === 'sewing' ? 5 : 7, [(string) $lot?->color, (string) $lot?->product?->name, (string) $lot?->size, (float) $transfer->quantity_received]);
        }

        ksort($days);

        return collect($days)->map(fn (array $groups, string $date) => [
            'date' => $date,
            'groups' => [
                $groups[0], $groups[1], $groups[2], $groups[3],
                $this->arrange($groups[4], 0, 2, 3),
                $this->arrange($groups[5], 0, 1, 2), $this->arrange($groups[6], 0, 1, 2),
                $this->arrange($groups[7], 0, 1, 2), $this->arrange($groups[8], 0, 1, 2),
                $this->arrange($groups[9], 0, 1, 2),
            ],
        ])->values()->all();
    }

    private function warehouse(CarbonInterface $start, CarbonInterface $end, callable $add): void
    {
        $moves = StockTransaction::whereIn('warehouse_id', $this->warehouseIds)
            ->whereIn('type', [...StockAnalytics::IN_TYPES, ...StockAnalytics::OUT_TYPES])
            ->where('type', '!=', 'production_output')
            ->where('occurred_at', '>=', $start)->where('occurred_at', '<=', $end)
            ->with(['item:id,name,color,type,unit_id', 'item.unit:id,symbol'])->get();

        foreach ($moves as $move) {
            $item = $move->item;
            if (! $item || $item->type === 'finished_good') {
                continue;
            }
            $incoming = in_array($move->type, StockAnalytics::IN_TYPES, true);
            $fabric = $item->type === 'raw_material' && in_array(strtolower((string) $item->unit?->symbol), self::FABRIC_UNITS, true);
            $group = ($incoming ? 0 : 2) + ($fabric ? 0 : 1);
            $label = $fabric ? ($item->color ?: $item->name) : trim($item->name . ($item->color ? ' ' . $item->color : ''));

            $add($move->occurred_at->toDateString(), $group, [$label, abs((float) $move->quantity_delta)]);
        }
    }

    /** Sorts by colour, style and then size from the smallest to the largest. */
    private function arrange(array $rows, int $colour, int $style, int $size): array
    {
        return NoguchiDailyRegister::arrange($rows, $colour, $style, $size);
    }
}
