<?php

use App\Models\Factory;
use App\Support\Catalogs\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (Factory::all() as $factory) {
            RoleTemplateCatalog::createFor($factory);
        }
    }

    public function down(): void {}
};
