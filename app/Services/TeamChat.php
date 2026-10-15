<?php

namespace App\Services;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\ChatParticipant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class TeamChat
{
    public const MAX_BODY = 2000;

    public function groupFor(User $user): ChatConversation
    {
        $group = ChatConversation::firstOrCreate(
            ['factory_id' => $user->current_factory_id, 'conversation_key' => 'group'],
            ['type' => 'group', 'name' => 'Everyone'],
        );
        $this->join($group, $user, $this->latestMessageId($group));

        return $group;
    }

    public function directBetween(User $first, User $second): ChatConversation
    {
        [$low, $high] = $first->id < $second->id ? [$first->id, $second->id] : [$second->id, $first->id];

        $conversation = ChatConversation::firstOrCreate(
            ['factory_id' => $first->current_factory_id, 'conversation_key' => "dm:{$low}:{$high}"],
            ['type' => 'direct'],
        );
        $this->join($conversation, $first);
        $this->join($conversation, $second);

        return $conversation;
    }

    public function canAccess(ChatConversation $conversation, User $user): bool
    {
        if ($user->is_platform_admin || (int) $conversation->factory_id !== (int) $user->current_factory_id) {
            return false;
        }

        return $conversation->type === 'group'
            ? $this->isMember($user, $user->current_factory_id)
            : $conversation->participants()->where('user_id', $user->id)->exists();
    }

    public function isMember(User $user, int $factoryId): bool
    {
        return $this->members($factoryId)->whereKey($user->id)->exists();
    }

    /** Active people of the factory who can chat: staff only, never system administrators or school accounts. */
    public function members(int $factoryId): Builder
    {
        return User::query()
            ->where('is_platform_admin', false)
            ->where('is_active', true)
            ->whereNull('school_id')
            ->whereHas('factories', fn ($query) => $query->where('factories.id', $factoryId)->where('factory_user.is_active', true));
    }

    public function conversationsFor(User $user): Collection
    {
        $group = $this->groupFor($user);
        $directIds = ChatParticipant::where('user_id', $user->id)
            ->whereHas('conversation', fn ($query) => $query->where('factory_id', $user->current_factory_id)->where('type', 'direct'))
            ->pluck('conversation_id');

        return ChatConversation::whereIn('id', $directIds->push($group->id))->get();
    }

    public function unreadByConversation(User $user, Collection $conversationIds): Collection
    {
        return ChatMessage::query()
            ->join('chat_participants', fn ($join) => $join
                ->on('chat_participants.conversation_id', '=', 'chat_messages.conversation_id')
                ->where('chat_participants.user_id', $user->id))
            ->whereIn('chat_messages.conversation_id', $conversationIds)
            ->where('chat_messages.user_id', '!=', $user->id)
            ->whereRaw('chat_messages.id > COALESCE(chat_participants.last_read_message_id, 0)')
            ->selectRaw('chat_messages.conversation_id, COUNT(*) as unread')
            ->groupBy('chat_messages.conversation_id')
            ->pluck('unread', 'conversation_id');
    }

    public function markRead(ChatConversation $conversation, User $user): void
    {
        $this->join($conversation, $user);
        ChatParticipant::where(['conversation_id' => $conversation->id, 'user_id' => $user->id])
            ->update(['last_read_message_id' => $this->latestMessageId($conversation)]);
    }

    public function latestMessageId(ChatConversation $conversation): ?int
    {
        return ChatMessage::where('conversation_id', $conversation->id)->max('id');
    }

    private function join(ChatConversation $conversation, User $user, ?int $readUpTo = null): void
    {
        ChatParticipant::firstOrCreate(
            ['conversation_id' => $conversation->id, 'user_id' => $user->id],
            ['last_read_message_id' => $readUpTo],
        );
    }
}
