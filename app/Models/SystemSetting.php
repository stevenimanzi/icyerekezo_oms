<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

#[Fillable(['key', 'value', 'type', 'is_public'])]
class SystemSetting extends Model
{
    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    public static function valueFor(string $key, mixed $default = null): mixed
    {
        if (! Schema::hasTable('system_settings')) {
            return $default;
        }
        $setting = static::where('key', $key)->first();
        if (! $setting) {
            return $default;
        }

        return match ($setting->type) {
            'boolean' => filter_var($setting->value, FILTER_VALIDATE_BOOLEAN), 'integer' => (int) $setting->value, 'json' => json_decode($setting->value, true), default => $setting->value
        };
    }
}
