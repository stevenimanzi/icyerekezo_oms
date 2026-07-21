<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'user_id', 'workstation_id', 'assignment_type', 'assignable_type', 'assignable_id', 'title', 'instructions', 'priority', 'status', 'starts_at', 'due_at', 'completed_at', 'assigned_by', 'metadata'])]
class WorkAssignment extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'due_at' => 'datetime', 'completed_at' => 'datetime', 'metadata' => 'array'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
