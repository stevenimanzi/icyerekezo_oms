<?php

use App\Models\SubscriptionPlan;
use App\Support\SubscriptionFeatureCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $starter = ['dashboard', 'production', 'inventory', 'products', 'team', 'reports', 'support'];
        $professional = [...$starter, 'procurement', 'quality', 'sales', 'logistics', 'maintenance'];

        SubscriptionPlan::where('code', 'STARTER')->update(['features' => json_encode($starter)]);
        SubscriptionPlan::where('code', 'PROFESSIONAL')->update(['features' => json_encode($professional)]);
        SubscriptionPlan::where('code', 'ENTERPRISE')->update(['features' => json_encode(SubscriptionFeatureCatalog::keys())]);
    }

    public function down(): void
    {
        // Feature selections are intentionally preserved if this migration is rolled back.
    }
};
