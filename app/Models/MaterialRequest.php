<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'request_number',
        'stage',
        'from_stage',
        'item_id',
        'lot_id',
        'warehouse_id',
        'quantity',
        'fulfilled_quantity',
        'reason',
        'status',
        'requested_by',
        'decided_by',
        'decided_at',
        'decision_note',
    ]),
]
class MaterialRequest extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3', 'decided_at' => 'datetime'];
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function lot()
    {
        return $this->belongsTo(ProductionLot::class, 'lot_id');
    }

    /** True when a stage asks the stage before it for finished pieces, instead of asking the warehouse for materials. */
    public function isForPieces(): bool
    {
        return $this->from_stage !== null;
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decider()
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
