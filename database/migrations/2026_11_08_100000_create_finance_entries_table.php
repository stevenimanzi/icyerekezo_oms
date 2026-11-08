<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Money movements that are not already recorded elsewhere: factory expenses, staff pay
     * and other income. Sales collections and supplier payments stay in their own tables and are
     * merged with these rows when the cash book is built.
     */
    public function up(): void
    {
        if (Schema::hasTable('finance_entries')) {
            return;
        }

        Schema::create('finance_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factory_id')->constrained()->cascadeOnDelete();
            $table->string('entry_number', 40);
            $table->string('direction', 3); // in = money received, out = money spent
            $table->string('category', 40);
            $table->string('description', 255);
            $table->string('party', 160)->nullable(); // who was paid, or who paid us
            $table->foreignId('employee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('period', 7)->nullable(); // pay month, YYYY-MM
            $table->decimal('amount', 14, 2);
            $table->string('method', 30);
            $table->string('reference', 120)->nullable();
            $table->date('entry_date');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('void_reason', 255)->nullable();
            $table->timestamps();

            $table->unique(['factory_id', 'entry_number']);
            $table->index(['factory_id', 'entry_date']);
            $table->index(['factory_id', 'direction', 'category']);
            $table->index(['factory_id', 'employee_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_entries');
    }
};
