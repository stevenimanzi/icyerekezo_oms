<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ROLES = [
        'warehouse-keeper', 'cutting-operator', 'sewing-operator', 'mixing-operator',
        'processing-operator', 'bottling-operator', 'packaging-operator', 'machine-operator',
    ];

    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('slug', 'reports.view')->value('id');
        if (! $permissionId) return;

        DB::table('roles')->whereIn('slug', self::ROLES)->pluck('id')->each(
            fn ($roleId) => DB::table('permission_role')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId])
        );
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('slug', 'reports.view')->value('id');
        if (! $permissionId) return;

        DB::table('permission_role')->where('permission_id', $permissionId)
            ->whereIn('role_id', DB::table('roles')->whereIn('slug', self::ROLES)->select('id'))->delete();
    }
};
