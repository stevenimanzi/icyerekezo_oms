<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** Packed pieces that passed the final quality check, handed from Packing to the storekeeper. */
#[
    Fillable([
        'factory_id',
        'lot_id',
        'quantity',
        'quantity_received',
        'status',
        'note',
        'receive_note',
        'warehouse_id',
        'sent_by',
        'sent_at',
        'received_by',
        'received_at',
    ]),
]
class StockHandover extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'received_at' => 'datetime'];
    }

    public function lot()
    {
        return $this->belongsTo(ProductionLot::class, 'lot_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }
}
