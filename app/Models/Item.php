<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['factory_id', 'category_id', 'unit_id', 'type', 'name', 'sku', 'barcode', 'description', 'standard_cost', 'selling_price', 'tax_rate', 'minimum_stock', 'reorder_level', 'batch_tracked', 'serial_tracked', 'expiry_tracked', 'storage_conditions', 'is_active'])]
class Item extends Model
{
    use BelongsToFactory, SoftDeletes;

    protected function casts(): array
    {
        return ['batch_tracked' => 'boolean', 'serial_tracked' => 'boolean', 'expiry_tracked' => 'boolean', 'is_active' => 'boolean'];
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }
}
