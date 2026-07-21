<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['workflow_template_id', 'department_id', 'workstation_id', 'name', 'code', 'sequence', 'expected_minutes', 'required_workers', 'quality_required', 'approval_required', 'instructions'])]
class WorkflowStage extends Model
{
    protected function casts(): array
    {
        return ['quality_required' => 'boolean', 'approval_required' => 'boolean', 'instructions' => 'array'];
    }
}
