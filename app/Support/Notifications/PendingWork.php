<?php

namespace App\Support\Notifications;

use App\Models\Factory;
use App\Models\MaterialRequest;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Models\StockHandover;
use App\Models\User;
use App\Services\ProductionFlow\FlowAccess;
use App\Services\ProductionFlow\FlowBalances;
use App\Support\Catalogs\ProductionFlowCatalog;

/**
 * Work that is waiting for this person right now. These are not stored: they are worked out on every
 * refresh, so they appear when something needs doing and vanish the moment it is dealt with.
 */
final class PendingWork
{
    /** @return array<int, array{id: string, title: string, body: string, url: string, category: string, count: int}> */
    public static function for(User $user): array
    {
        $factory = $user->current_factory_id ? Factory::find($user->current_factory_id) : null;

        if (! $factory?->hasFeature('garment_flow')) {
            return [];
        }

        $access = FlowAccess::for($user);
        $items = [];
        $label = fn (string $stage) => ProductionFlowCatalog::STAGES[$stage]['label']['en'];

        foreach ($access->workStages() as $stage) {
            $deliveries = ProductionTransfer::where('status', 'sent')->where('to_stage', $stage)->count();
            if ($deliveries > 0) {
                $items[] = self::item("flow-deliveries-{$stage}", 'Deliveries to receive', "{$deliveries} " . ($deliveries === 1 ? 'delivery is' : 'deliveries are') . " waiting for {$label($stage)} to receive.", "/flow/{$stage}-workspace", 'production', $deliveries);
            }

            $asked = MaterialRequest::where('status', 'pending')->where('from_stage', $stage)->count();
            if ($asked > 0) {
                $items[] = self::item("flow-asked-{$stage}", 'Pieces requested from you', "{$asked} " . ($asked === 1 ? 'request is' : 'requests are') . ' asking for pieces. Send them or decline.', "/flow/{$stage}-materials", 'production', $asked);
            }
        }

        if ($access->canApproveRequests()) {
            $waiting = MaterialRequest::where('status', 'pending')->whereNull('from_stage')->count();
            if ($waiting > 0) {
                $items[] = self::item('flow-warehouse-requests', 'Material requests to answer', "{$waiting} material " . ($waiting === 1 ? 'request is' : 'requests are') . ' waiting for the warehouse.', '/flow/incoming-requests', 'inventory', $waiting);
            }
        }

        if ($access->canApproveRequests()) {
            $goods = StockHandover::where('status', 'sent')->count();
            if ($goods > 0) {
                $items[] = self::item('flow-finished-goods', 'Finished goods to receive', "{$goods} " . ($goods === 1 ? 'handover is' : 'handovers are') . ' waiting to be received into stock.', '/flow/stock-in', 'inventory', $goods);
            }
        }

        if ($access->isManager() || $access->canInspect()) {
            $open = ProductionLot::where('status', 'open')->get(['id', 'held_at']);
            $held = $open->whereNotNull('held_at')->count();

            if ($access->isManager() && $held > 0) {
                $items[] = self::item('flow-held-lots', 'Lots on quality hold', "{$held} " . ($held === 1 ? 'lot is' : 'lots are') . ' on hold and cannot move until released.', '/flow/production-flow', 'quality', $held);
            }

            $balances = app(FlowBalances::class)->forLots($open->pluck('id'));
            $final = (int) collect($balances)->sum(fn (array $lot) => $lot['stages']['packing']['awaiting_quality'] ?? 0);
            if ($final > 0) {
                $items[] = self::item('flow-final-check', 'Pieces waiting for the final check', "{$final} packed pieces are waiting for quality control.", '/flow/production-flow', 'quality', $final);
            }
        }

        return $items;
    }

    private static function item(string $id, string $title, string $body, string $url, string $category, int $count): array
    {
        return ['id' => "dyn-{$id}", 'title' => $title, 'body' => $body, 'url' => $url, 'category' => $category, 'count' => $count];
    }
}
