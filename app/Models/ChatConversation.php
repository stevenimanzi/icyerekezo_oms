<?php

namespace App\Models;

use App\Models\Concerns\BelongsToFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'type', 'conversation_key', 'name', 'last_message_at'])]
class ChatConversation extends Model
{
    use BelongsToFactory;

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function participants()
    {
        return $this->hasMany(ChatParticipant::class, 'conversation_id');
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id');
    }
}
