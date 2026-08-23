<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'user_id', 'leave_type', 'starts_at', 'ends_at', 'days_requested', 'reason', 'status', 'reviewed_by', 'reviewed_at', 'review_note'])]
class LeaveRequest extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['starts_at' => 'date', 'ends_at' => 'date', 'reviewed_at' => 'datetime'];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
