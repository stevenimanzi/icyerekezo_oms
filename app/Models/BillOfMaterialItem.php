<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['bill_of_material_id', 'item_id', 'unit_id', 'quantity', 'waste_percent', 'substitute_item_id', 'is_optional'])]
class BillOfMaterialItem extends Model
{
    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
