<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_handovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lot_id')->constrained('production_lots')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('quantity_received')->nullable();
            $table->string('status', 20)->default('sent');
            $table->string('note')->nullable();
            $table->string('receive_note')->nullable();
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->index(['factory_id', 'status']);
            $table->index('lot_id');
        });

        // Quality checks made before this existed already released their pieces into stock, so only new ones wait for a handover.
        Schema::table('quality_inspections', function (Blueprint $table) {
            $table->boolean('stock_released')->default(true)->after('rejected_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('quality_inspections', function (Blueprint $table) {
            $table->dropColumn('stock_released');
        });
        Schema::dropIfExists('stock_handovers');
    }
};
