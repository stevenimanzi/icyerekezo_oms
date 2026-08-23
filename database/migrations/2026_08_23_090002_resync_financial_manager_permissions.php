<?php

use App\Models\Factory;
use App\Support\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Invoice upload belongs to the sales/school-order side, not finance — re-sync so
        // financial-manager no longer carries the finance.invoice permission granted earlier.
        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
        //
    }
};
