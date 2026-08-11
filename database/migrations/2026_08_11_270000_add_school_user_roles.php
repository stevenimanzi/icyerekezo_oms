<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
 public function up():void { $permissionIds=DB::table('permissions')->whereIn('slug',['sales.view','sales.create'])->pluck('id'); DB::table('factories')->pluck('id')->each(function($factoryId)use($permissionIds){$roleId=DB::table('roles')->where(['factory_id'=>$factoryId,'slug'=>'school-user'])->value('id')??DB::table('roles')->insertGetId(['factory_id'=>$factoryId,'name'=>'School User','slug'=>'school-user','dashboard_key'=>'school','is_system'=>true,'created_at'=>now(),'updated_at'=>now()]);foreach($permissionIds as $permissionId)DB::table('permission_role')->insertOrIgnore(['role_id'=>$roleId,'permission_id'=>$permissionId]);}); }
 public function down():void { DB::table('roles')->where('slug','school-user')->delete(); }
};
