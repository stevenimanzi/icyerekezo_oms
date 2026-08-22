<?php

use App\Jobs\CreateDatabaseBackup;
use App\Models\DatabaseBackup;
use App\Models\FactorySubscription;
use App\Notifications\SubscriptionExpiringSoon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('subscriptions:enforce', function () {
    FactorySubscription::with('factory')->whereIn('status', ['trial', 'active', 'past_due'])->get()->each(function ($subscription) {
        $deadline = $subscription->grace_ends_at ?? $subscription->ends_at;
        if ($deadline->isPast()) {
            $subscription->update(['status' => 'expired', 'suspended_at' => now()]);
            $subscription->factory?->update(['status' => 'suspended']);
        }
    });
})->purpose('Suspend factories whose subscriptions have expired');

Artisan::command('subscriptions:notify-expiring', function () {
    $window = now()->addDays(5)->endOfDay();
    FactorySubscription::with(['factory', 'plan'])
        ->whereIn('status', ['trial', 'active', 'past_due'])
        ->whereNull('expiry_reminder_sent_at')
        ->whereNotNull('ends_at')
        ->where('ends_at', '<=', $window)
        ->where('ends_at', '>', now())
        ->get()
        ->each(function (FactorySubscription $subscription) {
            $owners = \App\Models\User::whereHas('factories', fn ($query) => $query->where('factories.id', $subscription->factory_id)->where('factory_user.is_owner', true))->get();
            if ($owners->isNotEmpty()) {
                Notification::send($owners, new SubscriptionExpiringSoon($subscription));
            }
            $subscription->update(['expiry_reminder_sent_at' => now()]);
        });
})->purpose('Warn factory owners 5 days before their subscription ends');

Artisan::command('database:backup', function () {
    $backup = DatabaseBackup::create(['status' => 'pending']);
    CreateDatabaseBackup::dispatch($backup->id);
    $this->info('Database backup queued.');
})->purpose('Queue a secure database backup');

Schedule::command('subscriptions:enforce')->hourly()->withoutOverlapping();
Schedule::command('subscriptions:notify-expiring')->dailyAt('08:00')->withoutOverlapping();
Schedule::command('database:backup')->dailyAt('02:00')->withoutOverlapping();
