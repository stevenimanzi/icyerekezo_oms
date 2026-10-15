<?php

namespace App\Models;

use App\Support\Catalogs\IndustryProfileCatalog;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['uuid', 'name', 'slug', 'industry_type', 'industry_profiles', 'email', 'phone', 'country_code', 'currency_code', 'timezone', 'default_locale', 'status', 'settings'])]
class Factory extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return ['settings' => 'array', 'industry_profiles' => 'array'];
    }

    public function profileKeys(): array
    {
        return IndustryProfileCatalog::normalize($this->industry_type, $this->industry_profiles ?? []);
    }

    public function features(): array
    {
        return IndustryProfileCatalog::resolve($this->profileKeys())['features'];
    }

    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->features(), true);
    }

    public function itemDefaults(): array
    {
        return IndustryProfileCatalog::resolve($this->profileKeys())['item_defaults'];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot(['job_title', 'is_owner', 'is_active', 'joined_at'])->withTimestamps();
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(FactorySubscription::class);
    }

    public function hasNoguchiSchoolOrders(): bool
    {
        return $this->industry_type === 'clothing_textiles'
            && Str::lower(trim($this->name)) === 'noguchi holdings ltd';
    }
}
