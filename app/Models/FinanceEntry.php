<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'entry_number',
        'direction',
        'category',
        'description',
        'party',
        'employee_id',
        'period',
        'amount',
        'method',
        'reference',
        'entry_date',
        'recorded_by',
        'voided_at',
        'voided_by',
        'void_reason',
    ]),
]
class FinanceEntry extends Model
{
    use BelongsToFactory;

    /** Money going out of the factory that is not a supplier payment. */
    public const OUT_CATEGORIES = [
        'payroll' => 'Salaries paid (HR payroll)',
        'utilities' => 'Electricity, water & internet',
        'rent' => 'Rent',
        'transport' => 'Transport & fuel',
        'maintenance' => 'Repairs & maintenance',
        'taxes' => 'Taxes & fees',
        'supplies' => 'Office & other supplies',
        'loan' => 'Loan repayment',
        'other' => 'Other expense',
    ];

    /** Money coming in that is not a customer payment. */
    public const IN_CATEGORIES = [
        'other_income' => 'Other income',
        'capital' => 'Owner capital',
        'loan_received' => 'Loan received',
        'refund' => 'Refund received',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'entry_date' => 'date',
            'voided_at' => 'datetime',
        ];
    }

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public static function categoryLabel(string $direction, string $category): string
    {
        $labels = $direction === 'in' ? self::IN_CATEGORIES : self::OUT_CATEGORIES;

        return $labels[$category] ?? ucfirst(str_replace('_', ' ', $category));
    }
}
