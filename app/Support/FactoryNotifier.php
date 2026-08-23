<?php

namespace App\Support;

use App\Models\User;
use App\Notifications\AppNotification;
use Illuminate\Support\Facades\Notification;

class FactoryNotifier
{
    /**
     * Notify every active user in the factory who holds the given permission (or is the factory owner).
     */
    public static function notify(int $factoryId, string $permission, string $title, string $body, ?string $url = null, string $category = 'general', ?int $excludeUserId = null): void
    {
        $users = User::where('is_platform_admin', false)
            ->whereHas('factories', fn ($query) => $query->where('factories.id', $factoryId)->where('factory_user.is_active', true))
            ->where(function ($query) use ($factoryId, $permission) {
                $query->whereHas('factories', fn ($sub) => $sub->where('factories.id', $factoryId)->where('factory_user.is_owner', true))
                    ->orWhereHas('roles', fn ($sub) => $sub->where('role_user.factory_id', $factoryId)->whereHas('permissions', fn ($p) => $p->where('slug', $permission)));
            })
            ->when($excludeUserId, fn ($query) => $query->where('id', '!=', $excludeUserId))
            ->get();

        if ($users->isNotEmpty()) {
            Notification::send($users, new AppNotification($title, $body, $url, $category));
        }
    }
}
