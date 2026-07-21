<?php

use App\Models\SubscriptionPlan;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $plans = [
            [
                'name' => 'Starter',
                'code' => 'STARTER',
                'monthly_price' => 100000,
                'limits' => ['users' => 10, 'branches' => 1, 'warehouses' => 2, 'monthly_orders' => 500, 'storage_gb' => 5],
                'features' => ['Core factory operations', 'Inventory management', 'Basic reports', 'Email support'],
            ],
            [
                'name' => 'Professional',
                'code' => 'PROFESSIONAL',
                'monthly_price' => 200000,
                'limits' => ['users' => 50, 'branches' => 5, 'warehouses' => 10, 'monthly_orders' => 5000, 'storage_gb' => 25],
                'features' => ['All Starter features', 'Advanced reports', 'Data exports', 'Priority support'],
            ],
            [
                'name' => 'Enterprise',
                'code' => 'ENTERPRISE',
                'monthly_price' => 300000,
                'limits' => ['users' => 250, 'branches' => 25, 'warehouses' => 50, 'monthly_orders' => 50000, 'storage_gb' => 100],
                'features' => ['All Professional features', 'API and integrations', 'Enterprise analytics', 'Dedicated support'],
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(
                ['code' => $plan['code']],
                $plan + ['currency_code' => 'RWF', 'is_active' => true],
            );
        }
    }

    public function down(): void
    {
        SubscriptionPlan::whereIn('code', ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'])->delete();
    }
};
