<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'department_id',
        'name',
        'code',
        'type',
        'serial_number',
        'manufacturer',
        'model',
        'status',
        'location',
        'runtime_hours',
        'ideal_output_per_hour',
        'installed_at',
        'next_maintenance_at',
        'last_maintenance_at',
        'maintenance_interval_days',
    ]),
]
class Machine extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['installed_at' => 'date', 'next_maintenance_at' => 'datetime', 'last_maintenance_at' => 'datetime'];
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function performanceLogs()
    {
        return $this->hasMany(MachinePerformanceLog::class);
    }

    public function maintenanceRecords()
    {
        return $this->hasMany(MaintenanceRecord::class);
    }
}
