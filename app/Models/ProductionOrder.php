<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'order_number', 'item_id', 'bill_of_material_id', 'workflow_template_id', 'warehouse_id', 'planned_quantity', 'completed_quantity', 'rejected_quantity', 'waste_quantity', 'status', 'planned_start', 'planned_end', 'started_at', 'completed_at', 'created_by', 'approved_by'])]
class ProductionOrder extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['planned_start' => 'date', 'planned_end' => 'date', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function executions()
    {
        return $this->hasMany(ProductionStageExecution::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function billOfMaterial()
    {
        return $this->belongsTo(BillOfMaterial::class);
    }
}
