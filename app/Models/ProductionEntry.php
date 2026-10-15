<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'lot_id',
        'stage',
        'entry_date',
        'good_quantity',
        'damaged_quantity',
        'fabric_item_id',
        'fabric_used',
        'fabric_waste',
        'notes',
        'recorded_by',
        'voided_at',
        'void_reason',
        'voided_by',
    ]),
]
class ProductionEntry extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return [
            'entry_date' => 'date:Y-m-d',
            'fabric_used' => 'decimal:3',
            'fabric_waste' => 'decimal:3',
            'voided_at' => 'datetime',
        ];
    }

    public function lot()
    {
        return $this->belongsTo(ProductionLot::class, 'lot_id');
    }

    public function fabric()
    {
        return $this->belongsTo(Item::class, 'fabric_item_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
