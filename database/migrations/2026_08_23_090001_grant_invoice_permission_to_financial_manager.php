<?php

use App\Models\Factory;
use App\Support\PermissionCatalog;
use App\Support\RoleTemplateCatalog;
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
        // Re-running createFor with the previous template list would require reverting the
        // catalog change first; nothing to safely undo here on its own.
    }
};
