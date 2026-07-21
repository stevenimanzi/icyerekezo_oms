<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['factory_id', 'subscription_plan_id', 'status', 'starts_at', 'ends_at', 'grace_ends_at', 'auto_renew', 'suspended_at'])]
class FactorySubscription extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'grace_ends_at' => 'datetime', 'suspended_at' => 'datetime', 'auto_renew' => 'boolean'];
    }

    public function factory()
    {
        return $this->belongsTo(Factory::class);
    }

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }
}
