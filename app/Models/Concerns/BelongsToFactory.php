<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait BelongsToFactory
{
    protected static function bootBelongsToFactory(): void
    {
        static::addGlobalScope('factory', function (Builder $query) {
            if ($factoryId = auth()->user()?->current_factory_id) {
                $query->where($query->qualifyColumn('factory_id'), $factoryId);
            }
        });
        static::creating(function ($model) {
            $model->factory_id ??= auth()->user()?->current_factory_id;
        });
    }
}
