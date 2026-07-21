<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'item_id', 'name', 'version', 'output_quantity', 'expected_waste_percent', 'status', 'effective_from', 'effective_until', 'approved_by', 'approved_at'])]
class BillOfMaterial extends Model
{
    use BelongsToFactory;

    protected $table = 'bills_of_materials';

    protected function casts(): array
    {
        return ['effective_from' => 'date', 'effective_until' => 'date', 'approved_at' => 'datetime'];
    }

    public function components()
    {
        return $this->hasMany(BillOfMaterialItem::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
