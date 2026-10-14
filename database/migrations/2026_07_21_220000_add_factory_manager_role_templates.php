<?php

use App\Models\Factory;
use App\Models\Role;
use App\Support\Catalogs\PermissionCatalog;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        PermissionCatalog::seed();
        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
        Role::where('slug', 'factory-manager')->delete();
    }
};
