<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Additional industries a factory operates beyond its primary industry_type
        // (for example a dairy that also makes other foods). Null means "primary only".
        Schema::table('factories', function (Blueprint $table) {
            $table->json('industry_profiles')->nullable()->after('industry_type');
        });
    }

    public function down(): void
    {
        Schema::table('factories', function (Blueprint $table) {
            $table->dropColumn('industry_profiles');
        });
    }
};
