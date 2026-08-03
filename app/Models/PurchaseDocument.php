<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'document_type', 'document_number', 'supplier_id', 'status', 'currency_code', 'total_amount', 'line_count', 'document_date', 'expected_date', 'received_at', 'created_by', 'approved_by'])]
class PurchaseDocument extends Model
{
    use BelongsToFactory;
    protected function casts(): array { return ['document_date' => 'date', 'expected_date' => 'date', 'received_at' => 'datetime', 'total_amount' => 'decimal:2']; }
    public function supplier() { return $this->belongsTo(Supplier::class); }
}
