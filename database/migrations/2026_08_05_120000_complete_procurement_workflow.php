<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_documents', function (Blueprint $table) {
            $table->text('purpose')->nullable()->after('status');
            $table->string('payment_status', 30)->default('unpaid')->after('total_amount');
            $table->decimal('paid_amount', 20, 2)->default(0)->after('payment_status');
            $table->timestamp('ordered_at')->nullable()->after('received_at');
            $table->timestamp('cancelled_at')->nullable()->after('ordered_at');
        });

        Schema::create('purchase_document_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->text('description')->nullable();
            $table->decimal('quantity', 20, 6);
            $table->decimal('unit_price', 20, 4)->default(0);
            $table->decimal('received_quantity', 20, 6)->default(0);
            $table->decimal('line_total', 20, 2)->default(0);
            $table->timestamps();
            $table->unique(['purchase_document_id', 'item_id']);
        });

        Schema::create('procurement_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_document_id')->constrained()->cascadeOnDelete();
            $table->string('payment_number', 60);
            $table->decimal('amount', 20, 2);
            $table->string('method', 30);
            $table->string('reference')->nullable();
            $table->date('paid_on');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['factory_id', 'payment_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_payments');
        Schema::dropIfExists('purchase_document_lines');
        Schema::table('purchase_documents', function (Blueprint $table) {
            $table->dropColumn(['purpose', 'payment_status', 'paid_amount', 'ordered_at', 'cancelled_at']);
        });
    }
};
