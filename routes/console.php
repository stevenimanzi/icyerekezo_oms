<?php

use App\Jobs\CreateDatabaseBackup;
use App\Models\DatabaseBackup;
use App\Models\FactorySubscription;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
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

Artisan::command('database:backup', function () {
    $backup = DatabaseBackup::create(['status' => 'pending']);
    CreateDatabaseBackup::dispatch($backup->id);
    $this->info('Database backup queued.');
})->purpose('Queue a secure database backup');

Schedule::command('subscriptions:enforce')->hourly()->withoutOverlapping();
Schedule::command('database:backup')->dailyAt('02:00')->withoutOverlapping();
