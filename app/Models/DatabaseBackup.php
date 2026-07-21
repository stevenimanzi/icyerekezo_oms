<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['requested_by', 'disk', 'path', 'status', 'size_bytes', 'error_message', 'started_at', 'completed_at'])]
class DatabaseBackup extends Model
{
    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'completed_at' => 'datetime'];
    }
}
