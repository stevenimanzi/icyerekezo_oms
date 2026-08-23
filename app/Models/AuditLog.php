<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'user_id', 'event', 'auditable_type', 'auditable_id', 'description', 'old_values', 'new_values', 'ip_address', 'user_agent', 'request_id'])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['old_values' => 'array', 'new_values' => 'array', 'created_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function factory()
    {
        return $this->belongsTo(Factory::class);
    }

    public static function record(string $event, string $description, ?Model $subject = null, array $old = [], array $new = []): self
    {
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
