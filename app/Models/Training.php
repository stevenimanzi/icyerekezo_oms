<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'title', 'description', 'trainer', 'scheduled_at', 'duration_hours', 'status', 'created_by'])]
class Training extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['scheduled_at' => 'date', 'duration_hours' => 'decimal:2'];
    }

    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function participants() { return $this->hasMany(TrainingParticipant::class); }
}
