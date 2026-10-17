<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\SalesDocument;
use App\Models\SupportTicket;
use App\Support\Notifications\PendingWork;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $notifications = $user->notifications()->latest()->limit(30)->get()->map(fn ($row) => $row->toArray());
        $unreadCount = $user->unreadNotifications()->count();

        $pending = collect($this->pending($user))->map(function (array $item) use ($user) {
            $read = Cache::get($this->readKey($user->id, $item['id'])) === $item['count'];

            return [
                'id' => $item['id'],
                'type' => 'pending',
                'data' => ['title' => $item['title'], 'body' => $item['body'], 'url' => $item['url'], 'category' => $item['category'], 'count' => $item['count']],
                'read_at' => $read ? now()->toIso8601String() : null,
                'created_at' => now()->toIso8601String(),
                'pending' => true,
            ];
        });

        return response()->json([
            'notifications' => $pending->concat($notifications)->values(),
            'unread_count' => $unreadCount + $pending->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (str_starts_with($id, 'dyn-')) {
            $item = collect($this->pending($user))->firstWhere('id', $id);
            if ($item) {
                Cache::put($this->readKey($user->id, $id), $item['count'], now()->addDays(30));
            }

            return response()->json(['body' => 'Notification marked as read']);
        }

        $user->notifications()->whereKey($id)->firstOrFail()->markAsRead();

        return response()->json(['body' => 'Notification marked as read']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();

        foreach ($this->pending($user) as $item) {
            Cache::put($this->readKey($user->id, $item['id']), $item['count'], now()->addDays(30));
        }
        $user->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['body' => 'All notifications marked as read']);
    }

    /** Work waiting for this person: sales orders, support tickets and the production flow. Each one returns when its count changes. */
    private function pending($user): array
    {
        $items = [];
        $factoryId = $user->current_factory_id;

        if ($factoryId && $user->hasPermission('sales.view')) {
            $orders = SalesDocument::where('factory_id', $factoryId)->where('document_type', 'customer_order')->where('status', 'pending')->count();
            if ($orders > 0) {
                $items[] = ['id' => 'dyn-orders', 'title' => 'Incoming orders', 'body' => "You have {$orders} incoming customer order(s) pending your review.", 'url' => '/app/sales', 'category' => 'sales', 'count' => $orders];
            }

            $tickets = $user->hasPermission('users.view') ? SupportTicket::where('factory_id', $factoryId)->whereNotIn('status', ['resolved', 'closed'])->count() : 0;
            if ($tickets > 0) {
                $items[] = ['id' => 'dyn-tickets-factory', 'title' => 'Open support tickets', 'body' => "You have {$tickets} open support ticket(s) awaiting resolution.", 'url' => '/app/support', 'category' => 'support', 'count' => $tickets];
            }
        }

        if ($user->is_platform_admin) {
            $tickets = SupportTicket::whereNotIn('status', ['resolved', 'closed'])->count();
            if ($tickets > 0) {
                $items[] = ['id' => 'dyn-tickets-admin', 'title' => 'Unanswered support tickets', 'body' => "There are {$tickets} support ticket(s) across the platform waiting for a response.", 'url' => '/admin', 'category' => 'support', 'count' => $tickets];
            }
        }

        return [...$items, ...PendingWork::for($user)];
    }

    private function readKey(int $userId, string $id): string
    {
        return "notification-read:{$userId}:{$id}";
    }

    public function vapidPublicKey(): JsonResponse
    {
        return response()->json(['public_key' => config('webpush.vapid.public_key')]);
    }

    public function storePushSubscription(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
        ]);
        PushSubscription::updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => 'aes128gcm',
            ],
        );

        return response()->json(['body' => 'Push subscription saved'], 201);
    }

    public function destroyPushSubscription(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => ['required', 'string']]);
        $request->user()->pushSubscriptions()->where('endpoint_hash', hash('sha256', $data['endpoint']))->delete();

        return response()->json(['body' => 'Push subscription removed']);
    }
}
