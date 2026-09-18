<?php

use App\Models\Factory;
use App\Support\PermissionCatalog;
use App\Support\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Packing (Packaging Operator) and delivery (Logistics Officer) used to share the
        // sales.fulfill permission, letting Logistics edit packed/delivered quantities
        // directly. Packing now gets its own sales.pack permission, and Logistics loses
        // sales.fulfill — it delivers only through logistics.deliver, and only up to what
        // has actually been packed.
        PermissionCatalog::seed();
        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
        //
    }
};
