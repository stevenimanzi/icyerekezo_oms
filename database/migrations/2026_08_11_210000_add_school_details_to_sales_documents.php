<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_documents', function (Blueprint $table) {
            $table->string('school_district', 80)->nullable()->after('customer_email')->index();
            $table->string('school_sector', 80)->nullable()->after('school_district')->index();
            $table->string('academic_year', 20)->nullable()->after('school_sector')->index();
        });
    }

    public function down(): void
    {
        Schema::table('sales_documents', fn (Blueprint $table) => $table->dropColumn(['school_district', 'school_sector', 'academic_year']));
    }
};
