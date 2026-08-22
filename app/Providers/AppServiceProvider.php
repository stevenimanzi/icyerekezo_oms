<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Point Laravel's password-reset emails at our SPA reset page.
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            return url('/reset-password/' . $token . '?email=' . urlencode($notifiable->getEmailForPasswordReset()));
        });
    }
}
