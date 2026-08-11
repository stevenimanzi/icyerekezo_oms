<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'school_id', 'document_type', 'document_number', 'customer_name', 'customer_email', 'school_district', 'school_sector', 'academic_year', 'status', 'currency_code', 'total_amount', 'paid_amount', 'item_count', 'document_date', 'due_date', 'created_by'])]
class SalesDocument extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['document_date' => 'date', 'due_date' => 'date', 'total_amount' => 'decimal:2', 'paid_amount' => 'decimal:2'];
    }

    public function shipments() { return $this->hasMany(Shipment::class); }
    public function lines() { return $this->hasMany(SalesDocumentLine::class); }
    public function school() { return $this->belongsTo(School::class); }
}
