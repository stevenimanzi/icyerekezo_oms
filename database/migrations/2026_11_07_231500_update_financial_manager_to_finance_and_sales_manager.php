<?php

use App\Models\Factory;
use App\Models\Permission;
use App\Models\Role;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        PermissionCatalog::seed();

        Role::where('slug', 'financial-manager')->update([
            'name' => 'Finance & Sales Manager',
        ]);

        $patterns = [
            'finance.*',
            'sales.*',
            'products.view',
            'inventory.view',
            'reports.view',
            'reports.export',
        ];

        $permissionIds = Permission::where(function ($builder) use ($patterns) {
            foreach ($patterns as $pattern) {
                if ($pattern === '*') {
                    $builder->orWhereNotNull('id');
                } elseif (str_contains($pattern, '*')) {
                    $builder->orWhere('slug', 'like', str_replace('*', '%', $pattern));
                } else {
                    $builder->orWhere('slug', $pattern);
                }
            }
        })->pluck('id');

        Role::where('slug', 'financial-manager')->each(function (Role $role) use ($permissionIds) {
            $role->permissions()->syncWithoutDetaching($permissionIds);
        });

        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
    }
};
