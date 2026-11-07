<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('production_targets')) {
            Schema::create('production_targets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
                $table->string('title');
                $table->string('product_name')->nullable();
                $table->string('stage')->default('finished'); // cutting, sewing, finishing, packing, finished
                $table->decimal('target_quantity', 14, 2);
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->string('period_type', 40)->default('weekly'); // daily, weekly, monthly, batch
                $table->string('status', 40)->default('active'); // active, completed, paused
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['factory_id', 'status']);
                $table->index(['factory_id', 'stage']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('production_targets');
    }
};
