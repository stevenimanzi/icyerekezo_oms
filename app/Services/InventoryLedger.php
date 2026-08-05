<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Item;
use App\Models\StockBalance;
use App\Models\StockTransaction;
use App\Models\Warehouse;
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
            $batch = isset($data['batch_id']) ? Batch::findOrFail($data['batch_id']) : null;
            if ($item->batch_tracked && ! $batch) {
                throw ValidationException::withMessages(['batch_id' => 'Choose a batch for this item.']);
            }
            if ($batch && $batch->item_id !== $item->id) {
                throw ValidationException::withMessages(['batch_id' => 'The selected batch does not belong to this item.']);
            }
            if ($batch?->expires_at?->isPast() && in_array($data['type'], ['issue', 'dispatch', 'reserve'], true)) {
                throw ValidationException::withMessages(['batch_id' => 'Expired stock cannot be sent out or reserved.']);
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
            return StockTransaction::create([...$dimensions, 'uuid' => (string) Str::uuid(), 'type' => $data['type'], 'quantity_delta' => $onHand, 'reserved_delta' => $reserved, 'quarantined_delta' => $quarantined, 'unit_cost' => $data['unit_cost'] ?? $item->standard_cost, 'balance_after' => $newOnHand, 'reason' => $data['reason'] ?? null, 'performed_by' => auth()->id(), 'occurred_at' => $data['occurred_at'] ?? now()]);
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
