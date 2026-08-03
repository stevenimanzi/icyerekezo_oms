<?php

namespace App\Support;

use App\Models\Factory;
use App\Models\Permission;
use App\Models\Role;

final class RoleTemplateCatalog
{
    public const FACTORY_OWNER_PERMISSIONS = [
        'factory.view', 'procurement.view', 'inventory.view', 'products.view',
        'production.view', 'quality.view', 'sales.view', 'finance.view',
        'logistics.view', 'maintenance.view', 'reports.view', 'reports.export',
        'audit.view',
    ];

    public static function ownerPermissionIds()
    {
        return Permission::whereIn('slug', self::FACTORY_OWNER_PERMISSIONS)->pluck('id');
    }

    public const TEMPLATES = [
        'factory-administrator' => ['Factory Administrator', 'executive', ['*']],
        'factory-manager' => ['Factory Manager', 'executive', ['factory.*', 'users.*', 'production.view', 'production.plan', 'reports.*', 'audit.view']],
        'production-manager' => ['Production Manager', 'production', ['production.*', 'products.view', 'inventory.view', 'quality.view', 'maintenance.view', 'reports.view']],
        'warehouse-keeper' => ['Warehouse Keeper', 'warehouse', ['inventory.*', 'products.view', 'procurement.view', 'procurement.receive']],
        'procurement-officer' => ['Procurement Officer', 'procurement', ['procurement.*', 'inventory.view', 'products.view', 'reports.view']],
        'quality-officer' => ['Quality Control Officer', 'quality', ['quality.*', 'inventory.view', 'products.view', 'production.view', 'reports.view']],
        'cutting-operator' => ['Cutting Operator', 'cutting', ['production.view', 'production.execute', 'inventory.view', 'inventory.issue', 'quality.view']],
        'machine-operator' => ['Machine Operator', 'workstation', ['production.view', 'production.execute', 'quality.view', 'maintenance.view', 'maintenance.create']],
        'logistics-officer' => ['Logistics Officer', 'logistics', ['logistics.*', 'sales.view', 'sales.fulfill', 'inventory.view', 'inventory.issue']],
        'sales-officer' => ['Sales Officer', 'sales', ['sales.*', 'products.view', 'inventory.view', 'reports.view']],
        'accountant' => ['Accountant', 'finance', ['finance.*', 'sales.view', 'procurement.view', 'reports.*']],
    ];

    public static function createFor(Factory $factory): void
    {
        foreach (self::TEMPLATES as $slug => [$name, $dashboard, $patterns]) {
            $role = Role::firstOrCreate(['factory_id' => $factory->id, 'slug' => $slug], ['name' => $name, 'dashboard_key' => $dashboard, 'is_system' => true]);
            $query = Permission::query();
            $query->where(function ($builder) use ($patterns) {
                foreach ($patterns as $pattern) {
                    $pattern === '*' ? $builder->orWhereNotNull('id') : ($pattern === rtrim($pattern, '*') ? $builder->orWhere('slug', $pattern) : $builder->orWhere('slug', 'like', str_replace('*', '%', $pattern)));
                }
            });
            $role->permissions()->sync($query->pluck('id'));
        }
    }
}
