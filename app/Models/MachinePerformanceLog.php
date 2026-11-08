<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'machine_id',
        'log_date',
        'shift',
        'planned_minutes',
        'run_minutes',
        'stop_reason',
        'units_produced',
        'units_target',
        'units_rejected',
        'notes',
        'recorded_by',
    ]),
]
class MachinePerformanceLog extends Model
{
    use BelongsToFactory;

    /** Why a machine stood still. */
    public const STOP_REASONS = [
        'breakdown' => 'Breakdown',
        'maintenance' => 'Planned maintenance',
        'setup' => 'Changing product or set-up',
        'no_material' => 'No material',
        'no_operator' => 'No operator',
        'power' => 'Power cut',
        'quality' => 'Quality problem',
        'other' => 'Other',
    ];

    public const SHIFTS = ['day' => 'Day', 'night' => 'Night', 'extra' => 'Extra shift'];

    protected function casts(): array
    {
        return ['log_date' => 'date:Y-m-d'];
    }

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
