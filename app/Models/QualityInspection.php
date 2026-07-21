<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'inspection_number', 'production_order_id', 'stage_execution_id', 'item_id', 'inspection_type', 'sample_size', 'inspected_quantity', 'passed_quantity', 'rejected_quantity', 'result', 'defect_details', 'corrective_action', 'notes', 'inspector_id', 'inspected_at', 'approved_by', 'approved_at'])]
class QualityInspection extends Model
{
    use BelongsToFactory;

    protected function casts(): array { return ['inspected_at' => 'datetime', 'approved_at' => 'datetime']; }
    public function order() { return $this->belongsTo(ProductionOrder::class, 'production_order_id'); }
    public function stageExecution() { return $this->belongsTo(ProductionStageExecution::class, 'stage_execution_id'); }
    public function item() { return $this->belongsTo(Item::class); }
    public function inspector() { return $this->belongsTo(User::class, 'inspector_id'); }
    public function approver() { return $this->belongsTo(User::class, 'approved_by'); }
}
