<?php

namespace App\Console\Commands;

use App\Models\FactorySubscription;
use App\Models\User;
use App\Notifications\SubscriptionExpiringSoon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class SendSubscriptionRemindersCommand extends Command
{
    protected $signature = 'subscriptions:remind';
    protected $description = 'Send 5-day reminder emails for expiring factory subscriptions';

    public function handle()
    {
        $subscriptions = FactorySubscription::whereIn('status', ['active', 'trial'])
            ->whereDate('ends_at', '<=', today()->addDays(5))
            ->whereNull('expiry_reminder_sent_at')
            ->with('factory')
            ->get();

        foreach ($subscriptions as $subscription) {
            $owner = User::whereHas('factories', function ($query) use ($subscription) {
                $query->where('factories.id', $subscription->factory_id)
                      ->where('factory_user.is_owner', true);
            })->first();

            if ($owner) {
                $owner->notify(new SubscriptionExpiringSoon($subscription));
            }

            // Always send an additional explicit copy to info@noguchi.rw as requested
            Notification::route('mail', 'info@noguchi.rw')->notify(new SubscriptionExpiringSoon($subscription));

            $subscription->update(['expiry_reminder_sent_at' => now()]);
            $this->info("Sent reminder for factory: {$subscription->factory->name}");
        }
    }
}
