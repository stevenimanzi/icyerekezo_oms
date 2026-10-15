<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('lot_number', 40);
            $table->foreignId('product_item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->foreignId('fabric_item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->string('style', 80)->nullable();
            $table->string('color', 80)->nullable();
            $table->string('size', 40)->nullable();
            $table->string('status', 20)->default('open');
            $table->string('hold_reason')->nullable();
            $table->timestamp('held_at')->nullable();
            $table->foreignId('held_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('cut_on');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['factory_id', 'lot_number']);
            $table->index(['factory_id', 'status']);
        });

        Schema::create('production_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lot_id')->nullable()->constrained('production_lots')->cascadeOnDelete();
            $table->string('stage', 20);
            $table->date('entry_date');
            $table->unsignedInteger('good_quantity')->default(0);
            $table->unsignedInteger('damaged_quantity')->default(0);
            $table->foreignId('fabric_item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->decimal('fabric_used', 14, 3)->default(0);
            $table->decimal('fabric_waste', 14, 3)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['factory_id', 'stage', 'entry_date']);
            $table->index(['lot_id', 'stage']);
        });

        Schema::create('production_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lot_id')->constrained('production_lots')->cascadeOnDelete();
            $table->string('from_stage', 20);
            $table->string('to_stage', 20);
            $table->unsignedInteger('quantity_sent');
            $table->unsignedInteger('quantity_received')->nullable();
            $table->string('status', 20)->default('sent');
            $table->string('note')->nullable();
            $table->string('receive_note')->nullable();
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->index(['factory_id', 'to_stage', 'status']);
            $table->index(['lot_id', 'from_stage']);
        });

        Schema::create('material_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('request_number', 30);
            $table->string('stage', 20);
            $table->foreignId('item_id')->constrained('items')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->decimal('quantity', 14, 3);
            $table->string('reason');
            $table->string('status', 20)->default('pending');
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note')->nullable();
            $table->timestamps();
            $table->unique(['factory_id', 'request_number']);
            $table->index(['factory_id', 'status']);
            $table->index(['factory_id', 'stage', 'item_id']);
        });

        Schema::table('quality_inspections', function (Blueprint $table) {
            $table->foreignId('lot_id')->nullable()->after('batch_id')->constrained('production_lots')->nullOnDelete();
            $table->string('stage', 20)->nullable()->after('lot_id');
            $table->index(['lot_id', 'stage']);
        });
    }

    public function down(): void
    {
        Schema::table('quality_inspections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('lot_id');
            $table->dropColumn('stage');
        });

        Schema::dropIfExists('material_requests');
        Schema::dropIfExists('production_transfers');
        Schema::dropIfExists('production_entries');
        Schema::dropIfExists('production_lots');
    }
};
