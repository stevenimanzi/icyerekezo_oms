<?php

namespace App\Notifications;

use App\Models\FactorySubscription;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SubscriptionExpiringSoon extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public FactorySubscription $subscription) {}

    public function via(mixed $notifiable): array
    {
        return ['database', 'mail', WebPushChannel::class];
    }

    public function toDatabase(mixed $notifiable): array
    {
        return [
            'title' => 'Subscription expiring soon',
            'body' => "Your factory's subscription for {$this->subscription->factory?->name} ends on {$this->subscription->ends_at->format('M j, Y')}. Renew to avoid losing access.",
            'url' => '/executive/settings',
            'category' => 'subscription',
        ];
    }

    public function toWebPush(mixed $notifiable): array
    {
        return [
            'title' => 'Subscription expiring soon',
            'body' => "Renew before {$this->subscription->ends_at->format('M j, Y')} to keep access to {$this->subscription->factory?->name}.",
            'url' => '/executive/settings',
            'category' => 'subscription',
        ];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $daysLeft = max(0, now()->diffInDays($this->subscription->ends_at, false));

        return (new MailMessage)
            ->subject('Your ICYEREKEZO OMS subscription expires in '.$daysLeft.' days')
            ->view('emails.subscription-expiring', [
                'recipientName' => $notifiable->name,
                'factoryName' => $this->subscription->factory?->name ?? 'your factory',
                'endsAt' => $this->subscription->ends_at,
                'daysLeft' => $daysLeft,
                'planName' => $this->subscription->plan?->name ?? 'your plan',
            ]);
    }
}
