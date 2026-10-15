<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'lot_number',
        'product_item_id',
        'fabric_item_id',
        'style',
        'color',
        'size',
        'status',
        'hold_reason',
        'held_at',
        'held_by',
        'cut_on',
        'notes',
        'created_by',
    ]),
]
class ProductionLot extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['cut_on' => 'date:Y-m-d', 'held_at' => 'datetime'];
    }

    public function product()
    {
        return $this->belongsTo(Item::class, 'product_item_id');
    }

    public function fabric()
    {
        return $this->belongsTo(Item::class, 'fabric_item_id');
    }

    public function entries()
    {
        return $this->hasMany(ProductionEntry::class, 'lot_id');
    }

    public function transfers()
    {
        return $this->hasMany(ProductionTransfer::class, 'lot_id');
    }

    public function inspections()
    {
        return $this->hasMany(QualityInspection::class, 'lot_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getIsHeldAttribute(): bool
    {
        return $this->held_at !== null;
    }
}
