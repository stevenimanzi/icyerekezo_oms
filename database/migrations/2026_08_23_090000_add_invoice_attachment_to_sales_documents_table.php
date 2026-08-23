<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_documents', function (Blueprint $table) {
            $table->string('invoice_path')->nullable()->after('due_date');
            $table->string('invoice_original_name')->nullable()->after('invoice_path');
            $table->timestamp('invoice_uploaded_at')->nullable()->after('invoice_original_name');
            $table->foreignId('invoice_uploaded_by')->nullable()->after('invoice_uploaded_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invoice_uploaded_by');
            $table->dropColumn(['invoice_path', 'invoice_original_name', 'invoice_uploaded_at']);
        });
    }
};
