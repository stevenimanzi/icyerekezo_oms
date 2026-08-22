<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'endpoint', 'endpoint_hash', 'public_key', 'auth_token', 'content_encoding'])]
class PushSubscription extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
