<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['factory_id', 'code', 'name', 'email', 'phone', 'tax_number', 'address', 'payment_terms_days', 'status', 'rating'])]
class Supplier extends Model
{
    use BelongsToFactory, SoftDeletes;
    public function items() { return $this->belongsToMany(Item::class, 'supplier_item')->withPivot(['supplier_sku', 'unit_price', 'lead_time_days', 'minimum_order_quantity'])->withTimestamps(); }
}
