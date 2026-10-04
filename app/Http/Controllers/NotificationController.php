<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $notifications = $user->notifications()->latest()->limit(30)->get();
        $unreadCount = $user->unreadNotifications()->count();

        // 1. Dynamic Notification: Incoming Orders (for factory users)
        if ($user->current_factory_id) {
            $pendingOrders = \App\Models\SalesDocument::where('factory_id', $user->current_factory_id)
                ->where('document_type', 'customer_order')
                ->where('status', 'pending')
                ->count();
            
            if ($pendingOrders > 0) {
                $notifications->prepend([
                    'id' => 'dyn-orders',
                    'type' => 'App\Notifications\IncomingOrder',
                    'data' => [
                        'title' => 'Incoming Orders',
                        'body' => "You have $pendingOrders incoming customer order(s) pending your review.",
                        'url' => '/app/sales',
                        'icon' => 'shopping-cart'
                    ],
                    'read_at' => null,
                    'created_at' => now()->toIso8601String(),
                ]);
                $unreadCount++;
            }

            // 2. Dynamic Notification: Open Support Tickets (for factory users)
            $openTickets = \App\Models\SupportTicket::where('factory_id', $user->current_factory_id)
                ->whereNotIn('status', ['resolved', 'closed'])
                ->count();
            
            if ($openTickets > 0) {
                $notifications->prepend([
                    'id' => 'dyn-tickets-factory',
                    'type' => 'App\Notifications\SupportTicket',
                    'data' => [
                        'title' => 'Open Support Tickets',
                        'body' => "You have $openTickets open support ticket(s) awaiting resolution.",
                        'url' => '/app/support',
                        'icon' => 'message-square'
                    ],
                    'read_at' => null,
                    'created_at' => now()->toIso8601String(),
                ]);
                $unreadCount++;
            }
        }

        // 3. Dynamic Notification: Open Support Tickets (for platform admins)
        if ($user->is_platform_admin) {
            $openTickets = \App\Models\SupportTicket::whereNotIn('status', ['resolved', 'closed'])->count();
            
            if ($openTickets > 0) {
                $notifications->prepend([
                    'id' => 'dyn-tickets-admin',
                    'type' => 'App\Notifications\SupportTicket',
                    'data' => [
                        'title' => 'Unanswered Support Tickets',
                        'body' => "There are $openTickets support ticket(s) across the platform waiting for a response.",
                        'url' => '/admin',
                        'icon' => 'message-square'
                    ],
                    'read_at' => null,
                    'created_at' => now()->toIso8601String(),
                ]);
                $unreadCount++;
            }
        }

        return response()->json([
            'notifications' => collect($notifications)->values(),
            'unread_count' => $unreadCount,
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        if (str_starts_with($id, 'dyn-')) {
            return response()->json(['body' => 'Dynamic notification acknowledged']);
        }
        $notification = $request->user()->notifications()->whereKey($id)->firstOrFail();
        $notification->markAsRead();

        return response()->json(['body' => 'Notification marked as read']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['body' => 'All notifications marked as read']);
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
            ]
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

