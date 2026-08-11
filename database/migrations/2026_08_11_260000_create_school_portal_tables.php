<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', fn (Blueprint $table) => $table->foreignId('school_id')->nullable()->after('current_factory_id')->constrained()->nullOnDelete());
        Schema::create('school_payment_submissions', function (Blueprint $table) {
            $table->id(); $table->foreignId('factory_id')->constrained()->cascadeOnDelete(); $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_document_id')->constrained()->cascadeOnDelete(); $table->decimal('amount', 20, 2); $table->string('payment_method', 40);
            $table->string('proof_path')->nullable(); $table->string('status', 30)->default('pending'); $table->text('review_note')->nullable(); $table->timestamps();
        });
        Schema::create('school_returns', function (Blueprint $table) {
            $table->id(); $table->foreignId('factory_id')->constrained()->cascadeOnDelete(); $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_document_id')->constrained()->cascadeOnDelete(); $table->foreignId('sales_document_line_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity'); $table->string('reason', 80); $table->string('status', 30)->default('pending'); $table->text('factory_feedback')->nullable(); $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('school_returns'); Schema::dropIfExists('school_payment_submissions'); Schema::table('users', fn (Blueprint $table) => $table->dropConstrainedForeignId('school_id')); }
};
