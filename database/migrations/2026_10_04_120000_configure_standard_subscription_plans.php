<?php

use App\Models\SubscriptionPlan;
use App\Support\Catalogs\SubscriptionFeatureCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $starterFeatures = ['dashboard', 'production', 'inventory', 'products', 'team', 'reports', 'support'];
        $professionalFeatures = [...$starterFeatures, 'procurement', 'quality', 'sales'];
        $enterpriseFeatures = SubscriptionFeatureCatalog::keys();

        // 1. Starter Plan (100,000 RWF / month)
        SubscriptionPlan::updateOrCreate(
            ['code' => 'STARTER'],
            [
                'name' => 'Starter Plan',
                'monthly_price' => 100000,
                'currency_code' => 'RWF',
                'features' => $starterFeatures,
                'is_active' => true,
                'limits' => ['users' => 10, 'branches' => 1, 'warehouses' => 2, 'monthly_orders' => 500, 'storage_gb' => 5],
            ]
        );

        // 2. Professional Plan (200,000 RWF / month)
        SubscriptionPlan::updateOrCreate(
            ['code' => 'PROFESSIONAL'],
            [
                'name' => 'Professional Plan',
                'monthly_price' => 200000,
                'currency_code' => 'RWF',
                'features' => $professionalFeatures,
                'is_active' => true,
                'limits' => ['users' => 50, 'branches' => 5, 'warehouses' => 10, 'monthly_orders' => 5000, 'storage_gb' => 25],
            ]
        );

        // 3. Unlimited Enterprise (300,000 RWF / month)
        $enterprise = SubscriptionPlan::where('code', 'UNLIMITED-ENT')->orWhere('code', 'ENTERPRISE')->first();
        if ($enterprise) {
            $enterprise->update([
                'name' => 'Unlimited Enterprise',
                'monthly_price' => 300000,
                'currency_code' => 'RWF',
                'features' => $enterpriseFeatures,
                'is_active' => true,
            ]);
        } else {
            SubscriptionPlan::create([
                'name' => 'Unlimited Enterprise',
                'code' => 'UNLIMITED-ENT',
                'monthly_price' => 300000,
                'currency_code' => 'RWF',
                'features' => $enterpriseFeatures,
                'is_active' => true,
                'limits' => ['users' => 250, 'branches' => 25, 'warehouses' => 50, 'monthly_orders' => 50000, 'storage_gb' => 100],
            ]);
        }
    }

    public function down(): void
    {
    }
};
