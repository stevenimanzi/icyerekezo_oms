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
        'item_id',
        'warehouse_id',
        'quantity',
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
