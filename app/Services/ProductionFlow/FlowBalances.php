<?php

namespace App\Services\ProductionFlow;

use App\Models\ProductionEntry;
use App\Models\ProductionTransfer;
use App\Models\QualityInspection;
use App\Models\StockHandover;
use App\Support\Catalogs\ProductionFlowCatalog;
use Illuminate\Support\Collection;

final class FlowBalances
{
    public function forLots(iterable $lotIds): array
    {
        $lotIds = Collection::make($lotIds)->unique()->values();

        if ($lotIds->isEmpty()) {
            return [];
        }

        $entries = ProductionEntry::whereIn('lot_id', $lotIds)
            ->whereNull('voided_at')
            ->selectRaw('lot_id, stage, SUM(good_quantity) as good, SUM(damaged_quantity) as damaged')
            ->groupBy('lot_id', 'stage')
            ->get()
            ->groupBy('lot_id');

        $sent = ProductionTransfer::whereIn('lot_id', $lotIds)
            ->whereIn('status', ['sent', 'received'])
            ->selectRaw('lot_id, from_stage as stage, SUM(quantity_sent) as sent')
            ->groupBy('lot_id', 'from_stage')
            ->get()
            ->groupBy('lot_id');

        $arrived = ProductionTransfer::whereIn('lot_id', $lotIds)
            ->whereIn('status', ['sent', 'received'])
            ->selectRaw(
                "lot_id, to_stage as stage,
                SUM(CASE WHEN status = 'received' THEN quantity_received ELSE 0 END) as received,
                SUM(CASE WHEN status = 'sent' THEN quantity_sent ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'received' THEN quantity_sent - quantity_received ELSE 0 END) as shortage",
            )
            ->groupBy('lot_id', 'to_stage')
            ->get()
            ->groupBy('lot_id');

        $inspections = QualityInspection::whereIn('lot_id', $lotIds)
            ->selectRaw('lot_id, stage, SUM(passed_quantity) as passed, SUM(rejected_quantity) as rejected, COUNT(*) as total')
            ->groupBy('lot_id', 'stage')
            ->get()
            ->groupBy('lot_id');

        $last = ProductionFlowCatalog::keys()[count(ProductionFlowCatalog::keys()) - 1];
        $unreleased = QualityInspection::whereIn('lot_id', $lotIds)->where('stage', $last)->where('stock_released', false)
            ->selectRaw('lot_id, SUM(passed_quantity) as passed')->groupBy('lot_id')->pluck('passed', 'lot_id');
        $handovers = StockHandover::whereIn('lot_id', $lotIds)->whereIn('status', ['sent', 'received'])
            ->selectRaw("lot_id, SUM(CASE WHEN status = 'sent' THEN quantity ELSE 0 END) as pending, SUM(CASE WHEN status = 'received' THEN quantity ELSE 0 END) as received")
            ->groupBy('lot_id')->get()->keyBy('lot_id');

        $balances = [];

        foreach ($lotIds as $lotId) {
            $balances[$lotId] = $this->assemble(
                $entries->get($lotId, collect())->keyBy('stage'),
                $sent->get($lotId, collect())->keyBy('stage'),
                $arrived->get($lotId, collect())->keyBy('stage'),
                $inspections->get($lotId, collect())->keyBy('stage'),
            );
        }

        foreach ($balances as $lotId => $balance) {
            $pending = (int) ($handovers[$lotId]->pending ?? 0);
            $received = (int) ($handovers[$lotId]->received ?? 0);

            $balances[$lotId]['stages'][$last]['ready_for_stock'] = max(0, (int) ($unreleased[$lotId] ?? 0) - $pending - $received);
            $balances[$lotId]['stages'][$last]['stock_pending'] = $pending;
            $balances[$lotId]['stages'][$last]['in_stock'] = $received;
        }

        return $balances;
    }

    public function forLot(int $lotId): array
    {
        return $this->forLots([$lotId])[$lotId];
    }

    private function assemble(Collection $entries, Collection $sent, Collection $arrived, Collection $inspections): array
    {
        $stages = [];
        $inProgress = 0;
        $damaged = 0;
        $rejected = 0;
        $shortage = 0;

        foreach (ProductionFlowCatalog::keys() as $stage) {
            $good = (int) ($entries[$stage]->good ?? 0);
            $damagedHere = (int) ($entries[$stage]->damaged ?? 0);
            $received = (int) ($arrived[$stage]->received ?? 0);
            $pending = (int) ($arrived[$stage]->pending ?? 0);
            $shortageHere = (int) ($arrived[$stage]->shortage ?? 0);
            $passed = (int) ($inspections[$stage]->passed ?? 0);
            $rejectedHere = (int) ($inspections[$stage]->rejected ?? 0);
            $isFirst = ProductionFlowCatalog::previous($stage) === null;
            $isLast = ProductionFlowCatalog::next($stage) === null;

            $wip = $isFirst ? 0 : $received - $good - $damagedHere;
            $outbox = $isLast ? 0 : $good - (int) ($sent[$stage]->sent ?? 0) - $rejectedHere;
            $awaitingQuality = $isLast ? $good - $passed - $rejectedHere : 0;

            $stages[$stage] = [
                'good' => $good,
                'damaged' => $damagedHere,
                'received' => $received,
                'incoming' => $pending,
                'shortage' => $shortageHere,
                'wip' => $wip,
                'outbox' => $outbox,
                'awaiting_quality' => $awaitingQuality,
                'quality_passed' => $passed,
                'quality_rejected' => $rejectedHere,
                'inspections' => (int) ($inspections[$stage]->total ?? 0),
                'sent' => (int) ($sent[$stage]->sent ?? 0),
            ];

            $inProgress += $wip + $outbox + $pending + $awaitingQuality;
            $damaged += $damagedHere;
            $rejected += $rejectedHere;
            $shortage += $shortageHere;
        }

        $cut = $stages['cutting']['good'];
        $last = ProductionFlowCatalog::keys()[count(ProductionFlowCatalog::keys()) - 1];

        return [
            'stages' => $stages,
            'cut' => $cut,
            'in_progress' => $inProgress,
            'finished' => $stages[$last]['quality_passed'],
            'damaged' => $damaged,
            'rejected' => $rejected,
            'shortage' => $shortage,
            'complete' => $cut > 0 && $inProgress === 0,
        ];
    }
}
