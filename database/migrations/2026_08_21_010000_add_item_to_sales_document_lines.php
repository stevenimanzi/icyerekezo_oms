<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_document_lines', function (Blueprint $table) {
            $table->foreignId('item_id')->nullable()->after('sales_document_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales_document_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('item_id');
        });
    }
};
