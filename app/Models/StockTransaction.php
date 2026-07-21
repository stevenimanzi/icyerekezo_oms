<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use LogicException;

#[Fillable(['uuid', 'factory_id', 'item_id', 'warehouse_id', 'location_id', 'batch_id', 'type', 'quantity_delta', 'reserved_delta', 'quarantined_delta', 'unit_cost', 'balance_after', 'reference_type', 'reference_id', 'reason', 'performed_by', 'reverses_transaction_id', 'occurred_at'])]
class StockTransaction extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Stock ledger entries are immutable.'));
        static::deleting(fn () => throw new LogicException('Stock ledger entries cannot be deleted.'));
    }
}
