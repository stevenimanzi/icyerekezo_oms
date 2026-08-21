<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'item_id', 'supplier_id', 'batch_number', 'manufactured_at', 'expires_at', 'status', 'production_stage', 'qc_status', 'metadata'])]
class Batch extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['manufactured_at' => 'date', 'expires_at' => 'date', 'metadata' => 'array'];
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function stockBalances()
    {
        return $this->hasMany(StockBalance::class);
    }

    public function qualityInspections()
    {
        return $this->hasMany(QualityInspection::class);
    }
}
