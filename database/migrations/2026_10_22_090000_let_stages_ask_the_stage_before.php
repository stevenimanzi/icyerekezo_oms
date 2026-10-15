<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_requests', function (Blueprint $table) {
            $table->foreignId('item_id')->nullable()->change();
            $table->string('from_stage', 20)->nullable()->after('stage');
            $table->foreignId('lot_id')->nullable()->after('item_id')->constrained('production_lots')->nullOnDelete();
            $table->unsignedInteger('fulfilled_quantity')->default(0)->after('quantity');
            $table->index(['factory_id', 'from_stage', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('material_requests', function (Blueprint $table) {
            $table->dropIndex(['factory_id', 'from_stage', 'status']);
            $table->dropConstrainedForeignId('lot_id');
            $table->dropColumn(['from_stage', 'fulfilled_quantity']);
        });
    }
};
