<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'sales_document_id',
        'item_id',
        'class_level',
        'garment_category',
        'gender',
        'size',
        'color',
        'quantity_ordered',
        'quantity_packed',
        'quantity_delivered',
        'quantity_rejected',
        'rejection_reason',
        'unit_price',
        'line_total',
    ]),
]
class SalesDocumentLine extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['unit_price' => 'decimal:2', 'line_total' => 'decimal:2'];
    }

    public function document()
    {
        return $this->belongsTo(SalesDocument::class, 'sales_document_id');
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
