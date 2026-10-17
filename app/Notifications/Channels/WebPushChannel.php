<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushChannel
{
    public function send(mixed $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toWebPush')) {
            return;
        }
        $subscriptions = $notifiable->pushSubscriptions;
        if ($subscriptions->isEmpty()) {
            return;
        }
        $payload = $notification->toWebPush($notifiable);

        dispatch(function () use ($notifiable, $subscriptions, $payload) {
            try {
                $publicKey = config('webpush.vapid.public_key');
                $privateKey = config('webpush.vapid.private_key');
                if (! $publicKey || ! $privateKey) {
                    return;
                }
                $payload = json_encode($payload);
                $webPush = new WebPush([
                    'VAPID' => [
                        'subject' => config('webpush.vapid.subject'),
                        'publicKey' => $publicKey,
                        'privateKey' => $privateKey,
                    ],
                ]);
                foreach ($subscriptions as $subscription) {
                    $webPush->queueNotification(
                        Subscription::create([
                            'endpoint' => $subscription->endpoint,
                            'publicKey' => $subscription->public_key,
                            'authToken' => $subscription->auth_token,
                            'contentEncoding' => $subscription->content_encoding,
                        ]),
                        $payload,
                    );
                }
                foreach ($webPush->flush() as $report) {
                    if ($report->isSubscriptionExpired()) {
                        $notifiable->pushSubscriptions()->where('endpoint', $report->getEndpoint())->delete();
                    }
                }
            } catch (\Throwable $error) {
                report($error);
            }
        })->afterResponse();
    }
}
