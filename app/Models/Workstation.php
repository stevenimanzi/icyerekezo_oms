<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'department_id', 'branch_id', 'name', 'code', 'type', 'description', 'is_active'])]
class Workstation extends Model
{
    use BelongsToFactory;
}
