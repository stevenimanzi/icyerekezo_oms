<?php

namespace App\Services;

use App\Models\Item;
use App\Models\StockTransaction;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockIssuer
{
    public function __construct(private readonly InventoryLedger $ledger) {}

    /**
     * @return array<int, StockTransaction> the ledger entries created for this issue
     */
    public function issue(Item $item, float $quantity, ?Warehouse $warehouse, string $type, string $reason, Model $reference, string $errorKey): array
    {
        $warehouse ??= $this->warehouseWithMostStock($item);

        if (! $warehouse) {
            throw ValidationException::withMessages([$errorKey => "{$item->name} is not in stock in any warehouse."]);
        }

        $posted = [];
        $remaining = $quantity;

        try {
            foreach ($this->sources($item, $warehouse, $quantity) as [$batchId, $take]) {
                $posted[] = $this->ledger->post([
                    'item_id' => $item->id,
                    'warehouse_id' => $warehouse->id,
                    'batch_id' => $batchId,
                    'type' => $type,
                    'quantity' => $take,
                    'reason' => $reason,
                    'reference_type' => $reference->getMorphClass(),
                    'reference_id' => $reference->getKey(),
                ]);
                $remaining -= $take;
            }
        } catch (ValidationException $exception) {
            $message = collect($exception->errors())->flatten()->first();

            throw ValidationException::withMessages([$errorKey => "{$item->name}: {$message}"]);
        }

        if ($remaining > 0.0000001) {
            throw ValidationException::withMessages([$errorKey => "{$item->name}: not enough stock."]);
        }

        return $posted;
    }

    public function warehouseWithMostStock(Item $item): ?Warehouse
    {
        $id = DB::table('stock_balances')
            ->join('warehouses', 'warehouses.id', '=', 'stock_balances.warehouse_id')
            ->where('stock_balances.item_id', $item->id)
            ->where('warehouses.factory_id', $item->factory_id)
            ->where('warehouses.is_active', true)
            ->groupBy('warehouses.id')
            ->orderByRaw('SUM(stock_balances.quantity_on_hand - stock_balances.quantity_reserved - stock_balances.quantity_quarantined) DESC')
            ->value('warehouses.id');

        return $id ? Warehouse::find($id) : Warehouse::where('is_active', true)->orderBy('id')->first();
    }

    /** @return array<int, array{0: ?int, 1: float}> batch id and quantity pairs, earliest expiry first for batch-tracked items */
    private function sources(Item $item, Warehouse $warehouse, float $quantity): array
    {
        if (! $item->batch_tracked) {
            return [[null, $quantity]];
        }

        $batches = DB::table('stock_balances')
            ->join('batches', 'batches.id', '=', 'stock_balances.batch_id')
            ->where('stock_balances.item_id', $item->id)
            ->where('stock_balances.warehouse_id', $warehouse->id)
            ->where(fn ($query) => $query->whereNull('batches.expires_at')->orWhere('batches.expires_at', '>=', today()))
            ->selectRaw('batches.id as batch_id, (stock_balances.quantity_on_hand - stock_balances.quantity_reserved - stock_balances.quantity_quarantined) as available')
            ->orderByRaw('batches.expires_at IS NULL, batches.expires_at')
            ->get();

        $sources = [];
        $needed = $quantity;

        foreach ($batches as $batch) {
            $take = min($needed, (float) $batch->available);
            if ($take > 0) {
                $sources[] = [(int) $batch->batch_id, $take];
                $needed -= $take;
            }
            if ($needed <= 0.0000001) {
                break;
            }
        }

        return $needed > 0.0000001 ? [[null, $quantity]] : $sources;
    }
}
