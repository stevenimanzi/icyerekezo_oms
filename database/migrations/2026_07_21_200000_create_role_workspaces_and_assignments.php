<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('dashboard_key', 60)->default('operations')->after('slug');
        });
        Schema::create('workstations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 40);
            $table->string('type', 60);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('employee_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('workstation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('employee_number', 50);
            $table->string('job_title')->nullable();
            $table->json('skills')->nullable();
            $table->string('employment_status')->default('active');
            $table->date('hired_at')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'user_id']);
            $table->unique(['factory_id', 'employee_number']);
        });
        Schema::create('work_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workstation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('assignment_type', 60)->index();
            $table->nullableMorphs('assignable');
            $table->string('title');
            $table->text('instructions')->nullable();
            $table->string('priority', 20)->default('normal');
            $table->string('status', 30)->default('assigned')->index();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('due_at')->nullable()->index();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['factory_id', 'user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_assignments');
        Schema::dropIfExists('employee_profiles');
        Schema::dropIfExists('workstations');
        Schema::table('roles', fn (Blueprint $table) => $table->dropColumn('dashboard_key'));
    }
};
