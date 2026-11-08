<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'user_id',
        'department_id',
        'workstation_id',
        'employee_number',
        'job_title',
        'base_salary',
        'overtime_rate',
        'contract_type',
        'phone',
        'emergency_contact',
        'skills',
        'employment_status',
        'hired_at',
    ]),
]
class EmployeeProfile extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['skills' => 'array', 'hired_at' => 'date', 'base_salary' => 'decimal:2', 'overtime_rate' => 'decimal:2'];
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function workstation()
    {
        return $this->belongsTo(Workstation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
