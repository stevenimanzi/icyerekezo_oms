<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safety_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('incident_date');
            $table->string('location', 160)->nullable();
            $table->text('description');
            $table->string('severity', 20)->default('minor');
            $table->string('injured_person', 160)->nullable();
            $table->string('status', 20)->default('reported');
            $table->text('resolution_note')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('safety_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inspector_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('area', 160);
            $table->date('inspection_date');
            $table->text('notes')->nullable();
            $table->string('result', 20)->default('pass');
            $table->timestamps();
        });

        Schema::create('ppe_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('equipment_name', 160);
            $table->date('issued_at');
            $table->string('condition', 20)->default('new');
            $table->date('returned_at')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('corrective_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('source_type', 20);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->text('description');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->string('status', 20)->default('open');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corrective_actions');
        Schema::dropIfExists('ppe_assignments');
        Schema::dropIfExists('safety_inspections');
        Schema::dropIfExists('safety_incidents');
    }
};
