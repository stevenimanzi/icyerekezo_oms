<?php

use App\Models\Permission;
use App\Models\Role;
use App\Support\Catalogs\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /** products.set_price: change the price of an item without being able to record new items. */
    public function up(): void
    {
        PermissionCatalog::seed();

        $ids = Permission::where('slug', 'products.set_price')->pluck('id');

        Role::whereIn('slug', ['financial-manager', 'accountant'])->each(
            fn (Role $role) => $role->permissions()->syncWithoutDetaching($ids),
        );
    }

    public function down(): void
    {
    }
};
