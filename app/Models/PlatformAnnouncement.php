<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['created_by', 'title', 'message', 'severity', 'audience', 'published_at', 'expires_at'])]
class PlatformAnnouncement extends Model
{
    protected function casts(): array
    {
        return ['published_at' => 'datetime', 'expires_at' => 'datetime'];
    }
}
