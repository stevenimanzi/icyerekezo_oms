<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'lot_id',
        'from_stage',
        'to_stage',
        'quantity_sent',
        'quantity_received',
        'status',
        'note',
        'receive_note',
        'sent_by',
        'sent_at',
        'received_by',
        'received_at',
    ]),
]
class ProductionTransfer extends Model
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
}
