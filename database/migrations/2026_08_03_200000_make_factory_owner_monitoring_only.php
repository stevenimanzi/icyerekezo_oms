<?php

use App\Support\RoleTemplateCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $roleIds = DB::table('roles')->where('slug', 'factory-owner')->pluck('id');
        $permissionIds = DB::table('permissions')->whereIn('slug', RoleTemplateCatalog::FACTORY_OWNER_PERMISSIONS)->pluck('id');
        DB::table('permission_role')->whereIn('role_id', $roleIds)->delete();
        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
            }
        }
    }

    public function down(): void
    {
        $roleIds = DB::table('roles')->where('slug', 'factory-owner')->pluck('id');
        $permissionIds = DB::table('permissions')->pluck('id');
        DB::table('permission_role')->whereIn('role_id', $roleIds)->delete();
        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
            }
        }
    }
};
