<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\StorageLocation;
use App\Models\Warehouse;
use App\Support\OperationalScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InventoryLedger
{
    public function post(array $data): StockTransaction
    {
        return DB::transaction(function () use ($data) {
            $item = Item::findOrFail($data['item_id']);
            $warehouse = Warehouse::findOrFail($data['warehouse_id']);
            abort_unless(OperationalScope::for(auth()->user())->allowsWarehouse($warehouse), 403, 'This warehouse is outside your assigned branch.');
            $location = isset($data['location_id']) ? StorageLocation::findOrFail($data['location_id']) : null;
            abort_if($location && (int) $location->warehouse_id !== (int) $warehouse->id, 422, 'The storage location does not belong to the selected warehouse.');
            $batch = isset($data['batch_id']) ? Batch::findOrFail($data['batch_id']) : null;
            $isPackedTransition = $data['type'] === 'production_output' && ($data['production_stage'] ?? null) === 'packed';
            if ($item->batch_tracked && ! $batch) {
                throw ValidationException::withMessages(['batch_id' => 'Choose a batch for this item.']);
            }
            // A batch's item identity legitimately changes at the packed transition: it
            // stops being tracked as work-in-progress fabric and becomes the finished
            // product chosen at packing time (rebound to $item below), so the usual
            // "batch belongs to this item" guard doesn't apply to that one step.
            if ($batch && $batch->item_id !== $item->id && ! $isPackedTransition) {
                throw ValidationException::withMessages(['batch_id' => 'The selected batch does not belong to this item.']);
            }
            if ($batch?->expires_at?->isPast() && in_array($data['type'], ['issue', 'dispatch', 'reserve'], true)) {
                throw ValidationException::withMessages(['batch_id' => 'Expired stock cannot be sent out or reserved.']);
            }
            if ($batch && $batch->production_stage === 'packed' && in_array($data['type'], ['issue', 'dispatch'], true) && $batch->qc_status !== 'passed') {
                throw ValidationException::withMessages(['batch_id' => 'This batch has not passed quality control and cannot be issued or dispatched.']);
            }

            $dimensions = ['factory_id' => auth()->user()->current_factory_id, 'item_id' => $item->id, 'warehouse_id' => $warehouse->id, 'location_id' => $data['location_id'] ?? null, 'batch_id' => $batch?->id];
            $balance = StockBalance::where($dimensions)->lockForUpdate()->first() ?? StockBalance::create($dimensions);
            [$onHand, $reserved, $quarantined] = $this->deltas($data['type'], (float) $data['quantity']);
            $currentOnHand = (float) $balance->quantity_on_hand;
            $currentReserved = (float) $balance->quantity_reserved;
            $currentQuarantined = (float) $balance->quantity_quarantined;
            $currentAvailable = $currentOnHand - $currentReserved - $currentQuarantined;
            $newOnHand = $currentOnHand + $onHand;
            $newReserved = $currentReserved + $reserved;
            $newQuarantined = $currentQuarantined + $quarantined;
            $available = $newOnHand - $newReserved - $newQuarantined;
            if (! $warehouse->allows_negative_stock) {
                if ($newOnHand < 0) throw ValidationException::withMessages(['quantity' => 'Not enough stock. Only '.$this->number($currentOnHand).' is currently in this warehouse.']);
                if ($newReserved < 0) throw ValidationException::withMessages(['quantity' => 'Only '.$this->number($currentReserved).' is currently reserved.']);
                if ($newQuarantined < 0) throw ValidationException::withMessages(['quantity' => 'Only '.$this->number($currentQuarantined).' is currently held for inspection.']);
                if ($available < 0) throw ValidationException::withMessages(['quantity' => 'Not enough available stock. You can use up to '.$this->number(max(0, $currentAvailable)).'.']);
            }

            $balance->update(['quantity_on_hand' => $newOnHand, 'quantity_reserved' => $newReserved, 'quantity_quarantined' => $newQuarantined]);
            $transaction = StockTransaction::create([...$dimensions, 'uuid' => (string) Str::uuid(), 'type' => $data['type'], 'quantity_delta' => $onHand, 'reserved_delta' => $reserved, 'quarantined_delta' => $quarantined, 'unit_cost' => $data['unit_cost'] ?? $item->standard_cost, 'balance_after' => $newOnHand, 'reason' => $data['reason'] ?? null, 'performed_by' => auth()->id(), 'occurred_at' => $data['occurred_at'] ?? now()]);

            if ($batch && isset($data['production_stage']) && $data['type'] === 'production_output') {
                $updates = ['production_stage' => $data['production_stage']];
                if ($data['production_stage'] === 'packed') {
                    $updates['qc_status'] = 'pending';
                    $updates['item_id'] = $item->id;
                }
                $batch->update($updates);
            }

            return $transaction;
        }, 5);
    }

    public function correct(StockTransaction $original, float $newQuantity, ?string $newReason = null): StockTransaction
    {
        return DB::transaction(function () use ($original, $newQuantity, $newReason) {
            $reverseType = match ($original->type) {
                'receipt', 'production_output', 'return_in', 'adjustment_in' => 'adjustment_out',
                'issue', 'dispatch', 'adjustment_out', 'waste' => 'adjustment_in',
                'reserve' => 'release_reservation',
                'release_reservation' => 'reserve',
                'quarantine' => 'release_quarantine',
                'release_quarantine' => 'quarantine',
                default => throw ValidationException::withMessages(['type' => 'Cannot reverse this transaction type.']),
            };

            // Reverse original transaction
            $this->post([
                'item_id' => $original->item_id,
                'warehouse_id' => $original->warehouse_id,
                'location_id' => $original->location_id,
                'batch_id' => $original->batch_id,
                'type' => $reverseType,
                'quantity' => abs((float) $original->quantity_delta ?: (float) $original->reserved_delta ?: (float) $original->quarantined_delta),
                'unit_cost' => $original->unit_cost,
                'reason' => 'REVERSAL of transaction ' . $original->id,
            ]);

            // Post corrected transaction
            return $this->post([
                'item_id' => $original->item_id,
                'warehouse_id' => $original->warehouse_id,
                'location_id' => $original->location_id,
                'batch_id' => $original->batch_id,
                'type' => $original->type,
                'quantity' => $newQuantity,
                'unit_cost' => $original->unit_cost,
                'reason' => $newReason ?? ($original->reason . ' (CORRECTED)'),
            ]);
        }, 5);
    }

    private function deltas(string $type, float $quantity): array
    {
        return match ($type) {
            'receipt', 'return_in', 'production_output', 'adjustment_in' => [$quantity, 0, 0],
            'issue', 'dispatch', 'adjustment_out', 'waste' => [-$quantity, 0, 0],
            'reserve' => [0, $quantity, 0], 'release_reservation' => [0, -$quantity, 0],
            'quarantine' => [0, 0, $quantity], 'release_quarantine' => [0, 0, -$quantity],
            default => throw ValidationException::withMessages(['type' => 'Choose a valid stock movement.']),
        };
    }

    private function number(float $value): string
    {
        return rtrim(rtrim(number_format($value, 6, '.', ''), '0'), '.');
    }
}
