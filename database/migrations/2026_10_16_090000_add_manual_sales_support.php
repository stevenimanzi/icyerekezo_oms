<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_document_lines', function (Blueprint $table) {
            $table->string('class_level', 30)->nullable()->change();
            $table->string('garment_category', 60)->nullable()->change();
            $table->decimal('unit_price', 14, 2)->default(0)->after('quantity_rejected');
            $table->decimal('line_total', 14, 2)->default(0)->after('unit_price');
        });

        Schema::table('sales_documents', function (Blueprint $table) {
            $table->string('customer_phone', 40)->nullable()->after('customer_email');
            $table->decimal('discount_amount', 14, 2)->default(0)->after('total_amount');
            $table->text('notes')->nullable();
            $table->string('source', 20)->default('school_portal')->after('document_type');
            $table->string('cancel_reason')->nullable();
        });

        Schema::create('sales_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_document_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('method', 30);
            $table->string('reference')->nullable();
            $table->date('paid_on');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['factory_id', 'paid_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_payments');

        Schema::table('sales_documents', function (Blueprint $table) {
            $table->dropColumn(['customer_phone', 'discount_amount', 'notes', 'source', 'cancel_reason']);
        });

        Schema::table('sales_document_lines', function (Blueprint $table) {
            $table->dropColumn(['unit_price', 'line_total']);
        });
    }
};
