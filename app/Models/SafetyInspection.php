<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'inspector_id', 'area', 'inspection_date', 'notes', 'result'])]
class SafetyInspection extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['inspection_date' => 'date'];
    }

    public function inspector() { return $this->belongsTo(User::class, 'inspector_id'); }
}
