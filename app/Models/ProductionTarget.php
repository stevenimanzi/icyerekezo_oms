<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionTarget extends Model
{
    use HasFactory;

    protected $fillable = [
        'factory_id',
        'title',
        'product_name',
        'stage',
        'target_quantity',
        'start_date',
        'end_date',
        'period_type',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'target_quantity' => 'float',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function factory(): BelongsTo
    {
        return $this->belongsTo(Factory::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
