<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('registration_number', 40);
            $table->string('vehicle_type', 60);
            $table->string('driver_name')->nullable();
            $table->string('driver_phone', 40)->nullable();
            $table->string('status', 30)->default('available')->index();
            $table->decimal('capacity', 20, 3)->nullable();
            $table->string('capacity_unit', 20)->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'registration_number']);
        });

        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('shipment_number', 60);
            $table->foreignId('sales_document_id')->nullable()->constrained('sales_documents')->nullOnDelete();
            $table->foreignId('delivery_vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name');
            $table->string('destination');
            $table->string('status', 30)->default('planned')->index();
            $table->unsignedInteger('package_count')->default(0);
            $table->decimal('total_weight', 20, 3)->default(0);
            $table->string('weight_unit', 20)->default('kg');
            $table->timestamp('planned_dispatch_at')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->string('received_by')->nullable();
            $table->text('delivery_notes')->nullable();
            $table->string('proof_reference')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'shipment_number']);
            $table->index(['factory_id', 'planned_dispatch_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('delivery_vehicles');
    }
};
