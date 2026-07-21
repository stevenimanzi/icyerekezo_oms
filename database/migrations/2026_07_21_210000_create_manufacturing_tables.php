<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bills_of_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('version', 40);
            $table->decimal('output_quantity', 20, 6)->default(1);
            $table->decimal('expected_waste_percent', 7, 4)->default(0);
            $table->string('status', 20)->default('draft')->index();
            $table->date('effective_from')->nullable();
            $table->date('effective_until')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'item_id', 'version']);
        });
        Schema::create('bill_of_material_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_of_material_id')->constrained('bills_of_materials')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->foreignId('unit_id')->constrained('units');
            $table->decimal('quantity', 20, 6);
            $table->decimal('waste_percent', 7, 4)->default(0);
            $table->foreignId('substitute_item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->boolean('is_optional')->default(false);
            $table->timestamps();
            $table->unique(['bill_of_material_id', 'item_id']);
        });
        Schema::create('workflow_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 40);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('draft')->index();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->unique(['factory_id', 'code']);
        });
        Schema::create('workflow_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_template_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('workstation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 40);
            $table->unsignedSmallInteger('sequence');
            $table->unsignedInteger('expected_minutes')->default(0);
            $table->unsignedSmallInteger('required_workers')->default(1);
            $table->boolean('quality_required')->default(false);
            $table->boolean('approval_required')->default(false);
            $table->json('instructions')->nullable();
            $table->timestamps();
            $table->unique(['workflow_template_id', 'sequence']);
        });
        Schema::create('production_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('order_number', 60);
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->foreignId('bill_of_material_id')->constrained('bills_of_materials')->restrictOnDelete();
            $table->foreignId('workflow_template_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('planned_quantity', 20, 6);
            $table->decimal('completed_quantity', 20, 6)->default(0);
            $table->decimal('rejected_quantity', 20, 6)->default(0);
            $table->decimal('waste_quantity', 20, 6)->default(0);
            $table->string('status', 30)->default('draft')->index();
            $table->date('planned_start')->nullable();
            $table->date('planned_end')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['factory_id', 'order_number']);
        });
        Schema::create('production_stage_executions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('production_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workflow_stage_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('not_started')->index();
            $table->decimal('input_quantity', 20, 6)->default(0);
            $table->decimal('output_quantity', 20, 6)->default(0);
            $table->decimal('waste_quantity', 20, 6)->default(0);
            $table->decimal('rejected_quantity', 20, 6)->default(0);
            $table->unsignedInteger('downtime_minutes')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['production_order_id', 'workflow_stage_id'], 'production_order_stage_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_stage_executions');
        Schema::dropIfExists('production_orders');
        Schema::dropIfExists('workflow_stages');
        Schema::dropIfExists('workflow_templates');
        Schema::dropIfExists('bill_of_material_items');
        Schema::dropIfExists('bills_of_materials');
    }
};
