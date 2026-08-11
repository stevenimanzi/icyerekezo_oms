<?php

use App\Models\Factory;
use App\Support\PermissionCatalog;
use App\Support\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLE_SLUGS = [
        'production-planner',
        'production-supervisor',
        'sewing-operator',
        'mixing-operator',
        'processing-operator',
        'bottling-operator',
        'packaging-operator',
        'maintenance-technician',
        'quality-manager',
        'hr-officer',
        'health-safety-officer',
        'internal-auditor',
    ];

    public function up(): void
    {
        PermissionCatalog::seed();
        Factory::query()->each(fn (Factory $factory) => RoleTemplateCatalog::createFor($factory));
    }

    public function down(): void
    {
        DB::table('roles')->whereIn('slug', self::ROLE_SLUGS)->delete();
        DB::table('permissions')->whereIn('module', ['hr', 'safety'])->delete();
    }
};
