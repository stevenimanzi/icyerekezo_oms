<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'warehouse_id', 'parent_id', 'name', 'code', 'type', 'is_quarantine', 'is_active'])]
class StorageLocation extends Model
{
    use BelongsToFactory;
}
