<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'name', 'code', 'description', 'status', 'is_default'])]
class WorkflowTemplate extends Model
{
    use BelongsToFactory;

    public function stages()
    {
        return $this->hasMany(WorkflowStage::class)->orderBy('sequence');
    }
}
