<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'reported_by', 'incident_date', 'location', 'description', 'severity', 'injured_person', 'status', 'resolution_note', 'resolved_by', 'resolved_at'])]
class SafetyIncident extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['incident_date' => 'date', 'resolved_at' => 'datetime'];
    }

    public function reporter() { return $this->belongsTo(User::class, 'reported_by'); }
    public function resolver() { return $this->belongsTo(User::class, 'resolved_by'); }
    public function correctiveActions() { return $this->hasMany(CorrectiveAction::class, 'source_id')->where('source_type', 'incident'); }
}
