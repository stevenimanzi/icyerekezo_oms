<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'legacy_id', 'name', 'district', 'sector', 'contact_name', 'phone', 'email'])]
class School extends Model
{
    use BelongsToFactory;

    public function orders() { return $this->hasMany(SalesDocument::class); }
}
