<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'purchase_document_id', 'payment_number', 'amount', 'method', 'reference', 'paid_on', 'recorded_by'])]
class ProcurementPayment extends Model
{
    use BelongsToFactory;
    protected function casts(): array { return ['amount' => 'decimal:2', 'paid_on' => 'date']; }
}
