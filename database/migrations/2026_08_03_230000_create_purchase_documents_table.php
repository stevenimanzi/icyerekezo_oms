<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 30)->index();
            $table->string('document_number', 60);
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 30)->default('draft')->index();
            $table->string('currency_code', 3)->default('RWF');
            $table->decimal('total_amount', 20, 2)->default(0);
            $table->unsignedInteger('line_count')->default(0);
            $table->date('document_date');
            $table->date('expected_date')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['factory_id', 'document_type', 'document_number'], 'factory_purchase_document_unique');
            $table->index(['factory_id', 'document_date']);
        });
    }

    public function down(): void { Schema::dropIfExists('purchase_documents'); }
};
