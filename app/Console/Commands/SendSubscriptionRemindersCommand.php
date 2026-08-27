<?php

namespace App\Console\Commands;

use App\Models\FactorySubscription;
use App\Models\User;
use App\Mail\SubscriptionEndingMail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendSubscriptionRemindersCommand extends Command
{
    protected $signature = 'subscriptions:remind';
    protected $description = 'Send 5-day reminder emails for expiring factory subscriptions';

    public function handle()
    {
        $subscriptions = FactorySubscription::where('status', 'active')
            ->whereDate('ends_at', '=', today()->addDays(5))
            ->whereNull('reminder_sent_at')
            ->with('factory')
            ->get();

        foreach ($subscriptions as $subscription) {
            $owner = User::whereHas('factories', function ($query) use ($subscription) {
                $query->where('factories.id', $subscription->factory_id)
                      ->where('factory_user.is_owner', true);
            })->first();

            if ($owner) {
                Mail::to($owner->email)->send(new SubscriptionEndingMail($subscription));
                $subscription->update(['reminder_sent_at' => now()]);
                $this->info("Sent reminder for factory: {$subscription->factory->name}");
            }
        }
    }
}
