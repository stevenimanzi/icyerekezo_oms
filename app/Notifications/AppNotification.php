<?php

namespace App\Notifications;

use App\Notifications\Channels\WebPushChannel;
use Illuminate\Notifications\Notification;

/** Saved at once (no queue worker needed); the browser push is sent right after the response. */
class AppNotification extends Notification
{
    public function __construct(
        public string $title,
        public string $body,
        public ?string $url = null,
        public string $category = 'general',
    ) {}

    public function via(mixed $notifiable): array
    {
        return ['database', WebPushChannel::class];
    }

    public function toDatabase(mixed $notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'category' => $this->category,
        ];
    }

    public function toWebPush(mixed $notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'category' => $this->category,
        ];
    }
}
