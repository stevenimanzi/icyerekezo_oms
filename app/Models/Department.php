<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'branch_id', 'name', 'code', 'manager_id', 'is_active'])]
class Department extends Model
{
    use BelongsToFactory;
}
