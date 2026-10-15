<?php

namespace App\Services\ProductionFlow;

use App\Models\ProductionEntry;
use App\Models\ProductionTransfer;
use App\Models\QualityInspection;
use App\Support\Catalogs\ProductionFlowCatalog;
use Illuminate\Support\Collection;

/**
 * Works out, for every lot, how many pieces are where. All numbers come from the entries,
 * transfers and inspections, so there is no separate counter that can drift out of step.
 */
final class FlowBalances
{
    /**
     * @param  iterable<int>  $lotIds
     * @return array<int, array<string, mixed>> balances keyed by lot id
     */
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

        $balances = [];

        foreach ($lotIds as $lotId) {
            $balances[$lotId] = $this->assemble(
                $entries->get($lotId, collect())->keyBy('stage'),
                $sent->get($lotId, collect())->keyBy('stage'),
                $arrived->get($lotId, collect())->keyBy('stage'),
                $inspections->get($lotId, collect())->keyBy('stage'),
            );
        }

        return $balances;
    }

    /** @return array<string, mixed> */
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
