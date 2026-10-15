<?php

namespace App\Support\Notifications;

use App\Models\User;
use App\Notifications\AppNotification;
use Illuminate\Support\Facades\Notification;

class FactoryNotifier
{
    public static function notify(
        int $factoryId,
        string $permission,
        string $title,
        string $body,
        ?string $url = null,
        string $category = 'general',
        ?int $excludeUserId = null,
    ): void {
        $users = User::where('is_platform_admin', false)
            ->whereHas(
                'factories',
                fn ($query) => $query->where('factories.id', $factoryId)->where('factory_user.is_active', true),
            )
            ->where(function ($query) use ($factoryId, $permission) {
                $query
                    ->whereHas(
                        'factories',
                        fn ($sub) => $sub->where('factories.id', $factoryId)->where('factory_user.is_owner', true),
                    )
                    ->orWhereHas(
                        'roles',
                        fn ($sub) => $sub
                            ->where('role_user.factory_id', $factoryId)
                            ->whereHas('permissions', fn ($p) => $p->where('slug', $permission)),
                    );
            })
            ->when($excludeUserId, fn ($query) => $query->where('id', '!=', $excludeUserId))
            ->get();

        if ($users->isNotEmpty()) {
            Notification::send($users, new AppNotification($title, $body, $url, $category));
        }
    }

    public static function notifyRoles(
        int $factoryId,
        array $roleSlugs,
        string $title,
        string $body,
        ?string $url = null,
        string $category = 'general',
        ?int $excludeUserId = null,
    ): void {
        $users = User::where('is_platform_admin', false)
            ->where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->where('role_user.factory_id', $factoryId)->whereIn('roles.slug', $roleSlugs))
            ->when($excludeUserId, fn ($query) => $query->where('id', '!=', $excludeUserId))
            ->get();

        if ($users->isNotEmpty()) {
            Notification::send($users, new AppNotification($title, $body, $url, $category));
        }
    }

    public static function notifyUser(int $userId, string $title, string $body, ?string $url = null, string $category = 'general'): void
    {
        $user = User::find($userId);

        if ($user) {
            Notification::send($user, new AppNotification($title, $body, $url, $category));
        }
    }
}
