<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use App\Support\Notifications\FactoryNotifier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

#[
    Fillable([
        'factory_id',
        'user_id',
        'event',
        'auditable_type',
        'auditable_id',
        'description',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'request_id',
    ]),
]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['old_values' => 'array', 'new_values' => 'array', 'created_at' => 'datetime'];
    }

    /** Every recorded change is also told to the people who work in that factory (with a sound in the app). */
    protected static function booted(): void
    {
        static::created(function (self $log) {
            $event = (string) $log->event;
            if (! $log->factory_id || str_starts_with($event, 'platform.') || str_starts_with($event, 'auth.')) {
                return;
            }

            try {
                $title = Str::of($event)->replace(['_', '.'], ' ')->lower()->ucfirst()->toString();
                $who = $log->user_id ? User::whereKey($log->user_id)->value('name') : null;
                FactoryNotifier::notifyEveryone(
                    (int) $log->factory_id,
                    $title,
                    trim(($log->description ?: $title) . ($who ? " (by {$who})" : '')),
                    null,
                    'activity',
                    $log->user_id ? (int) $log->user_id : null,
                );
            } catch (\Throwable $e) {
                report($e);
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function factory()
    {
        return $this->belongsTo(Factory::class);
    }

    public static function record(
        string $event,
        string $description,
        ?Model $subject = null,
        array $old = [],
        array $new = [],
    ): self {
        $request = request();

        return self::create([
            'factory_id' => auth()->user()?->current_factory_id,
            'user_id' => auth()->id(),
            'event' => $event,
            'auditable_type' => $subject?->getMorphClass(),
            'auditable_id' => $subject?->getKey(),
            'description' => $description,
            'old_values' => $old ?: null,
            'new_values' => $new ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'request_id' => $request?->header('X-Request-ID'),
        ]);
    }
}
