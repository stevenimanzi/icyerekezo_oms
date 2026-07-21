<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['support_ticket_id', 'user_id', 'message', 'is_internal'])]
class SupportMessage extends Model
{
    protected function casts(): array
    {
        return ['is_internal' => 'boolean'];
    }
}
