<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->string('production_stage', 20)->nullable()->index()->after('status');
            $table->string('qc_status', 20)->nullable()->index()->after('production_stage');
        });

        Schema::table('quality_inspections', function (Blueprint $table) {
            $table->foreignId('batch_id')->nullable()->after('item_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quality_inspections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('batch_id');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn(['production_stage', 'qc_status']);
        });
    }
};
