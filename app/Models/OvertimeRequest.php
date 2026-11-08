<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'user_id',
        'work_date',
        'hours',
        'reason',
        'status',
        'recorded_by',
        'decided_by',
        'decided_at',
        'payroll_run_id',
    ]),
]
class OvertimeRequest extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['work_date' => 'date', 'hours' => 'decimal:2', 'decided_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function decider()
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
