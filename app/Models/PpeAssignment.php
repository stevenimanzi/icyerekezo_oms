<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'user_id', 'equipment_name', 'issued_at', 'condition', 'returned_at', 'issued_by'])]
class PpeAssignment extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['issued_at' => 'date', 'returned_at' => 'date'];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function issuer() { return $this->belongsTo(User::class, 'issued_by'); }
}
