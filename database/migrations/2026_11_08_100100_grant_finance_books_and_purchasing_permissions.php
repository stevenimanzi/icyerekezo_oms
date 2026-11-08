<?php

use App\Models\Permission;
use App\Models\Role;
use App\Support\Catalogs\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * - finance.manage_books: record expenses, staff pay and other income, and void mistakes.
     * - procurement.request: ask for materials to be bought without being able to order or approve.
     *
     * Permissions are only added to the roles below; nothing is removed from anyone.
     */
    public function up(): void
    {
        PermissionCatalog::seed();

        $grants = [
            'financial-manager' => [
                'finance.manage_books',
                'procurement.view',
                'procurement.create',
                'procurement.approve',
            ],
            'accountant' => ['finance.manage_books'],
            'warehouse-keeper' => ['procurement.request'],
        ];

        foreach ($grants as $slug => $permissions) {
            $ids = Permission::whereIn('slug', $permissions)->pluck('id');

            Role::where('slug', $slug)->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($ids));
        }
    }

    public function down(): void
    {
    }
};
