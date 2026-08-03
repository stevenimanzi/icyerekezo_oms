<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 30)->index();
            $table->string('document_number', 60);
            $table->string('customer_name');
            $table->string('customer_email')->nullable();
            $table->string('status', 30)->default('draft')->index();
            $table->string('currency_code', 3)->default('RWF');
            $table->decimal('total_amount', 20, 2)->default(0);
            $table->decimal('paid_amount', 20, 2)->default(0);
            $table->unsignedInteger('item_count')->default(0);
            $table->date('document_date');
            $table->date('due_date')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['factory_id', 'document_type', 'document_number'], 'factory_sales_document_unique');
            $table->index(['factory_id', 'document_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_documents');
    }
};
