<?php

use App\Models\Factory;
use App\Support\PermissionCatalog;
use App\Support\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        PermissionCatalog::seed();
        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
        DB::table('roles')->where('slug', 'financial-manager')->delete();
    }
};
