<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'payroll_run_id',
        'user_id',
        'employee_name',
        'employee_number',
        'job_title',
        'base_salary',
        'overtime_hours',
        'overtime_pay',
        'allowances',
        'absent_days',
        'absence_deduction',
        'statutory_deduction',
        'other_deductions',
        'gross_pay',
        'net_pay',
        'note',
    ]),
]
class PayrollLine extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'overtime_hours' => 'decimal:2',
            'overtime_pay' => 'decimal:2',
            'allowances' => 'decimal:2',
            'absence_deduction' => 'decimal:2',
            'statutory_deduction' => 'decimal:2',
            'other_deductions' => 'decimal:2',
            'gross_pay' => 'decimal:2',
            'net_pay' => 'decimal:2',
        ];
    }

    public function run()
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Works out gross and net pay from the parts of the line. */
    public function settle(float $statutoryRate): void
    {
        $gross = round((float) $this->base_salary + (float) $this->overtime_pay + (float) $this->allowances, 2);
        $statutory = round($gross * $statutoryRate / 100, 2);
        $net = max(0, round($gross - (float) $this->absence_deduction - $statutory - (float) $this->other_deductions, 2));

        $this->fill(['gross_pay' => $gross, 'statutory_deduction' => $statutory, 'net_pay' => $net]);
    }
}
