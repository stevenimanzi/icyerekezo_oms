<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const SLUGS = ['users.view', 'users.create', 'users.update'];

    public function up(): void
    {
        $roleIds = DB::table('roles')->where('slug', 'factory-owner')->pluck('id');
        $permissionIds = DB::table('permissions')->whereIn('slug', self::SLUGS)->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                $exists = DB::table('permission_role')->where('role_id', $roleId)->where('permission_id', $permissionId)->exists();

                if (! $exists) {
                    DB::table('permission_role')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
                }
            }
        }
    }

    public function down(): void
    {
        $roleIds = DB::table('roles')->where('slug', 'factory-owner')->pluck('id');
        $permissionIds = DB::table('permissions')->whereIn('slug', self::SLUGS)->pluck('id');

        DB::table('permission_role')->whereIn('role_id', $roleIds)->whereIn('permission_id', $permissionIds)->delete();
    }
};
