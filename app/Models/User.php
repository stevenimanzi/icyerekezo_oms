<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['current_factory_id', 'name', 'email', 'locale', 'timezone', 'password', 'last_login_at', 'last_login_ip', 'is_platform_admin', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_login_at' => 'datetime',
            'is_platform_admin' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function currentFactory(): BelongsTo
    {
        return $this->belongsTo(Factory::class, 'current_factory_id');
    }

    public function factories(): BelongsToMany
    {
        return $this->belongsToMany(Factory::class)->withPivot(['job_title', 'is_owner', 'is_active', 'joined_at'])->withTimestamps();
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)->withPivot('factory_id')->withTimestamps();
    }

    public function hasPermission(string $permission, ?int $factoryId = null): bool
    {
        if ($this->is_platform_admin) {
            return true;
        }
        $factoryId ??= $this->current_factory_id;

        return $this->roles()->wherePivot('factory_id', $factoryId)->whereHas('permissions', fn ($query) => $query->where('slug', $permission))->exists();
    }
}
