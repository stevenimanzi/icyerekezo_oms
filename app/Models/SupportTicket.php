<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'user_id', 'ticket_number', 'subject', 'category', 'priority', 'status', 'assigned_to', 'resolved_at'])]
class SupportTicket extends Model
{
    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function messages()
    {
        return $this->hasMany(SupportMessage::class);
    }
}
