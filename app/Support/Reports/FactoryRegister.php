<?php

namespace App\Support\Reports;

use App\Models\ProductionEntry;
use App\Models\ProductionTransfer;
use App\Models\QualityInspection;
use App\Models\StockTransaction;
use App\Services\StockAnalytics;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The daily register of a garment factory in the layout management already knows from the paper and Excel register:
 * one band per day, with the warehouse, cutting, sewing, finishing and packing side by side, broken down by colour, style and size.
 * The rows use the same group layout as NoguchiDailyRegister so the Excel export can draw them.
 */
final class FactoryRegister
{
    private const FABRIC_UNITS = ['m', 'meter', 'meters', 'metre', 'metres', 'yd', 'yard', 'yards'];

    /** Which register block each allowed department unlocks. */
    public const SECTION_FOR = ['warehouse' => 'wh', 'cutting' => 'cut', 'sewing' => 'prod', 'finishing' => 'fin', 'packing' => 'stock', 'quality' => 'quality', 'sales' => 'sales'];

    public function __construct(private readonly Collection $warehouseIds, private readonly int $factoryId) {}

    /** @return array<int, array{date: string, groups: array<int, array<int, array<int, mixed>>>}> */
    public function days(CarbonInterface $from, CarbonInterface $to, array $allowed): array
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();
        $days = [];

        $blank = fn () => ['groups' => array_fill(0, 10, []), 'quality' => [], 'sales' => []];
        $add = function (string $date, int $group, array $row) use (&$days, $blank) {
            $days[$date] ??= $blank();
            $days[$date]['groups'][$group][] = $row;
        };
        $extra = function (string $date, string $kind, array $row) use (&$days, $blank) {
            $days[$date] ??= $blank();
            $days[$date][$kind][] = $row;
        };

        if (in_array('quality', $allowed, true)) {
            $this->quality($start, $end, $extra);
        }
        if (in_array('sales', $allowed, true)) {
            $this->sales($start, $end, $extra);
        }

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

        return collect($days)->map(function (array $day, string $date) {
            $groups = $day['groups'];

            return [
                'date' => $date,
                'groups' => [
                    $groups[0], $groups[1], $groups[2], $groups[3],
                    $this->arrange($groups[4], 0, 2, 3),
                    $this->arrange($groups[5], 0, 1, 2), $this->arrange($groups[6], 0, 1, 2),
                    $this->arrange($groups[7], 0, 1, 2), $this->arrange($groups[8], 0, 1, 2),
                    $this->arrange($groups[9], 0, 1, 2),
                ],
                'quality' => $this->arrange($day['quality'], 0, 1, 2),
                'sales' => collect($day['sales'])->sortByDesc(fn (array $row) => $row[1])->values()->all(),
            ];
        })->values()->all();
    }

    private function quality(CarbonInterface $start, CarbonInterface $end, callable $extra): void
    {
        $checks = QualityInspection::whereNotNull('lot_id')->where('created_at', '>=', $start)->where('created_at', '<=', $end)
            ->with('lot.product:id,name')->get();

        foreach ($checks as $check) {
            $lot = $check->lot;
            $extra($check->created_at->toDateString(), 'quality', [
                (string) $lot?->color, (string) $lot?->product?->name, (string) $lot?->size, (string) $check->stage,
                (float) $check->inspected_quantity, (float) $check->passed_quantity, (float) $check->rejected_quantity,
            ]);
        }
    }

    private function sales(CarbonInterface $start, CarbonInterface $end, callable $extra): void
    {
        $rows = DB::table('sales_documents as d')
            ->join('sales_document_lines as l', 'l.sales_document_id', '=', 'd.id')
            ->leftJoin('items as i', 'i.id', '=', 'l.item_id')
            ->where('d.factory_id', $this->factoryId)
            ->where('d.document_type', 'customer_order')
            ->where('d.source', 'manual')
            ->whereNotIn('d.status', ['cancelled', 'rejected'])
            ->where('d.document_date', '>=', $start->toDateString())
            ->where('d.document_date', '<=', $end->toDateString())
            ->selectRaw("d.document_date as day, COALESCE(i.name, l.garment_category, 'Other') as name, SUM(l.quantity_ordered) as quantity, COALESCE(SUM(l.line_total), 0) as revenue")
            ->groupBy('d.document_date', 'i.name', 'l.garment_category')
            ->get();

        foreach ($rows as $row) {
            $extra(substr((string) $row->day, 0, 10), 'sales', [(string) $row->name, (float) $row->quantity, (float) $row->revenue]);
        }
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
