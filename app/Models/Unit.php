<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'name', 'symbol', 'dimension', 'precision', 'is_active'])]
class Unit extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
