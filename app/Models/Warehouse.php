<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'branch_id', 'name', 'code', 'type', 'allows_negative_stock', 'is_active'])]
class Warehouse extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['allows_negative_stock' => 'boolean', 'is_active' => 'boolean'];
    }
}
