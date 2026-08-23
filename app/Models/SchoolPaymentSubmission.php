<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'school_id', 'sales_document_id', 'amount', 'payment_method', 'payment_reference', 'paid_at', 'proof_path', 'status', 'review_note', 'reviewed_by', 'reviewed_at'])]
class SchoolPaymentSubmission extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'paid_at' => 'date', 'reviewed_at' => 'datetime'];
    }

    public function school() { return $this->belongsTo(School::class); }
    public function salesDocument() { return $this->belongsTo(SalesDocument::class); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
