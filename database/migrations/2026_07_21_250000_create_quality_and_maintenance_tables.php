<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quality_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('inspection_number', 60);
            $table->foreignId('production_order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('stage_execution_id')->nullable()->constrained('production_stage_executions')->nullOnDelete();
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('inspection_type', 40)->index();
            $table->decimal('sample_size', 20, 6)->default(0);
            $table->decimal('inspected_quantity', 20, 6)->default(0);
            $table->decimal('passed_quantity', 20, 6)->default(0);
            $table->decimal('rejected_quantity', 20, 6)->default(0);
            $table->string('result', 30)->default('pending')->index();
            $table->text('defect_details')->nullable();
            $table->text('corrective_action')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('inspector_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('inspected_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'inspection_number']);
        });
        Schema::create('machines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 50);
            $table->string('type', 80);
            $table->string('serial_number')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('model')->nullable();
            $table->string('status', 30)->default('operational')->index();
            $table->string('location')->nullable();
            $table->decimal('runtime_hours', 12, 2)->default(0);
            $table->date('installed_at')->nullable();
            $table->timestamp('next_maintenance_at')->nullable()->index();
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('machine_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reported_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('maintenance_type', 30)->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority', 20)->default('normal');
            $table->string('status', 30)->default('open')->index();
            $table->timestamp('scheduled_at')->nullable()->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('downtime_minutes')->default(0);
            $table->decimal('cost', 18, 2)->default(0);
            $table->text('resolution')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_records');
        Schema::dropIfExists('machines');
        Schema::dropIfExists('quality_inspections');
    }
};
