<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'production_order_id', 'workflow_stage_id', 'assigned_user_id', 'status', 'input_quantity', 'output_quantity', 'waste_quantity', 'rejected_quantity', 'downtime_minutes', 'notes', 'started_at', 'completed_at'])]
class ProductionStageExecution extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function stage()
    {
        return $this->belongsTo(WorkflowStage::class, 'workflow_stage_id');
    }
}
