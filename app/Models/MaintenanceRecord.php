<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'machine_id', 'reported_by', 'assigned_to', 'maintenance_type', 'title', 'description', 'priority', 'status', 'scheduled_at', 'started_at', 'completed_at', 'downtime_minutes', 'cost', 'resolution'])]
class MaintenanceRecord extends Model
{
    use BelongsToFactory;
    protected function casts(): array { return ['scheduled_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime']; }
    public function machine() { return $this->belongsTo(Machine::class); }
    public function reporter() { return $this->belongsTo(User::class, 'reported_by'); }
    public function assignee() { return $this->belongsTo(User::class, 'assigned_to'); }
}
