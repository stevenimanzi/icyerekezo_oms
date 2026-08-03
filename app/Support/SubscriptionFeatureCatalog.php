<?php

namespace App\Support;

class SubscriptionFeatureCatalog
{
    public static function all(): array
    {
        return [
            'dashboard' => 'Operations dashboard',
            'production' => 'Production and workflows',
            'inventory' => 'Inventory and warehouses',
            'products' => 'Products and bills of materials',
            'procurement' => 'Procurement',
            'quality' => 'Quality control',
            'sales' => 'Sales and orders',
            'logistics' => 'Logistics',
            'team' => 'Team and shifts',
            'maintenance' => 'Machines and maintenance',
            'reports' => 'Reports and exports',
            'support' => 'Help and support',
        ];
    }

    public static function keys(): array
    {
        return array_keys(self::all());
    }
}
