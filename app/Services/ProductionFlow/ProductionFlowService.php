<?php

namespace App\Services\ProductionFlow;

use App\Models\AuditLog;
use App\Models\Item;
use App\Models\ProductionEntry;
use App\Models\ProductionLot;
use App\Models\ProductionTransfer;
use App\Models\QualityInspection;
use App\Models\StockHandover;
use App\Models\StockTransaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryLedger;
use App\Support\Catalogs\ProductionFlowCatalog;
use App\Support\Notifications\FactoryNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductionFlowService
{
    private const OPEN_HOURS_FOR_EDITS = 48;

    public function __construct(
        private readonly FlowBalances $balances,
        private readonly MaterialRequestService $materials,
        private readonly InventoryLedger $ledger,
    ) {}

    public function recordCut(User $user, array $data): ProductionLot
    {
        $this->requireStageAccess($user, 'cutting');

        return DB::transaction(function () use ($user, $data) {
            $fabric = Item::findOrFail($data['fabric_item_id']);

            if (empty($data['lot_id'])) {
                if ($fabric->color) {
                    $data['color'] = $fabric->color;
                } elseif (! empty($data['color'])) {
                    $fabric->update(['color' => trim($data['color'])]);
                }
            }

            $lot = ! empty($data['lot_id'])
                ? $this->lockLot((int) $data['lot_id'])
                : $this->createLot($user, $data);

            $this->requireActive($lot);

            $used = round((float) $data['fabric_used'], 3);
            $waste = round((float) ($data['fabric_waste'] ?? 0), 3);
            $available = $this->materials->fabricAvailable($fabric->id);

            if ($used + $waste > $available + 0.0005) {
                throw ValidationException::withMessages([
                    'fabric_used' => "Only {$this->number($available)} of {$fabric->name} is available at cutting. Ask the warehouse for more first.",
                ]);
            }

            if (! $lot->fabric_item_id) {
                $lot->update(['fabric_item_id' => $fabric->id]);
            }

            $entry = ProductionEntry::create([
                'lot_id' => $lot->id,
                'stage' => 'cutting',
                'entry_date' => $data['entry_date'] ?? today()->toDateString(),
                'good_quantity' => (int) $data['good_quantity'],
                'damaged_quantity' => (int) ($data['damaged_quantity'] ?? 0),
                'fabric_item_id' => $fabric->id,
                'fabric_used' => $used,
                'fabric_waste' => $waste,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $user->id,
            ]);

            AuditLog::record('production.cut_recorded', "Cut {$entry->good_quantity} pieces for {$lot->lot_number}", $lot);
            $this->refreshStatus($lot);

            return $lot->fresh(['product']);
        });
    }

    public function recordFabricLoss(User $user, array $data): ProductionEntry
    {
        $this->requireStageAccess($user, 'cutting');

        $fabric = Item::findOrFail($data['fabric_item_id']);
        $waste = round((float) $data['fabric_waste'], 3);
        $available = $this->materials->fabricAvailable($fabric->id);

        if ($waste > $available + 0.0005) {
            throw ValidationException::withMessages([
                'fabric_waste' => "Only {$this->number($available)} of {$fabric->name} is available at cutting.",
            ]);
        }

        $entry = ProductionEntry::create([
            'lot_id' => null,
            'stage' => 'cutting',
            'entry_date' => $data['entry_date'] ?? today()->toDateString(),
            'fabric_item_id' => $fabric->id,
            'fabric_waste' => $waste,
            'notes' => $data['notes'] ?? null,
            'recorded_by' => $user->id,
        ]);

        AuditLog::record('production.fabric_damaged', "Recorded {$waste} of {$fabric->name} damaged at cutting", $entry);

        return $entry;
    }

    public function recordWork(User $user, ProductionLot $lot, string $stage, array $data): ProductionEntry
    {
        abort_unless(ProductionFlowCatalog::previous($stage) !== null, 422, 'Use the cutting form to record cutting.');
        $this->requireStageAccess($user, $stage);

        return DB::transaction(function () use ($user, $lot, $stage, $data) {
            $lot = $this->lockLot($lot->id);
            $this->requireActive($lot);

            $good = (int) $data['good_quantity'];
            $damaged = (int) ($data['damaged_quantity'] ?? 0);
            $waiting = $this->balances->forLot($lot->id)['stages'][$stage]['wip'];

            if ($good + $damaged < 1) {
                throw ValidationException::withMessages(['good_quantity' => 'Enter how many pieces were finished or damaged.']);
            }

            if ($good + $damaged > $waiting) {
                throw ValidationException::withMessages([
                    'good_quantity' => "Only {$waiting} pieces are waiting at " . $this->label($stage) . ' for this lot. Receive the pieces from the stage before first.',
                ]);
            }

            $entry = ProductionEntry::create([
                'lot_id' => $lot->id,
                'stage' => $stage,
                'entry_date' => $data['entry_date'] ?? today()->toDateString(),
                'good_quantity' => $good,
                'damaged_quantity' => $damaged,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $user->id,
            ]);

            if ($this->isLastStage($stage) && $good > 0) {
                $this->putIntoFinishedStock($entry, $lot, $good);
            }

            AuditLog::record('production.work_recorded', "{$this->label($stage)}: {$good} good, {$damaged} damaged on {$lot->lot_number}", $lot);
            $this->refreshStatus($lot);

            return $entry;
        });
    }

    public function send(User $user, ProductionLot $lot, string $fromStage, int $quantity, ?string $note, ?string $toStage = null): ProductionTransfer
    {
        $destinations = ProductionFlowCatalog::destinations($fromStage);
        abort_if($destinations === [], 422, 'Packed pieces go to quality control, not to another stage.');
        $next = $toStage ?? $destinations[0];
        abort_unless(in_array($next, $destinations, true), 422, 'Pieces cannot be sent to that stage from here.');
        $this->requireStageAccess($user, $fromStage);

        return DB::transaction(function () use ($user, $lot, $fromStage, $next, $quantity, $note) {
            $lot = $this->lockLot($lot->id);
            $this->requireActive($lot);
            $ready = $this->balances->forLot($lot->id)['stages'][$fromStage]['outbox'];

            if ($quantity < 1 || $quantity > $ready) {
                throw ValidationException::withMessages([
                    'quantity' => "Only {$ready} pieces are ready to send from " . $this->label($fromStage) . ' for this lot.',
                ]);
            }

            $transfer = ProductionTransfer::create([
                'lot_id' => $lot->id,
                'from_stage' => $fromStage,
                'to_stage' => $next,
                'quantity_sent' => $quantity,
                'status' => 'sent',
                'note' => $note,
                'sent_by' => $user->id,
                'sent_at' => now(),
            ]);

            AuditLog::record('production.sent', "Sent {$quantity} of {$lot->lot_number} to {$this->label($next)}", $lot);
            $this->materials->countDelivery($transfer, $user);

            return $transfer;
        });
    }

    public function receive(User $user, ProductionTransfer $transfer, int $quantity, ?string $note): ProductionTransfer
    {
        $this->requireStageAccess($user, $transfer->to_stage);

        return DB::transaction(function () use ($user, $transfer, $quantity, $note) {
            $transfer = ProductionTransfer::lockForUpdate()->findOrFail($transfer->id);
            abort_unless($transfer->status === 'sent', 422, 'This delivery was already received or cancelled.');

            $lot = $this->lockLot($transfer->lot_id);
            $this->requireActive($lot);

            if ($quantity < 1 || $quantity > $transfer->quantity_sent) {
                throw ValidationException::withMessages(['quantity' => "Enter a number from 1 to {$transfer->quantity_sent}."]);
            }

            if ($quantity < $transfer->quantity_sent && ! trim((string) $note)) {
                throw ValidationException::withMessages(['note' => 'Fewer pieces arrived than were sent. Please say what happened.']);
            }

            $transfer->update([
                'status' => 'received',
                'quantity_received' => $quantity,
                'receive_note' => $note,
                'received_by' => $user->id,
                'received_at' => now(),
            ]);

            AuditLog::record('production.received', "Received {$quantity} of {$lot->lot_number} at {$this->label($transfer->to_stage)}", $lot);

            if ($quantity < $transfer->quantity_sent) {
                FactoryNotifier::notifyRoles(
                    $user->current_factory_id,
                    array_merge(ProductionFlowCatalog::MANAGER_ROLES, ['quality-officer', 'quality-manager']),
                    'Pieces missing between stages',
                    "{$lot->lot_number}: " . ($transfer->quantity_sent - $quantity) . " fewer arrived at {$this->label($transfer->to_stage)} than were sent.",
                    '/quality/production-flow',
                    'production',
                    $user->id,
                );
            }

            return $transfer;
        });
    }

    public function cancelTransfer(User $user, ProductionTransfer $transfer): ProductionTransfer
    {
        abort_unless($transfer->status === 'sent', 422, 'Only a delivery that has not been received yet can be taken back.');
        $this->requireStageAccess($user, $transfer->from_stage);

        $transfer->update(['status' => 'cancelled']);
        AuditLog::record('production.send_cancelled', "Took back {$transfer->quantity_sent} from {$this->label($transfer->to_stage)}", $transfer);

        return $transfer;
    }

    public function voidEntry(User $user, ProductionEntry $entry, string $reason): ProductionEntry
    {
        abort_if($entry->voided_at, 422, 'This record was already cancelled.');
        $access = FlowAccess::for($user);
        $this->requireStageAccess($user, $entry->stage);

        $own = (int) $entry->recorded_by === (int) $user->id;
        abort_unless($access->isManager() || ($own && $entry->created_at->diffInHours(now()) <= self::OPEN_HOURS_FOR_EDITS), 403, 'Only the person who made this record can cancel it, within two days. Ask a production manager.');

        return DB::transaction(function () use ($user, $entry, $reason) {
            $lot = $entry->lot_id ? $this->lockLot($entry->lot_id) : null;
            $entry->update(['voided_at' => now(), 'void_reason' => $reason, 'voided_by' => $user->id]);

            if ($lot) {
                $this->assertBalancesStillHold($lot);

                if ($this->isLastStage($entry->stage) && $entry->good_quantity > 0) {
                    $this->takeOutOfFinishedStock($entry);
                }

                if ($entry->stage === 'cutting' && ! $lot->entries()->whereNull('voided_at')->exists()) {
                    $lot->update(['status' => 'cancelled']);
                } else {
                    $this->refreshStatus($lot);
                }
            }

            AuditLog::record('production.record_cancelled', "Cancelled a {$this->label($entry->stage)} record: {$reason}", $entry);

            return $entry;
        });
    }

    public function hold(User $user, ProductionLot $lot, string $reason): ProductionLot
    {
        $this->requireQuality($user);
        abort_if($lot->held_at, 422, 'This lot is already on hold.');

        $lot->update(['held_at' => now(), 'held_by' => $user->id, 'hold_reason' => $reason]);
        AuditLog::record('production.lot_held', "Put {$lot->lot_number} on hold: {$reason}", $lot);

        FactoryNotifier::notifyRoles(
            $user->current_factory_id,
            array_merge(ProductionFlowCatalog::MANAGER_ROLES, ['quality-officer', 'quality-manager']),
            'A lot was put on quality hold',
            "{$lot->lot_number} is on hold: {$reason}",
            '/quality/production-flow',
            'production',
            $user->id,
        );

        return $lot->fresh();
    }

    public function release(User $user, ProductionLot $lot): ProductionLot
    {
        $this->requireQuality($user);
        abort_unless($lot->held_at, 422, 'This lot is not on hold.');

        $lot->update(['held_at' => null, 'held_by' => null, 'hold_reason' => null]);
        AuditLog::record('production.lot_released', "Released {$lot->lot_number} from hold", $lot);

        return $lot->fresh();
    }

    public function inspect(User $user, ProductionLot $lot, string $stage, array $data): QualityInspection
    {
        $this->requireQuality($user);
        abort_unless(ProductionFlowCatalog::exists($stage), 422, 'Choose a stage.');

        return DB::transaction(function () use ($user, $lot, $stage, $data) {
            $lot = $this->lockLot($lot->id);
            abort_if($lot->status === 'cancelled', 422, 'This lot was cancelled.');

            $passed = (int) $data['passed_quantity'];
            $rejected = (int) $data['rejected_quantity'];
            $inspected = (int) $data['inspected_quantity'];
            $isFinalGate = $this->isLastStage($stage);
            $balance = $this->balances->forLot($lot->id)['stages'][$stage];

            if ($passed + $rejected > $inspected) {
                throw ValidationException::withMessages(['inspected_quantity' => 'Passed and rejected pieces cannot be more than the pieces checked.']);
            }

            if ($isFinalGate) {
                $decided = $passed + $rejected;
                if ($decided < 1 || $decided > $balance['awaiting_quality']) {
                    throw ValidationException::withMessages([
                        'passed_quantity' => "Only {$balance['awaiting_quality']} packed pieces are waiting for the final quality check.",
                    ]);
                }
            } elseif ($rejected > $balance['outbox']) {
                throw ValidationException::withMessages([
                    'rejected_quantity' => "Only {$balance['outbox']} pieces are ready to send from " . $this->label($stage) . '. Reject pieces that are finished at the stage, not ones still being worked on.',
                ]);
            }

            $result = $rejected === 0 ? 'passed' : ($passed === 0 && $inspected === $rejected ? 'failed' : 'conditional');

            $inspection = QualityInspection::create([
                'inspection_number' => 'QI-' . now()->format('ymd') . '-' . Str::upper(Str::random(6)),
                'lot_id' => $lot->id,
                'stage' => $stage,
                'item_id' => $lot->product_item_id,
                'inspection_type' => $isFinalGate ? 'finished_goods' : 'in_process',
                'inspected_quantity' => $inspected,
                'passed_quantity' => $passed,
                'rejected_quantity' => $rejected,
                'stock_released' => ! ($isFinalGate && $passed > 0),
                'result' => $result,
                'defect_details' => $data['defect_details'] ?? null,
                'notes' => $data['notes'] ?? null,
                'inspector_id' => $user->id,
                'inspected_at' => now(),
            ]);

            if ($isFinalGate) {
                $this->settleFinishedStock($lot, $passed, $rejected, $inspection);
            }

            if ($rejected > 0 && ! empty($data['hold']) && ! $lot->held_at) {
                $lot->update(['held_at' => now(), 'held_by' => $user->id, 'hold_reason' => "Quality check {$inspection->inspection_number} found {$rejected} bad pieces"]);
            }

            AuditLog::record('production.quality_checked', "{$inspection->inspection_number}: {$passed} passed, {$rejected} rejected at {$this->label($stage)} for {$lot->lot_number}", $inspection);

            if ($rejected > 0) {
                FactoryNotifier::notify(
                    $user->current_factory_id,
                    'quality.approve',
                    'Pieces rejected by quality control',
                    "{$lot->lot_number}: {$rejected} pieces rejected at {$this->label($stage)}.",
                    '/quality/production-flow',
                    'quality',
                    $user->id,
                );
            }

            $this->refreshStatus($lot);

            return $inspection;
        });
    }

    private function createLot(User $user, array $data): ProductionLot
    {
        $product = ! empty($data['product_item_id'])
            ? Item::where('type', 'finished_good')->findOrFail($data['product_item_id'])
            : Item::resolveFinishedGood($user->current_factory_id, trim($data['product_name']));

        return ProductionLot::create([
            'lot_number' => $this->nextLotNumber(),
            'product_item_id' => $product->id,
            'style' => $data['style'] ?? null,
            'color' => $data['color'] ?? null,
            'size' => $data['size'] ?? null,
            'status' => 'open',
            'cut_on' => $data['entry_date'] ?? today()->toDateString(),
            'notes' => $data['lot_notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    private function putIntoFinishedStock(ProductionEntry $entry, ProductionLot $lot, int $quantity): void
    {
        $item = $lot->product ?? throw ValidationException::withMessages(['good_quantity' => 'This lot has no product to put into stock.']);
        $warehouse = $this->finishedGoodsWarehouse();

        $common = ['item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'quantity' => $quantity, 'reference_type' => $entry->getMorphClass(), 'reference_id' => $entry->id];

        $this->ledger->post($common + ['type' => 'production_output', 'reason' => "Packed {$lot->lot_number}"]);
        $this->ledger->post($common + ['type' => 'quarantine', 'reason' => "Waiting for final quality check: {$lot->lot_number}"]);
    }

    private function takeOutOfFinishedStock(ProductionEntry $entry): void
    {
        $original = StockTransaction::where('reference_type', $entry->getMorphClass())
            ->where('reference_id', $entry->id)
            ->where('type', 'production_output')
            ->first();

        if (! $original) {
            return;
        }

        $common = [
            'item_id' => $original->item_id,
            'warehouse_id' => $original->warehouse_id,
            'quantity' => $entry->good_quantity,
            'reference_type' => $entry->getMorphClass(),
            'reference_id' => $entry->id,
        ];

        $this->ledger->post($common + ['type' => 'release_quarantine', 'reason' => 'Packing record cancelled']);
        $this->ledger->post($common + ['type' => 'adjustment_out', 'reason' => 'Packing record cancelled']);
    }

    private function settleFinishedStock(ProductionLot $lot, int $passed, int $rejected, QualityInspection $inspection): void
    {
        $entryIds = $lot->entries()->where('stage', ProductionFlowCatalog::keys()[count(ProductionFlowCatalog::keys()) - 1])->pluck('id');
        $origin = StockTransaction::where('reference_type', (new ProductionEntry)->getMorphClass())
            ->whereIn('reference_id', $entryIds)
            ->where('type', 'production_output')
            ->first();

        $warehouseId = $origin?->warehouse_id ?? $this->finishedGoodsWarehouse()->id;
        $common = ['item_id' => $lot->product_item_id, 'warehouse_id' => $warehouseId, 'reference_type' => $inspection->getMorphClass(), 'reference_id' => $inspection->id];

        if ($rejected > 0) {
            $this->ledger->post($common + ['type' => 'release_quarantine', 'quantity' => $rejected, 'reason' => "Rejected at quality check {$inspection->inspection_number}"]);
            $this->ledger->post($common + ['type' => 'waste', 'quantity' => $rejected, 'reason' => "Rejected at quality check {$inspection->inspection_number}: {$lot->lot_number}"]);
        }
    }

    /** Packing hands pieces that passed the final check to the storekeeper. They stay out of sellable stock until received. */
    public function sendToStock(User $user, ProductionLot $lot, int $quantity, ?string $note): StockHandover
    {
        $this->requireStageAccess($user, ProductionFlowCatalog::keys()[count(ProductionFlowCatalog::keys()) - 1]);

        return DB::transaction(function () use ($user, $lot, $quantity, $note) {
            $lot = $this->lockLot($lot->id);
            $this->requireActive($lot);
            $last = ProductionFlowCatalog::keys()[count(ProductionFlowCatalog::keys()) - 1];
            $ready = $this->balances->forLot($lot->id)['stages'][$last]['ready_for_stock'];

            if ($quantity < 1 || $quantity > $ready) {
                throw ValidationException::withMessages(['quantity' => "Only {$ready} pieces have passed the quality check and are ready to go to stock."]);
            }

            $handover = StockHandover::create([
                'lot_id' => $lot->id,
                'quantity' => $quantity,
                'status' => 'sent',
                'note' => $note,
                'sent_by' => $user->id,
                'sent_at' => now(),
            ]);

            AuditLog::record('production.stock_sent', "Sent {$quantity} of {$lot->lot_number} to stock", $handover);

            FactoryNotifier::notifyRoles(
                $user->current_factory_id,
                ProductionFlowCatalog::WAREHOUSE_ROLES,
                'Finished goods to receive',
                "Packing sent {$quantity} {$lot->product?->name} ({$lot->lot_number}) to stock. Receive them to put them on the shelf.",
                '/warehouse/stock-in',
                'inventory',
                $user->id,
            );

            return $handover->load('lot');
        });
    }

    /** The storekeeper counts the pieces in. Only now do they become sellable stock. */
    public function receiveIntoStock(User $user, StockHandover $handover, int $quantity, ?string $note): StockHandover
    {
        abort_unless(FlowAccess::for($user)->canApproveRequests(), 403, 'Only the warehouse can receive finished goods.');

        return DB::transaction(function () use ($user, $handover, $quantity, $note) {
            $handover = StockHandover::lockForUpdate()->findOrFail($handover->id);
            abort_unless($handover->status === 'sent', 422, 'This handover was already received or cancelled.');

            if ($quantity < 1 || $quantity > $handover->quantity) {
                throw ValidationException::withMessages(['quantity' => "Enter a number from 1 to {$handover->quantity}."]);
            }

            if ($quantity < $handover->quantity && ! trim((string) $note)) {
                throw ValidationException::withMessages(['note' => 'Fewer pieces arrived than were sent. Please say what happened.']);
            }

            $lot = $this->lockLot($handover->lot_id);
            $origin = StockTransaction::where('item_id', $lot->product_item_id)->where('type', 'production_output')->latest('id')->first();
            $warehouseId = $origin?->warehouse_id ?? $this->finishedGoodsWarehouse()->id;

            $this->ledger->post([
                'item_id' => $lot->product_item_id,
                'warehouse_id' => $warehouseId,
                'quantity' => $quantity,
                'type' => 'release_quarantine',
                'reference_type' => $handover->getMorphClass(),
                'reference_id' => $handover->id,
                'reason' => "Received from packing: {$lot->lot_number}",
            ]);

            $handover->update([
                'status' => 'received',
                'quantity_received' => $quantity,
                'receive_note' => $note,
                'warehouse_id' => $warehouseId,
                'received_by' => $user->id,
                'received_at' => now(),
            ]);

            AuditLog::record('production.stock_received', "Received {$quantity} of {$lot->lot_number} into stock", $handover);
            FactoryNotifier::notifyUser((int) $handover->sent_by, 'Finished goods received', "{$quantity} of {$lot->lot_number} are now in stock.", '/packing/packing-workspace', 'inventory');

            return $handover->load('lot');
        });
    }

    public function cancelStockHandover(User $user, StockHandover $handover): StockHandover
    {
        $this->requireStageAccess($user, ProductionFlowCatalog::keys()[count(ProductionFlowCatalog::keys()) - 1]);
        abort_unless($handover->status === 'sent', 422, 'Only a handover that was not received yet can be taken back.');

        $handover->update(['status' => 'cancelled']);
        AuditLog::record('production.stock_cancelled', "Took back handover of {$handover->quantity} pieces", $handover);

        return $handover;
    }

    private function finishedGoodsWarehouse(): Warehouse
    {
        return Warehouse::where('is_active', true)->where('type', 'finished_goods')->orderBy('id')->first()
            ?? Warehouse::where('is_active', true)->orderBy('id')->first()
            ?? throw ValidationException::withMessages(['warehouse' => 'There is no warehouse to keep finished goods in. Add one under Stock first.']);
    }

    private function assertBalancesStillHold(ProductionLot $lot): void
    {
        $balances = $this->balances->forLot($lot->id);

        foreach ($balances['stages'] as $stage => $balance) {
            if ($balance['wip'] < 0 || $balance['outbox'] < 0 || $balance['awaiting_quality'] < 0) {
                throw ValidationException::withMessages([
                    'record' => 'This record cannot be cancelled because the pieces were already used by a later step. Cancel the later records first.',
                ]);
            }
        }
    }

    private function refreshStatus(ProductionLot $lot): void
    {
        if ($lot->status === 'cancelled') {
            return;
        }

        $complete = $this->balances->forLot($lot->id)['complete'];
        $lot->update(['status' => $complete ? 'completed' : 'open']);
    }

    private function lockLot(int $id): ProductionLot
    {
        return ProductionLot::lockForUpdate()->findOrFail($id);
    }

    private function requireActive(ProductionLot $lot): void
    {
        abort_if($lot->status === 'cancelled', 422, 'This lot was cancelled.');
        abort_if($lot->held_at, 422, "This lot is on quality hold ({$lot->hold_reason}). Wait for quality control to release it.");
    }

    private function requireStageAccess(User $user, string $stage): void
    {
        abort_unless(
            ProductionFlowCatalog::exists($stage) && FlowAccess::for($user)->canWork($stage),
            403,
            'This step belongs to another team.',
        );
    }

    private function requireQuality(User $user): void
    {
        abort_unless(FlowAccess::for($user)->canInspect(), 403, 'Only quality control can do this.');
    }

    private function nextLotNumber(): string
    {
        $prefix = 'CUT-' . now()->format('ymd') . '-';
        $next = ProductionLot::where('lot_number', 'like', $prefix . '%')->count() + 1;

        do {
            $number = $prefix . str_pad((string) $next++, 3, '0', STR_PAD_LEFT);
        } while (ProductionLot::where('lot_number', $number)->exists());

        return $number;
    }

    private function isLastStage(string $stage): bool
    {
        return ProductionFlowCatalog::next($stage) === null;
    }

    private function label(string $stage): string
    {
        return strtolower(ProductionFlowCatalog::STAGES[$stage]['label']['en']);
    }

    private function number(float $value): string
    {
        return rtrim(rtrim(number_format($value, 3, '.', ''), '0'), '.') ?: '0';
    }
}
