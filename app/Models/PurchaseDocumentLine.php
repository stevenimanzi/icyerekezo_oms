<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'purchase_document_id', 'item_id', 'description', 'quantity', 'unit_price', 'received_quantity', 'line_total'])]
class PurchaseDocumentLine extends Model
{
    use BelongsToFactory;
    protected function casts(): array { return ['quantity' => 'decimal:6', 'unit_price' => 'decimal:4', 'received_quantity' => 'decimal:6', 'line_total' => 'decimal:2']; }
    public function item() { return $this->belongsTo(Item::class); }
}
