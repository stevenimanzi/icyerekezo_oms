<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\TeamChat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function __construct(private readonly TeamChat $chat) {}

    public function overview(Request $request): JsonResponse
    {
        $user = $this->staff($request);
        $factoryId = $user->current_factory_id;
        $conversations = $this->chat->conversationsFor($user);
        $unread = $this->chat->unreadByConversation($user, $conversations->pluck('id'));
        $latest = ChatMessage::with('user:id,name')
            ->whereIn('id', ChatMessage::whereIn('conversation_id', $conversations->pluck('id'))->selectRaw('MAX(id)')->groupBy('conversation_id'))
            ->get()
            ->keyBy('conversation_id');
        $members = $this->chat->members($factoryId)
            ->with(['roles' => fn ($query) => $query->wherePivot('factory_id', $factoryId)])
            ->orderBy('name')
            ->get(['users.id', 'users.name']);
        $names = $members->keyBy('id');

        $rows = $conversations->map(function (ChatConversation $conversation) use ($user, $unread, $latest, $names) {
            $last = $latest->get($conversation->id);
            $other = $conversation->type === 'direct' ? $this->otherPerson($conversation, $user) : null;

            return [
                'id' => $conversation->id,
                'type' => $conversation->type,
                'title' => $conversation->type === 'group' ? $conversation->name : ($names[$other]->name ?? $this->nameOf($other)),
                'person_id' => $other,
                'unread' => (int) ($unread[$conversation->id] ?? 0),
                'last_message' => $last ? [
                    'body' => mb_strimwidth($last->body, 0, 80, '…'),
                    'at' => $last->created_at->toIso8601String(),
                    'by' => $last->user_id === $user->id ? null : $last->user?->name,
                ] : null,
            ];
        })->sortByDesc(fn (array $row) => $row['last_message']['at'] ?? '')->values();

        return response()->json([
            'conversations' => $rows,
            'people' => $members->where('id', '!=', $user->id)->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'role' => $member->roles->first()?->name,
            ])->values(),
            'unread' => $rows->sum('unread'),
        ]);
    }

    public function unread(Request $request): JsonResponse
    {
        $user = $this->staff($request);
        $ids = $this->chat->conversationsFor($user)->pluck('id');

        return response()->json(['unread' => (int) $this->chat->unreadByConversation($user, $ids)->sum()]);
    }

    public function messages(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $this->staff($request);
        abort_unless($this->chat->canAccess($conversation, $user), 404);
        $after = $request->integer('after');

        $query = ChatMessage::with('user:id,name')->where('conversation_id', $conversation->id);
        $messages = $after > 0
            ? $query->where('id', '>', $after)->orderBy('id')->limit(100)->get()
            : $query->orderByDesc('id')->limit(50)->get()->reverse()->values();

        $this->chat->markRead($conversation, $user);

        return response()->json([
            'messages' => $messages->map(fn (ChatMessage $message) => $this->row($message, $user))->values(),
            'last_id' => $messages->max('id') ?? $after,
        ]);
    }

    public function send(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $this->staff($request);
        abort_unless($this->chat->canAccess($conversation, $user), 404);
        $data = $request->validate(['body' => ['required', 'string', 'max:' . TeamChat::MAX_BODY]]);
        $body = trim($data['body']);
        abort_if($body === '', 422, 'Write a message first.');

        $message = ChatMessage::create(['conversation_id' => $conversation->id, 'user_id' => $user->id, 'body' => $body]);
        $conversation->update(['last_message_at' => $message->created_at]);
        $this->chat->markRead($conversation, $user);

        return response()->json($this->row($message->load('user:id,name'), $user), 201);
    }

    public function direct(Request $request): JsonResponse
    {
        $user = $this->staff($request);
        $data = $request->validate(['user_id' => ['required', 'integer', 'different:' . $user->id]]);
        $other = $this->chat->members($user->current_factory_id)->find($data['user_id']);
        abort_unless($other, 404, 'This person is not in your factory team.');

        $conversation = $this->chat->directBetween($user, $other);

        return response()->json(['id' => $conversation->id, 'title' => $other->name], 201);
    }

    private function staff(Request $request): User
    {
        $user = $request->user();
        abort_if($user->is_platform_admin || $user->school_id, 403, 'Team chat is for factory staff.');

        return $user;
    }

    private function otherPerson(ChatConversation $conversation, User $user): ?int
    {
        return $conversation->participants()->where('user_id', '!=', $user->id)->value('user_id');
    }

    private function nameOf(?int $id): string
    {
        return $id ? (string) User::withoutGlobalScopes()->whereKey($id)->value('name') : '';
    }

    private function row(ChatMessage $message, User $viewer): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'at' => $message->created_at->toIso8601String(),
            'mine' => $message->user_id === $viewer->id,
            'user' => ['id' => $message->user_id, 'name' => $message->user?->name],
        ];
    }
}
