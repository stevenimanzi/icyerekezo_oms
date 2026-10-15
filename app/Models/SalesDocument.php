<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use App\Support\Security\PrivateFile;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

#[
    Fillable([
        'factory_id',
        'school_id',
        'document_type',
        'document_number',
        'customer_name',
        'customer_email',
        'school_district',
        'school_sector',
        'academic_year',
        'status',
        'currency_code',
        'total_amount',
        'paid_amount',
        'payment_status',
        'item_count',
        'document_date',
        'due_date',
        'created_by',
        'invoice_path',
        'invoice_original_name',
        'invoice_uploaded_at',
        'invoice_uploaded_by',
        'customer_phone',
        'discount_amount',
        'notes',
        'source',
        'cancel_reason',
    ]),
]
class SalesDocument extends Model
{
    use BelongsToFactory;

    protected $appends = ['invoice_url'];

    protected function casts(): array
    {
        return [
            'document_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'invoice_uploaded_at' => 'datetime',
        ];
    }

    public function shipments()
    {
        return $this->hasMany(Shipment::class);
    }

    public function lines()
    {
        return $this->hasMany(SalesDocumentLine::class);
    }

    public function payments()
    {
        return $this->hasMany(SalesPayment::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    public function invoiceUploadedBy()
    {
        return $this->belongsTo(User::class, 'invoice_uploaded_by');
    }

    protected function invoiceUrl(): Attribute
    {
        return Attribute::get(fn () => PrivateFile::url($this->invoice_path));
    }
}
