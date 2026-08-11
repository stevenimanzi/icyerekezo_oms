<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'document_type', 'document_number', 'customer_name', 'customer_email', 'status', 'currency_code', 'total_amount', 'paid_amount', 'item_count', 'document_date', 'due_date', 'created_by'])]
class SalesDocument extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['document_date' => 'date', 'due_date' => 'date', 'total_amount' => 'decimal:2', 'paid_amount' => 'decimal:2'];
    }

    public function shipments() { return $this->hasMany(Shipment::class); }
}
