<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'sales_document_id', 'amount', 'method', 'reference', 'paid_on', 'recorded_by'])]
class SalesPayment extends Model
{
    use BelongsToFactory;

    public const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'cheque', 'card'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'paid_on' => 'date'];
    }

    public function document()
    {
        return $this->belongsTo(SalesDocument::class, 'sales_document_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
