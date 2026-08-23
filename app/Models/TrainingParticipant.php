<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['training_id', 'user_id', 'status', 'certified'])]
class TrainingParticipant extends Model
{
    protected function casts(): array
    {
        return ['certified' => 'boolean'];
    }

    public function training() { return $this->belongsTo(Training::class); }
    public function user() { return $this->belongsTo(User::class); }
}
