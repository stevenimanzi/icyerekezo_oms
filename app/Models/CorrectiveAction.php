<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'source_type', 'source_id', 'description', 'assigned_to', 'due_date', 'status', 'completed_at', 'created_by'])]
class CorrectiveAction extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['due_date' => 'date', 'completed_at' => 'datetime'];
    }

    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
