<?php

use App\Models\Factory;
use App\Support\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLE_SLUGS = [
        'sewing-operator',
        'mixing-operator',
        'processing-operator',
        'bottling-operator',
        'packaging-operator',
    ];

    public function up(): void
    {
        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
        DB::table('roles')->whereIn('slug', self::ROLE_SLUGS)->delete();
    }
};
