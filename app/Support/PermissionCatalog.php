<?php

namespace App\Support;

use App\Models\Permission;

final class PermissionCatalog
{
    public const MODULES = [
        'factory' => ['view', 'manage'],
        'users' => ['view', 'create', 'update', 'deactivate', 'assign_roles'],
        'products' => ['view', 'create', 'update', 'approve'],
        'procurement' => ['view', 'create', 'approve', 'receive'],
        'inventory' => ['view', 'receive', 'issue', 'transfer', 'adjust', 'count'],
        'production' => ['view', 'plan', 'approve', 'execute', 'close'],
        'quality' => ['view', 'inspect', 'approve', 'reject'],
        'sales' => ['view', 'create', 'approve', 'fulfill'],
        'finance' => ['view', 'invoice', 'receive_payment', 'approve'],
        'logistics' => ['view', 'plan', 'dispatch', 'deliver'],
        'maintenance' => ['view', 'create', 'execute', 'close'],
        'reports' => ['view', 'export'],
        'audit' => ['view'],
    ];

    public static function seed(): void
    {
        foreach (self::MODULES as $module => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(
                    ['slug' => "$module.$action"],
                    ['name' => ucfirst($action).' '.ucfirst($module), 'module' => $module],
                );
            }
        }
    }
}
