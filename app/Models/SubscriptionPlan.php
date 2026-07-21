<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'code', 'monthly_price', 'currency_code', 'limits', 'features', 'is_active'])]
class SubscriptionPlan extends Model
{
    protected function casts(): array
    {
        return ['limits' => 'array', 'features' => 'array', 'is_active' => 'boolean'];
    }
}
