<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['uuid', 'name', 'slug', 'industry_type', 'email', 'phone', 'country_code', 'currency_code', 'timezone', 'default_locale', 'status', 'settings'])]
class Factory extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return ['settings' => 'array'];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot(['job_title', 'is_owner', 'is_active', 'joined_at'])->withTimestamps();
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function hasNoguchiSchoolOrders(): bool
    {
        return $this->industry_type === 'clothing_textiles'
            && Str::lower(trim($this->name)) === 'noguchi holdings ltd';
    }
}
