<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'user_id', 'date', 'status', 'check_in_time', 'check_out_time', 'notes', 'recorded_by'])]
class EmployeeAttendance extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['date' => 'date'];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function recorder() { return $this->belongsTo(User::class, 'recorded_by'); }
}
