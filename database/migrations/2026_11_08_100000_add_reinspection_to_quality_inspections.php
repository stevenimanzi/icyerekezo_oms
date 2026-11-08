<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** A re-check looks again at pieces that failed before; the pieces that now pass are recorded as passed. */
    public function up(): void
    {
        if (! Schema::hasColumn('quality_inspections', 'is_reinspection')) {
            Schema::table('quality_inspections', function (Blueprint $table) {
                $table->boolean('is_reinspection')->default(false)->after('result');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quality_inspections', 'is_reinspection')) {
            Schema::table('quality_inspections', function (Blueprint $table) {
                $table->dropColumn('is_reinspection');
            });
        }
    }
};
