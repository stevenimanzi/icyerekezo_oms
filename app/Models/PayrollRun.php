<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'run_number',
        'period',
        'status',
        'statutory_rate',
        'total_gross',
        'total_deductions',
        'total_net',
        'employee_count',
        'notes',
        'created_by',
        'submitted_at',
        'paid_at',
        'paid_by',
        'finance_entry_id',
    ]),
]
class PayrollRun extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return [
            'statutory_rate' => 'decimal:2',
            'total_gross' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'total_net' => 'decimal:2',
            'submitted_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function lines()
    {
        return $this->hasMany(PayrollLine::class)->orderBy('employee_name');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payer()
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /** Recalculates the totals from the lines. */
    public function recalculate(): void
    {
        $lines = $this->lines()->get();
        $this->update([
            'total_gross' => round((float) $lines->sum('gross_pay'), 2),
            'total_deductions' => round((float) $lines->sum(fn ($l) => $l->absence_deduction + $l->statutory_deduction + $l->other_deductions), 2),
            'total_net' => round((float) $lines->sum('net_pay'), 2),
            'employee_count' => $lines->count(),
        ]);
    }
}
